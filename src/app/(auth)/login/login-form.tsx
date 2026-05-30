import Link from "next/link";

import { buttonClassName } from "@/components/button";
import { cn } from "@/lib/cn";

import { GoogleCtaContent } from "./google-cta-content";

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
 * which the existing PKCE handler turns into a session. The button's child
 * is a client island so it can show a pending state via useLinkStatus while
 * the navigation is in flight.
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
        <GoogleCtaContent />
      </Link>

      <p className="text-center text-xs text-foreground-faint">
        No password. No email link. One tap.
      </p>
    </div>
  );
}
