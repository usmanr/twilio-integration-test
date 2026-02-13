import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as iam from "aws-cdk-lib/aws-iam";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";
import * as path from "path";

export interface EnquiriesAgentStackProps extends cdk.StackProps {
  enquiriesApiUrl: string;
}

export class EnquiriesAgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EnquiriesAgentStackProps) {
    super(scope, id, props);

    // DynamoDB Table for call records
    const table = new dynamodb.Table(this, "EnquiryAgentCallsTable", {
      tableName: "EnquiryAgentCalls",
      partitionKey: { name: "callSid", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Python Lambda Function
    const fn = new lambda.Function(this, "EnquiryAgentHandler", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "enquiry_agent.handler.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../EnquiryAgent"),
        {
          bundling: {
            image: lambda.Runtime.PYTHON_3_12.bundlingImage,
            command: [
              "bash",
              "-c",
              "pip install -r requirements.txt -t /asset-output && cp -r enquiry_agent /asset-output/",
            ],
          },
        },
      ),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        ENQUIRIES_API_URL: props.enquiriesApiUrl,
        TWILIO_CALLS_TABLE_NAME: table.tableName,
      },
    });

    // IAM: DynamoDB access
    table.grantReadWriteData(fn);

    // IAM: Bedrock InvokeModel (for ai_polisher via Strands Agents)
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: ["*"],
      }),
    );

    // HTTP API Gateway v2
    const api = new apigwv2.HttpApi(this, "EnquiryAgentApi", {
      apiName: "EnquiryAgentWebhooks",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
        ],
        allowHeaders: ["Content-Type"],
      },
    });

    const integration = new HttpLambdaIntegration(
      "EnquiryAgentIntegration",
      fn,
    );

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

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.apiEndpoint,
      description: "EnquiryAgent webhook base URL",
    });

    new cdk.CfnOutput(this, "TableName", {
      value: table.tableName,
    });
  }
}
