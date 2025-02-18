import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { aws_lambda_nodejs as nodejs } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Tracing } from "aws-cdk-lib/aws-lambda";
import * as path from "path";

interface ApiProps extends cdk.NestedStackProps {
  stackName: string;
  approvedMessagesTableName: string;
  unapprovedMessagesTableName: string;
  hallucinationsTableName: string;
  promptStoreTableName: string;
  guardrailId: string;
  guardrailVersion: string;
  promptSwitchParameterName: string;
}

export class Api extends cdk.NestedStack {
  public readonly restApiEndpoint: string;
  public readonly graphQlApiEndpoint: string;
  public readonly appSyncApiKey: string;
  public readonly deadLetterQueueName: string;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id, props);

    // SQS FIFO Dead Letter Queue
    const deadLetterQueue = new sqs.Queue(this, "DeadLetterQueue", {
      queueName: "ChatModeration-DeadLetterQueue.fifo",
      fifo: true,
      contentBasedDeduplication: true,
      deduplicationScope: sqs.DeduplicationScope.MESSAGE_GROUP,
      fifoThroughputLimit: sqs.FifoThroughputLimit.PER_MESSAGE_GROUP_ID,
      retentionPeriod: cdk.Duration.days(14),
    });

    // SQS FIFO Queue
    const messageQueue = new sqs.Queue(this, "MessageQueue", {
      queueName: "ChatModeration-MessageQueue.fifo",
      fifo: true,
      contentBasedDeduplication: true,
      deduplicationScope: sqs.DeduplicationScope.MESSAGE_GROUP,
      fifoThroughputLimit: sqs.FifoThroughputLimit.PER_MESSAGE_GROUP_ID,
      deliveryDelay: cdk.Duration.seconds(0), // No delay
      visibilityTimeout: cdk.Duration.seconds(300), // 5 minutes
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // REST API CloudWatch Log Group
    const restApiLogGroup = new logs.LogGroup(this, "RestApiLogGroup", {
      logGroupName: "ChatModeration-RestApiLogGroup",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // REST API CORS
    const restApi = new apigateway.RestApi(this, "RestApi", {
      restApiName: "ChatModeration-RestApi",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
        allowCredentials: true,
      },
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(
          restApiLogGroup
        ),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        tracingEnabled: true,
      },
    });

    // REST API and SQS Integration
    const sqsIntegration = new apigateway.AwsIntegration({
      service: "sqs",
      path: `${this.account}/${messageQueue.queueName}`,
      integrationHttpMethod: "POST",
      options: {
        credentialsRole: new iam.Role(this, "ApiGatewayToSQSRole", {
          assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
          inlinePolicies: {
            SQSSendMessagePolicy: new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  actions: ["sqs:SendMessage"],
                  resources: [messageQueue.queueArn],
                }),
              ],
            }),
          },
        }),
        requestParameters: {
          "integration.request.header.Content-Type":
            "'application/x-www-form-urlencoded'",
        },
        requestTemplates: {
          "application/json":
            "Action=SendMessage&MessageBody=$input.body&MessageGroupId=$input.json('$.message.messageId').substring(0, 5)",
        },
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
            responseTemplates: {
              "application/json": '{"message": "Message sent to SQS"}',
            },
          },
        ],
      },
    });

    const validator = new apigateway.RequestValidator(
      this,
      "ChatModerationValidator",
      {
        restApi: restApi,
        validateRequestBody: true,
        validateRequestParameters: true,
      }
    );

    const messageModel = restApi.addModel("MessageModel", {
      contentType: "application/json",
      modelName: "MessageModel",
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ["message"],
        properties: {
          message: {
            type: apigateway.JsonSchemaType.OBJECT,
            required: [
              "messageId",
              "userId",
              "userName",
              "userMessage",
              "timestamp",
            ],
            properties: {
              messageId: { type: apigateway.JsonSchemaType.STRING },
              userId: { type: apigateway.JsonSchemaType.STRING },
              userName: { type: apigateway.JsonSchemaType.STRING },
              userMessage: { type: apigateway.JsonSchemaType.STRING },
              timestamp: { type: apigateway.JsonSchemaType.STRING },
            },
          },
        },
      },
    });

    // REST API Resource and Method
    const messagesResource = restApi.root.addResource("messages");
    messagesResource.addMethod("POST", sqsIntegration, {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
      requestValidator: validator,
      requestModels: {
        "application/json": messageModel,
      },
    });

    // REST API WAF WebACL
    const webAcl = new wafv2.CfnWebACL(this, "ChatModeration-ApiGatewayWAF", {
      defaultAction: { allow: {} },
      scope: "REGIONAL",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "ChatModeration-ApiGatewayWAF",
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "LimitRequests100",
          priority: 1,
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "LimitRequests100",
            sampledRequestsEnabled: true,
          },
          statement: {
            rateBasedStatement: {
              limit: 100,
              aggregateKeyType: "IP",
            },
          },
        },
        {
          name: "AWSManagedRulesCommonRuleSet",
          priority: 2,
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWSManagedRulesCommonRuleSet",
            sampledRequestsEnabled: true,
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
        },
      ],
    });

    // Associate WAF WebACL with API Gateway stage
    new wafv2.CfnWebACLAssociation(this, "WebAclAssociation", {
      resourceArn: restApi.deploymentStage.stageArn,
      webAclArn: webAcl.attrArn,
    });

    // AppSync GraphQL API
    const graphQlApi = new appsync.GraphqlApi(this, "GraphQLApi", {
      name: "ChatModeration-GraphQLApi",
      definition: appsync.Definition.fromFile(
        path.join(__dirname, "..", "schema", "schema.graphql")
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
      },
      xrayEnabled: true,
    });

    // AppSync GraphQL API Key
    const appSyncApiKey = graphQlApi.apiKey || "";

    // Lambda Function Role
    const lambdaRole = new iam.Role(this, "ApiLambdaRole", {
      roleName: "ChatModeration-Api-LambdaRole",
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        ["ChatModeration-Api-DynamoDBReadPolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["dynamodb:DescribeTable", "dynamodb:GetItem"],
              resources: [
                `arn:aws:dynamodb:${this.region}:${this.account}:table/${props.promptStoreTableName}`,
              ],
            }),
          ],
        }),
        ["ChatModeration-Api-DynamoDBWritePolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["dynamodb:DescribeTable", "dynamodb:PutItem"],
              resources: [
                `arn:aws:dynamodb:${this.region}:${this.account}:table/${props.approvedMessagesTableName}`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/${props.unapprovedMessagesTableName}`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/${props.hallucinationsTableName}`,
              ],
            }),
          ],
        }),
        ["ChatModeration-Api-BedrockGuardrailPolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["bedrock:ApplyGuardrail"],
              resources: [
                `arn:aws:bedrock:${this.region}:${this.account}:guardrail/${props.guardrailId}`,
              ],
            }),
          ],
        }),
        ["ChatModeration-Api-BedrockModelPolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["bedrock:ListFoundationModels", "bedrock:InvokeModel"],
              resources: [
                `arn:aws:bedrock:${this.region}:*:foundation-model/amazon.titan-text-premier-v1:0`,
                `arn:aws:bedrock:${this.region}:*:foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
                `arn:aws:bedrock:${this.region}:*:foundation-model/meta.llama3-8b-instruct-v1:0`,
                `arn:aws:bedrock:${this.region}:*:foundation-model/amazon.nova-micro-v1:0`
              ],
            }),
          ],
        }),
        ["ChatModeration-Api-SSMPolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["ssm:GetParameter"],
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter${props.promptSwitchParameterName}`,
              ],
            }),
          ],
        }),
        ["ChatModeration-Api-SQSPolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "sqs:SendMessage",
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
              ],
              resources: [messageQueue.queueArn, deadLetterQueue.queueArn],
            }),
          ],
        }),
        ["ChatModeration-Api-AppSyncPolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["appsync:GraphQL"],
              resources: [
                `${graphQlApi.arn}/types/Mutation/fields/broadcastMessage`,
                `${graphQlApi.arn}/types/Mutation/fields/sendNotification`,
              ],
            }),
          ],
        }),
        ["ChatModeration-Api-CloudWatch"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "cloudwatch:PutMetricData",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
              ],
              resources: ["*"],
            }),
          ],
        }),
        ["ChatModeration-Api-Xray"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "xray:PutTraceSegments",
                "xray:PutTelemetryRecords",
                "xray:GetSamplingRules",
                "xray:GetSamplingTargets",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    // Lambda Function
    const messageProcessorFunction = new nodejs.NodejsFunction(
      this,
      "MessageProcessorFunction",
      {
        functionName: "ChatModeration-MessageProcessor",
        entry: path.join(
          __dirname,
          "../..",
          "lambdas",
          "MessageProcessorFunction",
          "index.mjs"
        ),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        role: lambdaRole,
        bundling: {
          minify: true,
          sourceMap: true,
          target: "es2020",
          format: nodejs.OutputFormat.ESM,
          mainFields: ["module", "main"],
          esbuildArgs: {
            "--tree-shaking": "true",
            "--platform": "node",
          },
        },
        environment: {
          APPROVED_MESSAGES_TABLE: props.approvedMessagesTableName,
          UNAPPROVED_MESSAGES_TABLE: props.unapprovedMessagesTableName,
          HALLUCINATIONS_TABLE: props.hallucinationsTableName,
          PROMPT_TABLE: props.promptStoreTableName,
          SSM_PARAMETER_NAME: props.promptSwitchParameterName,
          GUARDRAIL_IDENTIFIER: props.guardrailId,
          GUARDRAIL_VERSION: props.guardrailVersion,
          DLQ_QUEUE_URL: deadLetterQueue.queueUrl,
          GRAPHQL_API_ENDPOINT: graphQlApi.graphqlUrl,
          APPSYNC_API_KEY: graphQlApi.apiKey || "",
        },
        tracing: Tracing.ACTIVE,
      }
    );

    // Lambda and SQS Event Source Mapping
    new lambda.EventSourceMapping(this, "SQSEventSourceMapping", {
      target: messageProcessorFunction,
      batchSize: 10,
      eventSourceArn: messageQueue.queueArn,
    });

    // AppSync Lambda Data Source
    const lambdaDataSource = graphQlApi.addLambdaDataSource(
      "ChatModerationLambdaDataSource",
      messageProcessorFunction
    );

    // AppSync Resolvers
    lambdaDataSource.createResolver("BroadcastMessageResolver", {
      typeName: "Mutation",
      fieldName: "broadcastMessage",
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    lambdaDataSource.createResolver("SendNotificationResolver", {
      typeName: "Mutation",
      fieldName: "sendNotification",
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    // Outputs
    this.restApiEndpoint = `${restApi.url}messages`;
    new cdk.CfnOutput(this, "RestApiEndpoint", {
      value: this.restApiEndpoint,
      description: "REST API Endpoint",
      exportName: "RestApiEndpoint",
    });
    this.graphQlApiEndpoint = graphQlApi.graphqlUrl;
    new cdk.CfnOutput(this, "GraphQlApiEndpoint", {
      value: this.graphQlApiEndpoint,
      description: "GraphQL Api Endpoint",
      exportName: "GraphQlApiEndpoint",
    });
    this.appSyncApiKey = graphQlApi.apiKey || "";
    new cdk.CfnOutput(this, "AppSyncApiKey", {
      value: this.appSyncApiKey,
      description: "AppSync API Key",
      exportName: "AppSyncApiKey",
    });
    this.deadLetterQueueName = deadLetterQueue.queueName;
    new cdk.CfnOutput(this, "DeadLetterQueueName", {
      value: this.deadLetterQueueName,
      description: "Dead Letter Queue Name",
      exportName: "DeadLetterQueueName",
    });
  }
}
