# Wedded on AWS

Infrastructure as code with the [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/home.html) (TypeScript). Three stacks: `WeddedMedia`, vendor photos (below); `WeddedBackend`, the app's whole backend on one server, the shared demo that doubles as staging ([further down](#the-backend-server-weddedbackend)); and `WeddedBackendProd`, the same for production ([Production](#production)).

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
- **Deploy** (`npm run backend -- deploy`, which runs `backend/deploy.sh` on the server): copies `supabase/` over, sets our settings (`backend/docker-compose.wedded.yml`: sign-in by code only, "Confirm email" on, Apple for Expo Go, no phone yet), loads the server functions and the sign-in email (its pictures load from the web app, `public/email`, at the address the deploy fills in; sign-in restarts when the email changes), starts everything behind Caddy (HTTPS from Let's Encrypt) and runs the migrations.
- **Address**: `https://<the Elastic IP with dashes>.sslip.io` (the `Url` output) until we have a domain (#148). Then point `api.<domain>` at the Elastic IP, run `npx cdk deploy WeddedBackend -c domain=api.<domain>` and deploy again.
- **The web app**: Caddy also serves the Expo web export at `https://www.<the same name>` (`backend/web.Caddyfile`), so the wedding website, RSVPs and invites open in any browser. CI builds it with the Expo `preview` values and deploys it with `WEB=dist npm run backend -- deploy`; a deploy without `WEB` keeps the last one. Each export's scripts stay for 2 days after the last export that had them, so a page someone opened before a deploy can still open its next screen. The app's share links go there through `EXPO_PUBLIC_WEB_URL` in the `preview` environment. With a domain, put its name in `/wedded/backend/env/WEB_DOMAIN` and set `EXPO_PUBLIC_SITE_URL` instead.
- **Files** are in the stack's S3 bucket. **Backups**: a snapshot of the disk every night at 3 AM California time, kept 7 days. To go back to one: EC2 → Instances → the server → Actions → Monitor and troubleshoot → Replace root volume, and pick the snapshot.
- **Settings and secrets** live in Parameter Store (Systems Manager), never in git. Deploy again after changing one:
  - `/wedded/backend/functions/<NAME>`: the server functions' settings, what `supabase secrets set` did on the hosted project: `RESEND_API_KEY`, `FOUNDERS_EMAIL`, `INQUIRY_TEST_INBOX`, `INQUIRY_FROM` (only once the domain is verified; docs/HOSTED_SETUP.md step 4), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EXPO_ACCESS_TOKEN` and the rest.
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

- Every merge to `main` runs `npm run backend -- deploy` in `.github/workflows/demo.yml`, then `npm run backend -- check` (Auth health, a table read and a search with the app's key; the run goes red if any fails), before the app is published. By hand, the same command from an up-to-date `main` (never a branch: the server is shared). Production never changes from a merge: see [Production](#production).
- Scripts (`vendors:import`, `photos:upload`, `demo:check`, the samples): run `eval "$(npm run -s backend -- env)"` first instead of pasting the hosted keys.
- The dashboard (Studio) is at the `Url`: user `supabase`, password from `aws ssm get-parameter --profile wedded --region us-east-2 --with-decryption --name /wedded/backend/keys/dashboard --query Parameter.Value --output text`.
- A shell on the server: `aws ssm start-session --profile wedded --region us-east-2 --target <InstanceId>` (needs `brew install --cask session-manager-plugin`), then `sudo -i`, `cd /opt/wedded/supabase` and `sh run.sh status`, `sh run.sh logs auth` and so on.
- Updating Supabase: on the server, as in [their guide](https://supabase.com/docs/guides/self-hosting/updating) (`sh update.sh`). Take a snapshot first (EC2 → Volumes → Create snapshot).

### Production

`WeddedBackendProd` is this same stack deployed a second time with `stage: 'prod'` (`bin/infra.ts`): its own server, address, S3 bucket, nightly snapshots and deploy user, with its settings under `/wedded/prod/` instead of `/wedded/backend/` (the stack's `ParameterPrefix` output), so nothing on the demo can reach it. The demo is staging: every merge to `main` runs there first. Production changes only when a founder publishes a GitHub Release.

Every `npm run backend` command takes `STAGE=prod` for the production server; without it, it means the demo. `--seed` is refused on production: seed.sql is made-up vendors, and production starts empty, with the reference data from the migrations.

**Set it up (once).** Signed in to Fezy's AWS account as in "First time":

1. `cd infra && npx cdk deploy WeddedBackendProd --profile wedded`. The first boot takes about 10 minutes.
2. Its settings, as in step 3 of the demo's setup but under `prod/`:
   ```
   put() { aws ssm put-parameter --profile wedded --region us-east-2 --overwrite --type SecureString --name "/wedded/prod/$1" --value "$2"; }
   ```
   then the `env/SMTP_*` lines and the `functions/*` settings. Real inboxes and sender only, never `INQUIRY_TEST_INBOX`: production emails go to real families and vendors.
3. `STAGE=prod npm run backend -- deploy` (no `--seed`). Real vendors come in afterwards with `eval "$(STAGE=prod npm run -s backend -- env)"` and `npm run vendors:import`.
4. `STAGE=prod npm run backend -- check`.
5. The app: on expo.dev → the project → **Environment variables** → `production`, set `EXPO_PUBLIC_SUPABASE_URL` to the stack's `Url`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `STAGE=prod npm run backend -- env`, `EXPO_PUBLIC_WEB_URL` to `https://www.<the same name>`, and `EXPO_PUBLIC_SENTRY_DSN` as in `preview`.
6. Deploys from a Release: make the production `DeployUser`'s key as in step 8 of the demo's setup, with the user from `aws cloudformation describe-stacks --profile wedded --region us-east-2 --stack-name WeddedBackendProd --query "Stacks[0].Outputs[?OutputKey=='DeployUser'].OutputValue" --output text`, and save it as the repo secrets `PROD_AWS_ACCESS_KEY_ID` and `PROD_AWS_SECRET_ACCESS_KEY`. The Expo robot (`EXPO_TOKEN`) must be able to read the `production` environment.

**Releasing.** From an up-to-date `main`:

```
gh release create v2026.11.23 --generate-notes --target main
```

Publishing the release runs `.github/workflows/prod.yml`: the web export with the `production` values, `STAGE=prod npm run backend -- deploy`, `STAGE=prod npm run backend -- check`, then `eas update --channel production --environment production`. A release whose commit isn't on `main` is refused. Name releases by the day (`v2026.11.23`; `v2026.11.23-2` for a second one). The server only moves forward, since migrations don't run backwards: to undo a release, land a fix or a revert on `main`, watch it on the demo, and publish a new release. Until there is a store build (docs/PROJECT_PLAN.md, Phase 4), the production channel opens in Expo Go like the demo's: `exp://u.expo.dev/b5558b15-659d-4436-9469-dcd2b7a8e213?runtime-version=exposdk%3A58.0.0&channel-name=production`.

### Cost

The t4g.small is free until 2026-12-31 (EC2's t4g.small trial), then about $12 a month. Add about $2.40 for the 30 GB disk, $3.60 for the Elastic IP, under $1 for snapshots and cents for S3. The Free plan's credits cover it until 2027-04-06. Production is a second server, and the trial covers one server's hours, so it costs about $12 a month from its first day plus about $7 for its disk, address and snapshots: about $38 a month for both after the trial, from the same credits.
