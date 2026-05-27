# Supabase email templates

These are the source-of-truth HTML for transactional emails that Supabase Auth sends.
Supabase doesn't yet have a CLI/API to push email templates programmatically — they
must be pasted into the Dashboard.

## Magic Link

**Source:** `magic-link.html`

**Where to paste:**
1. Supabase Dashboard → Authentication → Email Templates → Magic Link
2. **Subject:** `Your JomSplit sign-in link`
3. **Message (HTML):** paste the entire `magic-link.html` file contents
4. Save

The template uses the Supabase Go-template variable `{{ .ConfirmationURL }}` for the
magic-link URL. Don't remove or rename it.

## Deployment auth checklist

Magic-link auth depends on three settings being correct. Run through this any time
the deployment URL changes.

### 1. Vercel project env vars

Vercel Dashboard → Project Settings → Environment Variables. Add for **Production**
(and Preview if you want previews to work):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ebedzuwpdpatmjgfhzmk.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (Supabase Dashboard → API → anon/public) |
| `SUPABASE_SERVICE_ROLE_KEY` | (Supabase Dashboard → API → service_role — server-only) |
| `NEXT_PUBLIC_SITE_URL` | `https://jom-split-two.vercel.app` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | (Google AI Studio → API Keys) |

Then **redeploy** — env vars only apply to new deployments.

### 2. Supabase Auth URL allowlist

Supabase Dashboard → Authentication → URL Configuration:

| Field | Value |
|---|---|
| **Site URL** | `https://jom-split-two.vercel.app` |
| **Redirect URLs** (add all) | `https://jom-split-two.vercel.app/auth/callback`, `https://jom-split-two.vercel.app/**`, `http://localhost:3000/auth/callback`, `http://localhost:3000/**` |

The `**` wildcards let Vercel preview URLs work too, if you want.

### 3. Verify

1. Open `https://jom-split-two.vercel.app/login` in an incognito window.
2. Enter your email, submit.
3. Open the magic-link email — confirm the URL begins with
   `https://jom-split-two.vercel.app/auth/callback?code=...`, NOT `localhost:3000`.
4. Tap the link, confirm you land on `/dashboard` signed in.

If the URL still points to localhost: `NEXT_PUBLIC_SITE_URL` isn't set on Vercel
(step 1). If the link errors with "redirect not allowed": redirect URL allowlist
missing (step 2).
