import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import { CfnOutput, Fn, RemovalPolicy, Stack, Tags, type StackProps } from 'aws-cdk-lib';
import * as dlm from 'aws-cdk-lib/aws-dlm';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

/**
 * The app's backend on one server: Supabase's open-source stack (Postgres,
 * sign-in, Realtime, Storage, the server functions) in Docker, with Caddy for
 * HTTPS. Storage keeps its files in S3; the disk is snapshotted every night.
 *
 *   app ──HTTPS──▶ Caddy ──▶ Supabase (EC2, Docker) ──▶ S3 (files)
 *
 * The server only installs Supabase on its first boot (backend/first-boot.sh);
 * `npm run backend -- deploy` brings our settings, functions and migrations.
 */
export class BackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Public subnets only: no NAT gateway to pay for
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [{ name: 'public', subnetType: ec2.SubnetType.PUBLIC }],
    });

    // HTTPS for the app; HTTP only for certificates and the redirect. No SSH:
    // founders get a shell through Systems Manager
    const web = new ec2.SecurityGroup(this, 'Web', { vpc, description: 'HTTP and HTTPS' });
    web.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    web.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));

    // Storage's files, and the repo's supabase/ folder under app/ for deploys
    const bucket = new s3.Bucket(this, 'Files', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // A fixed address, so the HTTPS name survives a restart. The server's first
    // boot waits for it: connections from the launch address drop when it arrives
    const address = new ec2.CfnEIP(this, 'Address', { domain: 'vpc' });
    address.applyRemovalPolicy(RemovalPolicy.RETAIN);
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      `export ELASTIC_IP=${address.attrPublicIp}`,
      readFileSync(path.join(__dirname, '../backend/first-boot.sh'), 'utf8'),
    );

    const server = new ec2.Instance(this, 'Server', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: web,
      // shortcut: 2 GB plus swap, free until 2026-12-31 (EC2's t4g.small trial); t4g.medium when it gets slow
      instanceType: new ec2.InstanceType('t4g.small'),
      // Ubuntu 26.04 LTS for ARM, 2026-10-03 (cloud-images.ubuntu.com/locator/ec2). It
      // installs security updates itself. Changing this replaces the server and its database
      machineImage: ec2.MachineImage.genericLinux({ 'us-east-2': 'ami-0c8db2e74523f6b6b' }),
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: ec2.BlockDeviceVolume.ebs(30, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
            deleteOnTermination: false,
          }),
        },
      ],
      propagateTagsToVolumeOnCreation: true,
      userData,
      ssmSessionPermissions: true,
      httpTokens: ec2.HttpTokens.REQUIRED,
      // Storage runs in a container, one hop further from the server's AWS role
      httpPutResponseHopLimit: 2,
      disableApiTermination: true,
    });
    server.applyRemovalPolicy(RemovalPolicy.RETAIN);
    Tags.of(server).add('wedded-backup', 'nightly');
    bucket.grantReadWrite(server);
    server.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParametersByPath'],
        resources: [this.parameterArn('wedded/backend/*')],
      }),
    );
    server.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:PutParameter'],
        resources: [this.parameterArn('wedded/backend/keys/*')],
      }),
    );

    new ec2.CfnEIPAssociation(this, 'AddressAssociation', {
      allocationId: address.attrAllocationId,
      instanceId: server.instanceId,
    });
    // shortcut: sslip.io turns the address into a name for the certificate; use api.<domain> once #148 lands
    const domain =
      (this.node.tryGetContext('domain') as string | undefined) ??
      Fn.join('', [Fn.join('-', Fn.split('.', address.attrPublicIp)), '.sslip.io']);

    // A snapshot of the disk (the database) every night at 3 AM in California, kept a week
    const snapshots = new iam.Role(this, 'SnapshotRole', {
      assumedBy: new iam.ServicePrincipal('dlm.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSDataLifecycleManagerServiceRole',
        ),
      ],
    });
    new dlm.CfnLifecyclePolicy(this, 'NightlySnapshots', {
      description: 'Wedded backend disk nightly kept 7 days',
      state: 'ENABLED',
      executionRoleArn: snapshots.roleArn,
      policyDetails: {
        resourceTypes: ['VOLUME'],
        targetTags: [{ key: 'wedded-backup', value: 'nightly' }],
        schedules: [
          {
            name: 'Nightly',
            createRule: { interval: 24, intervalUnit: 'HOURS', times: ['10:00'] },
            retainRule: { count: 7 },
            copyTags: true,
          },
        ],
      },
    });

    new CfnOutput(this, 'Url', { value: `https://${domain}` });
    new CfnOutput(this, 'Domain', { value: domain });
    new CfnOutput(this, 'InstanceId', { value: server.instanceId });
    new CfnOutput(this, 'Bucket', { value: bucket.bucketName });
  }

  private parameterArn(name: string): string {
    return this.formatArn({ service: 'ssm', resource: 'parameter', resourceName: name });
  }
}
