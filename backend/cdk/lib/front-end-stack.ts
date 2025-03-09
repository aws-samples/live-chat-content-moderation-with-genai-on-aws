import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface FrontEndProps extends cdk.NestedStackProps {
  stackName: string;
  webAclArn: string;
  crossRegionReferences: boolean;
  env?: {
    region?: string;
    account?: string;
  };
}

export class FrontEnd extends cdk.NestedStack {
  public readonly s3BucketStaticAssetsName: string;
  public readonly s3BucketStaticAssetsDomainName: string;
  public readonly cloudFrontDistributionId: string;
  public readonly cloudFrontDistributionDomain: string;

  constructor(scope: Construct, id: string, props: FrontEndProps) {
    super(scope, id, props);

    // CloudFront Origin Access Control
    const cloudFrontOriginAccessControl = new cloudfront.CfnOriginAccessControl(
      this,
      "CloudFrontOriginAccessControl",
      {
        originAccessControlConfig: {
          description: "OAC for live-chat-bucket",
          name: "ChatModeration-OriginAccessControl",
          originAccessControlOriginType: "s3",
          signingBehavior: "always",
          signingProtocol: "sigv4",
        },
      }
    );

    // S3 Bucket for CloudFront Access Logging
    const s3BucketCloudFrontAccessLogging = new s3.Bucket(
      this,
      "s3BucketCloudFrontAccessLogging",
      {
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
        enforceSSL: true,
        autoDeleteObjects: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    // S3 Bucket for Front-End Static Assets
    const s3BucketStaticAssets = new s3.Bucket(this, "s3BucketStaticAssets", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CloudFront Distribution for Front-End Static Assets
    const cloudFrontDistribution = new cloudfront.CfnDistribution(
      this,
      "CloudFrontDistribution",
      {
        distributionConfig: {
          defaultCacheBehavior: {
            allowedMethods: ["GET", "HEAD"],
            cachedMethods: ["GET", "HEAD"],
            compress: true,
            defaultTtl: 86400,
            forwardedValues: {
              cookies: {
                forward: "none",
              },
              queryString: false,
            },
            maxTtl: 31536000,
            minTtl: 0,
            smoothStreaming: false,
            targetOriginId: "S3Origin",
            viewerProtocolPolicy: "redirect-to-https",
          },
          enabled: true,
          httpVersion: "http2",
          defaultRootObject: "index.html",
          origins: [
            {
              domainName: s3BucketStaticAssets.bucketRegionalDomainName,
              id: "S3Origin",
              s3OriginConfig: {},
              originAccessControlId: cloudFrontOriginAccessControl.ref,
            },
          ],
          priceClass: "PriceClass_All",
          viewerCertificate: {
            cloudFrontDefaultCertificate: true,
          },
          customErrorResponses: [
            {
              errorCode: 403,
              responseCode: 200,
              responsePagePath: "/index.html",
            },
          ],
          logging: {
            bucket: `${s3BucketCloudFrontAccessLogging.bucketName}.s3.amazonaws.com`,
            prefix: "cloudfront-logs/",
            includeCookies: false,
          },
          webAclId: props.webAclArn,
        },
      }
    );

    // CloudFront Distribution IAM Policy for Front-End Static Assets
    s3BucketStaticAssets.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontServicePrincipal",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [s3BucketStaticAssets.arnForObjects("*")],
        conditions: {
          StringEquals: {
            "AWS:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/${cloudFrontDistribution.attrId}`,
          },
        },
      })
    );

    // Outputs
    this.s3BucketStaticAssetsName = s3BucketStaticAssets.bucketName;
    new cdk.CfnOutput(this, "CfnOutputS3BucketStaticAssetsName", {
      key: "S3BucketStaticAssetsName",
      value: this.s3BucketStaticAssetsName,
    });
    this.s3BucketStaticAssetsDomainName =
      s3BucketStaticAssets.bucketRegionalDomainName;
    new cdk.CfnOutput(this, "CfnOutputS3BucketStaticAssetsDomainName", {
      key: "S3BucketStaticAssetsDomainName",
      value: this.s3BucketStaticAssetsDomainName,
    });
    this.cloudFrontDistributionId = cloudFrontDistribution.attrId;
    new cdk.CfnOutput(this, "CfnOutputCloudFrontDistributionId", {
      key: "CloudFrontDistributionId",
      value: this.cloudFrontDistributionId,
    });
    this.cloudFrontDistributionDomain = cloudFrontDistribution.attrDomainName;
    new cdk.CfnOutput(this, "CfnOutputCloudFrontDistributionDomain", {
      key: "CloudFrontDistributionDomain",
      value: this.cloudFrontDistributionDomain,
    });
  }
}
