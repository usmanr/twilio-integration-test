import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";
import * as path from "path";

export class EnquiriesStack extends cdk.Stack {
  public readonly api: apigwv2.HttpApi;
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const table = new dynamodb.Table(this, "EnquiriesTable", {
      tableName: "Enquiries",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Secrets Manager: API Key
    const apiKeySecret = new secretsmanager.Secret(this, "EnquiriesApiKey", {
      secretName: "enquiries/api-key",
      description: "API key for the Enquiries API",
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 48,
      },
    });

    // Lambda Function
    const fn = new nodejs.NodejsFunction(this, "EnquiriesHandler", {
      entry: path.join(__dirname, "../../src/enquiries/lambda.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        ENQUIRIES_TABLE_NAME: table.tableName,
        API_KEY_SECRET_ARN: apiKeySecret.secretArn,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ["@aws-sdk/*"],
      },
    });

    // IAM: DynamoDB access
    table.grantReadWriteData(fn);

    // IAM: Secrets Manager read
    apiKeySecret.grantRead(fn);

    // IAM: Bedrock InvokeModel
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [`*`],
      }),
    );

    // HTTP API Gateway v2
    this.api = new apigwv2.HttpApi(this, "EnquiriesApi", {
      apiName: "EnquiriesService",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PATCH,
        ],
        allowHeaders: ["Content-Type", "x-api-key"],
      },
    });

    const integration = new HttpLambdaIntegration("EnquiriesIntegration", fn);

    this.api.addRoutes({
      path: "/enquiries",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration,
    });

    this.api.addRoutes({
      path: "/enquiries/{id}",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PATCH],
      integration,
    });

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", {
      value: this.api.apiEndpoint,
      description: "HTTP API endpoint URL",
    });

    new cdk.CfnOutput(this, "TableName", {
      value: table.tableName,
    });

    new cdk.CfnOutput(this, "ApiKeySecretArn", {
      value: apiKeySecret.secretArn,
      description: "ARN of the API key secret in Secrets Manager",
    });
  }
}
