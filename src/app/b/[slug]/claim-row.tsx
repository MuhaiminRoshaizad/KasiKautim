"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
import { cn } from "@/lib/cn";
import { claimMember, type ClaimMemberState } from "@/actions/members";

interface ClaimRowProps {
  slug: string;
  memberId: string;
  name: string;
  amountOwedCents: number;
  paid: boolean;
  claimed: boolean;
}

const INITIAL: ClaimMemberState = { ok: null, message: "" };

export function ClaimRow({
  slug,
  memberId,
  name,
  amountOwedCents,
  paid,
  claimed,
}: ClaimRowProps) {
  const [state, formAction] = useActionState(claimMember, INITIAL);
  const taken = paid || claimed;

  return (
    <li>
      <form
        action={formAction}
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border border-border bg-surface px-3 py-3",
          taken && "opacity-60",
        )}
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="memberId" value={memberId} />

        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "inline-block h-2 w-2",
              paid
                ? "bg-ringgit"
                : claimed
                  ? "bg-foreground-faint"
                  : "bg-foreground",
            )}
          />
          <span className="truncate font-mono text-sm text-foreground">
            {name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <AmountDisplay cents={amountOwedCents} size="sm" muted={taken} />
          {taken ? (
            <TakenBadge paid={paid} />
          ) : (
            <ClaimButton />
          )}
        </div>

        {state.ok === false ? (
          <p role="alert" className="basis-full text-xs text-stamp">
            {state.message}
          </p>
        ) : null}
      </form>
    </li>
  );
}

function ClaimButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      // rounded-sm + active:scale-[0.97] for parity with the Button
      // component's standard CTA treatment - this used to render as a
      // sharp-cornered hard-edged block with no press feedback while
      // the rest of the app's CTAs felt soft + tactile.
      className="inline-flex h-11 items-center justify-center rounded-sm border border-foreground bg-foreground px-4 text-sm font-medium text-paper transition-[color,background-color,transform] duration-150 hover:bg-foreground/90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 sm:h-9"
    >
      {pending ? "Claiming..." : "That's me"}
    </button>
  );
}

function TakenBadge({ paid }: { paid: boolean }) {
  if (paid) {
    return (
      <span className="inline-flex items-center gap-1 border border-ringgit px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-ringgit">
        <Check size={10} aria-hidden />
        Paid
      </span>
    );
  }
  return (
    <span className="border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-foreground-faint">
      Taken
    </span>
  );
}
