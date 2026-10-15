# Handoff: Kirat's Tab 1 — Wedded Pro billing (#220)

Continue in `/Users/gurkiratbagri/Projects/wedding-app-tab1`, branch `feature/pro-billing`.
Draft PR: https://github.com/wedded-app/Wedded/pull/224

## Scope and safety

- Tab 1 only: database, Edge Functions, scripts and `src/data`. Do not edit `src/app`, `src/components`, or `src/features` (Tab 2 owns these).
- Commit and push only to `feature/pro-billing`; never push main or run a merge.
- Keep PR #224 draft until the real Stripe checklist passes. Do not mark it ready merely because CI is green; ready PRs auto-merge here.
- Stripe **test mode only**. No live payments, no secrets in commits or messages, no attribution trailers.
- Pause this Codex session before another agent starts editing this checkout. Two sessions previously collided here.

## Context

PR #223 (Requests/data, #218) was completed by the other session and merged on 2026-10-14 at 1:26 a.m. Pacific, with all CI checks passing. Its handoff was removed as part of that completion; do not restore it. Kirat explicitly authorized continuing #220 on the new billing branch.

## Implemented and pushed

- `026ebd6`: Pro billing database state, service-only RPCs and generated types.
- `9f8e2ec`: Checkout, customer portal, subscription webhook, hooks, tests and setup docs.
- `supabase/migrations/20261014140000_pro_billing.sql`: unique customer IDs, Stripe statuses (including paused/incomplete_expired), ordered refresh timestamps and shared checkout-attempt keys. `save_pro_customer`, `save_pro_subscription`, `claim_pro_checkout` are service-role only. Live customer writes are refused.
- `20261014141000_pro_checkout_lifecycle.sql`: confirmation of a subscription clears the old Checkout attempt, so canceled vendors can buy again using a fresh session.
- `supabase/functions/pro-billing`: authenticated vendor membership required; POST `{ vendorId, action: 'checkout' | 'portal' | 'refresh' }`; result `{ url?: string, status: 'pro' | 'free' }`. Checkout validates a test-mode $50 USD monthly licensed price and refuses a second unfinished/current subscription. Retry/concurrent requests share a database-backed Stripe idempotency key. URLs and price are server-configured.
- `supabase/functions/pro-webhook`: separate platform webhook signature on the raw request body. Ignores live and Connect events. Fetches the current configured-price subscriptions instead of trusting event order. Unknown customers are ignored; failed writes return 500 so Stripe retries.
- `supabase/functions/_shared/pro.ts`: test-only settings, price validation, Pro grace policy, subscription selection and refresh.
- `src/data/pro-billing.ts`: `useProBilling(vendorId)` takes `checkout`, `portal` or `refresh`. `proBillingProblem(error)` exposes `notSetUp`, `notAllowed`, `signIn`, `alreadySubscribed`, `noCustomer`, `offline`, `failed`. URLs are checked against the appropriate Stripe HTTPS host. Pro/looking/summary caches are invalidated after actions. Existing `useProStatus` continues to return richer status details from `requests.ts`.
- Setup and Tab 2 contract: `docs/HOSTED_SETUP.md` section 12; status record: `docs/WHERE_THINGS_STAND.md`; blank server env template: `supabase/functions/.env.example`.

## Verified locally

- `npm run lint -- --max-warnings 0`: pass.
- `npm run format:check`: pass.
- `npm run typecheck`: pass.
- `npm test -- --ci --runInBand`: 60 suites, 391 tests pass.
- `npx expo export --platform web --output-dir /tmp/wedded-pro-billing-web`: pass.
- Deno check/lint/fmt for both new functions and lint/fmt for `_shared`: pass.
- `cd supabase/functions/pro-billing && deno test handler.test.ts`: 12 tests pass, including real Stripe signature verification with a generated test secret (no external Stripe calls).
- `supabase test db supabase/tests/pro_billing.test.sql`: 21 billing tests pass.
- Full suite against a fresh isolated database: **39 files, 554 tests, Result: PASS**. Fresh schema lint/advisors pass and regenerated types exactly match committed types.
- Shared local `supabase test db` fails existing reels/weddings tests because of extra development records. Do not reset the shared database to fix this. Fresh verification used a separate project `wedded-pro-ci` on port 55422 and was then stopped. Its configuration is `/tmp/wedded-pro-ci`; to rerun, start that database and run from the real checkout:
  `supabase test db --db-url 'postgresql://postgres:postgres@127.0.0.1:55422/postgres?sslmode=disable'`
  These are the default credentials of the disposable local test database. The CLI's test file discovery/mounting fails when run directly from the temporary project folder.
- CI on implementation commit `9f8e2ec`: database, Edge Functions and infrastructure passed; app check was still running when this handoff was written. Check the latest commit's CI before proceeding.

## Remaining, in order

1. Read issue #210 and `docs/HOSTED_SETUP.md` section 12. #210 is still open. No `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_PRO_RETURN_URL` or `STRIPE_PRO_WEBHOOK_SECRET` is configured in the local environment or usual gitignored env files. No hosted secrets were read, set or changed. No functions were deployed.
2. Founder supplies a Stripe test account/key privately and the website return page. Configure the $50 monthly price, test portal (payment method updates, cancellation at period end), and the separate platform subscription webhook. Keep deployment/configuration within founder authorization. Never use live keys.
3. Run every end-to-end item in section 12: membership refusal, successful test payment and webhook granting Pro, unpaid success URL cannot grant Pro, concurrent Checkout reuse, repeated/late webhook handling, portal card update/cancellation, failed-renewal grace, resubscribe after cancellation. Record evidence and fix failures on this branch.
4. Tell Tab 2 the `useProBilling` / `proBillingProblem` contract through the founder or the agreed coordination process. App screens remain Tab 2 work.
5. Rerun required CI checks if code changes; verify PR checks. Only after end-to-end passes, update the PR to `Closes #220`, remove this handoff when appropriate, and mark PR #224 ready if Kirat authorizes releasing it. Never merge manually.

Codex cannot automatically restart Claude Code at 4:40 a.m.; Kirat must reopen Claude and point it to this handoff.
