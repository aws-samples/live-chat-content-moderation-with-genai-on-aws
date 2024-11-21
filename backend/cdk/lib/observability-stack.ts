import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Duration } from "aws-cdk-lib/core";
import { Construct } from "constructs";

interface ObservabilityProps extends cdk.NestedStackProps {
  bedrockModels: string[];
  stackName: string;
  deadLetterQueueName: string;
}

export class Observability extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: ObservabilityProps) {
    super(scope, id, props);

    const dashboard = new cloudwatch.Dashboard(this, "Monitoring", {
      dashboardName: "ChatModeration-Monitoring",
    });

    const METRIC_PERIOD = Duration.minutes(1);

    for (const model of props.bedrockModels) {
      const modelDimension = { ModelId: model };

      // Add widgets for each metric
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: `Metrics for ${model}`,
          left: [
            new cloudwatch.Metric({
              metricName: "Invocations",
              namespace: "AWS/Bedrock",
              dimensionsMap: modelDimension,
              statistic: "Sum",
              period: METRIC_PERIOD,
            }),
            new cloudwatch.Metric({
              metricName: "InvocationLatency",
              namespace: "AWS/Bedrock",
              dimensionsMap: modelDimension,
              statistic: "Average",
              period: METRIC_PERIOD,
            }),
            new cloudwatch.Metric({
              metricName: "InvocationClientErrors",
              namespace: "AWS/Bedrock",
              dimensionsMap: modelDimension,
              statistic: "Sum",
              period: METRIC_PERIOD,
            }),
            new cloudwatch.Metric({
              metricName: "InvocationServerErrors",
              namespace: "AWS/Bedrock",
              dimensionsMap: modelDimension,
              statistic: "Sum",
              period: METRIC_PERIOD,
            }),
            new cloudwatch.Metric({
              metricName: "InvocationThrottles",
              namespace: "AWS/Bedrock",
              dimensionsMap: modelDimension,
              statistic: "Sum",
              period: METRIC_PERIOD,
            }),
            new cloudwatch.Metric({
              metricName: "InputTokenCount",
              namespace: "AWS/Bedrock",
              dimensionsMap: modelDimension,
              statistic: "Sum",
              period: METRIC_PERIOD,
            }),
            new cloudwatch.Metric({
              metricName: "LegacyModelInvocations",
              namespace: "AWS/Bedrock",
              dimensionsMap: modelDimension,
              statistic: "Sum",
              period: METRIC_PERIOD,
            }),
            new cloudwatch.Metric({
              metricName: "OutputTokenCount",
              namespace: "AWS/Bedrock",
              dimensionsMap: modelDimension,
              statistic: "Sum",
              period: METRIC_PERIOD,
            }),
          ],
        }),
        new cloudwatch.SingleValueWidget({
          title: `Input Token Count for ${model}`,
          metrics: [
            new cloudwatch.Metric({
              metricName: "InputTokenCount",
              namespace: "AWS/Bedrock",
              dimensionsMap: modelDimension,
              statistic: "Sum",
              period: METRIC_PERIOD,
            }),
          ],
        }),
        new cloudwatch.SingleValueWidget({
          title: `Output Token Count for ${model}`,
          metrics: [
            new cloudwatch.Metric({
              metricName: "OutputTokenCount",
              namespace: "AWS/Bedrock",
              dimensionsMap: modelDimension,
              statistic: "Sum",
              period: METRIC_PERIOD,
            }),
          ],
        })
      );
    }

    // Add widgets for SQS Queue
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: `Number Of Messages Received on SQS Queue: ${props.deadLetterQueueName}`,
        metrics: [
          new cloudwatch.Metric({
            metricName: "NumberOfMessagesReceived",
            namespace: "AWS/SQS",
            dimensionsMap: { QueueName: props.deadLetterQueueName },
            statistic: "Sum",
            period: METRIC_PERIOD,
          }),
        ],
      })
    );

    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: `Number Of Messages Sent to SQS Queue: ${props.deadLetterQueueName}`,
        metrics: [
          new cloudwatch.Metric({
            metricName: "NumberOfMessagesSent",
            namespace: "AWS/SQS",
            dimensionsMap: { QueueName: props.deadLetterQueueName },
            statistic: "Sum",
            period: METRIC_PERIOD,
          }),
        ],
      })
    );

    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: `Approx Number of Messages Visible in SQS Queue: ${props.deadLetterQueueName}`,
        metrics: [
          new cloudwatch.Metric({
            metricName: "ApproximateNumberOfMessagesVisible",
            namespace: "AWS/SQS",
            dimensionsMap: { QueueName: props.deadLetterQueueName },
            statistic: "Sum",
            period: METRIC_PERIOD,
          }),
        ],
      })
    );

    // Add widget for number of messages redacted
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: `Number of messages unapproved`,
        metrics: [
          new cloudwatch.Metric({
            metricName: "UnapprovedMessages",
            namespace: "ChatModeration/Messages",
            dimensionsMap: { ApplicationName: "ChatModeration" },
            statistic: "Sum",
            period: METRIC_PERIOD,
          }),
        ],
      })
    );
  }
}
