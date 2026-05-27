import Link from "next/link";

import { buttonClassName } from "@/components/button";
import { cn } from "@/lib/cn";

interface LoginFormProps {
  next?: string;
  error?: string;
}

const ERROR_COPY: Record<string, string> = {
  oauth_init_failed:
    "Couldn't reach Google. Try again, or check the browser blocked the popup.",
  exchange_failed:
    "Sign-in didn't complete. Open the link on the same device you started on.",
  missing_code:
    "Sign-in link was missing its code. Try again from scratch.",
};

/*
 * Single Google OAuth button. No email input, no password, no magic-link.
 * The href hits a server-side route that swaps for a Google consent URL
 * and 302s the browser there; Google redirects back to /auth/callback?code=...
 * which the existing PKCE handler turns into a session.
 */
export function LoginForm({ next, error }: LoginFormProps) {
  const href = next
    ? `/login/google?next=${encodeURIComponent(next)}`
    : "/login/google";

  return (
    <div className="flex flex-col gap-4">
      {error && ERROR_COPY[error] ? (
        <p role="alert" className="text-sm text-stamp">
          {ERROR_COPY[error]}
        </p>
      ) : null}

      <Link
        href={href}
        className={cn(
          buttonClassName({
            size: "lg",
            variant: "secondary",
            className: "font-medium",
          }),
          "!h-12 w-full !bg-paper !text-ink",
        )}
      >
        <GoogleLogo />
        <span>Continue with Google</span>
      </Link>

      <p className="text-center text-xs text-foreground-faint">
        No password. No email link. One tap.
      </p>
    </div>
  );
}

function GoogleLogo() {
  // Inline SVG so it renders correctly in dark mode without an extra asset
  // round-trip. Multi-color is the official Google brand mark.
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
