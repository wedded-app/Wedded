import { App, Tags } from 'aws-cdk-lib';

import { BackendStack } from '../lib/backend-stack';
import { MediaStack } from '../lib/media-stack';

const app = new App();

// The account comes from the AWS CLI profile you deploy with. The Region is
// fixed: AWS projects in the new AWS experience can only use the one Region
// they were created in.
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-2' };

new MediaStack(app, 'WeddedMedia', {
  env,
  description: 'Wedded vendor photos: S3 uploads, a resizing Lambda and a CloudFront CDN',
});

new BackendStack(app, 'WeddedBackend', {
  env,
  description: 'Wedded backend: self-hosted Supabase on one EC2 server, files in S3',
  terminationProtection: true,
});

Tags.of(app).add('project', 'wedded');
