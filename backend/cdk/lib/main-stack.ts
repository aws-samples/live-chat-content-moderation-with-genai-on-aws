import * as cdk from "aws-cdk-lib";
import { Database } from "./database-stack";
import { Guardrail } from "./guardrail-stack";
import { PromptSwitch } from "./prompt-switch-stack";
import { Api } from "./api-stack";
import { FrontEnd } from "./front-end-stack";
import { Observability } from "./observability-stack";

export interface MainStackProps extends cdk.StackProps {}

export class MainStack extends cdk.Stack {
  public readonly approvedMessagesTableName: string;
  public readonly unapprovedMessagesTableName: string;
  public readonly hallucinationsTableName: string;
  public readonly promptStoreTableName: string;
  public readonly promptSwitchParameterName: string;
  public readonly guardrailId: string;
  public readonly guardrailVersion: string;
  public readonly restApiEndpoint: string;
  public readonly graphQlApiEndpoint: string;
  public readonly appSyncApiId: string;
  public readonly appSyncApiKey: string;
  public readonly s3BucketStaticAssetsName: string;
  public readonly s3BucketStaticAssetsDomainName: string;
  public readonly cloudFrontDistributionId: string;
  public readonly cloudFrontDistributionDomain: string;

  public constructor(scope: cdk.App, id: string, props: MainStackProps = {}) {
    super(scope, id, props);

    // Database Nested Stack
    const database = new Database(this, "Database", {
      stackName: "Database",
    });

    // Guardrail Nested Stack
    const guardrail = new Guardrail(this, "Guardrail", {
      stackName: "Guardrail",
    });

    // PromptSwitch Nested Stack (replacing FeatureToggle)
    const promptSwitch = new PromptSwitch(this, "PromptSwitch", {
      stackName: "PromptSwitch",
    });

    // API Nested Stack
    const api = new Api(this, "Api", {
      stackName: "Api",
      approvedMessagesTableName: database.approvedMessagesTableName,
      unapprovedMessagesTableName: database.unapprovedMessagesTableName,
      hallucinationsTableName: database.hallucinationsTableName,
      promptStoreTableName: database.promptStoreTableName,
      guardrailId: guardrail.guardrailId,
      guardrailVersion: guardrail.guardrailVersion,
      promptSwitchParameterName: promptSwitch.promptSwitchParameterName,
    });

    // Front-End Nested Stack
    const frontEnd = new FrontEnd(this, "FrontEnd", {
      stackName: "FrontEnd",
    });

    // Observability Stack
    const bedrockModels = [
      "amazon.titan-text-premier-v1:0",
      "anthropic.claude-3-haiku-20240307-v1:0",
      "meta.llama3-8b-instruct-v1:0",
    ];

    const observability = new Observability(this, "Observability", {
      bedrockModels,
      stackName: "Observability",
      deadLetterQueueName: api.deadLetterQueueName,
    });

    // Outputs
    this.approvedMessagesTableName = database.approvedMessagesTableName;
    new cdk.CfnOutput(this, "ApprovedMessagesTableName", {
      value: this.approvedMessagesTableName,
      description: "DynamoDB Approved Messages Table Name",
    });
    this.unapprovedMessagesTableName = database.unapprovedMessagesTableName;
    new cdk.CfnOutput(this, "UnapprovedMessagesTableName", {
      value: this.unapprovedMessagesTableName,
      description: "DynamoDB Unapproved Messages Table Name",
    });
    this.hallucinationsTableName = database.hallucinationsTableName;
    new cdk.CfnOutput(this, "HallucinationsTableName", {
      value: this.hallucinationsTableName,
      description: "DynamoDB HallucinationsTable Name",
    });
    this.promptStoreTableName = database.promptStoreTableName;
    new cdk.CfnOutput(this, "PromptStoreTableName", {
      value: this.promptStoreTableName,
      description: "DynamoDB Prompt Store Table Name",
    });
    this.guardrailId = guardrail.guardrailId;
    new cdk.CfnOutput(this, "GuardrailId", {
      value: this.guardrailId,
      description: "Bedrock Guardrail ID",
    });
    this.guardrailVersion = guardrail.guardrailVersion;
    new cdk.CfnOutput(this, "GuardrailVersionOutput", {
      value: this.guardrailVersion,
      description: "Bedrock Guardrail Version",
    });
    this.promptSwitchParameterName = promptSwitch.promptSwitchParameterName;
    new cdk.CfnOutput(this, "PromptSwitchParameterName", {
      value: this.promptSwitchParameterName,
      description: "SSM Parameter Name for Active Model UUID",
    });
    this.restApiEndpoint = api.restApiEndpoint;
    new cdk.CfnOutput(this, "RestApiEndpoint", {
      value: this.restApiEndpoint,
      description: "REST API Endpoint",
    });
    this.graphQlApiEndpoint = api.graphQlApiEndpoint;
    new cdk.CfnOutput(this, "GraphQlApiEndpoint", {
      value: this.graphQlApiEndpoint,
      description: "GraphQL API Endpoint",
    });
    this.appSyncApiKey = api.appSyncApiKey;
    new cdk.CfnOutput(this, "AppSyncApiKey", {
      value: this.appSyncApiKey,
      description: "AppSync API Key",
    });
    this.s3BucketStaticAssetsName = frontEnd.s3BucketStaticAssetsName;
    new cdk.CfnOutput(this, "S3BucketStaticAssetsName", {
      value: this.s3BucketStaticAssetsName,
      description: "S3 Bucket Static Assets Name",
    });
    this.s3BucketStaticAssetsDomainName =
      frontEnd.s3BucketStaticAssetsDomainName;
    new cdk.CfnOutput(this, "S3BucketStaticAssetsDomainName", {
      value: this.s3BucketStaticAssetsDomainName,
      description: "S3 Bucket Static Assets Domain Name",
    });
    this.cloudFrontDistributionId = frontEnd.cloudFrontDistributionId;
    new cdk.CfnOutput(this, "CloudFrontDistributionId", {
      value: this.cloudFrontDistributionId,
      description: "CloudFront Distribution ID",
    });
    this.cloudFrontDistributionDomain = frontEnd.cloudFrontDistributionDomain;
    new cdk.CfnOutput(this, "CloudFrontDistributionDomain", {
      value: this.cloudFrontDistributionDomain,
      description: "CloudFront Distribution Domain",
    });
  }
}
