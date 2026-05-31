"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2, X } from "lucide-react";

import { buttonClassName } from "@/components/button";
import { deleteBill } from "@/actions/bills";
import { cn } from "@/lib/cn";

interface DeleteBillPanelProps {
  slug: string;
  title: string;
}

/*
 * Danger-zone footer on /dashboard/[slug]. One small "Delete bill" link
 * opens a confirmation dialog where the tukang bayar has to type the
 * bill title (Splitwise / GitHub repo-delete pattern) — friction
 * proportional to the consequence. Cascade deletes via the FK ON DELETE
 * CASCADE clause in 0001_init.sql; orphan proof images stay in Storage
 * (documented in README known limitations).
 */
export function DeleteBillPanel({ slug, title }: DeleteBillPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const canDelete = typed.trim() === title.trim();

  return (
    <>
      <div className="mt-8 border-t border-border pt-6">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
          Danger zone
        </h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-stamp/40 bg-stamp-soft/30 px-3 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Delete this bill</p>
            <p className="mt-0.5 text-xs text-foreground-soft">
              Members and payment history will be deleted. Can&apos;t undo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              buttonClassName({ variant: "secondary", size: "sm" }),
              "border-stamp/60 text-stamp hover:bg-stamp-soft/60",
            )}
          >
            <Trash2 size={14} aria-hidden />
            Delete
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => {
          setOpen(false);
          setTyped("");
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="fixed inset-0 m-auto h-fit w-fit max-w-[95vw] border border-border bg-surface p-0 text-foreground backdrop:bg-foreground/60"
        aria-labelledby="delete-bill-title"
      >
        <div className="w-[28rem] max-w-full p-6">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="delete-bill-title"
              className="font-display text-2xl uppercase tracking-tight text-stamp"
            >
              Delete bill?
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
            This deletes <span className="font-medium text-foreground">{title}</span>,
            all its members, payment records, and the shareable link. Members&apos;
            uploaded proof images stay in Storage.
          </p>

          {/*
           * Input + buttons inside one form so useFormStatus inside
           * the children can lock everything while the action is in
           * flight (otherwise the user could edit the typed name
           * mid-submit and invalidate the canDelete gate). Layout-
           * wise the same: confirm input on top, two-button grid below.
           */}
          <form action={deleteBill}>
            <input type="hidden" name="slug" value={slug} />

            <p className="mt-4 text-xs text-foreground-soft">
              Type the bill title to confirm:
            </p>
            <DeleteConfirmInput
              value={typed}
              onChange={setTyped}
              placeholder={title}
            />

            <div className="mt-6 grid grid-cols-2 gap-2">
              <DeleteCancel onCancel={() => setOpen(false)} />
              <DeleteSubmit canDelete={canDelete} />
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}

function DeleteSubmit({ canDelete }: { canDelete: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!canDelete || pending}
      className={buttonClassName({
        variant: "stamp",
        size: "md",
        className: "w-full font-display uppercase tracking-widest",
      })}
    >
      {pending ? "Deleting..." : "Delete forever"}
    </button>
  );
}

/*
 * Confirm input lives inside the <form> now so useFormStatus can
 * disable it during submit. Without this, typing into the input after
 * pressing Delete could change the canDelete gate state mid-action
 * and produce inconsistent UI.
 */
function DeleteConfirmInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const { pending } = useFormStatus();
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={pending}
      className="mt-1 h-11 w-full rounded-lg border border-border bg-paper px-3 font-mono text-base text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
    />
  );
}

/*
 * Same useFormStatus lock as the SignOut cancel button - prevents
 * the user from dismissing the dialog mid-submit and ending up
 * confused when the action completes anyway.
 */
function DeleteCancel({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      onClick={onCancel}
      disabled={pending}
      className={buttonClassName({
        variant: "secondary",
        size: "md",
        className: "w-full",
      })}
    >
      Cancel
    </button>
  );
}
