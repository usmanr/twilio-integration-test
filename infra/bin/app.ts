import * as cdk from "aws-cdk-lib";
import { EnquiriesStack } from "../lib/enquiries-stack";
import { TwilioStack } from "../lib/twilio-stack";
import { EnquiriesAgentStack } from "../lib/enquiries-agent-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "ap-southeast-2",
};

const enquiriesStack = new EnquiriesStack(app, "EnquiriesStack", { env });
new TwilioStack(app, "TwilioStack", {
  env,
  enquiriesApiUrl: enquiriesStack.api.apiEndpoint,
});
new EnquiriesAgentStack(app, "EnquiriesAgentStack", {
  env,
  enquiriesApiUrl: enquiriesStack.api.apiEndpoint,
});
