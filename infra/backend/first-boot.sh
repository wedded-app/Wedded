#!/bin/bash
# First boot of the backend server (the EC2 user data in lib/backend-stack.ts):
# swap, Docker, and Supabase's official self-hosting files in
# /opt/wedded/supabase. Nothing starts until `npm run backend -- deploy` brings
# our settings, functions and migrations (deploy.sh).
set -euxo pipefail
export HOME=/root
: "${ELASTIC_IP:?}" # set by the stack, just above this script
release=self-hosted/v0.8.2 # github.com/supabase/supabase/tree/master/docker; update.sh moves it on

# The stack uses about 1.4 GB at rest; swap takes the peaks on a 2 GB server
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap defaults 0 0' >>/etc/fstab

# Download nothing until the Elastic IP is attached: it drops the launch address's connections
public_ip() {
  local token
  token=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')
  curl -fsS -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/public-ipv4
}
until [ "$(public_ip || true)" = "$ELASTIC_IP" ]; do sleep 5; done

# Systems Manager is how founders and deploys reach the server (Ubuntu's images usually have it)
snap list amazon-ssm-agent >/dev/null 2>&1 || snap install amazon-ssm-agent --classic

mkdir -p /opt/wedded
chmod 700 /opt/wedded
cd /opt/wedded
curl -fsSL "https://raw.githubusercontent.com/supabase/supabase/$release/docker/setup.sh" -o setup.sh
# Its output includes the passwords it generates, so it goes to a private file, not the console log
install -m 600 /dev/null setup.log
sh setup.sh -y --with-aws --ref "$release" --project-dir supabase >>setup.log 2>&1
chmod 600 supabase/.env
