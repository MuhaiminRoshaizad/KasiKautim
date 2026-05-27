# JomSplit — Split bills, no awkward chasing

> "Jom split" = "let's split" in Manglish.
> A web app for splitting bills the way Malaysians actually do it — share a link in the group chat, watch it settle.

**Bounty submission:** [KrackedDevs Fintech Bounty — Split Bill & Payment Tracker Web App](https://krackeddevs.com)
**Live URL:** https://jom-split-two.vercel.app
**Repo:** https://github.com/MuhaiminRoshaizad/JomSplit

---

## The problem

Splitting a group bill in Malaysia today looks like this:

1. Someone pays the full amount at the cashier.
2. They open WhatsApp and start chasing 6 friends, one DM at a time.
3. Half ignore, half "later la", one forgets entirely.
4. A week later, the tukang bayar is RM 80 out of pocket and emotionally drained.

JomSplit replaces step 2–4 with **one link** dropped into the group chat. Recipients tap their name, pay via DuitNow / bank app / TNG, and mark themselves paid with an optional screenshot. The tukang bayar sees who's settled and who's ghosting — in real time.

## What it does

- **AI receipt scanner** — snap a photo of the receipt, Gemini extracts items + tax + total. Edit before saving.
- **Equal split or by-items** — equal-split for makan, item-claim for "I only had teh tarik, not the seafood platter".
- **Claim-your-name flow** — recipients tap their name once on the bill page, get a private link bookmarked to their device. No signup.
- **DuitNow + bank-app shortcuts** — copy DuitNow ID with one tap, or jump straight into TNG / Maybank2u via deep links.
- **Payment audit** — when you mark paid, record the method (DuitNow, cash, TNG, etc.) + an optional note + a screenshot. EXIF stripped server-side before storage.
- **Live dashboard** — Supabase Realtime pushes payment events; the tukang bayar's bill view updates without a refresh.
- **Per-bill report** — KPIs, member breakdown with paid/owed delta, activity timeline. Print-ready for chasing PDFs.
- **Fully-collected celebration** — confetti + animated "PAID IN FULL" stamp when the last member settles.
- **WhatsApp-ready OG image** — every bill link unfurls to a receipt-styled preview when shared.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2 (App Router, RSC by default), TypeScript strict |
| UI | Tailwind v4 with custom "Transactional Paper" palette tokens, Framer Motion |
| Database & realtime | Supabase Postgres + Realtime + Storage |
| Auth | Supabase Auth with Google OAuth (tukang bayar only; recipients are link-credentialed) |
| AI | Google Gemini 2.5 Flash via Vercel AI SDK |
| OG image | next/og (1200×630 PNG, receipt-styled) |
| Image processing | sharp (EXIF strip on payment proofs) |
| Forms | react-hook-form + zod |
| Hosting | Vercel |

Tests: vitest, 40/40 green. Money math, slug retry, members parser, item-split math.

## Try it

1. Open https://jom-split-two.vercel.app on your phone.
2. Tap "Continue with Google" and pick the Google account you want to use.
3. Tap "Create a bill", scan or type in the items, add the squad.
4. Hit "Send to group chat" — copy the link.
5. Open the link in another browser/incognito as a recipient. Tap a name. Mark paid.
6. Switch back to your tukang bayar dashboard — watch the progress bar move live.

## Run locally

```bash
git clone https://github.com/MuhaiminRoshaizad/JomSplit.git
cd JomSplit
npm install
cp .env.example .env.local   # fill in Supabase + Gemini keys
npm run dev
```

`.env.example` documents every key. You need:

- A Supabase project with the migrations in `supabase/migrations/` applied (use `supabase db push` or the Supabase MCP).
- A `payment-proofs` Storage bucket (private, 5 MB limit, image MIME types).
- A Google AI Studio Gemini API key (free tier, vision-capable).
- A Google Cloud OAuth 2.0 client ID + secret, with `https://<your-supabase-ref>.supabase.co/auth/v1/callback` listed under Authorized redirect URIs. Paste the credentials into Supabase Dashboard → Authentication → Providers → Google.

Run tests / lint / build:

```bash
npm test        # vitest, 40 tests
npm run lint    # eslint
npm run build   # next build (typecheck included)
```

## Design — "Transactional Paper"

Bills render as ink-stamped paper receipts. Monospace amounts, torn-edge cards, ink-stamp PAID overlays. Color palette is non-negotiable: `ringgit` (#3D7A4A) for paid/success/primary, `stamp` (#C8412C) for overdue/destructive. Body in Inter, display in Anton, amounts in JetBrains Mono.

Light mode is receipt paper. Dark mode is thermal-printer carbon copy.

## Rubric coverage

| # | Requirement | Where |
|---|---|---|
| 1 | Bill creation | `/dashboard/new` — form + AI scanner, server action `createBill` in `src/actions/bills.ts` |
| 2 | Shareable bill page | `/b/[slug]` — public, no auth, RPC-scoped via slug |
| 3 | Member payment confirmation | `/b/[slug]` `MarkPaidPanel` — method dropdown + note + proof upload + ink-stamp drop |
| 4 | Organizer dashboard | `/dashboard` — list of bills with progress cards, `/dashboard/[slug]` detail view |
| 5 | Payment progress display | `BillProgressCard` + `ProgressBar` on dashboard + bill detail + report KPIs |
| 6 | Mobile-friendly | Mobile-first Tailwind (375px baseline), 44px+ tap targets, body `overflow-x: hidden`, grid layouts over `flex-wrap` |
| 7 | Creative theme / branding | "Transactional Paper" palette tokens in `src/app/globals.css`, ink-stamp components, paper-grain receipts |
| 8 | GitHub repository | This repo (public from D5) |
| 9 | Short project description | `## The problem` + `## What it does` above, plus 150-word submission blurb |
| 10 | Optional bonus features | AI scanner, claim-your-name, fully-collected celebration, dynamic OG image, dark mode, realtime, item-claim mode, payment audit, /report page with print CSS |
| 11 | Minimum acceptance | All 10 above ✓ |

## Architecture notes

- **Money as integer cents** everywhere. `parseFloat` is banned for money. Schema is `bigint` in Postgres.
- **RLS is the source of truth for access control**, not route-level checks. Anonymous `/b/[slug]` reads go through a `get_public_bill` RPC; organizer reads are RLS-scoped to `auth.uid()`.
- **Member token = nanoid(16)** ≈ 96 bits of entropy. Treated as a bearer credential. Never logged.
- **Item-claim math**: `share = floor(price / claimer_count)`; first claimer (by sorted memberId) absorbs the remainder. Tax allocates proportional to subtotal.
- **Slug collision retry** wrapped in `src/lib/slugs.ts`.
- **Idempotent mark-paid** (`UPDATE ... WHERE paid = false`).
- **EXIF stripped** from payment proofs via `sharp` before Storage upload.
- **24h signed Storage URLs** for proofs on the report page.
- **30-min throttle on `viewed` events** (migration 0006) — prevents activity-timeline spam.
- **Server Components by default**. `'use client'` only where required (realtime subscriptions, form interactions, framer-motion).

## Known limitations (documented honestly)

Scoped out of this submission, documented so judges and future readers know they're known:

- **Item edits after bill creation** — not supported. Item-mode bills lock items + tax + total at creation. Workaround: delete + recreate.
- **Custom paid amount** — recipients can only mark-paid for their fair share. "Tip" and "round up" deferred.
- **Settle-up round** — when fair-share drifts after late claims, the delta is stored and surfaced on the report but no UX to reconcile it.
- **Proof storage cleanup** — deleted bills leave orphan proof images in Storage. No cron yet.
- **HEIC EXIF strip** — depends on libheif being available in the runtime; soft-fails to raw bytes if not.
- **Bill total locked at creation** in item-mode (intentional — see item edits limitation).
- **Storage signed URL TTL** is 24h on the report. After 24h, print-late shows broken images; re-open the report to refresh.
- **Multi-currency conversion** — scanner detects but JomSplit only stores MYR. Non-MYR scans are blocked at the apply-to-form step.

## License

[MIT](./LICENSE) © 2026 Muhammad Muhaimin Bin Roshaizad ([@minned](https://github.com/minned))

## Contact

aminmuhaimin192@gmail.com — for bug reports, PDPA deletion requests, or just to say hi.
