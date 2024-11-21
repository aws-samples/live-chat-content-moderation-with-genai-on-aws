import * as cdk from "aws-cdk-lib";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

interface PromptSwitchProps extends cdk.NestedStackProps {
  stackName: string;
}

export class PromptSwitch extends cdk.NestedStack {
  public readonly promptSwitchParameterName: string;

  constructor(scope: Construct, id: string, props: PromptSwitchProps) {
    super(scope, id, props);

    this.promptSwitchParameterName = "/ChatModeration/ActiveModelUUID";

    // Create SSM Parameter for active model UUID
    const activeModelParameter = new ssm.StringParameter(
      this,
      "ActiveModelParameter",
      {
        parameterName: this.promptSwitchParameterName,
        stringValue: "00000000-0000-0000-0000-000000000000",
        description:
          "The UUID of the currently active model for chat moderation",
        tier: ssm.ParameterTier.STANDARD,
      }
    );

    const removalPolicy = activeModelParameter.node
      .defaultChild as cdk.CfnResource;
    removalPolicy.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Output
    new cdk.CfnOutput(this, "PromptSwitchParameterName", {
      value: this.promptSwitchParameterName,
      description: "SSM Parameter Name for Active Model UUID",
    });
  }
}
