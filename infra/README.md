# Wedded on AWS

Infrastructure as code with the [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/home.html) (TypeScript). Two stacks: `WeddedMedia`, vendor photos (below), and `WeddedBackend`, the app's whole backend on one server ([further down](#the-backend-server-weddedbackend)).

```
app ──PUT──▶ S3 uploads ──event──▶ Lambda (sharp) ──▶ S3 media ◀── CloudFront ◀── app
```

- **Uploads bucket** (private): photos as uploaded, at `<vendor id>/<photo id>.jpg` (or `.png`, `.webp`). They expire after 7 days. They're never served, because phone photos carry GPS in their EXIF.
- **ProcessPhoto Lambda** (`lambda/process-photo.ts`, Node 24 on ARM): runs for each upload and writes `<vendor id>/<photo id>/{400,1080,1600}.webp` and `meta.json` (`{ width, height, blurhash }`) to the media bucket. The sizes and quality match `scripts/upload-vendor-photos.ts`, and the layout matches `vendor_media.storage_path` in Supabase, so `photoUrl()` could point here by changing its base URL.
- **Media bucket** (private) behind **CloudFront** with Origin Access Control: only the distribution can read it, and files are cached for a year (each photo id is new, so a file never changes).

**The app** loads photos from here when `EXPO_PUBLIC_MEDIA_URL` is set to `MediaUrl`, through `photoUrl()` in `src/data/vendor-media.ts`; otherwise it uses Supabase Storage. Photos get here with `npm run photos:upload -- <folder> --aws` or `npm run photos:samples -- --aws` (`scripts/aws-media.ts`). That script uploads each original, waits for the Lambda's `meta.json`, and saves the `vendor_media` row with its size and blurhash. Photos already in Supabase Storage are copied over with `npm run photos:to-aws` (`scripts/copy-photos-to-aws.ts`). They're already sized, so they go straight to the media bucket.

Vendors can't upload from the app yet. That needs a hosted Supabase project, because a Lambda can't reach a database on a laptop, and the "My business" screens.

## First time

1. Install the AWS CLI, then sign in through the browser. It lasts 12 hours and renews itself for 90 days:
   ```
   aws login --region us-east-2 --profile wedded
   ```
2. `cd infra && npm install`
3. Once per AWS account: `npx cdk bootstrap --profile wedded`. It creates the bucket and roles CDK deploys with.

The Region is fixed to `us-east-2` in `bin/infra.ts`, because projects in AWS's new experience can only use the Region they were created in.

## Change and deploy

```
npm run typecheck && npm test        # what CI runs, plus `npx cdk synth`
npx cdk diff --profile wedded        # what would change in AWS
npx cdk deploy --profile wedded      # asks before creating or widening IAM permissions
```

The outputs are `UploadsBucket` and `MediaUrl`.

## Try it

```
aws s3 cp photo.jpg s3://<UploadsBucket>/<vendor uuid>/<photo uuid>.jpg --profile wedded
```

A few seconds later, `<MediaUrl>/<vendor uuid>/<photo uuid>/1080.webp` and `meta.json` load in a browser. The Lambda's logs are in CloudWatch under `WeddedMedia-ProcessPhotoLogs…`, one JSON line per photo.

## Cost

On the Free plan nothing can be charged. Each photo costs a few hundred milliseconds of Lambda time, and a profile view is about 500 KB from CloudFront.

## The backend server (`WeddedBackend`)

```
app ──HTTPS──▶ Caddy ──▶ Supabase in Docker (one EC2 server) ──▶ S3 (Storage's files)
```

Supabase's open-source stack runs on our own server: the same Postgres, sign-in, Realtime, Storage and server functions as the hosted demo. So the app, `supabase/migrations` and `supabase/functions` don't change; only the address and key the app uses do. Tested on a Mac with the same ARM chip type: all 52 migrations, the 570 database tests, email-code sign-in, live chat updates, uploads, the functions and the scheduled jobs.

- **The server**: a t4g.small (2 ARM cores, 2 GB plus 2 GB of swap) on Ubuntu 26.04 LTS, which installs security updates itself. The stack uses about 1.4 GB at rest. No SSH: you reach it through Systems Manager.
- **First boot** (`backend/first-boot.sh`): swap, Docker, and Supabase's official self-hosting files (release `self-hosted/v0.8.2`) in `/opt/wedded/supabase`, with new passwords and keys in its `.env`. Nothing runs until the first deploy.
- **Deploy** (`npm run backend -- deploy`, which runs `backend/deploy.sh` on the server): copies `supabase/` over, sets our settings (`backend/docker-compose.wedded.yml`: sign-in by code only, "Confirm email" on, Apple for Expo Go, no phone yet), loads the server functions and the sign-in email, starts everything behind Caddy (HTTPS from Let's Encrypt) and runs the migrations.
- **Address**: `https://<the Elastic IP with dashes>.sslip.io` (the `Url` output) until we have a domain (#148). Then point `api.<domain>` at the Elastic IP, run `npx cdk deploy WeddedBackend -c domain=api.<domain>` and deploy again.
- **Files** are in the stack's S3 bucket. **Backups**: a snapshot of the disk every night at 3 AM California time, kept 7 days. To go back to one: EC2 → Instances → the server → Actions → Monitor and troubleshoot → Replace root volume, and pick the snapshot.
- **Settings and secrets** live in Parameter Store (Systems Manager), never in git. Deploy again after changing one:
  - `/wedded/backend/functions/<NAME>`: the server functions' settings, what `supabase secrets set` did on the hosted project: `RESEND_API_KEY`, `FOUNDERS_EMAIL`, `INQUIRY_TEST_INBOX`, `INQUIRY_FROM`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EXPO_ACCESS_TOKEN` and the rest.
  - `/wedded/backend/env/<NAME>`: lines in the server's `.env`, for the sign-in email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL` (the From address), `SMTP_SENDER_NAME`.

### Set it up (once)

1. Sign in to the AWS account (Fezy's) as in "First time" above. Fezy runs this setup (#263).
2. Create it: `cd infra && npx cdk deploy WeddedBackend --profile wedded`. The first boot takes about 10 minutes (about 3 GB of downloads).
3. The sign-in email. Until the domain, Gmail with an [app password](https://myaccount.google.com/apppasswords) (Resend once the domain is verified). In Git Bash on Windows, run `export MSYS_NO_PATHCONV=1` first, or it turns `/wedded/…` into a Windows path:
   ```
   put() { aws ssm put-parameter --profile wedded --region us-east-2 --overwrite --type SecureString --name "/wedded/backend/$1" --value "$2"; }
   put env/SMTP_HOST smtp.gmail.com
   put env/SMTP_PORT 587
   put env/SMTP_USER <the gmail address>
   put env/SMTP_PASS '<the app password>'
   put env/SMTP_ADMIN_EMAIL <the gmail address>
   put env/SMTP_SENDER_NAME Wedded
   ```
   And the functions' settings from docs/HOSTED_SETUP.md step 4 the same way, for example `put functions/RESEND_API_KEY '<key>'`.
4. `npm run backend -- deploy`. It ends with `Up to date: https://….sslip.io`.
5. Bring the demo's data over (or run `npm run backend -- deploy --seed` instead, for a fresh demo with the sample vendors):
   1. Supabase dashboard → **Connect** → **Session pooler**: copy the address with the database password filled in, and save it: `put copy/SOURCE_DB_URL '<the address>'`. Encode the password's symbols (`?` is `%3F`, `@` is `%40`, `+` is `%2B`) and keep every other character, `_` included.
   2. `npm run backend -- copy-from-supabase`: accounts and every table, in one go. It refuses if the server already has accounts; `REPLACE=1 npm run backend -- copy-from-supabase` replaces them.
   3. The files: `eval "$(npm run -s backend -- env)"`, then `FROM_URL=https://ujkshrptgmbtstrjcyfy.supabase.co FROM_SECRET_KEY=<the demo's service role key> npm run storage:copy`. Safe to run again.
   4. `aws ssm delete-parameter --profile wedded --region us-east-2 --name /wedded/backend/copy/SOURCE_DB_URL`
6. Check it: `eval "$(npm run -s backend -- env)"` and `npm run demo:check -- --hall=<hall slug> --send`.
7. Switch the app: on expo.dev → the project → **Environment variables** → `preview`, set `EXPO_PUBLIC_SUPABASE_URL` to the `Url` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the publishable key from `npm run backend -- env`. Then `npx eas-cli@latest update --channel demo --environment preview` from a checkout without `.env.local` (its local values would go into the app too). Everyone signs in again once; sessions belong to the old address. Done 2026-10-17.
8. Deploys from CI: the stack's `DeployUser` may only upload `app/`, run commands on this server and read this stack (the organization denies IAM OIDC providers, so GitHub can't assume a role). Give GitHub its key:
   ```
   aws iam create-access-key --profile wedded --user-name <DeployUser> --output json > key.json
   jq -rj .AccessKey.AccessKeyId key.json | gh secret set AWS_ACCESS_KEY_ID
   jq -rj .AccessKey.SecretAccessKey key.json | gh secret set AWS_SECRET_ACCESS_KEY
   rm key.json
   ```

### Day to day

- Every merge to `main` runs `npm run backend -- deploy` in `.github/workflows/demo.yml`, then `npm run backend -- check` (Auth health, a table read and a search with the app's key; the run goes red if any fails), before the app is published. By hand, the same command from an up-to-date `main` (never a branch: the server is shared).
- Scripts (`vendors:import`, `photos:upload`, `demo:check`, the samples): run `eval "$(npm run -s backend -- env)"` first instead of pasting the hosted keys.
- The dashboard (Studio) is at the `Url`: user `supabase`, password from `aws ssm get-parameter --profile wedded --region us-east-2 --with-decryption --name /wedded/backend/keys/dashboard --query Parameter.Value --output text`.
- A shell on the server: `aws ssm start-session --profile wedded --region us-east-2 --target <InstanceId>` (needs `brew install --cask session-manager-plugin`), then `sudo -i`, `cd /opt/wedded/supabase` and `sh run.sh status`, `sh run.sh logs auth` and so on.
- Updating Supabase: on the server, as in [their guide](https://supabase.com/docs/guides/self-hosting/updating) (`sh update.sh`). Take a snapshot first (EC2 → Volumes → Create snapshot).

### Cost

The t4g.small is free until 2026-12-31 (EC2's t4g.small trial), then about $12 a month. Add about $2.40 for the 30 GB disk, $3.60 for the Elastic IP, under $1 for snapshots and cents for S3. The Free plan's credits cover it until 2027-04-06.
