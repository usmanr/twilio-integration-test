import * as cdk from 'aws-cdk-lib';
import { EnquiriesStack } from '../lib/enquiries-stack';

const app = new cdk.App();
new EnquiriesStack(app, 'EnquiriesStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',
  },
});
