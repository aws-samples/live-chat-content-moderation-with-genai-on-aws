import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cloudtrail from "aws-cdk-lib/aws-cloudtrail";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

interface DatabaseProps extends cdk.NestedStackProps {
  stackName: string;
}

export class Database extends cdk.NestedStack {
  public readonly approvedMessagesTableName: string;
  public readonly unapprovedMessagesTableName: string;
  public readonly hallucinationsTableName: string;
  public readonly promptStoreTableName: string;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id, props);

    // DynamoDB Approved Messages Table
    const approvedMessagesTable = new dynamodb.Table(
      this,
      "ApprovedMessagesTable",
      {
        tableName: "ChatModeration-ApprovedMessagesTable",
        partitionKey: {
          name: "messageId",
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        pointInTimeRecovery: true,
      }
    );

    // DynamoDB Unapproved Messages Table
    const unapprovedMessagesTable = new dynamodb.Table(
      this,
      "UnapprovedMessagesTable",
      {
        tableName: "ChatModeration-UnapprovedMessagesTable",
        partitionKey: {
          name: "messageId",
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        pointInTimeRecovery: true,
      }
    );

    // DynamoDB Hallucinations Table
    const hallucinationsTable = new dynamodb.Table(
      this,
      "HallucinationsTable",
      {
        tableName: "ChatModeration-HallucinationsTable",
        partitionKey: {
          name: "messageId",
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        pointInTimeRecovery: true,
      }
    );

    // DynamoDB Prompt Store Table
    const promptStoreTable = new dynamodb.Table(this, "PromptStoreTable", {
      tableName: "ChatModeration-PromptStoreTable",
      partitionKey: {
        name: "promptId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    /*
    // S3 Bucket for DynamoDB Data Events CloudTrail Logging
    const s3BucketDynamoDBCloudTrailLogging = new s3.Bucket(
      this,
      "s3BucketDynamoDBCloudTrailLogging",
      {
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        autoDeleteObjects: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    const trailName = "ChatModeration-DynamoDB-DataEvents-Trail";

    const cloudTrailPrincipal = new iam.ServicePrincipal(
      "cloudtrail.amazonaws.com"
    );

    s3BucketDynamoDBCloudTrailLogging.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowGetBucketAcl",
        effect: iam.Effect.ALLOW,
        principals: [cloudTrailPrincipal],
        actions: ["s3:GetBucketAcl"],
        resources: [s3BucketDynamoDBCloudTrailLogging.bucketArn],
        conditions: {
          StringEquals: {
            "AWS:SourceArn": `arn:aws:cloudtrail:${this.region}:${this.account}:trail/${trailName}`,
          },
        },
      })
    );

    s3BucketDynamoDBCloudTrailLogging.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowPutObject",
        effect: iam.Effect.ALLOW,
        principals: [cloudTrailPrincipal],
        actions: ["s3:PutObject"],
        resources: [
          `arn:aws:s3:::${s3BucketDynamoDBCloudTrailLogging.bucketName}/AWSLogs/${this.account}/*`,
        ],
        conditions: {
          StringEquals: {
            "s3:x-amz-acl": "bucket-owner-full-control",
            "AWS:SourceArn": `arn:aws:cloudtrail:${this.region}:${this.account}:trail/${trailName}`,
          },
        },
      })
    );

    const cfnTrail = new cloudtrail.CfnTrail(this, "DynamoDBDataEventsTrail", {
      isLogging: true,
      s3BucketName: s3BucketDynamoDBCloudTrailLogging.bucketName,
      trailName: trailName,
      isMultiRegionTrail: false,
      includeGlobalServiceEvents: false,
      eventSelectors: [
        {
          dataResources: [
            {
              type: "AWS::DynamoDB::Table",
              values: [
                approvedMessagesTable.tableArn,
                unapprovedMessagesTable.tableArn,
                hallucinationsTable.tableArn,
                promptStoreTable.tableArn,
              ],
            },
          ],
          includeManagementEvents: false,
          readWriteType: "All",
        },
      ],
    });

    cfnTrail.addDependency(
      s3BucketDynamoDBCloudTrailLogging.node.defaultChild as cdk.CfnResource
    );
    */

    // Outputs
    this.approvedMessagesTableName = approvedMessagesTable.tableName;
    new cdk.CfnOutput(this, "ApprovedMessagesTableName", {
      value: this.approvedMessagesTableName,
      description: "DynamoDB Approved Messages Table Name",
    });
    this.unapprovedMessagesTableName = unapprovedMessagesTable.tableName;
    new cdk.CfnOutput(this, "UnapprovedMessagesTableName", {
      value: this.unapprovedMessagesTableName,
      description: "DynamoDB Unapproved Messages Table Name",
    });
    this.hallucinationsTableName = hallucinationsTable.tableName;
    new cdk.CfnOutput(this, "HallucinationsTableName", {
      value: this.hallucinationsTableName,
      description: "DynamoDB Hallucinations Table Name",
    });
    this.promptStoreTableName = promptStoreTable.tableName;
    new cdk.CfnOutput(this, "PromptStoreTableName", {
      value: this.promptStoreTableName,
      description: "DynamoDB Prompt Store Table Name",
    });
  }
}
