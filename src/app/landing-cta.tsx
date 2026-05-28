"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

import { buttonClassName } from "@/components/button";

/*
 * Landing-page primary CTA. Wraps next/link so we can call useLinkStatus
 * (Next 16) to render a pending state while the click is in flight. Without
 * this, tapping "Create a bill" gives no visual feedback until /login
 * renders — which can take a noticeable beat on mobile + cold-start Vercel.
 *
 * useLinkStatus requires a descendant of <Link>, so the actual swap lives
 * in CtaContent inside the Link, not the Link itself.
 */
export function CreateBillCta() {
  return (
    <Link
      href="/login"
      className={buttonClassName({
        size: "lg",
        className: "font-display uppercase tracking-widest",
      })}
    >
      <CtaContent />
    </Link>
  );
}

function CtaContent() {
  const { pending } = useLinkStatus();
  if (pending) {
    return (
      <>
        Loading...
        <Loader2 size={18} className="animate-spin" aria-hidden />
      </>
    );
  }
  return (
    <>
      Create a bill
      <ArrowRight size={18} aria-hidden />
    </>
  );
}
