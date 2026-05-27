"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/button";
import {
  completeOnboarding,
  type ProfileUpdateState,
} from "@/actions/profile";

const FIELD =
  "h-12 w-full border border-border bg-surface px-3 font-sans text-base text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background";

const INITIAL: ProfileUpdateState = { ok: null, message: "" };

interface WelcomeFormProps {
  initialDisplayName: string;
  initialDuitnowId: string;
}

export function WelcomeForm({
  initialDisplayName,
  initialDuitnowId,
}: WelcomeFormProps) {
  const [state, formAction] = useActionState(completeOnboarding, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-widest text-foreground-soft">
          Display name
        </span>
        <input
          type="text"
          name="displayName"
          defaultValue={initialDisplayName}
          required
          maxLength={50}
          placeholder="e.g. Muhaimin"
          className={FIELD}
          aria-invalid={Boolean(state.fieldErrors?.displayName)}
        />
        {state.fieldErrors?.displayName ? (
          <span role="alert" className="text-xs text-stamp">
            {state.fieldErrors.displayName}
          </span>
        ) : (
          <span className="text-[11px] text-foreground-faint">
            Shows on every bill you create. You can change it later in Settings.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-widest text-foreground-soft">
          DuitNow ID (optional)
        </span>
        <input
          type="text"
          name="duitnowId"
          defaultValue={initialDuitnowId}
          maxLength={50}
          placeholder="+60123456789 or your NRIC"
          className={FIELD}
          aria-invalid={Boolean(state.fieldErrors?.duitnowId)}
        />
        {state.fieldErrors?.duitnowId ? (
          <span role="alert" className="text-xs text-stamp">
            {state.fieldErrors.duitnowId}
          </span>
        ) : (
          <span className="text-[11px] text-foreground-faint">
            Mobile, NRIC, business reg — whatever you&apos;ve registered with
            your bank as your DuitNow proxy. Recipients tap to copy.
          </span>
        )}
      </label>

      {state.ok === false && state.message && !state.fieldErrors ? (
        <p role="alert" className="text-sm text-stamp">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />

      <p className="text-center text-[11px] text-foreground-faint">
        You can skip the DuitNow ID and add it later — but recipients
        won&apos;t see a tap-to-copy on the bill page until you do.
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      size="lg"
      className="w-full font-display uppercase tracking-widest"
    >
      {pending ? "Saving..." : "Done — take me to my dashboard"}
      <ArrowRight size={16} aria-hidden />
    </Button>
  );
}
