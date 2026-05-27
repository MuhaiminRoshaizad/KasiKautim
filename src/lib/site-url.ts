/*
 * Centralized canonical site URL resolver.
 *
 * Mirrors the official Supabase pattern from
 * https://supabase.com/docs/guides/auth/redirect-urls — falls back through
 * NEXT_PUBLIC_SITE_URL → NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL →
 * NEXT_PUBLIC_VERCEL_URL → localhost, normalizing the scheme + trailing slash.
 *
 * Both NEXT_PUBLIC_VERCEL_* env vars are auto-exposed by Vercel at build time
 * for Next.js projects. Using them as fallbacks means even if you forget to
 * set NEXT_PUBLIC_SITE_URL, Production + Preview deploys still get a
 * working magic-link / OG / share URL — they just won't agree on a single
 * canonical host across previews.
 *
 * Use `siteUrl()` everywhere we need an absolute URL: magic-link
 * emailRedirectTo, OG image src, og:url meta, WhatsApp share links.
 */

const FALLBACK_DEV_URL = "http://localhost:3000";

function normalize(raw: string): string {
  const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
  return withScheme.replace(/\/$/, "");
}

export function siteUrl(): string {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    FALLBACK_DEV_URL;
  return normalize(candidate);
}
