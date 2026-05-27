"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Trash2, Upload, X } from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
import { Button, buttonClassName } from "@/components/button";
import { InkStamp } from "@/components/ink-stamp";
import { cn } from "@/lib/cn";
import { markPaid, type MarkPaidState } from "@/actions/members";
import {
  uploadProof,
  type UploadProofState,
} from "@/actions/upload-proof";
import type { PaymentMethod } from "@/types/schemas";

interface MarkPaidPanelProps {
  token: string;
  initiallyPaid: boolean;
  initialPaidAt: string | null;
  organizerName: string | null;
  /** False when the bill is item-mode and the recipient hasn't claimed anything yet. */
  canPay?: boolean;
  /** For the disabled-state hint label. */
  amountOwedCents?: number;
}

const INITIAL_PAID: MarkPaidState = { ok: null, message: "", paidAt: null };
const INITIAL_UPLOAD: UploadProofState = { ok: null, message: "" };

const METHOD_OPTIONS: { value: PaymentMethod | ""; label: string }[] = [
  { value: "", label: "Pick one (optional)" },
  { value: "cash", label: "Cash" },
  { value: "online_transfer", label: "Online transfer (bank app)" },
  { value: "duitnow_qr", label: "DuitNow QR" },
  { value: "ewallet", label: "E-wallet (TNG / GrabPay / Boost)" },
  { value: "other", label: "Other" },
];

const FIELD =
  "h-11 w-full border border-border bg-surface px-3 font-sans text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background";

export function MarkPaidPanel({
  token,
  initiallyPaid,
  initialPaidAt,
  organizerName,
  canPay = true,
  amountOwedCents = 0,
}: MarkPaidPanelProps) {
  const [state, formAction, pending] = useActionState(markPaid, INITIAL_PAID);
  const reduced = useReducedMotion();

  const paid = initiallyPaid || state.ok === true;
  const paidAt = state.paidAt ?? initialPaidAt;

  // Confirmation dialog state — guards the irreversible "marked paid" RPC
  // call against fat-finger taps. Opens on "I've paid" click; only the
  // Confirm button inside actually submits the form. Derived `dialogOpen`
  // auto-closes while the action is in flight so the user sees the form's
  // "Confirming..." button state and isn't stuck behind a modal.
  const confirmRef = useRef<HTMLDialogElement>(null);
  const [confirmRequested, setConfirmRequested] = useState(false);
  const dialogOpen = confirmRequested && !pending;
  useEffect(() => {
    const d = confirmRef.current;
    if (!d) return;
    if (dialogOpen && !d.open) d.showModal();
    if (!dialogOpen && d.open) d.close();
  }, [dialogOpen]);

  // Audit fields (recipient-side state until "I've paid" submit)
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [note, setNote] = useState("");

  // Proof upload state — auto-uploads on file pick so user sees the result.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [proofState, setProofState] =
    useState<UploadProofState>(INITIAL_UPLOAD);
  const [isUploading, startUpload] = useTransition();

  useEffect(() => {
    // Revoke object URLs on cleanup to avoid leaks.
    return () => {
      if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    };
  }, [proofPreviewUrl]);

  const handleFile = (file: File) => {
    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    setProofPreviewUrl(URL.createObjectURL(file));
    setProofPath(null);
    setProofState(INITIAL_UPLOAD);

    const fd = new FormData();
    fd.append("token", token);
    fd.append("image", file);
    startUpload(async () => {
      const result = await uploadProof(INITIAL_UPLOAD, fd);
      setProofState(result);
      if (result.ok && result.proofPath) setProofPath(result.proofPath);
    });
  };

  const clearProof = () => {
    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    setProofPreviewUrl(null);
    setProofPath(null);
    setProofState(INITIAL_UPLOAD);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
      {/* Hidden inputs carry the controlled state into the action FormData. */}
      <input type="hidden" name="method" value={method} />
      <input type="hidden" name="note" value={note} />
      <input type="hidden" name="proofPath" value={proofPath ?? ""} />

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-widest text-foreground-soft">
          Payment method (optional)
        </span>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod | "")}
          disabled={pending || !canPay}
          className={FIELD}
          aria-label="Payment method"
        >
          {METHOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-widest text-foreground-soft">
          Reference / note (optional)
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 120))}
          disabled={pending || !canPay}
          maxLength={120}
          placeholder="e.g. DuitNow ref ABC123"
          className={FIELD}
        />
      </label>

      <ProofPicker
        canPick={!pending && canPay}
        previewUrl={proofPreviewUrl}
        proofPath={proofPath}
        isUploading={isUploading}
        errorMessage={proofState.ok === false ? proofState.message : null}
        fileInputRef={fileInputRef}
        onFile={handleFile}
        onClear={clearProof}
      />

      <Button
        type="button"
        onClick={() => setConfirmRequested(true)}
        disabled={pending || !canPay || isUploading}
        size="lg"
        className="w-full font-display uppercase tracking-widest"
      >
        {pending ? "Confirming..." : isUploading ? "Uploading proof..." : "I've paid"}
      </Button>
      {state.ok === false ? (
        <p role="alert" className="text-center text-sm text-stamp">
          {state.message}
        </p>
      ) : null}
      <p className="text-center text-[11px] text-foreground-faint">
        {!canPay
          ? "Tap items above first to compute your share."
          : "Tap after you transfer. Tukang bayar gets notified instantly."}
      </p>

      <ConfirmPaidDialog
        ref={confirmRef}
        amountOwedCents={amountOwedCents}
        method={method}
        note={note}
        proofAttached={Boolean(proofPath)}
        pending={pending}
        onCancel={() => setConfirmRequested(false)}
      />
    </form>
  );
}

interface ConfirmPaidDialogProps {
  ref: React.RefObject<HTMLDialogElement | null>;
  amountOwedCents: number;
  method: PaymentMethod | "";
  note: string;
  proofAttached: boolean;
  pending: boolean;
  onCancel: () => void;
}

function ConfirmPaidDialog({
  ref,
  amountOwedCents,
  method,
  note,
  proofAttached,
  pending,
  onCancel,
}: ConfirmPaidDialogProps) {
  const methodLabel =
    METHOD_OPTIONS.find((o) => o.value === method)?.label ?? "Not specified";

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="print-hide fixed inset-0 m-auto h-fit w-fit max-w-[95vw] border border-border bg-surface p-0 text-foreground backdrop:bg-foreground/60"
      aria-labelledby="confirm-paid-title"
    >
      <div className="w-[28rem] max-w-full p-6">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="confirm-paid-title"
            className="font-display text-2xl uppercase tracking-tight text-foreground"
          >
            Mark as paid?
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="inline-flex h-8 w-8 items-center justify-center border border-border bg-surface text-foreground hover:bg-surface-deep"
          >
            <X size={14} aria-hidden />
          </button>
        </div>

        <p className="mt-2 text-sm text-foreground-soft">
          Once marked, the tukang bayar sees this as settled. You can&apos;t
          un-mark it yourself — they&apos;d have to delete the bill to fix
          mistakes.
        </p>

        <dl className="mt-5 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-foreground-soft">Your share</dt>
          <dd className="font-mono tabular text-foreground">
            <AmountDisplay cents={amountOwedCents} size="sm" />
          </dd>

          <dt className="text-foreground-soft">Method</dt>
          <dd className="font-mono text-foreground">{methodLabel}</dd>

          {note ? (
            <>
              <dt className="text-foreground-soft">Note</dt>
              <dd className="break-words font-mono text-foreground">{note}</dd>
            </>
          ) : null}

          <dt className="text-foreground-soft">Proof</dt>
          <dd className="font-mono text-foreground">
            {proofAttached ? "Attached" : "None"}
          </dd>
        </dl>

        <div className="mt-6 grid grid-cols-2 gap-2">
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
          <button
            type="submit"
            disabled={pending}
            className={buttonClassName({
              size: "md",
              className: "w-full font-display uppercase tracking-widest",
            })}
          >
            {pending ? "Confirming..." : "Yes, I've paid"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

// ---------- Proof upload sub-component ----------

interface ProofPickerProps {
  canPick: boolean;
  previewUrl: string | null;
  proofPath: string | null;
  isUploading: boolean;
  errorMessage: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
  onClear: () => void;
}

function ProofPicker({
  canPick,
  previewUrl,
  proofPath,
  isUploading,
  errorMessage,
  fileInputRef,
  onFile,
  onClear,
}: ProofPickerProps) {
  // Perceived progress bar — the server action processes the file
  // (sharp EXIF strip + Storage upload) and doesn't expose progress
  // events, so we animate 0→90% over ~3s on upload start and snap to
  // 100% when the action completes. Better reassurance than a spinner.
  const progress = useUploadProgress(isUploading, Boolean(proofPath));

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-widest text-foreground-soft">
        Proof of transfer (optional)
      </span>
      {/* No `capture` attribute on purpose — payment proofs are
          almost always screenshots of a bank / TNG transfer that
          already live in the gallery. capture="environment" would
          force the camera and hide the gallery picker on both iOS
          and Android, making the optional proof effectively
          unuploadable for the common case. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />

      {previewUrl ? (
        <div className="flex flex-col gap-2 border border-border bg-surface p-2">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Payment proof preview"
              className="h-16 w-16 shrink-0 object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2 text-xs">
                {isUploading ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-foreground-soft" aria-hidden />
                    <span className="font-mono tabular text-foreground-soft">
                      Uploading… {progress}%
                    </span>
                  </>
                ) : proofPath ? (
                  <>
                    <Check size={12} className="text-ringgit" aria-hidden />
                    <span className="text-ringgit">Uploaded</span>
                  </>
                ) : errorMessage ? (
                  <span className="text-stamp" role="alert">
                    {errorMessage}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClear}
                disabled={!canPick}
                className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-widest text-foreground-soft hover:text-stamp"
              >
                <Trash2 size={11} aria-hidden />
                Remove
              </button>
            </div>
          </div>
          {isUploading || (proofPath && progress < 100) ? (
            <div className="h-1 w-full overflow-hidden border border-border bg-paper">
              <div
                className="h-full bg-ringgit transition-[width] duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={!canPick}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 border border-dashed border-border bg-surface/60 px-4 text-sm font-medium text-foreground-soft transition-colors hover:bg-surface-deep",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <Upload size={14} aria-hidden />
          Upload screenshot
        </button>
      )}
      {!previewUrl && errorMessage ? (
        <p role="alert" className="text-xs text-stamp">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

/*
 * Animated upload-progress percentage. The proof upload server action
 * doesn't expose real bytes-sent events (server actions run as a
 * single POST), so we animate a perceived curve:
 *   - On upload start: ease 0% → 90% over ~3s (easeOutCubic so it
 *     decelerates as it approaches 90%, feels like a real upload)
 *   - On upload complete: snap to 100% briefly, then reset to 0 once
 *     the success state has had a moment to land
 *   - On error / unmount: instant 0%
 *
 * Doesn't use Date.now() in render (would trip react-hooks/purity);
 * uses performance.now() inside the rAF tick — those are fine because
 * the tick runs outside React's render cycle.
 */
function useUploadProgress(isUploading: boolean, isDone: boolean): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // All setProgress calls run inside rAF callbacks (not synchronously
    // in this effect body) so the react-hooks/set-state-in-effect rule
    // stays happy. Each branch returns a cleanup that cancels its rAF.
    if (isDone) {
      const id = window.requestAnimationFrame(() => setProgress(100));
      return () => window.cancelAnimationFrame(id);
    }
    if (!isUploading) {
      const id = window.requestAnimationFrame(() => setProgress(0));
      return () => window.cancelAnimationFrame(id);
    }

    const start = performance.now();
    const duration = 3000;
    let rafId = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setProgress(Math.round(eased * 90));
      if (t < 1) rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isUploading, isDone]);

  return progress;
}
