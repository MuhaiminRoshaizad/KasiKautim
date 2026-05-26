import { THEME_STORAGE_KEY } from "@/lib/constants";

/*
 * Inline blocking script that sets data-theme on <html> before paint.
 * Avoids the dark/light flash on initial load. Reads localStorage first,
 * falls back to prefers-color-scheme. Snippet is a hard-coded literal — no
 * user input, no XSS surface.
 *
 * React 19 supports <script>{stringChild}</script> directly, so we don't need
 * next/script (whose beforeInteractive strategy is Pages-Router-only) or
 * raw-HTML APIs.
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
  return <script>{SNIPPET}</script>;
}
