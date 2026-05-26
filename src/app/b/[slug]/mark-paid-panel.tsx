"use client";

import { useActionState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/button";
import { InkStamp } from "@/components/ink-stamp";
import { markPaid, type MarkPaidState } from "@/actions/members";

interface MarkPaidPanelProps {
  token: string;
  initiallyPaid: boolean;
  initialPaidAt: string | null;
  organizerName: string | null;
}

const INITIAL: MarkPaidState = { ok: null, message: "", paidAt: null };

export function MarkPaidPanel({
  token,
  initiallyPaid,
  initialPaidAt,
  organizerName,
}: MarkPaidPanelProps) {
  const [state, formAction, pending] = useActionState(markPaid, INITIAL);
  const reduced = useReducedMotion();

  // Derive from action state (no mirror useState — keeps react-hooks/set-state-in-effect happy).
  const paid = initiallyPaid || state.ok === true;
  const paidAt = state.paidAt ?? initialPaidAt;

  if (paid) {
    return (
      <div className="relative flex flex-col items-center gap-3 py-2">
        <motion.div
          initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.6, rotate: -22 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: -8 }}
          transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <InkStamp label="Paid" variant="paid" rotate={0} className="text-3xl" />
        </motion.div>
        <p className="text-center text-sm text-foreground-soft">
          Thank you 🙏
          {organizerName ? ` ${organizerName} has been notified.` : ""}
        </p>
        {paidAt ? (
          <time
            dateTime={paidAt}
            className="font-mono text-[11px] uppercase tracking-widest text-foreground-faint"
          >
            Settled · {new Date(paidAt).toLocaleString("en-MY")}
          </time>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Button
        type="submit"
        disabled={pending}
        size="lg"
        className="w-full font-display uppercase tracking-widest"
      >
        {pending ? "Confirming..." : "I've paid"}
      </Button>
      {state.ok === false ? (
        <p role="alert" className="text-center text-sm text-stamp">
          {state.message}
        </p>
      ) : null}
      <p className="text-center text-[11px] text-foreground-faint">
        Tap after you transfer. Organizer gets notified instantly.
      </p>
    </form>
  );
}
