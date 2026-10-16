# Wedded App: Project Plan and Checklist

Converted from the original PDF plan. Work through the phases in order. There are no deadlines. Tick a box (`- [x]`) when a task is fully finished, and add `(Kirat)` or `(Fezy)` after a task when someone takes it.

| | |
| --- | --- |
| **Founders** | Kirat and Fezy, 50/50 partners |
| **Product** | Cross-platform mobile app (iOS and Android) to find and book every wedding vendor, organized by event |
| **Launch market** | Northern California Punjabi weddings (510, 916, 408, 209, 530) |
| **Approach** | Build the app and prove it works with sample vendors first. Handle the name, LLC, and other official steps once the app is running. |
| **Standard** | Build it like a real company would: clean code, real design, proper testing, and professional tools |

## Phase overview

| Phase | Focus |
| --- | --- |
| 1. Setup | Tools, repo, starter app on both phones, and a simple partnership agreement |
| 2. Design | Brand basics, design system, and every screen in Figma |
| 3. Build the App | All core features working |
| 4. Test with Sample Vendors | Fake vendors, full testing on both phones, installable builds |
| 5. Make It Official | Final name, domain, Instagram, LLC, bank, legal documents |
| 6. Vendor Research and Outreach | Vendor list, founding vendors signed, family beta test |
| 7. Public Launch | Quality checks, store submission, and marketing |
| 8. Growth | Reviews, vendor accounts, paid features, and expansion |

## Requirements: Tools and Accounts

| Requirement | Details |
| --- | --- |
| GitHub | Organization and shared repo, both of us as admins |
| Figma | Design and prototyping |
| Task board | Linear, GitHub Projects, or Notion |
| Google Drive | Shared docs and vendor data |
| AI dev tools | Claude Code and others we use |
| Expo (React Native) | TypeScript and Expo Router |
| Supabase | Auth, database, and file storage |
| ESLint and Prettier | Consistent code style |
| Apple Developer account | $99 per year; needed once we make TestFlight builds (Phase 4) |
| Google Play Console account | $25 one-time; needed once we make Android test builds (Phase 4) |

---

## Phase 1: Setup

### Workspace
- [ ] Create the GitHub organization and shared repo
- [ ] Set up the task board
- [ ] Set up the shared Google Drive folder
- [ ] Set up the shared Figma workspace
- [x] Create the shared decisions doc (Fezy)
- [ ] Schedule the weekly check-in

### Tech
- [x] Create the starter Expo app and push it to the repo (Kirat)
- [x] Set up ESLint and Prettier (Kirat)
- [ ] Create the Supabase project
- [ ] Set up separate development and production environments
- [x] Merge pull requests automatically once the checks pass; drafts wait for review
- [ ] Get the starter app running on Kirat's phone (Expo Go)
- [ ] Get the starter app running on Fezy's phone (Expo Go)

### Partnership
- [ ] Write a simple one-page partnership agreement: 50/50 split, weekly time commitment, how decisions get made, code and brand belong to the future company, what happens if one of us leaves
- [ ] Both sign the partnership agreement

## Ongoing: Name Ideas

Add ideas any time during Phases 1 to 4. No checking or buying until Phase 5.

| Name idea | Suggested by | Notes |
| --- | --- | --- |
| **Wedded App** (chosen) | Kirat | Picked 2026-09-30. "App" is part of the name for trademark and licensing reasons. Culture-neutral, so it works beyond Punjabi weddings. Still to check: App Store, Google Play, domain, Instagram handle, USPTO |
| EverWed | Kirat | Culture-neutral, so it works as we expand beyond Punjabi weddings. "Ever" reflects the full journey, from roka to reception. Easy for elders to say and spell. Made-up word, so easier to trademark than "WED". App Store listing: "Everwed: Wedding Vendors" |
| HostWell | Kirat | Covers every event, not just weddings. Culture-neutral and sounds established. More distinctive than WedBook, so easier to trademark. Risk: doesn't say "wedding," so needs a subtitle. Risk: "host" is common in hotel and web hosting names, so check for conflicts |
| WedBook or BookWed | Kirat | Says exactly what the app does. Easy for elders to understand. Works for any culture. Risk: very descriptive, so weak trademark protection. Risk: "Wedbook" likely already exists, so check first |
| Wedded App | Fez | |

---

## Phase 2: Design

### Brand and Design System
- [ ] Define brand basics: colors, fonts, logo direction, app icon concept
- [ ] Build the Figma design system: buttons, cards, inputs, headers, spacing rules

### Screens in Figma
- [ ] Welcome and signup
- [ ] Home (organized by event)
- [ ] Event page (vendor categories for that event)
- [ ] Search and results
- [ ] Vendor profile
- [ ] Inquiry form
- [ ] Saved vendors
- [ ] User profile and settings
- [ ] Click through the Figma prototype together before writing app code

### Design Rules
- Simple enough for parents and elders: large text, clear buttons, minimal steps
- Browsing works without an account; signup only when saving a vendor or sending an inquiry
- 18+ checkbox at signup, not a birthdate
- Layouts leave room for Punjabi (Gurmukhi) text

---

## Phase 3: Build the App

### Step 1: Data Model and Auth
- [x] Create tables: users, vendors, vendor_categories, vendor_media, cultures, events, event_categories, saved_vendors, inquiries (Kirat; users are `auth.users` plus `profiles`)
- [x] Store cultures, events, and categories as data, not hardcoded (Kirat)
- [x] Store event and category names so they can be translated (English and Punjabi) (Kirat)
- [x] Add vendor base location and service radius; hide street addresses for home-based vendors (Kirat)
- [x] Build signup and login (email or phone) (Kirat; email code now, phone after the LLC)
- [x] Build the user profile: name, city, state, country, 18+ confirmation (Kirat; name, city, phone and 18+, email from sign-in; state and country left out to keep signup short)
- [x] Build in-app account deletion (required by Apple) (Kirat)
- [x] Write row level security rules in Supabase (Kirat; covered by the pgTAP tests in CI)

### Step 2: Navigation and Home
- [x] Bottom tabs: Home, Search, Saved, Profile (Kirat)
- [x] Home organized by event (roka, mehndi, jaago, anand karaj, reception, and more) (Kirat; vendor types first, then events)
- [x] Event page shows the vendor categories for that event (Kirat)

### Step 3: Search and Results
- [x] Search by category and location (Kirat)
- [x] Use phone location or a typed city or zip (Kirat; phone location snaps to the nearest city)
- [x] Sort results by distance (Kirat)
- [x] Results show vendor photo, name, category, and city (Kirat)

### Step 4: Vendor Profiles
- [x] Instagram-style layout: cover photo, photo and video grid, bio, address, phone, email, Instagram link, optional "starting at" price (Kirat; photos now, video later; email stays private and families reach it through the inquiry form)
- [x] Action buttons: Call, Text, Open Instagram, Get Directions, Save, Send Inquiry (Kirat; also WhatsApp and Book a tour)

### Step 5: Inquiries and Saved Vendors
- [x] Inquiry form: event type, date, guest count, message (Kirat)
- [x] Send inquiries by email (all test inquiries go to our own inbox) (Kirat; set INQUIRY_TEST_INBOX)
- [x] Saved vendors grouped by event (Kirat)

### Step 6: Polish
- [ ] Match the Figma designs closely
- [ ] Add loading states, empty states, and error messages on every screen

---

## Phase 4: Test with Sample Vendors
- [x] Create 20 to 30 fake sample vendors across all major categories (made-up names, our own or stock photos) (Kirat; 25 in `supabase/seed.sql`, labelled placeholder photos from `npm run photos:samples`)
- [ ] Test every flow on Kirat's phone: signup, browse by event, search, vendor profile, save, inquiry, account deletion
- [ ] Test every flow on Fezy's phone
- [ ] Log every bug on the task board
- [ ] Fix the bugs
- [ ] Get the Apple Developer account and Google Play Console account
- [ ] Build the iPhone version on TestFlight with EAS Build
- [ ] Build the Android version on internal testing with EAS Build

> **App is ready when:** both of us can install it on our own phones, sign up, browse by event, search near a location, open a vendor profile, save a vendor, and send an inquiry, with no crashes.

---

## Phase 5: Make It Official

### Name and Brand
- [ ] Shortlist 3 to 5 names from the Name Ideas list
- [ ] Check each name: App Store, Google Play, .com domain, Instagram handle, USPTO trademark search
- [x] Pick the final name (Kirat: Wedded App, 2026-09-30)
- [ ] Buy the domain
- [ ] Claim the Instagram handle
- [ ] Finalize the logo and app icon
- [ ] Update the app with the final name, logo, and icon

### Business and Legal
- [ ] Form the LLC
- [ ] Replace the partnership agreement with a full operating agreement (vesting, IP assignment to the LLC)
- [ ] Open a business bank account
- [ ] Set up business email on our domain
- [ ] Move the Apple and Google developer accounts to the LLC
- [ ] Write the privacy policy (required by Apple and Google)
- [ ] Write the terms of service

---

## Phase 6: Vendor Research and Outreach

### Research and Prep
- [ ] Create the vendor spreadsheet: name, category, city, area code, phone, email, Instagram, website, who knows them, contacted, status, notes
- [ ] Fill it with 150 to 200 NorCal vendors (510, 916, 408, 209, 530)
- [ ] Search every source: Instagram, Google Maps, gurdwara contacts, family and friends, tagged wedding posts
- [ ] Reach at least 5 vendors in every major category
- [ ] Flag warm leads (people our families know) to contact first
- [ ] Write the in-person pitch script
- [ ] Write the text and DM script
- [ ] Write the phone call script
- [ ] Write the follow-up script
- [ ] Decide the founding-vendor offer (free for life or free for the first year)
- [ ] Create the vendor consent form for using their photos, videos, and info
- [ ] Record a 60 second walkthrough video of the app

### Outreach and Beta
- [ ] Contact warm leads
- [ ] Contact cold leads
- [ ] Show the app in person or on video calls
- [ ] Sign vendors to free founding listings
- [ ] Collect from each vendor: photos, videos, description, service area, contact info, optional pricing, signed consent
- [ ] Reach 50 signed vendors with coverage in every major category
- [ ] Replace the sample vendors with real vendor profiles
- [ ] Set up a way to add and edit vendors quickly (Supabase table editor first, admin panel only when needed)
- [ ] Beta test with 10 to 20 friends and family who are planning or recently had a wedding
- [ ] Track beta feedback
- [ ] Fix what confuses people

---

## Phase 7: Public Launch

### Quality
- [x] Set up crash and error monitoring (Sentry) (2026-10-16, #273: JavaScript errors from Expo Go now; native crashes once there's a real build)
- [ ] Set up analytics: which categories and vendors get viewed and contacted (started 2026-09-30: vendor profile views and contact taps are counted anonymously in `vendor_activity_daily`, and `npm run report` prints the week; category views still to add)
- [ ] Test on multiple iPhone models and screen sizes
- [ ] Test on multiple Android models and screen sizes
- [ ] Run an accessibility check: text size, contrast, screen reader labels

### Store Release
- [ ] Build the English/Punjabi language toggle
- [ ] Complete the App Store privacy labels and Google Play data safety form
- [ ] Create store screenshots and the store description
- [ ] Submit to the App Store (leave buffer for Apple review)
- [ ] Submit to Google Play

### Marketing
- [ ] Launch the Instagram page with vendor spotlights and wedding content
- [ ] Ask every founding vendor to share the app
- [ ] Spread the word through gurdwaras, family networks, and community events
- [ ] Launch before wedding booking season

---

## Phase 8: Growth

Built in this order.

1. [ ] Reviews and ratings
2. [ ] Vendor accounts so vendors manage their own profiles
3. [ ] Availability calendars (Google Calendar sync)
4. [ ] Premium vendor profiles (paid)
5. [ ] Sponsored "recommended" placements (once traffic is real)
6. [ ] AI wedding planner
7. [ ] Expand to Southern California
8. [ ] Expand to other states, Canada, and the UK
9. [ ] Add other cultures with their own events and categories (started 2026-09-30: Punjabi Hindu, Pakistani, Muslim and Arab event sets in My Wedding; new names await review by families from each community)

---

## How We Work Together
- We both own every part of the app and review each other's work
- Every feature gets its own branch and a pull request; it merges itself once the checks pass (open a draft to have the other partner look first)
- Never commit passwords or API keys; use environment variables
- Every task lives on the task board
- Decisions get written down in the decisions doc
- Weekly check-in: what got done, what's next, blockers

## Key Risks

| Risk | How we handle it |
| --- | --- |
| Cold start | No vendors means no users, so we list vendors ourselves for free |
| Scope creep | No calendars, payments, or AI until the app works with sample vendors |
| Name taken later | Don't get attached to a name before the Phase 5 trademark and domain checks |
| Vendor content rights | Signed permission before posting their photos and videos |
| Time | We both have other commitments; agree on weekly hours and stick to them |
| Partnership | Everything important goes in writing, starting with the Phase 1 agreement |
| Personal data | Collect only what we need; never show home-based vendors' street addresses |
