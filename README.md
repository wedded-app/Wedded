# Wedded App

> The name is **Wedded App** ("App" is part of the name). The App Store, domain and trademark checks are still to do (Phase 5).

A cross-platform mobile app (iOS and Android) for finding and booking every wedding vendor, organized by event: roka, mehndi, jaago, anand karaj, reception, and more.

- **Founders:** Kirat and Fezy (50/50)
- **Launch market:** Northern California (510, 916, 408, 209, 530), starting with Punjabi wedding vendors. The brand is for every culture.
- **Approach:** Build the app and prove it works with sample vendors first. Handle the name, LLC, and other official steps once the app is running.

## Stack

| Layer      | Tool                                             |
| ---------- | ------------------------------------------------ |
| App        | Expo (React Native), TypeScript, Expo Router     |
| Backend    | Supabase (auth, Postgres, file storage)          |
| Code style | ESLint and Prettier                              |
| Builds     | EAS Build (TestFlight and Play internal testing) |
| Design     | Figma                                            |

## Run it

```bash
npm install
npx expo start        # then scan the QR code with Expo Go on your phone
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm test              # unit tests (Jest); npm run test:watch while working
npm run format        # Prettier (format:check runs in CI)
```

### Local database (Supabase)

Development runs on a local Supabase in Docker, so the dev database never pauses. One-time setup on a Mac:

```bash
brew install colima docker supabase/tap/supabase
colima start --cpu 4 --memory 6 --disk 40   # Docker engine; run again after a restart
```

Then, from the repo:

```bash
npm run db:start      # starts Supabase locally (first run downloads a few GB)
npm run db:status     # shows the local URL and publishable key
npm run db:reset      # rebuilds the database from supabase/migrations and seed.sql
npm run db:test       # runs the database tests in supabase/tests
npm run db:types      # regenerates src/types/database.ts after a schema change
npm run db:stop
```

Copy `.env.example` to `.env.local` and fill in the two values from `npm run db:status`. To test on a phone with Expo Go, use your Mac's Wi-Fi IP instead of `127.0.0.1` (`ipconfig getifaddr en0`). Supabase Studio, a web UI for the local database, is at http://127.0.0.1:54323. Emails the local database sends (sign-in codes) land in Mailpit at http://127.0.0.1:54324, not in a real inbox.

If a local sign-in email arrives as a link instead of a 6-digit code, Docker is serving a stale copy of `supabase/templates/sign-in-code.html` (switching git branches can replace the file). Run `npm run db:stop && npm run db:start`; your local data is kept.

### Adding a real vendor

Write the vendor's details in a JSON file in `vendor-data/` (gitignored, since it holds their email and your notes). Copy [docs/examples/vendor.example.json](docs/examples/vendor.example.json): field names are the `vendors` columns, plus `categories` (1 to 3 slugs, primary first), `events`, `private` (email, owner name, notes: never shown in the app), `links` (a hall's approved caterers, only ones both sides confirmed) and, for a public address only, `latitude` and `longitude` (in Google Maps, right-click the building and click the numbers). Phone numbers can be typed any way. Home-based vendors leave out the address and coordinates and get their city's centre point. The top of `scripts/vendor-file.ts` lists every field.

```bash
npm run vendors:import -- vendor-data/sunrise.json --local --dry-run   # check only
npm run vendors:import -- vendor-data/sunrise.json --local             # save
```

Everything is checked before anything is saved, and each problem is explained. Running it again updates the vendor (a field left out keeps its value; `null` clears it). A real vendor taking a founding number a sample vendor has gets it, and the sample loses it. Without `--local`, set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for the hosted database. Add their photos next with `npm run photos:upload`.

### Is the demo ready?

`npm run demo:check -- --hall=<slug> --local` walks the November demo path (vision §13) and prints a checklist:

- Reception and Banquet hall.
- The hall first near Yuba City, with a price.
- Its profile: founding #1, the six fact chips, Call and Directions, photos, "Real weddings here" and two approved caterers.
- The Founding Wall.
- Signed in as a throwaway family: saving the hall under Reception and sending a Book a tour request. On the local database, it also finds the booking sheet in Mailpit.

`✗` means the demo breaks; `!` means it works but could look better. For the hosted database, set `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `SUPABASE_PUBLISHABLE_KEY`, and add `--send` to also send the tour request, which emails for real.

### The founders' numbers

`npm run report -- --local` prints the last 7 days as text you can paste into WhatsApp:

- new families;
- inquiries and follow-up answers;
- saves;
- shared plans;
- new vendor sign-ups;
- the most viewed vendors.

Add `--days=30` for longer. `npm run report -- --local --vendor=<slug> --month=2026-10` writes one vendor's monthly scorecard, ready to send to them. For the hosted database, set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` instead of `--local`.

### Vendor accounts (for chat)

A vendor's owner chats with families in the same app, signing in with the same email code. Link their email to their listing:

```bash
npm run vendors:invite -- --local --vendor=royal-orchard-banquet-hall --email=owner@example.com
npm run vendors:invite -- --local --vendor=royal-orchard-banquet-hall --list
```

Add `--role=staff` for their staff, and `--remove` to take access away. Without `--local`, set `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.

### Vendor calendars

Until vendors have accounts, founders keep each vendor's calendar after a call or text:

```bash
npm run availability -- --local --vendor=royal-orchard-banquet-hall --booked=2027-06-12,2027-06-13 --held=2027-06-19 --evening=2027-06-26
npm run availability -- --local --vendor=royal-orchard-banquet-hall --open=2027-06-13 --list
```

- **Days you mark:** `--booked` (all day), `--held` (someone is holding it), `--morning` / `--evening` (that part of the day is booked). `--open` clears a day.
- **Days you don't mark** show as open for 60 days after each update, and after that as unknown. Families see "open", "booked", "held" or "partly booked", never who booked.

### Vendor photos

`npm run photos:samples` gives every sample vendor three labelled placeholder photos on your local database (run it after `npm run db:reset`, which clears them). Three of them are tagged at Royal Orchard for its "Real weddings here"; add `-- --venue=<slug>` to tag them at another hall instead (the real hall, for the demo). For the hosted database, run `npm run photos:upload -- --samples` with `SUPABASE_URL` and `SUPABASE_SECRET_KEY` set. When `sample-photos/<slug>/sample-1.jpg` to `sample-3.jpg` exist (the demo's generated photos; gitignored, Kirat has the folder), those replace the placeholders. To add real photos, put them in a folder with one subfolder per vendor slug:

```
photos/
  royal-orchard-banquet-hall/
    cover.jpg          # becomes the cover (otherwise the first file does)
    hall-stage.jpg
    photos.json        # optional tags: { "hall-stage.jpg": { "event": "reception", "venue": "royal-orchard-banquet-hall", "credit": "frames-by-jas" } }
```

Then run `npm run photos:upload -- photos --local` for your local database, or with `SUPABASE_URL` and `SUPABASE_SECRET_KEY` set for the hosted one. Each photo is resized to 400, 1080 and 1600 wide WebP with a blurhash, uploaded, and registered. Running it again updates photos instead of duplicating them. Keep real vendor photos out of git.

### The whole demo

To make every screen look lived in, run these in order after `npm run db:reset` (`reel-samples/` and `sample-photos/` are gitignored folders of generated clips and photos; Kirat has them):

```
npm run photos:samples
npm run reels:samples -- reel-samples --local
npm run stories:samples -- reel-samples --local
npm run requests:samples -- --local --pro=frames-by-jas --family=<your email>
npm run demo:samples -- --local --family=<your email> --business=frames-by-jas
```

`demo:samples` gives the family's wedding event dates, 14 booked vendors, saved vendors to compare and three family members with reactions and suggestions; six chats with vendors (quotes, a menu, a paid deposit, one unread); six leads and chats for the business; 90 days of page views, searches and contact taps for every published vendor; reel views; and booked or held weekends on the sample vendors' calendars. `stories:samples` has eight of the sample reel posters share a story; stories last 24 hours, so run it again on the morning of a demo. Sign in once in the app first, so the account, profile and wedding exist. For the hosted demo, drop `--local` and set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (photos: `npm run photos:upload -- --samples`). Each command replaces its own earlier samples.

**Through AWS:** add `--aws` to either command (`npm run photos:samples -- --aws`) to send the photos through the AWS pipeline in [infra/](infra/README.md) instead. Each original goes to S3, a Lambda makes the same three sizes, and CloudFront serves them. It needs `aws login --region us-east-2 --profile wedded` (or `AWS_PROFILE`). Then set `EXPO_PUBLIC_MEDIA_URL` in `.env.local` to the stack's `MediaUrl`, and the app loads every vendor photo from CloudFront. Before setting it, run `npm run photos:to-aws -- --local` (or with `SUPABASE_URL` and `SUPABASE_SECRET_KEY` set for the hosted database). It copies every photo that's only in Supabase Storage to AWS, because a photo that isn't on AWS won't load. Running it again copies only what's missing.

### Edge Functions (server code)

`supabase/functions/` holds the server code, written for Deno. `npm run db:start` serves it locally at `http://127.0.0.1:54321/functions/v1/<name>`, and emails it sends land in Mailpit. To check a function, install Deno (`brew install deno`) and run `deno check index.ts && deno lint && deno fmt --check` in its folder. CI runs the same. After adding a new function (or if a local function answers 404 or 503), restart with `npm run db:stop && npm run db:start`.

Settings for the hosted project (set once with `supabase secrets set NAME=value`):

| Name                 | What it's for                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`     | Sending inquiry emails through Resend                                                                                   |
| `INQUIRY_FROM`       | The sender, e.g. `Wedded App <inquiries@mail.yourdomain.com>` (needs the verified domain, Phase 5)                      |
| `FOUNDERS_EMAIL`     | Founders' emails, comma-separated: a blind copy of every inquiry, and relayed inquiries for vendors who don't use email |
| `INQUIRY_TEST_INBOX` | While testing, every vendor email goes here instead of to the vendor                                                    |
| `SITE_URL`           | The website once there's a domain, e.g. `https://weddedapp.com`: chat notification emails link to it                    |

The nightly job that sends queued inquiries (when the daily email limit was reached) reads two values from the database's Vault. Set them once per hosted project in the SQL editor:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<service role key>', 'service_role_key');
```

## Layout

| Path                     | What lives there                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `src/app/`               | Screens and navigators (Expo Router). `(tabs)/` holds Home, Search, Saved, Profile                        |
| `src/components/`        | Reusable UI. `AppText` is the only text component: it picks the font and sets line height                 |
| `src/constants/theme.ts` | Colour, spacing, radius and type-scale tokens from the product vision                                     |
| `src/i18n/`              | The app's English strings, the `useLocale()` hook and `localized()` for database names                    |
| `src/lib/`               | Small utilities (device storage, the Supabase client)                                                     |
| `src/types/database.ts`  | TypeScript types generated from the database (`npm run db:types`); don't edit by hand                     |
| `supabase/migrations/`   | Every database change, in order. Reference data (events, categories) lives here so production gets it too |
| `supabase/tests/`        | Database tests (pgTAP): data completeness and what logged-out and signed-in users can do                  |
| `docs/`                  | Plan, decisions, product vision                                                                           |

## Docs

- [Project plan and checklist](docs/PROJECT_PLAN.md): every phase and task, with checkboxes
- [Product vision](docs/PRODUCT_VISION.md): how the app looks and works, screen by screen, and the November prototype plan
- [Decisions log](docs/DECISIONS.md): what we decided and why
- [Growth research](docs/RESEARCH_GROWTH.md): what successful apps do and what we're building from it
- [Putting the app online](docs/HOSTED_SETUP.md): the hosted Supabase project, emails and server code, step by step

## How we work

- Every feature gets its own branch and a pull request. It merges itself once the checks pass; open it as a draft if you want the other partner to look first.
- Never commit passwords or API keys. Use `.env` files (already ignored by git).
- Every task lives on the task board. Decisions go in the decisions log.
