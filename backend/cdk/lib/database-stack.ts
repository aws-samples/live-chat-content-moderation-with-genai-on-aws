import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
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
