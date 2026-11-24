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

// The shared demo, which every merge to main updates, so it is also staging
new BackendStack(app, 'WeddedBackend', {
  env,
  stage: 'staging',
  description: 'Wedded backend: self-hosted Supabase on one EC2 server, files in S3',
  terminationProtection: true,
});

// Production: the same stack again, with its own server, files, settings and
// deploy user. Only a GitHub Release deploys to it (.github/workflows/prod.yml)
new BackendStack(app, 'WeddedBackendProd', {
  env,
  stage: 'prod',
  description: 'Wedded production backend: self-hosted Supabase on one EC2 server, files in S3',
  terminationProtection: true,
});

Tags.of(app).add('project', 'wedded');
