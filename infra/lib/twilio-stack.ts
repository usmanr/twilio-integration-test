import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";
import * as path from "path";
import { StackProps } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface TwilioStackProps extends StackProps {
  enquiriesApiUrl: string;
}

export class TwilioStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TwilioStackProps) {
    super(scope, id, props);

    // DynamoDB Table for call records
    const table = new dynamodb.Table(this, "TwilioCallsTable", {
      tableName: "TwilioCalls",
      partitionKey: { name: "callSid", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Lambda Function
    const fn = new nodejs.NodejsFunction(this, "TwilioHandler", {
      entry: path.join(__dirname, "../../src/twilio/lambda.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        ENQUIRIES_API_URL: props.enquiriesApiUrl,
        TWILIO_CALLS_TABLE_NAME: table.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ["@aws-sdk/*"],
      },
    });

    fn.addToRolePolicy(
      new PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [`*`],
      }),
    );

    // IAM: DynamoDB access
    table.grantReadWriteData(fn);

    // HTTP API Gateway v2
    const api = new apigwv2.HttpApi(this, "TwilioApi", {
      apiName: "TwilioWebhooks",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST],
        allowHeaders: ["Content-Type"],
      },
    });

    const integration = new HttpLambdaIntegration("TwilioIntegration", fn);

    // IVR flow routes
    api.addRoutes({
      path: "/webhooks/voice/ivr-incoming",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });
    api.addRoutes({
      path: "/webhooks/voice/ivr-selection",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });
    api.addRoutes({
      path: "/webhooks/voice/ivr-recording-completed",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });
    api.addRoutes({
      path: "/webhooks/voice/ivr-transcription-completed",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });

    // VA flow routes
    api.addRoutes({
      path: "/webhooks/voice/va-incoming",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });
    api.addRoutes({
      path: "/webhooks/voice/va-transcription-available",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });
    api.addRoutes({
      path: "/webhooks/voice/va-recording-post",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });

    // Debug / read endpoints
    api.addRoutes({
      path: "/webhooks/voice/all-calls",
      methods: [apigwv2.HttpMethod.GET],
      integration,
    });
    api.addRoutes({
      path: "/webhooks/voice/all-calls/polished",
      methods: [apigwv2.HttpMethod.GET],
      integration,
    });

    // Set BASE_URL on the Lambda now that the API is created
    fn.addEnvironment("BASE_URL", api.apiEndpoint);

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.apiEndpoint,
      description: "Twilio webhook base URL",
    });

    new cdk.CfnOutput(this, "TableName", {
      value: table.tableName,
    });
  }
}
