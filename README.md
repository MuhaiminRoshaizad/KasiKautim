# KasiKautim — Settle shared bills, no awkward chasing

> "Kasi kautim" = "settle it / sort it out" in Manglish (from Cantonese 搞掂 *gao dim*).
> A web app for splitting bills the way Malaysians actually do it — share a link in the group chat, watch it settle.

**Built for:** [KrackedDevs](https://krackeddevs.com/) — a Malaysian platform that hosts paid coding "bounties" where anyone can submit a project answering a posted brief. Multiple builders ship their take on the same bounty; the brief owner picks the winners.

**This bounty:** [Split Bill & Payment Tracker Web App](https://krackeddevs.com/code/bounty/split-bill-payment-tracker-web-app)
**Live URL:** https://kasi-kautim.vercel.app
**Repo:** https://github.com/MuhaiminRoshaizad/KasiKautim *(rename pending — old name was JomSplit; GitHub redirects old URLs)*

---

## The problem

Splitting a group bill in Malaysia today looks like this:

1. Someone pays the full amount at the cashier.
2. They open WhatsApp and start chasing 6 friends, one DM at a time.
3. Half ignore, half "later la", one forgets entirely.
4. A week later, the tukang bayar is RM 80 out of pocket and emotionally drained.

KasiKautim replaces step 2–4 with **one link** dropped into the group chat. Recipients tap their name, pay via DuitNow / bank app / TNG, and mark themselves paid with an optional screenshot. The tukang bayar sees who's settled and who's ghosting — in real time.

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

1. Open https://kasi-kautim.vercel.app on your phone.
2. Tap "Continue with Google" and pick the Google account you want to use.
3. Tap "Create a bill", scan or type in the items, add the squad.
4. Hit "Send to group chat" — copy the link.
5. Open the link in another browser/incognito as a recipient. Tap a name. Mark paid.
6. Switch back to your tukang bayar dashboard — watch the progress bar move live.

## Run locally

```bash
git clone https://github.com/MuhaiminRoshaizad/KasiKautim.git
cd KasiKautim
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
- **DuitNow ID is loose-validated by design.** [PayNet's Pay-by-Proxy spec](https://docs.developer.paynet.my/docs/duitnow-transfer/integration/pay-by-proxy) supports five proxy types (mobile / NRIC / passport / army-police / business reg) but doesn't publish strict format regexes — banks validate at transfer-time. We accept any alphanumeric string 5-50 chars and expose it via tap-to-copy on `/b/[slug]`. Recipients paste into their banking app where the real validation happens.

## Known limitations (documented honestly)

Scoped out of this submission, documented so judges and future readers know they're known. Grouped by area.

### AI receipt scanner (Gemini 2.5 Flash)

- **Two-receipts-in-one-photo** — Gemini will extract items from both receipts and merge them into one items list with a total that doesn't reconcile against either receipt. The "receipt math reconciles" check will fail; user has to manually delete the wrong items.
- **Handwritten receipts** — accuracy drops sharply on handwritten or smudged thermal-printed receipts. Latin-script printed receipts (the 90% case in Malaysia) work reliably.
- **Non-MYR receipts** — scanner detects the currency code; if it's not MYR, the apply-to-form step is blocked. We don't do FX conversion. Submitted as "scan a USD receipt → see error" rather than "scan a USD receipt → silently store wrong amount."
- **Free-tier rate limit** — Google AI Studio free tier caps Gemini 2.5 Flash at 15 req/min, 1500 req/day. A judge testing rapidly could exhaust this; falls back to a "rate limited, try again" message and the user can still enter items manually.
- **Subtotal vs total reconciliation** — when items + tax don't match the printed total exactly (rounding, hidden fees, manual receipt edits), the UI shows a "math doesn't reconcile" hint; we trust the printed total over the items sum.

### Items + claiming

- **Item edits after bill creation** — items + tax + discount are locked at creation. Workaround: delete + recreate the bill.
- **Per-person quantity for a single item** — `claim_item` is binary (you tapped this line or you didn't). If a receipt has one line "3 NASI LEMAK RM 25.50" and Ali ordered 2 + Faiz ordered 1, both tapping the chip splits it 50/50 (RM 12.75 each) rather than 2:1. Workaround: manually split that one line into two items in the editor before creating the bill — "Nasi Lemak (Ali x2) RM 17.00" + "Nasi Lemak (Faiz x1) RM 8.50".
- **Repeated identical items** — when a receipt lists the same item 10 times as 10 separate lines (rare, usually multi-pax orders), the picker shows 10 identical chips. Each claimer taps their own. Math is correct; UX is visually noisy. Can be cleaned up by manually consolidating lines in the editor.
- **No item-level partial claim** — if you ordered half of someone's appetizer, neither of you can express that today. Workaround: pretend it's a whole one and tap once between you two.

### Payment + reconciliation

- **Custom paid amount** — recipients can only mark-paid for the fair share KasiKautim computed. "Tip", "round up", "I'll add the parking fee" deferred to v2.
- **Settle-up round** — when fair shares shift after late claims (someone new claims an item after others paid), the delta is stored and surfaced on the report but there's no in-app UX to reconcile it. Organizer eats the diff or DMs whoever owes more.
- **No un-mark-paid** — once a recipient confirms "I've paid", they cannot reverse it themselves. The tukang bayar has to delete the bill if it was a mistake. Intentional — pretending an irreversible action is undoable would cause worse confusion.
- **No partial bill payment** — you either mark your entire share paid or you don't. "I'll pay half now, half on Friday" isn't supported.

### Identity + linking

- **Single device per claim** — claim_member binds a slot to the first device that taps the name. The tap-to-remove "Not you?" flow lets recipients escape that mistake, but if someone bookmarked a per-member URL on two devices, only the first device's payment is recorded against that slot.
- **Per-member token in URL** — anyone with the `/b/[slug]?m=token` link IS that recipient. We don't gate it with a PIN or extra credential because adding friction kills the WhatsApp flow. If someone forwards their per-member link, the new holder can mark-paid as them.
- **No account merging** — sign in with a different Google account and your bills are separate. We don't support transferring bills between accounts.

### Storage + retention

- **Proof storage cleanup** — deleting a bill cascades through `bill_members` + `payment_events` via FK ON DELETE CASCADE, but the proof images in Storage are not auto-cleaned (would need a cron job we haven't built). Orphans accumulate.
- **HEIC EXIF strip** — runtime depends on libheif being bundled in the Vercel function. If it isn't (Vercel's Node 24 default), the EXIF strip soft-fails to a raw byte copy. Privacy degraded gracefully but not eliminated for HEIC uploads.
- **Storage signed URL TTL** — 24 hours on the report page proof thumbnails. Re-print after that → broken images until you reload the page (which mints fresh URLs).
- **No bill archive / soft delete** — bill delete is destructive. A "settled bills" archive folder isn't built; once paid + acknowledged, organizers either keep them visible or delete them.

### Auth + onboarding

- **Google-only sign-in** — no email/password fallback, no other OAuth providers. Users without a Google account can't sign up (rare in Malaysia but possible).
- **Google consent screen shows Supabase project domain** — the "to continue to ebedzuwpdpatmjgfhzmk.supabase.co" text on Google's account picker reflects the OAuth callback domain (Supabase's hosted auth). Replacing it with a custom domain requires Supabase Pro's custom auth domain feature ($25/mo); deferred to v2. Standard situation for any small app on a hosted auth provider's free tier (Notion, Linear, etc. on similar setups had this same line until they paid for custom domains).
- **No DuitNow ID validation** — per [PayNet's spec](https://docs.developer.paynet.my/docs/duitnow-transfer/integration/pay-by-proxy), banks validate proxies at transfer-time, not at registration. We accept any 5-50 char alphanumeric+separator string and trust the bank to reject invalid ones at payment.
- **Session lifetime** — Supabase JWT defaults to 1 hour. After that, the user has to sign in again. We don't run a refresh job on the client.

### Performance + infrastructure

- **Cold-start latency** — Vercel free tier sleeps idle functions; first hit after a quiet period adds ~500-1000ms. Subsequent hits are fast (~150-300ms).
- **Supabase region** — project is in `ap-northeast-1` (Tokyo). From Malaysia that's ~50-100ms RTT; from Europe / US that's worse. Acceptable since the audience is Malaysian.
- **OG image scrape timeout** — WhatsApp's link-preview scraper times out at ~3-5s. If our `/api/og/[slug]` route cold-starts past that on the first scrape, WhatsApp caches "no preview" for 24h. Mitigation: share fresh slugs / use the Facebook Sharing Debugger to force a rescrape.

### Mobile + browser

- **WhatsApp's in-app WebView quirks** — different cookie scope from regular Safari/Chrome, sometimes blocks features. We test on it explicitly during QA.
- **Print background colors** — browsers strip background colors from PDF output by default (toner-saving heuristic). We override via `print-color-adjust: exact` for the progress bar; other potentially-load-bearing colors might still strip on aggressive print profiles.

## License

[MIT](./LICENSE) © 2026 Muhammad Muhaimin Bin Roshaizad ([@minned](https://github.com/minned))

## Contact

aminmuhaimin192@gmail.com — for bug reports, PDPA deletion requests, or just to say hi.
