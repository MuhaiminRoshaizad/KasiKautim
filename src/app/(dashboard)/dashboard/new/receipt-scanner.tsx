"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { customAlphabet } from "nanoid";
import {
  AlertTriangle,
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
import { compressImage } from "@/lib/compress-image";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { fromCents, toCents } from "@/lib/money";
import {
  scanReceipt,
  type ScanReceiptState,
  type ScannedReceipt,
} from "@/actions/scan-receipt";
import type { BillItemInput } from "@/types/schemas";

const INITIAL: ScanReceiptState = { ok: null, message: "" };

// String IDs for items so they round-trip through DB JSONB unchanged.
const newItemId = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyz",
  10,
);

export interface ScannerApplyPayload {
  title: string;
  total: string;
  items: BillItemInput[];
  taxCents: number;
  discountCents: number;
  currency: string;
}

interface ReceiptScannerProps {
  onScanned: (payload: ScannerApplyPayload) => void;
}

interface EditableItem {
  id: string;
  name: string;
  price: string; // raw input ("12.50") to avoid float jitter while typing
}

export function ReceiptScanner({ onScanned }: ReceiptScannerProps) {
  const [state, setState] = useState<ScanReceiptState>(INITIAL);
  const [isPending, startTransition] = useTransition();
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setState(INITIAL);
    startTransition(async () => {
      // Compress on the client so a 5 MB landscape phone shot doesn't
      // exceed the server-action body limit before the action runs.
      const ready = await compressImage(file);
      const fd = new FormData();
      fd.append("image", ready);
      const result = await scanReceipt(INITIAL, fd);
      setState(result);
      if (result.ok && result.receipt) {
        // Only auto-fill the form if the receipt is in our supported currency.
        if (result.receipt.currency === DEFAULT_CURRENCY) {
          onScanned({
            title: result.receipt.merchant_name ?? "",
            total: fromCents(result.receipt.total_cents).toFixed(2),
            items: result.receipt.items.map((it) => ({
              id: newItemId(),
              name: it.name,
              price_cents: it.price_cents,
            })),
            taxCents: result.receipt.tax_cents ?? 0,
            discountCents: result.receipt.discount_cents ?? 0,
            currency: result.receipt.currency,
          });
        }
      }
    });
  };

  const reset = () => {
    setState(INITIAL);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Drag-and-drop handlers — desktop convenience; mobile gets the OS
  // sheet via tap on the same surface.
  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!isPending) setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isPending) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (state.ok && state.receipt) {
    return (
      <ScanResult
        receipt={state.receipt}
        onClear={reset}
        onRescan={() => inputRef.current?.click()}
        onApply={(payload) => onScanned(payload)}
      />
    );
  }

  return (
    <div>
      {/* No `capture` attribute on purpose — with capture="environment"
          mobile browsers skip the gallery picker entirely and jump
          straight into the camera. Without it, iOS shows a "Photo
          Library / Take Photo / Choose File" sheet and Android shows
          its app chooser, letting users pick a receipt photo they
          already took. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {/*
       * Full-panel tap target instead of a small button buried in an
       * info card. Pattern follows Strava / Linear / Vercel asset-
       * upload affordances — the entire dashed zone fires the file
       * picker. Drag-and-drop is wired for desktop convenience; mobile
       * gets the OS Camera/Library sheet via the same tap.
       */}
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label="Scan a receipt"
        className={cn(
          "group block w-full rounded-lg border-2 border-dashed bg-surface/60 px-6 py-8 text-left transition-[background-color,border-color,transform] duration-150 sm:py-10",
          isDragOver
            ? "border-ringgit bg-ringgit-soft/30"
            : "border-border hover:border-foreground/40 hover:bg-surface-deep/50 active:scale-[0.99]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100",
        )}
      >
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors",
              isDragOver && "border-ringgit text-ringgit",
            )}
            aria-hidden
          >
            {isPending ? (
              <Loader2 size={24} className="animate-spin" aria-hidden />
            ) : (
              <Camera size={24} aria-hidden />
            )}
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 font-display text-base uppercase tracking-widest text-foreground">
              <Sparkles size={14} className="text-ringgit" aria-hidden />
              {isPending ? "Reading receipt..." : "Scan a receipt"}
            </div>
            <p className="text-xs text-foreground-soft sm:text-sm">
              Snap your restaurant receipt — we auto-fill the title, total,
              and items using Google Gemini. Edit anything that&apos;s wrong
              before applying.
            </p>
          </div>
        </div>
      </button>

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
  onApply: (payload: ScannerApplyPayload) => void;
}

const PRICE_PATTERN = /^\d*(\.\d{0,2})?$/;

function ScanResult({ receipt, onClear, onRescan, onApply }: ScanResultProps) {
  const currency = receipt.currency || DEFAULT_CURRENCY;
  const isSupportedCurrency = currency === DEFAULT_CURRENCY;

  const [merchant, setMerchant] = useState(receipt.merchant_name ?? "");
  const [items, setItems] = useState<EditableItem[]>(() =>
    receipt.items.map((it) => ({
      id: newItemId(),
      name: it.name,
      price: fromCents(it.price_cents).toFixed(2),
    })),
  );
  const [total, setTotal] = useState<string>(
    fromCents(receipt.total_cents).toFixed(2),
  );

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
  const discountCents = receipt.discount_cents ?? 0;
  const subtotalScannedCents = receipt.subtotal_cents;

  let totalCents = 0;
  try {
    totalCents = toCents(total || "0");
  } catch {
    totalCents = 0;
  }

  // Sum-as-total uses the receipt's printed subtotal when available
  // (more reliable than items extracted), falling back to items sum.
  const baseForSum = subtotalScannedCents ?? itemsSumCents;
  const sumPlusTaxCents = baseForSum + taxCents - discountCents;
  const totalDiffersFromSum = sumPlusTaxCents !== totalCents;

  const updateItem = (id: string, patch: Partial<EditableItem>) => {
    setItems((curr) =>
      curr.map((it) => {
        if (it.id !== id) return it;
        if (patch.price !== undefined && !PRICE_PATTERN.test(patch.price)) {
          return it;
        }
        return { ...it, ...patch };
      }),
    );
  };

  const removeItem = (id: string) =>
    setItems((curr) => curr.filter((it) => it.id !== id));

  const addItem = () =>
    setItems((curr) => [
      ...curr,
      { id: newItemId(), name: "", price: "" },
    ]);

  const useSumAsTotal = () => {
    setTotal(fromCents(sumPlusTaxCents).toFixed(2));
  };

  const apply = () => {
    // Convert editable items to the server-side BillItemInput shape.
    const itemsForApply: BillItemInput[] = items
      .map((it) => {
        let price_cents = 0;
        try {
          price_cents = toCents(it.price || "0");
        } catch {
          price_cents = 0;
        }
        return { id: it.id, name: it.name.trim(), price_cents };
      })
      .filter((it) => it.name.length > 0 && it.price_cents > 0);

    onApply({
      title: merchant,
      total,
      items: itemsForApply,
      taxCents,
      discountCents,
      currency,
    });
  };

  return (
    <div className="border border-ringgit/40 bg-ringgit-soft/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-widest text-ringgit">
            ✓ Scanned · {currency}
          </div>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Merchant name"
            // text-base (16px) on mobile dodges iOS Safari's zoom-on-
            // focus heuristic; tightens back at sm+ for desktop density.
            className="mt-1 w-full bg-transparent text-base font-medium text-foreground outline-none placeholder:text-foreground-faint sm:text-sm"
            aria-label="Merchant name"
          />
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear scan"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-foreground-faint transition-[color,transform] duration-150 hover:text-foreground active:scale-90"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {!isSupportedCurrency ? (
        <UnsupportedCurrencyBanner currency={currency} />
      ) : null}

      <ReceiptDivider
        label={`${items.length} ${items.length === 1 ? "item" : "items"} (editable)`}
      />

      <ul className="max-h-56 space-y-1.5 overflow-y-auto">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 font-mono text-xs">
            <input
              type="text"
              value={it.name}
              onChange={(e) => updateItem(it.id, { name: e.target.value })}
              placeholder="Item name"
              maxLength={80}
              // text-base on mobile dodges iOS Safari zoom-on-focus; tighten
              // to text-xs at sm+ to preserve the row density on desktop.
              className="min-w-0 flex-1 border border-transparent bg-transparent px-1 py-0.5 text-base text-foreground placeholder:text-foreground-faint hover:border-border focus:border-foreground focus:bg-surface focus:outline-none sm:text-xs"
              aria-label="Item name"
            />
            <span className="text-foreground-faint">{currency}</span>
            <input
              type="text"
              inputMode="decimal"
              value={it.price}
              onChange={(e) => updateItem(it.id, { price: e.target.value })}
              placeholder="0.00"
              className="w-16 border border-transparent bg-transparent px-1 py-0.5 text-right text-base tabular text-foreground placeholder:text-foreground-faint hover:border-border focus:border-foreground focus:bg-surface focus:outline-none sm:text-xs"
              aria-label={`Price of ${it.name || "item"}`}
            />
            <button
              type="button"
              onClick={() => removeItem(it.id)}
              aria-label={`Remove ${it.name || "item"}`}
              className="inline-flex h-6 w-6 items-center justify-center text-foreground-faint transition-[color,transform] duration-150 hover:text-stamp active:scale-90"
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

      <Breakdown
        currency={currency}
        itemsSumCents={itemsSumCents}
        taxCents={taxCents}
        discountCents={discountCents}
        subtotalScannedCents={subtotalScannedCents}
        totalCents={totalCents}
      />

      <div className="mt-3 flex items-center gap-2 border-t border-ringgit/30 pt-3">
        <span
          className="text-xs font-medium uppercase tracking-widest text-foreground"
          title="The amount the bill should charge people. Editable — fix it if the scanner got it wrong."
        >
          Final amount to charge
        </span>
        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="font-mono text-xs text-foreground-faint">{currency}</span>
          <input
            type="text"
            inputMode="decimal"
            value={total}
            onChange={(e) => {
              if (PRICE_PATTERN.test(e.target.value)) setTotal(e.target.value);
            }}
            // text-base mobile, text-sm desktop - same iOS zoom guard as
            // the rest of the inputs in this panel.
            className="w-20 border border-border bg-surface px-2 py-1 text-right font-mono text-base tabular text-foreground focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background sm:text-sm"
            aria-label="Total"
          />
        </div>
      </div>

      {totalDiffersFromSum && sumPlusTaxCents > 0 ? (
        <button
          type="button"
          onClick={useSumAsTotal}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-widest text-ringgit underline-offset-4 hover:underline"
          title={
            subtotalScannedCents != null
              ? "Replace total with: receipt's printed subtotal + tax − discount."
              : "Replace total with: items sum + tax − discount."
          }
        >
          <RotateCcw size={11} aria-hidden />
          Use {subtotalScannedCents != null ? "receipt subtotal" : "items sum"}
          {taxCents > 0 ? " + tax" : ""} as total ({" "}
          <AmountDisplay cents={sumPlusTaxCents} size="sm" muted />
          {" "})
        </button>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={apply}
          disabled={!isSupportedCurrency}
          className={cn(
            "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-sm border border-ringgit bg-ringgit px-4 text-sm font-medium text-paper transition-[color,background-color,transform] duration-150 hover:bg-ringgit/90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ringgit focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
          )}
          title={
            isSupportedCurrency
              ? undefined
              : `KasiKautim only supports ${DEFAULT_CURRENCY} bills.`
          }
        >
          <Check size={14} aria-hidden />
          Apply to form
        </button>
        <button
          type="button"
          onClick={onRescan}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-border bg-surface px-4 text-sm font-medium text-foreground-soft transition-[color,background-color,transform] duration-150 hover:bg-surface-deep active:scale-[0.97]"
        >
          <Camera size={14} aria-hidden />
          Rescan
        </button>
      </div>
    </div>
  );
}

function UnsupportedCurrencyBanner({ currency }: { currency: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 border border-stamp/40 bg-stamp-soft/40 p-3 text-xs">
      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-stamp" aria-hidden />
      <div>
        <p className="font-medium text-stamp">
          This receipt is in {currency} — KasiKautim only supports {DEFAULT_CURRENCY}.
        </p>
        <p className="mt-1 text-foreground-soft">
          You can browse the scan below, but &quot;Apply to form&quot; is
          disabled to prevent currency mismatches. Convert the total to{" "}
          {DEFAULT_CURRENCY} manually if you want to use this bill.
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  tooltip,
  highlight,
  children,
}: {
  label: string;
  hint?: string;
  tooltip?: string;
  highlight?: "warning" | "ok";
  children: React.ReactNode;
}) {
  const hintColor =
    highlight === "warning"
      ? "text-stamp"
      : highlight === "ok"
        ? "text-ringgit"
        : "text-foreground-faint";
  return (
    <div className="flex items-baseline justify-between gap-3 font-mono text-xs">
      <dt className="flex min-w-0 items-baseline gap-2 text-foreground-soft">
        <span
          title={tooltip}
          className={
            tooltip
              ? "cursor-help underline decoration-dotted decoration-foreground-faint/40 underline-offset-2"
              : undefined
          }
        >
          {label}
        </span>
        {hint ? (
          <span className={cn("truncate text-[10px]", hintColor)}>{hint}</span>
        ) : null}
      </dt>
      <dd className="tabular shrink-0">{children}</dd>
    </div>
  );
}

interface BreakdownProps {
  currency: string;
  itemsSumCents: number;
  taxCents: number;
  discountCents: number;
  subtotalScannedCents: number | null;
  totalCents: number;
}

/**
 * The receipt's *printed* subtotal/tax/total are the source of truth.
 * Items-extracted is shown as a *check* row — if it doesn't match the
 * receipt's subtotal, that's an OCR error and the user should fix the items.
 *
 * Reconciliation runs on the receipt's printed numbers, not on extracted items.
 * Two common patterns:
 *   - Tax added on top : subtotal + tax − discount = total
 *   - Tax already in   : subtotal − discount       = total  (tax shown for audit)
 * Both pass reconciliation; the tax-row hint tells the user which one applies.
 *
 * A 5-cent tolerance covers the standard Malaysian 5-sen rounding.
 */
function Breakdown({
  currency,
  itemsSumCents,
  taxCents,
  discountCents,
  subtotalScannedCents,
  totalCents,
}: BreakdownProps) {
  const TOL = 5;
  const close = (a: number, b: number) => Math.abs(a - b) <= TOL;

  // Source-of-truth selection: prefer the receipt's printed subtotal.
  const truthSubtotal = subtotalScannedCents ?? itemsSumCents;

  const taxAddedOnTop = close(truthSubtotal + taxCents - discountCents, totalCents);
  const taxIncluded =
    !taxAddedOnTop &&
    taxCents > 0 &&
    close(truthSubtotal - discountCents, totalCents);
  const reconciles = taxAddedOnTop || taxIncluded || taxCents === 0;

  // Items-extracted check: does the items list match the receipt's printed subtotal?
  const itemsMatchSubtotal =
    subtotalScannedCents == null
      ? null
      : close(itemsSumCents, subtotalScannedCents);

  const taxHint = taxIncluded
    ? "already in item prices"
    : taxAddedOnTop
      ? "added on top"
      : taxCents > 0
        ? "doesn't match — check receipt"
        : undefined;

  return (
    <dl className="space-y-1">
      {/* Items-extracted check row (top — it's our OCR output, may need editing) */}
      <Row
        label="Items I extracted"
        hint={
          itemsMatchSubtotal === false
            ? "differs from receipt — fix items above"
            : itemsMatchSubtotal === true
              ? "matches receipt subtotal"
              : undefined
        }
        highlight={
          itemsMatchSubtotal === false
            ? "warning"
            : itemsMatchSubtotal === true
              ? "ok"
              : undefined
        }
        tooltip="Sum of the items I OCR'd from the receipt. If this doesn't match the receipt's printed subtotal, some items above were misread — edit the prices/names to fix."
      >
        <AmountDisplay cents={itemsSumCents} size="sm" muted />
      </Row>

      <ReceiptDivider />

      {/* The receipt's printed numbers — the source of truth */}
      {subtotalScannedCents != null ? (
        <Row
          label="Subtotal printed on receipt"
          tooltip="The 'Subtotal' line printed on the receipt itself. This is the source of truth — trust it over items-extracted when they disagree."
        >
          <AmountDisplay cents={subtotalScannedCents} size="sm" muted />
        </Row>
      ) : null}

      {discountCents > 0 ? (
        <Row
          label="Discount / promo"
          tooltip="Voucher, coupon, or promo amount the receipt subtracted before total."
        >
          <span className="text-ringgit">
            − <AmountDisplay cents={discountCents} size="sm" muted />
          </span>
        </Row>
      ) : null}

      {taxCents > 0 ? (
        <Row
          label="GST / SST / service"
          hint={taxHint}
          tooltip={
            taxIncluded
              ? `Tax printed on the receipt — but on this receipt it's already inside the item prices, so don't add it on top. Math: subtotal = total = ${currency} ${(totalCents / 100).toFixed(2)}.`
              : taxAddedOnTop
                ? `Tax printed on the receipt and added on top of subtotal to reach the total. Math: subtotal + tax - discount = total.`
                : `Tax printed on the receipt. The math doesn't cleanly reconcile — double-check the total below.`
          }
        >
          <AmountDisplay cents={taxCents} size="sm" muted />
        </Row>
      ) : null}

      {reconciles ? (
        <p
          className="pt-1 text-[10px] text-ringgit"
          title="The receipt's printed numbers add up cleanly to the total."
        >
          ✓ receipt math reconciles
        </p>
      ) : (
        <p
          className="pt-1 text-[10px] text-stamp"
          title="The receipt's printed subtotal + tax doesn't add up to the printed total. Manually verify before applying."
        >
          ⚠ receipt math doesn&apos;t reconcile — verify the total
        </p>
      )}
    </dl>
  );
}
