# Handoff: Kirat's Tab 1, legal checklist data side (#228)

Continue in `/Users/gurkiratbagri/Projects/wedding-app-tab1`, branch `feature/email-unsubscribe` (draft PR). Tab 1 files only (supabase/, scripts/, src/data/, docs). Never push main, no AI attribution, delete this file in the final commit.

## Done (uncommitted work committed as WIP, not yet tested)

- `supabase/migrations/20261014160000_email_opt_outs.sql`: `email_opt_outs` (service role only).
- `supabase/functions/_shared/email-links.ts`: HMAC-signed stop link (`signedParams`, `verifiedEmail`, key `EMAIL_LINK_SECRET` or the service key), `withFooter(email, recipient, why)` (why / stop link / `businessLine()` from `BUSINESS_NAME`, `BUSINESS_ADDRESS`; List-Unsubscribe one-click headers only when the email has one recipient and no cc), `optedOut(admin, addresses)`, `inquiryEmailFor(admin, input)` (vendor opted out → relay through founders; family opted out → no cc).
- `inquiry-email.ts`: `OutgoingEmail.headers`, passed to Resend and Mailpit.
- `notify-chat`: one email per address, opted-out skipped, footer per person.
- `send-inquiry`, `send-queued-inquiries`: use `inquiryEmailFor`.

## Remaining, in order

1. New function `supabase/functions/email-unsubscribe/index.ts` (+ `deno.json` like notify-chat; `[functions.email-unsubscribe] verify_jwt = false` in config.toml). GET `?e&t`: verify; page "Stop emails to x@y?" with a POST button (never stop on GET: mail scanners open links). POST (form `action=stop|resume`, or body `List-Unsubscribe=One-Click`): insert into / delete from `email_opt_outs`, show "You're unsubscribed" with "Start emails again". Same plain page style as `stripe-return`. Bad signature → 400 page.
2. Tests: `_shared/email-links.test.ts` (sign/verify round trip, altered e or t rejected, footer text, headers only when alone, inquiryEmailFor relay/cc with a fake admin); pgTAP `supabase/tests/email_opt_outs.test.sql` (anon/authenticated can't read or write).
3. `npm run db:reset && npm run db:test && npm run db:types` (or a fresh isolated DB if the shared one has extra dev data, as in HANDOFF-R3), plus lint, format:check, typecheck, test, web export; deno check/lint/fmt every touched function.
4. Docs: `docs/WHERE_THINGS_STAND.md` (emails section), `docs/HOSTED_SETUP.md` (optional `EMAIL_LINK_SECRET`, `BUSINESS_ADDRESS` once the LLC exists), and new `docs/LEGAL_CHECKLIST.md`: Kirat's 20 items (privacy policy, terms, refund policy, cookie policy, cookie banner, form consents, no unnecessary data, third-party SDK audit, dark patterns, hidden fees, fake reviews, unsupported claims, alt text, contrast, keyboard nav, business details, age consent, unsubscribe, font/image licences, data deletion) each with status and owner (Tab 1 #228, Tab 2 #229, founders + lawyer). Include the data inventory (every personal field and why) and the SDK/service table: Supabase (data, auth), Stripe (cards, Connect, Pro), Expo push via Apple/Google, Apple sign-in, Resend email, TikTok/Instagram oEmbed and embeds in a webview, fonts bundled (OFL). No analytics or ad SDKs today, so the web needs no cookie banner. Add first drafts of Privacy, Terms and Refund (Wedded Pro cancel any time, ends at period end, no partial refunds; deposits are between family and vendor, refunds through the vendor) marked "draft for a lawyer".
5. Push, mark the PR ready ("Closes #228" only if every item is done, else "Part of #228"). After it merges: from `wedding-app-b1` on origin/main, `yes | supabase db push --include-all -p "$(cat ~/.config/wedded/demo-db-password)"`, then deploy `email-unsubscribe notify-chat send-inquiry send-queued-inquiries` with `--project-ref ujkshrptgmbtstrjcyfy --use-api`.
6. Tell Tab 2 (#229) the policy page paths once they exist.

## Also open for Kirat

- Demo: once Kirat signs in on the demo with Apple and plans his wedding, run from `wedding-app-samples` (on origin/main) with the demo URL and service key: `npm run requests:samples -- --pro=dhol-di-awaaz --family=<his email>`, and add him to `vendor_members` for dhol-di-awaaz (`npm run vendors:invite`).
- PR #224 (Pro billing) stays draft until the Stripe test keys (#210) and the checklist in HANDOFF-R3.md.
- Tool installs from his videos wait for his OK: design skills `npx skills add pbakaus/impeccable`, `Leonxlnx/taste-skill`, `emilkowalski/skills`; token savers `rtk-ai/rtk`, `Graphify-Labs/graphify`, `DietrichGebert/ponytail`. Skip OmniRoute (routes code to other AI providers).
