# Putting the app online (hosted Supabase)

Until now everything has run on a laptop: the database, sign-in emails (in Mailpit) and inquiry emails. For the November demo the app has to work on a phone anywhere, which means one online Supabase project. This is the checklist, in order. Steps marked **(you)** need a founder at a browser; Claude Code can run the rest.

It takes about an hour. Nothing here costs money: the free Supabase plan and the free Resend plan are enough for the demo.

## 1. Create the project (you)

1. Sign in at [supabase.com](https://supabase.com) with the shared founders' account, and create an organization if there isn't one.
2. **New project**. Name: `wedding-app`. Region: **West US (North California)**, closest to our families. Pick a strong database password and save it in the shared password manager, never in the repo.
3. When it's ready, open **Project Settings → API Keys** and note:
   - the **Project URL** (`https://<project-ref>.supabase.co`) and the project ref (the part before `.supabase.co`)
   - the **publishable key** (`sb_publishable_…`): safe to put in the app
   - under **Legacy API keys**, the **service_role** key: a secret. Never paste it in chat, the app or git. It goes only in step 6 and in your shell when running the scripts.

## 2. Link and push the database

```bash
supabase login                                # opens the browser once
supabase link --project-ref <project-ref>     # asks for the database password
supabase db push --dry-run                    # lists the migrations it will run
supabase db push --include-seed               # runs them, plus the 25 sample vendors
```

`--include-seed` is right for the demo: the sample vendors (`is_sample`) fill the lists around the real hall. Leave it off for later pushes, or the seed runs again. The migrations create everything else: tables, security rules, the 101 cities and ZIP codes, the photo bucket and the nightly queued-inquiry job.

## 3. Sign-in emails (you)

In the dashboard, **Authentication**:

1. **Emails → Templates**: paste the contents of `supabase/templates/sign-in-code.html` into both **Magic link** and **Confirm signup**. Subject: `Your sign-in code`. This is what makes the email a 6-digit code instead of a link.
2. **Sign In / Providers → Email**: email provider on, **Confirm email** off, **Email OTP length** 6.
3. **URL Configuration**: nothing needed yet (we don't use links).
4. **Auth Hooks → Add hook → Customize Access Token**: Postgres, schema `public`, function `refuse_password_sign_in` (from the migrations). It refuses every password sign-in. The app never uses passwords, but with **Confirm email** off, anyone calling Supabase's sign-up directly could otherwise claim a family's email or phone with a password, with no code, and keep a back door into their account.

Supabase's built-in email only sends to members of the Supabase organization and only a few an hour. That's fine while only the two founders sign in. **Before the hall owner or anyone else signs in**, set **Emails → SMTP settings** to Resend (host `smtp.resend.com`, port `465`, user `resend`, password: a Resend API key). That needs the verified domain (Phase 5).

## 4. Email for inquiries (you, then Claude)

1. Create a free account at [resend.com](https://resend.com) with the shared founders' email, and create an API key (**Sending access** only).
2. Set the server settings (README, "Edge Functions"):

```bash
supabase secrets set RESEND_API_KEY=<key> FOUNDERS_EMAIL=<founder1>,<founder2> INQUIRY_TEST_INBOX=<the Resend account email>
```

Without a verified domain, Resend only delivers to the account's own email, so `INQUIRY_TEST_INBOX` sends every inquiry there. That's what the demo shows: the booking sheet arriving in our inbox. Once the domain is verified (Phase 5), set `INQUIRY_FROM` and remove `INQUIRY_TEST_INBOX`.

## 5. Deploy the server code

```bash
supabase functions deploy          # send-inquiry, delete-account, send-queued-inquiries, notify-chat
supabase functions list            # all three should say ACTIVE
```

## 6. The nightly job's keys (you, in the SQL editor)

**SQL Editor → New query**, run once:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<legacy service_role key>', 'service_role_key');
```

## 7. Add the real vendors and photos

With the hosted values in your shell only for these commands (not saved anywhere):

```bash
export SUPABASE_URL=https://<project-ref>.supabase.co
export SUPABASE_SECRET_KEY=<legacy service_role key>
npm run vendors:import -- vendor-data/<hall>.json --dry-run
npm run vendors:import -- vendor-data/<hall>.json
npm run photos:upload -- photos
```

Sample-vendor placeholder photos (`photos:samples`) are local only; on the hosted project, sample vendors show their category icon until they get photos.

## 8. Point the app at it

In `.env.local` (gitignored):

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_… key>
```

Then `npx expo start` and scan the QR code with Expo Go. If the phone isn't on the laptop's Wi-Fi, `npx expo start --tunnel`.

## 9. Check it end to end

First the automatic check, with the three values from step 1 in your shell:

```bash
export SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SECRET_KEY=<legacy service_role key> SUPABASE_PUBLISHABLE_KEY=<sb_publishable_… key>
npm run demo:check -- --hall=<hall slug> --send
```

Fix anything marked `✗`. Then do it by hand on a phone: sign in with a founder's email (the code arrives by email), fill in About you, find the hall from Home → Reception → Banquet hall, save it, send a **Book a tour** request, and check the booking sheet arrives in the Resend account's inbox. Then **Profile → My inquiries** shows it as sent.

## 10. Sign-in methods: Apple, Google and phone (you)

The app offers **Continue with Apple** (iPhone only), **Google**, **phone** and **email**. Email works once step 3 is done. Each of the others needs an account with Apple, Google or a text-message company. Until one is set up its button says "Coming soon" (the app asks the project which methods are on), so nothing breaks while you do these one at a time.

On the laptop, everything but Google already works without any accounts: Apple in Expo Go on an iPhone, and phone with the test numbers in `supabase/config.toml` (type (530) 555-0100, then code 123456; no text is sent).

Never run `supabase config push` from the laptop: it would copy the local test numbers and dummy text-message settings to the hosted project. Set these in the dashboard.

### Apple

1. Join the **Apple Developer Program** ($99 a year; the App Store needs it anyway). Enrol as the LLC, not a person, so the store shows the business as the seller; that needs the LLC's D-U-N-S number.
2. For Expo Go (the demo): in the Supabase dashboard, **Authentication → Sign In / Providers → Apple**: turn it on and put `host.exp.Exponent` under **Client IDs**. Leave the secret empty. That's Expo Go's own app id, which is who Apple issues the sign-in to while we're in Expo Go.
3. Before the first real build: pick the bundle id (for example `com.weddedapp.app`) and add it to `app.json` as `ios.bundleIdentifier` (`ios.usesAppleSignIn` is already on, so EAS turns on the Sign in with Apple capability when it builds). Then add it to **Client IDs**, comma-separated: `host.exp.Exponent,com.weddedapp.app`, and the same in `supabase/config.toml`.
4. **Hide My Email**: people can give Apple's relay address (`…@privaterelay.appleid.com`). Our emails (sign-in codes, chat notices) only reach it once the sending domain is registered: developer.apple.com → **Certificates, IDs & Profiles → Services → Sign in with Apple for Email Communication**, add the domain and the From address. Needs the domain (Phase 5).
5. **Before submitting to the App Store**: Apple requires that deleting an account also revokes the person's Apple sign-in (the Sign in with Apple REST API, using a key from step 6). The app doesn't do that yet; it's a server job for the `delete-account` function once there's a key.
6. Later, for Apple on the web and Android (not needed for the demo): create a **Services ID** (for example `com.weddedapp.web`) with Sign in with Apple on, domain `<project-ref>.supabase.co` and return URL `https://<project-ref>.supabase.co/auth/v1/callback`. Create a **Key** with Sign in with Apple, download the `.p8` once (keep it in the password manager, never in git), and note the Key ID and Team ID. Supabase's Apple provider page turns these into the **Secret Key**; add the Services ID to **Client IDs**. The secret expires every 6 months: put a reminder in the calendar.

### Google

1. [console.cloud.google.com](https://console.cloud.google.com) with the founders' account: create a project, `Wedded App`.
2. **Google Auth Platform → Branding**: app name, support email, and later the logo, privacy policy and terms links. **Audience**: External. While it's in Testing, only the Google accounts under **Test users** can sign in (add both founders and anyone trying the demo; up to 100).
3. **Clients → Create client → Web application** (one web client covers iPhone, Android and the web, because sign-in happens in the browser). **Authorized redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback`. To try it in the web build on the laptop, also `http://127.0.0.1:54321/auth/v1/callback` (see `supabase/config.toml`; it can't work on a phone against the laptop). Copy the **Client ID** and **Client secret**.
4. Supabase dashboard, **Authentication → Sign In / Providers → Google**: turn it on and paste both.
5. **Authentication → URL Configuration → Redirect URLs**, add `exp://**` (Expo Go), `weddingapp://**` (real builds) and, once there's a domain, `https://<domain>/**` (the web build). Without these, Google sends people to the Site URL instead of back to the app.
6. Before launch: publish the app (**Audience → Publish app**) so anyone can sign in, and get the branding verified so the consent screen shows our name and logo. The button uses a one-colour G for now; the store build needs Google's official four-colour G from their branding guidelines.

### Phone (text-message codes)

Every text costs money, and US carriers have rules for business texting. Needs the LLC (see the 2026-09-29 sign-in decision in DECISIONS.md).

1. Pick the provider (founders' call; check current prices):
   - **Twilio Verify**: Twilio sends the code from its own registered senders, so there's usually no A2P 10DLC registration; priced per successful check (a few US cents) plus carrier fees.
   - **Twilio Programmable Messaging**: our own number, but US texting needs A2P 10DLC registration of the business (LLC, EIN) and the use case, which can take days to weeks (or a toll-free number with toll-free verification).
2. Create the Twilio account with the founders' email and upgrade it (a trial account only texts numbers you've verified). For Verify, create a **Verify Service** and note its SID (`VA…`); for Messaging, a **Messaging Service** (`MG…`). Note the Account SID and Auth Token (a secret: password manager only).
3. In Twilio, **Messaging → Settings → Geo permissions**: allow only the US and Canada (add India or others only if families need them). This blocks "SMS pumping" fraud, where bots request codes to expensive foreign numbers. Set a usage alert in Billing.
4. Supabase dashboard, **Authentication → Sign In / Providers → Phone**: turn it on, pick Twilio Verify or Twilio, and paste the SIDs and token. OTP length 6. Message: `Your Wedded App code is {{ .Code }}` (Twilio Verify uses its own wording).
5. **Authentication → Rate Limits**: "SMS messages sent per hour" is for the whole project (30 by default). Raise it as families sign up; each number can already only ask once a minute. If bots show up, turn on the CAPTCHA option there.
6. **Test numbers** (same page as step 4): add `15305550100=123456`. Apple's App Review needs a way to sign in; give them that number and code in App Store Connect's review notes. It never sends a text.

## 11. Deposits through Stripe (test mode, free)

For deposits through Wedded (#209). Free in test mode: no card, and no LLC until live payments.

1. **You:** sign up at dashboard.stripe.com/register and stay in **Test mode**. Under **Settings → Connect**, choose that vendors get their own Stripe accounts (Standard). Send Claude the **Publishable key** (`pk_test_…`) and **Secret key** (`sk_test_…`) privately.
2. **Claude:** `supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_test_… STRIPE_SECRET_KEY=sk_test_… --project-ref ujkshrptgmbtstrjcyfy`.
3. **Claude:** in Stripe, **Developers → Webhooks → Add endpoint**, `https://ujkshrptgmbtstrjcyfy.supabase.co/functions/v1/stripe-webhook`, listening to **Events on Connected accounts**: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`. Then `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_… --project-ref ujkshrptgmbtstrjcyfy`.
4. **Check:** a test vendor taps Get paid through Wedded and finishes Stripe's test setup, asks a test family for $500, and the family pays with the test card 4242 4242 4242 4242 (any future date and CVC). Both see "Deposit paid".

## 12. Wedded Pro billing (test mode, #220)

This is a platform subscription to Wedded, separate from vendors' Connect deposits. The existing `STRIPE_SECRET_KEY` must start with `sk_test_`; live keys are refused. No publishable key is needed by the hosted Checkout backend. Keep every secret server-side, never `EXPO_PUBLIC_*` or in git. The blank server template is `supabase/functions/.env.example`.

1. After founder prerequisite #210, create a **test-mode** Wedded Pro product and a recurring **$50.00 USD, every month** price (one licensed unit). Save its `price_…` ID as `STRIPE_PRO_PRICE_ID`. The function rejects a wrong amount, currency, interval, or live price.
2. Set `STRIPE_PRO_RETURN_URL` to the fixed HTTPS page on the Wedded website that tells vendors to return to their account. It must have no query, fragment or credentials. For local web testing, HTTP localhost/127.0.0.1 is allowed. Checkout adds `?pro=success` or `?pro=canceled`; the portal returns to this page. These query values never grant access; call refresh and read `useProStatus`.
3. Configure Stripe's **test-mode customer portal**: payment method updates and cancel at period end. Do not offer price/quantity changes to this single-price plan. Configure the default portal before testing the portal action.
4. Apply the two Pro billing migrations and deploy `pro-billing` and `pro-webhook` when authorized. `pro-webhook` has `verify_jwt=false` and verifies `Stripe-Signature` against the raw body. Authenticated `pro-billing` keeps JWT verification and independently verifies the user and vendor membership.
5. Create a **platform/account webhook**, not a Connect webhook, to `/functions/v1/pro-webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Its separate signing secret is `STRIPE_PRO_WEBHOOK_SECRET`; do not reuse `STRIPE_WEBHOOK_SECRET` for deposits.
6. Store `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_PRO_RETURN_URL`, and `STRIPE_PRO_WEBHOOK_SECRET` in Supabase secrets through the existing private setup process. For local functions, use a gitignored env file. Missing settings return `503 not_set_up`; no fake Pro status is granted.

**Tab 2 contract:** `useProBilling(vendorId)` returns a mutation taking `'checkout' | 'portal' | 'refresh'`, with result `{ url?: string, status: 'pro' | 'free' }`. Open Checkout/portal URLs in the website, then call refresh on return. Continue reading the richer account details through `useProStatus(vendorId)` from `requests.ts`. `proBillingProblem(error)` maps `notSetUp`, `notAllowed`, `signIn`, `alreadySubscribed`, `noCustomer`, `offline`, or `failed`. An existing active, trialing, past-due, unpaid, paused or incomplete subscription returns `alreadySubscribed` instead of creating another; use portal to manage it.

**End-to-end checklist (still pending founder configuration):**

- A member of a test vendor opens Checkout; a stranger receives 403.
- Pay with Stripe's test card; a verified webhook updates `vendor_subscriptions`, and refresh reports Pro. Returning to `?pro=success` without payment does not.
- Open two Checkout requests concurrently: they share one session. Repeat the webhook: access stays consistent. Deliver an old event after canceling: current Stripe state wins.
- Open the customer portal, change the payment method and cancel at period end. Access remains until Stripe marks the subscription canceled; then refresh reports free.
- Verify failed renewal has three days of grace, then free; paused/unpaid/incomplete do not grant access.
- Resubscribe after cancellation: a fresh Checkout attempt is used.

Reference: [Stripe Checkout sessions](https://docs.stripe.com/api/checkout/sessions/create), [customer portal](https://docs.stripe.com/api/customer_portal/sessions/create), [subscription listing](https://docs.stripe.com/api/subscriptions/list), and [webhook verification and ordering](https://docs.stripe.com/webhooks).

## Founders' tools on the hosted database

With `SUPABASE_URL` and `SUPABASE_SECRET_KEY` set in your shell as in step 7, these work on the hosted project too (leave off `--local`):

- `npm run report`: the week's numbers. `-- --vendor=<slug> --month=2026-10` gives a vendor's monthly scorecard.
- `npm run availability -- --vendor=<slug> --booked=…`: keep a vendor's calendar.
- `npm run vendors:import` and `npm run photos:upload`: add real vendors and their photos (step 7).

Everything added since this guide was written (Plan together, the family shortlist, filters, vendor numbers, availability) comes with the migrations in step 2. There's nothing extra to set up.

## Still open

- Decided 2026-10-06: the phone opens the app as an EAS Update in Expo Go, published on every merge to `main` by `.github/workflows/demo.yml` (see CLAUDE.md, "Shared demo"). A development build is only needed once a library Expo Go doesn't include comes in.
- A separate development project (Phase 1, "separate development and production environments") can wait until after the demo. Until then, the local database is development.
