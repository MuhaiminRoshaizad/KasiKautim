"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Camera,
  Check,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
import { ReceiptDivider } from "@/components/receipt-card";
import { cn } from "@/lib/cn";
import { fromCents, toCents } from "@/lib/money";
import {
  scanReceipt,
  type ScanReceiptState,
  type ScannedReceipt,
} from "@/actions/scan-receipt";

const INITIAL: ScanReceiptState = { ok: null, message: "" };

interface ReceiptScannerProps {
  onScanned: (args: { title: string; total: string }) => void;
}

interface EditableItem {
  id: number;
  name: string;
  price: string; // raw input ("12.50") to avoid float jitter while typing
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
        onApply={(merchant, totalString) => onScanned({ title: merchant, total: totalString })}
        fileInputRef={inputRef}
        onFile={handleFile}
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
            Snap your restaurant receipt — we auto-fill the title, total, and
            items using Google Gemini. Edit anything that&apos;s wrong before
            applying.
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

// ---------- Editable scanned-result panel ----------

interface ScanResultProps {
  receipt: ScannedReceipt;
  onClear: () => void;
  onRescan: () => void;
  onApply: (merchant: string, totalString: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
}

const PRICE_PATTERN = /^\d*(\.\d{0,2})?$/;

function ScanResult({
  receipt,
  onClear,
  onRescan,
  onApply,
}: ScanResultProps) {
  const [merchant, setMerchant] = useState(receipt.merchant_name ?? "");
  const [items, setItems] = useState<EditableItem[]>(() =>
    receipt.items.map((it, i) => ({
      id: i,
      name: it.name,
      price: fromCents(it.price_cents).toFixed(2),
    })),
  );
  const [total, setTotal] = useState<string>(
    fromCents(receipt.total_cents).toFixed(2),
  );
  const nextIdRef = useRef(receipt.items.length);

  // Computed sums.
  const itemsSumCents = useMemo(() => {
    return items.reduce((acc, it) => {
      try {
        return acc + toCents(it.price || "0");
      } catch {
        return acc;
      }
    }, 0);
  }, [items]);

  const taxCents = receipt.tax_cents ?? 0;

  const itemsPlusTaxCents = itemsSumCents + taxCents;

  let totalCents = 0;
  try {
    totalCents = toCents(total || "0");
  } catch {
    totalCents = 0;
  }

  const totalDoesNotMatch = itemsPlusTaxCents !== totalCents && itemsSumCents > 0;

  const updateItem = (id: number, patch: Partial<EditableItem>) => {
    setItems((curr) =>
      curr.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        if (patch.price !== undefined && !PRICE_PATTERN.test(patch.price)) {
          return it; // reject invalid char
        }
        return next;
      }),
    );
  };

  const removeItem = (id: number) =>
    setItems((curr) => curr.filter((it) => it.id !== id));

  const addItem = () =>
    setItems((curr) => [
      ...curr,
      { id: nextIdRef.current++, name: "", price: "" },
    ]);

  const useSumAsTotal = () => {
    setTotal(fromCents(itemsPlusTaxCents).toFixed(2));
  };

  const apply = () => {
    onApply(merchant, total);
  };

  return (
    <div className="border border-ringgit/40 bg-ringgit-soft/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-widest text-ringgit">
            ✓ Scanned · {receipt.currency}
          </div>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Merchant name"
            className="mt-1 w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-foreground-faint"
            aria-label="Merchant name"
          />
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear scan"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-foreground-faint hover:text-foreground"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      <ReceiptDivider label={`${items.length} ${items.length === 1 ? "item" : "items"} (editable)`} />

      <ul className="max-h-56 space-y-1.5 overflow-y-auto">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-2 font-mono text-xs"
          >
            <input
              type="text"
              value={it.name}
              onChange={(e) => updateItem(it.id, { name: e.target.value })}
              placeholder="Item name"
              maxLength={80}
              className="min-w-0 flex-1 border border-transparent bg-transparent px-1 py-0.5 text-foreground placeholder:text-foreground-faint hover:border-border focus:border-foreground focus:bg-surface focus:outline-none"
              aria-label="Item name"
            />
            <span className="text-foreground-faint">RM</span>
            <input
              type="text"
              inputMode="decimal"
              value={it.price}
              onChange={(e) => updateItem(it.id, { price: e.target.value })}
              placeholder="0.00"
              className="w-16 border border-transparent bg-transparent px-1 py-0.5 text-right tabular text-foreground placeholder:text-foreground-faint hover:border-border focus:border-foreground focus:bg-surface focus:outline-none"
              aria-label={`Price of ${it.name || "item"}`}
            />
            <button
              type="button"
              onClick={() => removeItem(it.id)}
              aria-label={`Remove ${it.name || "item"}`}
              className="inline-flex h-6 w-6 items-center justify-center text-foreground-faint hover:text-stamp"
            >
              <Trash2 size={12} aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addItem}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-widest text-foreground-soft hover:text-foreground"
      >
        <Plus size={12} aria-hidden />
        Add item
      </button>

      <ReceiptDivider label="Breakdown" />

      <dl className="space-y-1 font-mono text-xs">
        <Row label="Sum of items">
          <AmountDisplay cents={itemsSumCents} size="sm" muted />
        </Row>
        {taxCents > 0 ? (
          <Row label="Tax / service">
            <AmountDisplay cents={taxCents} size="sm" muted />
          </Row>
        ) : null}
        {receipt.subtotal_cents != null && receipt.subtotal_cents !== itemsSumCents ? (
          <Row label="Scanned subtotal">
            <span className="text-foreground-faint">
              <AmountDisplay cents={receipt.subtotal_cents} size="sm" muted />{" "}
              <span className="text-[10px]">(differs from items)</span>
            </span>
          </Row>
        ) : null}
      </dl>

      <div className="mt-2 flex items-center gap-2 border-t border-ringgit/30 pt-2">
        <span className="text-xs font-medium uppercase tracking-widest text-foreground-soft">
          Total
        </span>
        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="font-mono text-xs text-foreground-faint">RM</span>
          <input
            type="text"
            inputMode="decimal"
            value={total}
            onChange={(e) => {
              if (PRICE_PATTERN.test(e.target.value)) setTotal(e.target.value);
            }}
            className="w-20 border border-border bg-surface px-2 py-1 text-right font-mono text-sm tabular text-foreground focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background"
            aria-label="Total"
          />
        </div>
      </div>

      {totalDoesNotMatch ? (
        <button
          type="button"
          onClick={useSumAsTotal}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-widest text-ringgit underline-offset-4 hover:underline"
        >
          <RotateCcw size={11} aria-hidden />
          Use sum{taxCents > 0 ? " + tax" : ""} as total ({" "}
          <AmountDisplay cents={itemsPlusTaxCents} size="sm" muted />
          {" "})
        </button>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={apply}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 border border-ringgit bg-ringgit px-4 text-sm font-medium text-paper transition-colors hover:bg-ringgit/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ringgit focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Check size={14} aria-hidden />
          Apply to form
        </button>
        <button
          type="button"
          onClick={onRescan}
          className="inline-flex h-10 items-center justify-center gap-2 border border-border bg-surface px-4 text-sm font-medium text-foreground-soft transition-colors hover:bg-surface-deep"
        >
          <Camera size={14} aria-hidden />
          Rescan
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-foreground-soft">{label}</dt>
      <dd className="tabular">{children}</dd>
    </div>
  );
}
