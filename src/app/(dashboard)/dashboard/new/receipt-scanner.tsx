"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Sparkles, X } from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
import { ReceiptDivider } from "@/components/receipt-card";
import { cn } from "@/lib/cn";
import { fromCents } from "@/lib/money";
import {
  scanReceipt,
  type ScanReceiptState,
  type ScannedReceipt,
} from "@/actions/scan-receipt";

const INITIAL: ScanReceiptState = { ok: null, message: "" };

interface ReceiptScannerProps {
  onScanned: (args: { title: string; total: string }) => void;
}

export function ReceiptScanner({ onScanned }: ReceiptScannerProps) {
  const [state, setState] = useState<ScanReceiptState>(INITIAL);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setState(INITIAL);
    const fd = new FormData();
    fd.append("image", file);
    startTransition(async () => {
      const result = await scanReceipt(INITIAL, fd);
      setState(result);
      if (result.ok && result.receipt) {
        onScanned({
          title: result.receipt.merchant_name ?? "",
          total: fromCents(result.receipt.total_cents).toFixed(2),
        });
      }
    });
  };

  const reset = () => {
    setState(INITIAL);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (state.ok && state.receipt) {
    return (
      <ScanResult
        receipt={state.receipt}
        onClear={reset}
        onRescan={() => inputRef.current?.click()}
      />
    );
  }

  return (
    <div className="border border-dashed border-border bg-surface/60 p-4">
      <div className="flex items-start gap-3">
        <Sparkles size={16} className="mt-1 shrink-0 text-ringgit" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-widest text-foreground-soft">
            Magical scanner
          </div>
          <p className="mt-1 text-sm text-foreground-soft">
            Snap your restaurant receipt — we auto-fill the title and total
            using Google Gemini.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "inline-flex h-11 flex-1 items-center justify-center gap-2 border border-foreground bg-foreground px-4 text-sm font-medium text-paper transition-colors hover:bg-foreground/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {isPending ? (
            <>
              <Loader2 size={16} aria-hidden className="animate-spin" />
              Reading receipt...
            </>
          ) : (
            <>
              <Camera size={16} aria-hidden />
              Scan a receipt
            </>
          )}
        </button>
      </div>

      {state.ok === false && state.message ? (
        <p role="alert" className="mt-3 text-xs text-stamp">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function ScanResult({
  receipt,
  onClear,
  onRescan,
}: {
  receipt: ScannedReceipt;
  onClear: () => void;
  onRescan: () => void;
}) {
  const itemsTotalCents = receipt.items.reduce(
    (acc, it) => acc + it.price_cents,
    0,
  );
  return (
    <div className="border border-ringgit/40 bg-ringgit-soft/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-ringgit">
            ✓ Scanned · {receipt.currency}
          </div>
          <p className="mt-1 text-sm text-foreground-soft">
            {receipt.merchant_name ?? "Receipt"} · Title & total filled in below.
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear scan"
          className="inline-flex h-7 w-7 items-center justify-center text-foreground-faint hover:text-foreground"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {receipt.items.length > 0 ? (
        <>
          <ReceiptDivider label={`${receipt.items.length} items`} />
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {receipt.items.map((it, i) => (
              <li
                key={`${it.name}-${i}`}
                className="flex items-baseline justify-between gap-3 font-mono"
              >
                <span className="truncate text-foreground">{it.name}</span>
                <AmountDisplay cents={it.price_cents} size="sm" muted />
              </li>
            ))}
          </ul>
          {itemsTotalCents !== receipt.total_cents ? (
            <p className="mt-2 text-[11px] text-foreground-faint">
              Note: line items don&apos;t sum to the receipt total — tax or
              service charge likely included.
            </p>
          ) : null}
        </>
      ) : null}

      <button
        type="button"
        onClick={onRescan}
        className="mt-3 text-xs font-medium uppercase tracking-widest text-foreground-soft underline-offset-4 hover:underline"
      >
        Rescan
      </button>
    </div>
  );
}
