import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as bedrock from "aws-cdk-lib/aws-bedrock";

interface GuardrailProps extends cdk.NestedStackProps {
  stackName: string;
}

export class Guardrail extends cdk.NestedStack {
  public readonly guardrailId: string;
  public readonly guardrailVersion: string;

  constructor(scope: Construct, id: string, props: GuardrailProps) {
    super(scope, id, props);

    const guardrail = new bedrock.CfnGuardrail(this, "Guardrail", {
      name: "ChatModeration-Guardrail",
      contentPolicyConfig: {
        filtersConfig: [
          {
            type: "HATE",
            inputStrength: "HIGH",
            outputStrength: "HIGH",
          },
          {
            type: "INSULTS",
            inputStrength: "HIGH",
            outputStrength: "HIGH",
          },
          {
            type: "SEXUAL",
            inputStrength: "HIGH",
            outputStrength: "HIGH",
          },
          {
            type: "VIOLENCE",
            inputStrength: "HIGH",
            outputStrength: "HIGH",
          },
          {
            type: "MISCONDUCT",
            inputStrength: "HIGH",
            outputStrength: "HIGH",
          },
        ],
      },
      wordPolicyConfig: {
        managedWordListsConfig: [{ type: "PROFANITY" }],
      },
      blockedInputMessaging: "n",
      blockedOutputsMessaging: "n",
    });

    const guardrailVersion = new bedrock.CfnGuardrailVersion(
      this,
      "GuardrailVersion",
      {
        description: "Version 1",
        guardrailIdentifier: guardrail.ref,
      }
    );

    // Outputs
    this.guardrailId = guardrail.attrGuardrailId;
    new cdk.CfnOutput(this, "GuardrailId", {
      value: this.guardrailId,
      description: "Bedrock Guardrail ID",
    });
    this.guardrailVersion = guardrailVersion.attrVersion;
    new cdk.CfnOutput(this, "GuardrailVersionOutput", {
      value: this.guardrailVersion,
      description: "Bedrock Guardrail Version",
    });
  }
}
