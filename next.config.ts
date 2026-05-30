import type { NextConfig } from "next";

/*
 * Platform-wide security headers. Applied to every route by Next's
 * `headers()` config, served by Vercel's edge before the response reaches
 * the client. Trade-offs are documented per-header below.
 *
 * What this does NOT cover:
 *   - Per-IP rate limiting (needs a KV store; deferred — see README)
 *   - Nonce-based CSP (would require restructuring `'unsafe-inline'` out
 *     of Next + Tailwind v4 hydration; deferred — see README)
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    // 'unsafe-inline' for scripts + styles is required by Next.js's
    // inlined hydration script + Tailwind v4's inlined style attribute.
    // 'self' covers our own bundles, Supabase covers REST + Realtime,
    // googleusercontent covers organizer avatars rendered on /b/[slug].
    // img-src has to spell out every image origin we hit at runtime
    // because 'self' does NOT cover blob: or data: per the CSP3 spec.
    //   - blob: needed for the recipient's preview thumbnail in
    //     mark-paid-panel (URL.createObjectURL on the picked file)
    //   - https://*.supabase.co needed for the organizer's payment-
    //     proof thumbnails on /dashboard/[slug]/report (signed
    //     Storage URLs minted server-side)
    // frame-ancestors 'none' is the modern replacement for X-Frame-Options
    // but we keep both for old-browser coverage.
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com https://*.supabase.co",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  // X-Frame-Options is superseded by CSP frame-ancestors but still needed
  // for IE11/old Safari that don't honour the CSP directive.
  { key: "X-Frame-Options", value: "DENY" },
  // strict-origin-when-cross-origin keeps full-URL referrer on same-origin
  // navigation (useful for analytics) but only sends origin on cross-site
  // — critical because /b/[slug]?m=<token> would otherwise leak the
  // member token credential to every outbound link target.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Prevent MIME-sniffing — every script/style we serve declares its type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Vercel terminates TLS for us so HSTS is safe to assert. 1 year, sub-
  // domains included. Not preloading — preload requires a separate
  // submission and is harder to roll back.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Lock down sensors we will never use. Empty allowlist = blocked.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    // Next 15 default is 1 MB, which rejects modern phone camera photos
    // (4–5 MB landscape JPEGs are common from iPhones) at the network
    // layer BEFORE our server actions can return a graceful error. The
    // request becomes an unhandled throw and surfaces as the global
    // error.tsx page. Bumped to match our server-side MAX_BYTES ceiling
    // (5 MB) plus FormData overhead.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
