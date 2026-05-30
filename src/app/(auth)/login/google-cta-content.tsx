"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/*
 * Pending-state content for the Continue-with-Google Link. Without this,
 * tapping the button shows zero visual feedback between click and Google's
 * consent screen rendering — long enough on mobile cold-start that users
 * tap it again or wonder if it worked. useLinkStatus reads the navigation
 * state of the closest <Link> ancestor (Next 16 hook), so the parent
 * server-rendered Link can stay; only this descendant needs 'use client'.
 *
 * Mirrors the pattern in landing-cta.tsx so future link CTAs follow one
 * convention.
 */
export function GoogleCtaContent() {
  const { pending } = useLinkStatus();

  // Same span across both states so the aria-live region's text
  // content swap gets announced by screen readers when navigation
  // starts. Icon is decorative (aria-hidden) - the label carries
  // the meaning.
  return (
    <>
      {pending ? (
        <Loader2 size={18} className="animate-spin" aria-hidden />
      ) : (
        <GoogleLogo />
      )}
      <span aria-live="polite" aria-atomic="true">
        {pending ? "Opening Google…" : "Continue with Google"}
      </span>
    </>
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
