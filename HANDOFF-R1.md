# Handoff: R1 Requests and proposals (data), #218 (plan #217)

Written by Kirat's Tab 1 (Claude) when usage ran out. Whoever picks this up (Codex or Claude): this is **Tab 1** work only (supabase/, Edge Functions, scripts/, src/data/). Tab 2 (screens) is building on `feature/requests-screens` against these shapes.

## Done on this branch
- `supabase/migrations/20261014120000_requests.sql`, **written but NOT yet applied or tested**:
  - `vendor_subscriptions` + `private.is_pro()`
  - `wedding_requests`, `request_proposals`, and the new `proposal` message kind
  - `post_request`, `close_request`, `families_looking`, `families_looking_summary`, `send_proposal`, `withdraw_proposal`, `answer_proposal`, `request_proposals_for`

## To do, in order
1. Apply it locally: `supabase migration up --local`. Fix any errors. It uses `private.can_edit_wedding`, `private.is_vendor_member`, `private.short_name`, `private.blocked_between` and `private.vendor_date_status`, all of which already exist.
2. Write `supabase/tests/requests.test.sql` (pgTAP, same style as `supabase/tests/deposits.test.sql`). Cover:
   - post (editor only, validations, already_open, limits)
   - a non-Pro vendor gets pro_only, while the summary works for free vendors
   - a Pro vendor sees the request with the short name and town only
   - send_proposal (once, 10 cap, a category that doesn't fit gives not_open)
   - answer_proposal accept: the conversation and both proposal messages are created, and after that the vendor can send_message
   - decline, withdraw, close
   - strangers are refused
   - Make a vendor Pro in tests with an insert into vendor_subscriptions (status 'active') as superuser. Pin times to California days as in business_insights.test.sql.
3. Run `npm run db:types`.
4. Write `src/data/requests.ts` with these exact names (Tab 2 is mocking them):
   - **Family:**
     - `usePostRequest(weddingId)` takes `{ categorySlug, eventSlug?, eventDate?, guestBand?, budgetMinCents?, budgetMaxCents?, note, citySlug }`
     - `useMyRequests(weddingId)` returns rows from `wedding_requests` with `categorySlug`, `eventSlug`, `status`, `proposalCount`, `createdAt`, `eventDate`
     - `useRequestProposals(requestId)` uses the `request_proposals_for` rpc and maps `cover_path` through `photoUrl()`
     - `useAnswerProposal()` returns the conversationId on accept
     - `useCloseRequest()`
   - **Vendor:**
     - `useFamiliesLooking(vendorId, { categorySlug?, maxMiles?, from?, to? })` is paged by `p_before` and returns `postedAt` (= created_at)
     - `useFamiliesLookingSummary(vendorId)`
     - `useSendProposal(vendorId)` and `useWithdrawProposal()`
     - `useMyProposals(vendorId)` reads `request_proposals` by vendor_id
     - `useProStatus(vendorId)` reads `vendor_subscriptions` and returns 'pro' | 'free'
   - `requestProblem(error)` maps the errors named in each function's comment.
   - Jest tests next to it (mock `@/lib/supabase`; factory variables must start with `mock`).
5. Add `proposal` to `MessageKind` in `src/data/chat.ts`: `Message.proposal = { proposalId, requestId, update: 'accepted' | null }`. Add "sent a proposal" to notify-chat's `KIND_TEXT`, and a `case 'proposal'` to `supabase/functions/push-chat/push.ts` `pushBody` ("Sent you a proposal" / "Accepted your proposal"), with a Deno test.
6. Add notes to `docs/WHERE_THINGS_STAND.md` (not CLAUDE.md), and a row at the top of `docs/DECISIONS.md`. The decision (Kirat, 2026-10-14):
   - Requests and Wedded Pro, $50 a month, sold on the website through Stripe
   - proposals rather than open messaging, about 10 per request
   - a teaser for free vendors
   - names: Requests / Families looking
   - privacy: short name and town only until accepted
   - it changes the "leads are free" principle: inquiries families send stay free, and Pro is for reaching out first
   Update the principle line in `PROJECT_BRIEF.md` to match.
7. Run what CI runs:
   - `npm run lint -- --max-warnings 0`
   - `npm run format:check`
   - `npm run typecheck`
   - `npm test`
   - `npx expo export --platform web`
   - `supabase test db` (weddings.test.sql may fail locally only because of leftover local data, which is fine)
   - `supabase db advisors --local --fail-on warn` (no two permissive policies for the same role and action)
8. Delete this file, mark the PR ready (`gh pr ready`) with "Closes #218", and tell Tab 2 the hook names.

## Repo rules
- PRs merge themselves when green; never push to main.
- No AI attribution lines in commits or PRs.
- Then R3 (#220, Wedded Pro billing with Stripe Checkout on the web, test mode) follows the same pattern as the deposits functions in `supabase/functions/_shared/stripe.ts`.
