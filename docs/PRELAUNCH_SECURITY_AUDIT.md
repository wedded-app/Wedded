# Pre-launch security audit — 2026-10-14

Baseline: `origin/main` at `6aeec4d` (merged #230). This is a bounded source/dependency/database review, not a penetration-test certification. The new fixes below are reviewable draft PRs, not deployed changes. No main branch push, history rewrite, local-to-hosted config push or credential rotation was performed.

| Requested check | Evidence / result | Action or remaining gate |
| --- | --- | --- |
| Full-history secrets | Gitleaks 8.30.1 default rules with `--redact --log-opts=--all`, after fetching all configured remotes/tags. Complete non-shallow repository: 378 commits, approximately 10.37 MB scanned, no leaks found | Nothing found to rotate. Scanner patterns are not proof that every credential type is absent. Store no raw credentials in this report. |
| npm dependencies | Initial app audit: 1 critical, 54 high, 17 moderate entries; infra: 1 high. Targeted compatible fixes remove shell-quote injection, source-map-js DoS and bundled CDK brace-expansion advisories | [#233](https://github.com/wedded-app/Wedded/pull/233): after updates app 0 critical / 53 high / 17 moderate entries; infra 0. Remaining high entries propagate from unpatched braces and node-forge. See dependency review below. |
| Deno dependencies | `deno audit --lock <absolute path>` passed for all nine Edge lockfiles with Deno 2.9.7 | Re-run after changing imports. stripe-return has no external dependencies/lockfile. |
| OTP abuse / paid SMS | Current clients do not pass captchaToken; local resend intervals were only 1s email / 5s SMS | [#234](https://github.com/wedded-app/Wedded/pull/234): conservative quotas, 60s intervals, Turnstile profile and hosted runbook. Production widget/keys, client challenges and hosted enablement remain a launch blocker. Never copy local test codes or dummy Twilio settings to hosted. |
| RLS and advisors | Fresh isolated DB and hosted catalog both show 53 of 53 public tables with RLS. Isolated and hosted security/performance advisors pass; isolated function lint passes | [#235](https://github.com/wedded-app/Wedded/pull/235) adds catalog regression tests. Hosted check was read-only; shared demo data was not reset. |
| RPC / response minimization | Catalog inventory: 71 non-extension public functions. Explicit TABLE/scalar/JSON return shapes; no public RPC returns an application table's composite row type. Client data queries and service queries use named columns. Business listing JSON uses named keys; business export intentionally includes the authorized vendor's full export | Schema regression in #235 protects against newly returning whole table rows. Existing membership/outsider/ownership tests cover sensitive business/chat/payment/request reads. This is not a proof of every possible future disclosure. |
| Edge authentication / inputs | All ten endpoints classified below. Payment and inquiry identity comes from verified Supabase getUser, deletion also requires recent sign-in; webhook verifies Stripe's signature; unsubscribe verifies HMAC | [#232](https://github.com/wedded-app/Wedded/pull/232) removes decoded-role and empty-key fallbacks for service jobs, requires POST and bounds quietMinutes. Public request body caps and UUID validation are in [#236](https://github.com/wedded-app/Wedded/pull/236). |
| HTML mail | Inquiry and chat builders escape dynamic body/attribute text; unsubscribe/footer escape addresses and purpose text | [#236](https://github.com/wedded-app/Wedded/pull/236) adds a hostile HTML/quote regression. Email transport uses JSON, not handwritten SMTP headers. |
| Upload limits | Server: chat/vendor media 5 MiB, reels 50 MiB; explicit image/audio/video MIME allowlists. Global storage limit 50 MiB supports reels | #235 checks actual bytes and MIME before upload, rejects empty uploads and unsupported reel types; server authorization/limits remain authoritative. Seven SQL security invariants and 383 app assertions passed locally on that branch. |
| Website HTTPS / headers | Existing media S3 buckets enforce SSL and block public access; CloudFront redirects viewers to HTTPS | [WEBSITE_SECURITY.md](WEBSITE_SECURITY.md) documents the future website's TLS, HSTS, CSP and response-header acceptance under #148; not deployed by this audit. |
| Tracking / banner | No first-party analytics or ad-tracking SDK is enabled. Aggregate vendor counters are service metrics, not cross-site advertising profiles | No tracking-consent banner is planned for the current essential-storage product. Check social-embed behavior before making a blanket no-tracking promise. Future analytics: cookieless mode, disabled by default and behind an explicit consent toggle, with withdrawal and policy updates. |

## Endpoint review

| Function | Who may call / validated input | Response scope |
| --- | --- | --- |
| send-inquiry | POST; getUser verifies token; parseInquiry and database validate fields, membership/rates | Inquiry ID/status or bounded error; no vendor private record returned |
| send-queued-inquiries | Service credential; POST after #232; ignores caller-supplied job data | Counts only |
| notify-chat | Service credential; POST and bounded integer quiet window after #232 | Counts only |
| push-chat | Service credential; POST after #232; ignores caller-supplied job data | Counts only |
| delete-account | POST; getUser and recent verified OTP/OAuth sign-in claims | Deleted flag; no user/account dump |
| stripe-connect | POST; getUser, vendor membership, action and UUID | Connection status or vendor-specific setup URL |
| pay-deposit | POST; getUser, deposit UUID and service-only payable check for that user | PaymentSheet inputs for that family's payable deposit; no card data |
| stripe-webhook | POST; Stripe signature verification over raw body before interpreting events | Received flag or bounded error |
| email-unsubscribe | Signed address; GET confirms only, POST accepts stop/resume or one-click | Escaped preference page, no-store/no-referrer |
| stripe-return | Public informational page; boolean query only, no database write | Fixed return-to-app instructions |

The scheduled-job checks previously relied on the gateway for JWT integrity, decoded a role claim themselves and could accept missing auth when SERVICE_KEY was empty. #232 fails closed in the handler itself. Do not disable gateway verification as a replacement for handler checks. CORS wildcard headers on bearer-token mobile APIs do not bypass authentication; do not enable credentialed cookie access with a wildcard origin.

## Dependencies still open

The two direct high-severity causes remain **unfixed upstream** at review time:

- `braces` <=3.0.3: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The latest published version is affected and the advisory lists no patched version. Exposure is Jest/Metro pattern processing. Keep builds/tests on trusted inputs and Metro off untrusted networks; monitor the upstream patch.
- `node-forge` <=1.4.0: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv). No patched published version; used by Expo code-signing tooling. Obtain an upstream fix and review OTA/release-signing exposure before production release. Do not replace crypto primitives casually or accept npm's proposed Expo SDK downgrade.

The dependency PR's [DEPENDENCY_SECURITY.md](DEPENDENCY_SECURITY.md) contains exact versions and validation. It is on that independent branch until merge. Moderate advisories are also still open. CI green does not mean npm audit is clear; nothing was suppressed.

## Founders and lawyer launch gates

- Founders: choose/verify production hostnames, configure Turnstile and provider limits/secrets, wire and test captchaToken on all OTP clients, and keep paid SMS off until negative-token/rate/cost checks pass. Configuration documentation alone does not stop hosted bots.
- Founders/release owner: review and merge green draft PRs, then deploy changed Edge Functions from merged main. This audit did not deploy unmerged security changes. Resolve the unpatched dependency advisories before production release, and re-audit the final combined dependency tree.
- Website owner: deploy and verify the HTTPS/header policy in #148, including actual CSP behavior and social-embed gating.
- Founders + lawyer: finalize legal entity/postal address/privacy contact, CCPA applicability and access/export/deletion request handling, retention and provider/backups cleanup, launch regions, terms/refund wording and content licences. All policy text remains **draft for a lawyer**. #231 follows #228 and merged #230, with verified CC0 provenance.

## Verification and follow-up

Original isolated database suite: 39 files / 546 assertions pass. #235 adds seven invariants. App baseline/dependency suite: 381 assertions; upload branch: 383. Edge-body suite: 13 Deno tests; service-guard suite: 12 shared tests. Touched Edge Functions pass Deno check/lint/format; each branch runs lint/typecheck and GitHub CI. Record exact PR check state before merge; do not mark an unchecked branch ready based on a different branch's run.

The approved six tool installs were already completed at user level and verified before this audit. No OmniRoute was installed. Full policy source drafts are in #231, because #230 had already merged after all checks passed.
