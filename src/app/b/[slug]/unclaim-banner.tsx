"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/cn";
import { unclaimMember, type ClaimMemberState } from "@/actions/members";

interface UnclaimBannerProps {
  slug: string;
  token: string;
  name: string;
  paid: boolean;
}

const INITIAL: ClaimMemberState = { ok: null, message: "" };

/*
 * Recovery escape hatch on /b/[slug]?m=token. Renders a thin row saying
 * "You're {name}. Not you?" with a tiny ghost button that releases the
 * slot and bounces back to the claim picker. Hidden once paid (the slot
 * is data-bound at that point; if the user marked the wrong name as paid
 * they must reach out to the tukang bayar — we surface a hint message).
 */
export function UnclaimBanner({ slug, token, name, paid }: UnclaimBannerProps) {
  const [state, formAction] = useActionState(unclaimMember, INITIAL);

  if (paid) {
    return (
      <div className="mb-4 flex items-start gap-2 border-l-2 border-highlighter bg-highlighter/10 px-3 py-2 text-[11px] text-foreground-soft">
        <span aria-hidden>i</span>
        <p>
          You&apos;re marked as <span className="font-medium text-foreground">{name}</span>.
          Wrong name? Contact the tukang bayar — paid slots can&apos;t be switched.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mb-4 flex flex-col gap-1 border-l-2 border-border bg-surface/50 px-3 py-2"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="token" value={token} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-foreground-soft">
          You&apos;re <span className="font-medium text-foreground">{name}</span>.
        </p>
        <UnclaimButton />
      </div>
      <p className="text-[10px] text-foreground-faint">
        Wrong name? Tap{" "}
        <span className="font-medium text-foreground-soft">Not you?</span>{" "}
        — don&apos;t hit back, your taps stay stuck otherwise.
      </p>
      {state.ok === false ? (
        <p role="alert" className="text-[11px] text-stamp">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function UnclaimButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "text-[11px] font-medium underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none",
        pending ? "text-foreground-faint" : "text-foreground",
      )}
    >
      {pending ? "Switching..." : "Not you?"}
    </button>
  );
}
