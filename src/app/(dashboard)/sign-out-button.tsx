"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { LogOut, X } from "lucide-react";

import { buttonClassName } from "@/components/button";
import { signOut } from "@/actions/auth";
import { cn } from "@/lib/cn";

/*
 * Sign-out is an identity-loss action — clearing the session, dropping
 * the user back to the marketing landing, losing any draft state in
 * the create-bill form. Industry-standard pattern is a confirmation
 * dialog. Same modal pattern as mark-paid + delete-bill so the
 * destructive-action language stays consistent across the app.
 */
export function SignOutButton({ iconButtonClassName }: { iconButtonClassName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Sign out"
        title="Sign out"
        className={iconButtonClassName}
      >
        <LogOut size={18} aria-hidden />
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="fixed inset-0 m-auto h-fit w-fit max-w-[95vw] border border-border bg-surface p-0 text-foreground backdrop:bg-foreground/60"
        aria-labelledby="sign-out-title"
      >
        <div className="w-[26rem] max-w-full p-6">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="sign-out-title"
              className="font-display text-2xl uppercase tracking-tight text-foreground"
            >
              Sign out?
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cancel"
              className="inline-flex h-8 w-8 items-center justify-center border border-border bg-surface text-foreground hover:bg-surface-deep"
            >
              <X size={14} aria-hidden />
            </button>
          </div>

          <p className="mt-2 text-sm text-foreground-soft">
            You&apos;ll need to sign in again to see your bills and create new
            ones. Bills you&apos;ve already shared keep working.
          </p>

          <form action={signOut} className="mt-6 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonClassName({
                variant: "secondary",
                size: "md",
                className: "w-full",
              })}
            >
              Cancel
            </button>
            <SignOutSubmit />
          </form>
        </div>
      </dialog>
    </>
  );
}

function SignOutSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        buttonClassName({
          size: "md",
          className: "w-full font-display uppercase tracking-widest",
        }),
      )}
    >
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
