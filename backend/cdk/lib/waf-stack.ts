import * as cdk from "aws-cdk-lib";
import * as waf from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

interface WafProps extends cdk.StackProps {
    crossRegionReferences: boolean;
  }

export class Waf extends cdk.Stack {
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: WafProps) {
    super(scope, id, {
      ...props,
      env: {
        region: 'us-east-1',  // Force WAF to be created in us-east-1
        account: props.env?.account,
      },
    });

    const webAcl = new waf.CfnWebACL(this, "ChatModeration-CloudFrontWAF", {
      name: "ChatModeration-CloudFrontWAF",
      scope: "CLOUDFRONT",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "ChatModeration-CloudFrontWAF",
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
      ],
    });

    this.webAclArn = webAcl.attrArn;
  }
}