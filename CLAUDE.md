@AGENTS.md

# Wedded App

## Start here

Before planning any feature, read the part of the docs it touches. They are the source of truth; this file only summarizes them.

- `PROJECT_BRIEF.md`: its first section, **Tabs**, says how the work is split and gives the rules for agents. Every task is a GitHub issue on the build plan board; each founder has Tab 1 (server and database) and Tab 2 (app screens). The founder names your tab ("You're Fezy Tab 1"); work only on that tab's issues, and put `Closes #<issue>` in the PR that finishes one. The rest of the file is an overview from 2026-10-06, only partly kept up; for what's built, read `docs/WHERE_THINGS_STAND.md`.
- `docs/PRODUCT_VISION.md`: the original vision, last changed 2026-09-29; where it and `docs/DECISIONS.md` disagree, the decision wins. It is about 150 KB, so read the section you need rather than the whole file:
  - §3 Events and vendor categories: the data the whole app is built on
  - §4 How it looks: the accessibility rules still apply; its colours, type and sizes are replaced by `src/constants/theme.ts`
  - §5 Screen by screen: what the first screens (S0 to S23) must do; their tabs, look and Punjabi switch are out of date, and later screens (Reels, Wed, chat, the wedding website, business mode) are in `docs/WHERE_THINGS_STAND.md`
  - §6 Vendor listings by type: the shared model, halls and gurdwaras in depth
  - §8 Technical reality: how each feature is built on Expo + Supabase, and what goes wrong
  - §13 The November prototype: demo scope, what is in and out, and the week-by-week plan
- `docs/DATABASE.md`: the database on one page: the core tables on a diagram, the rules every table follows, and every table in one line. Read it before touching `supabase/` or `src/data/`. The structure is frozen until the November demo (DECISIONS.md, 2026-10-20): new tables follow Kirat's database design (linked from #304); existing ones aren't renamed or reshaped.
- `docs/WHERE_THINGS_STAND.md`: what's built, feature by feature, and where it lives (read the part you need).
- `docs/PROJECT_PLAN.md`: the 8-phase checklist. Tick a box in the same PR that finishes the task.
- `docs/DECISIONS.md`: decisions already made. Don't reopen one without asking; add new ones at the top.
- `docs/RESEARCH_GROWTH.md`: what successful apps do (Partiful, Meesho, Zola, The Knot, Thumbtack, Airbnb, Houzz) and the features we're building from it, in priority order.
- `docs/HOSTED_SETUP.md`: setting up the hosted Supabase project (push, auth emails, secrets, functions, Vault), in order. The demo has moved to our own server on AWS; its setup is in `infra/README.md`.

## Where things stand

The full feature-by-feature record (tables, functions, hooks, screens, scripts) is **`docs/WHERE_THINGS_STAND.md`**. Read the part your task touches before building, and update it in the PR that changes it. The essentials:

- **Screens:** pages with a title use `NavScreen` (`src/components/nav.tsx`); grouped rows are `ListSection` / `ListRow` / `SectionTitle`; sheets start with `SheetHeader`; text is always `AppText`; buttons `Button`, chips `Chip`, fields `TextField`, empty/loading/error `StateView`. `Icon` takes an Ionicons name and draws the SF Symbol on iPhone (add new ones to its map).
- **Colours and dark mode:** never import colours; `useColors()` in components and `makeStyles((Colors) => …)` for styles. Some places keep one look in both schemes on purpose, each with a comment saying why: the wedding website's designs (`src/features/website/designs.ts`) and invitation cards (`src/features/cards/card-designs.ts`), with their own colours and fonts; printed pages and the first questions (`/onboarding`), always light; text over photos and video (white); and Wed's maroon bow. The app itself uses the system font with no serif or italics, and iOS motion with no bounce or overshoot: `Timing` and `Springs` from the theme or `Motion` in `src/lib/motion.ts` (DECISIONS.md, 2026-10-23). Respect Reduce Motion (Reanimated's `useReducedMotion`), large text (`useFontScale()`), 48 pt taps.
- **Words:** every string in `src/i18n/en.json` through `t()`, plain and warm, with no promise or number we can't back up (DECISIONS.md, 2026-10-14); database names through `localized()`. English only since 2026-10-15 (DECISIONS.md): no Punjabi strings, columns or fonts.
- **Data:** TanStack Query hooks in `src/data/` (Tab 1's side) over the typed Supabase client (`src/lib/supabase.ts`); writes go through RPCs with RLS. Cultures, events and vendor types always come from the database.
- **Accounts:** `useSession()` (`src/features/auth/session.tsx`) with `requireSignIn(action)`; browsing never needs an account. Vendor accounts: `useIsVendor()`; business screens get their business from `useCurrentBusiness()` (`src/features/business/use-current-business.ts`; for a vendor with several, the one they picked), not straight from `useMyBusinesses()`.
- **Main areas:** Home `src/app/(tabs)/(home)/`, Vendors `(tabs)/(search)/vendors.tsx` (Search and Requests on its stack), Reels `(tabs)/discover.tsx`, My Wedding `/plan` (the Wedding tab), vendor page `/v/[slug]`, Ask `/ask`, chat `/messages` and `/chat/[id]`. The wedding website: the builder `/website` (`src/app/website.tsx` and `src/app/website/`, parts in `src/features/website/`); guests open `/w/[slug]` and RSVP at `/rsvp/[token]` without an account.
- **Wed** is not a tab: the bow in the middle of the tab bar slides it (`src/app/wed/`) up as a sheet over any tab. Open it with `openWed()`; from inside it, open other pages with `openFromWed(href)` (both in `src/features/wed/open-wed.ts`), or iOS opens them behind the sheet.
- **Business mode:** `(business)/` has the tabs Today, Leads (Wanted is inside it), Calendar and My page (`business.tsx`), with Wed's bow in the middle opening `/business/wed`; `wanted` and `reels` are routes off the bar, and its other screens are under `/business/*`.
- **Shared demo:** Expo Go opens the latest published `main` (channel `demo`); every merge runs `.github/workflows/demo.yml`, which builds the web app, updates the AWS server with it (`npm run backend -- deploy`), checks it answers, then publishes the app with the repo secret `EXPO_TOKEN`. Only if that run fails, redo its steps by hand from an up-to-date `main` (each ships the checkout it runs from), publishing from a checkout without `.env.local`: `npx eas-cli@latest update --channel demo --environment preview`. Must run in Expo Go until the November demo.
- **Tests:** Jest `*.test.ts` next to the code (never in `src/app`); pgTAP in `supabase/tests`. Local database: `npm run db:start | db:reset | db:test | db:types`.
- **Working together:** each session starts with a briefing (`scripts/session-briefing.sh`); stay in your tab's files, and coordinate shared database resets with the other tab.

## Stack

- **Frontend**: React Native + Expo (SDK 58) with Expo Router
- **Backend/DB**: Supabase (Postgres + Auth + Storage)
- **Platforms**: iOS and Android (cross-platform first; web is secondary)
- Until the November demo, everything must run in Expo Go: no libraries that need a development build (§13)

## User base

Users include elders who may not be tech-savvy. UI must:

- Use large, readable text (minimum 16sp body, 20sp+ headings)
- Keep interactions simple — no multi-step flows without clear progress indicators
- Avoid jargon; use plain, warm language

## Data-driven content

Cultures, event types, and vendor categories must come from the database — never hardcode them in the app. This ensures the app supports any culture or event type without a code change.

## Privacy & security

- Collect only the minimum personal data needed for a feature to work
- Never commit secrets, API keys, or credentials — use `.env.local` (gitignored) locally, GitHub repo secrets for CI, AWS Parameter Store for the server (`infra/README.md`) and the Expo project's `preview` environment for the demo app. `EXPO_PUBLIC_*` values ship inside the app, so never put a secret in one
- `.env.example` documents the required env vars with empty values

## Git workflow

Pull requests merge themselves. When the checks pass, the `Merge when checks pass` job in `.github/workflows/ci.yml` squash-merges the PR into `main`. Nobody has to approve or click merge.

1. Start from a fresh `main`: `git fetch origin`
2. Branch from it: `git switch -c feature/<name> origin/main` (or `fix/`, `docs/`, `chore/`). This works in a worktree too, where `git switch main` fails
3. Before pushing, run what CI runs: `npm run lint -- --max-warnings 0`, `npm run format:check`, `npm run typecheck`, `npm test`, and after changing imports in `src/`, `npx expo export --platform web` (in a worktree without `.env.local`, put CI's `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=ci-placeholder` in front). `npm run format` fixes formatting. If you touched `supabase/`, also `npm run db:reset && npm run db:test && npm run db:types`, `supabase db lint --local --schema public,private --fail-on warning` and `supabase db advisors --local --fail-on warn`, and commit the regenerated types (CI refuses stale ones). A changed Edge Function: `deno check index.ts && deno lint && deno fmt --check && deno test --allow-env --permit-no-files` in its folder (in `_shared`: `deno lint && deno fmt --check && deno test --allow-env`). A changed `infra/`: `npm run typecheck && npm test && npx cdk synth --quiet` there
4. Push and open the PR: `git push -u origin HEAD`, then `gh pr create`
5. Watch it land: `gh pr checks --watch`. All green means it is merged. The bot's merge doesn't close the issue, so close it: `gh issue close <issue> --comment "Done in #<pr>"`

- The PR title becomes the only commit message on `main`, so write it as a short plain sentence: "Add vendor profile screen"
- Keep PRs small: one feature or fix each. Small PRs rarely conflict
- To have the other founder look first, open a draft (`gh pr create --draft`). Drafts never merge on their own; `gh pr ready` sends it through the checks and it merges when green
- Checks failed: fix on the same branch and push again. It merges once green
- `Merge when checks pass` failed: `main` moved and the PR now conflicts. Run `git fetch origin && git merge origin/main`, fix the conflicts, rerun the checks, push
- Never push straight to `main`, and never force-push it
- No AI attribution: no `Co-Authored-By: Claude` trailers and no "Generated with Claude Code" lines in commits or PR descriptions
- GitHub CLI on a Mac: `brew install gh`, then `gh auth login` once
- The repo is `wedded-app/Wedded`. If `git remote -v` still shows `faizant316/…`, `gh pr create` fails: ask a founder to run `git remote set-url origin https://github.com/wedded-app/Wedded.git` once, and until then open the PR with `gh api repos/wedded-app/Wedded/pulls -f title="<title>" -f head=<branch> -f base=main -F body=@<file> --jq .html_url`

## Co-founders

- Gurkirat Bagri — grrcarrotb2022@gmail.com
- Fezy — faizant316 (GitHub: faizant316)
