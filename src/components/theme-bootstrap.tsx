import Script from "next/script";

import { THEME_STORAGE_KEY } from "@/lib/constants";

/*
 * Inline blocking script that sets data-theme on <html> before paint.
 * Avoids the dark/light flash on initial load. Reads localStorage first,
 * falls back to prefers-color-scheme. Kept tiny on purpose.
 */
const SNIPPET = `(() => {
  try {
    var k = ${JSON.stringify(THEME_STORAGE_KEY)};
    var stored = localStorage.getItem(k);
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolved = stored === 'light' || stored === 'dark'
      ? stored
      : (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();`;

export function ThemeBootstrap() {
  return (
    <Script id="theme-bootstrap" strategy="beforeInteractive">
      {SNIPPET}
    </Script>
  );
}
