"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customAlphabet } from "nanoid";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { AmountDisplay } from "@/components/amount-display";
import { Button, buttonClassName } from "@/components/button";
import { CurrencyInput } from "@/components/currency-input";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { cn } from "@/lib/cn";
import { fromCents, toCents } from "@/lib/money";
import { createBill, type CreateBillState } from "@/actions/bills";
import {
  CreateBillFormSchema,
  type CreateBillForm,
} from "@/types/schemas";

import { ItemClaimPicker } from "@/components/item-claim-picker";

import { MembersRowInput } from "./members-row-input";
import { ReceiptScanner, type ScannerApplyPayload } from "./receipt-scanner";

const ME_PLACEHOLDER_ID = "__me__";

const FIELD_INPUT =
  "h-12 w-full rounded-lg border border-border bg-surface px-3 font-sans text-base text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background";

const PRICE_PATTERN = /^\d*(\.\d{0,2})?$/;

const newItemId = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyz",
  10,
);

interface EditableItem {
  id: string;
  name: string;
  price: string;
}

type SplitMode = "equal" | "item";

// Adapter helpers that bridge the existing string-based RHF + local
// state (used by toCents() at submit time) and the cents-based
// <CurrencyInput> component. Keeps the form schema unchanged.
const centsToPriceString = (cents: number): string => {
  if (cents <= 0) return "";
  return fromCents(cents).toFixed(2);
};

const parsePriceToCents = (raw: string): number => {
  if (!raw || raw.trim() === "") return 0;
  try {
    return toCents(raw);
  } catch {
    return 0;
  }
};

export function CreateBillFormIsland() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [taxString, setTaxString] = useState("0");
  const [discountString, setDiscountString] = useState("0");
  // Tukang-bayar opt-in. Default true since the common case is "I ate too".
  // Drives the organizer-as-paid-member insert in createBill.
  const [includeMyself, setIncludeMyself] = useState(true);
  // Organizer's claimed items (item-mode only). Tracked client-side as
  // a Set of item IDs; flushed to FormData as JSON on submit.
  const [myClaimedItemIds, setMyClaimedItemIds] = useState<string[]>([]);

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateBillForm>({
    resolver: zodResolver(CreateBillFormSchema),
    defaultValues: {
      title: "",
      description: "",
      total: "",
      dueDate: "",
      membersInput: "",
      splitMode: "equal",
      items: [],
      taxCents: 0,
      discountCents: 0,
    },
  });

  // Computed sums for the item-mode breakdown card.
  const itemsSumCents = useMemo(
    () => items.reduce((acc, it) => acc + parsePriceToCents(it.price), 0),
    [items],
  );
  const taxCents = parsePriceToCents(taxString);
  const discountCents = parsePriceToCents(discountString);
  const computedTotalCents = Math.max(0, itemsSumCents + taxCents - discountCents);

  const handleScanApplied = (payload: ScannerApplyPayload) => {
    if (payload.title) setValue("title", payload.title, { shouldValidate: true });

    // Populate BOTH modes' state from the scan. The active splitMode just
    // decides which fields are rendered — toggling between Equal and By
    // Items should preserve everything the scanner found, not silently
    // wipe the inactive mode's data (which forced users to "Apply to form"
    // a second time after switching).
    if (payload.total) setValue("total", payload.total, { shouldValidate: true });
    setItems(
      payload.items.map((it) => ({
        id: it.id,
        name: it.name,
        price: fromCents(it.price_cents).toFixed(2),
      })),
    );
    setTaxString(fromCents(payload.taxCents).toFixed(2));
    setDiscountString(fromCents(payload.discountCents).toFixed(2));
    // Re-applying a scan resets the organizer's picks — the previous
    // claim IDs reference items that no longer exist after replace.
    setMyClaimedItemIds([]);
  };

  // Item-mode: the picker needs BillItem-shaped items (price_cents, not
  // string). Derive from the editable items state so the picker reflects
  // edits live. Skip items with empty/zero price — they're in-progress
  // rows and shouldn't appear in the organizer picker yet.
  const pickerItems = useMemo(
    () =>
      items
        .filter((it) => it.name.trim().length > 0)
        .map((it) => ({
          id: it.id,
          name: it.name.trim(),
          price_cents: parsePriceToCents(it.price),
        }))
        .filter((it) => it.price_cents > 0),
    [items],
  );

  // Drop stale myClaimedItemIds when items change (renamed, removed).
  // Keep only IDs that still exist in the current items array.
  const validItemIds = useMemo(
    () => new Set(pickerItems.map((it) => it.id)),
    [pickerItems],
  );
  const liveMyClaims = useMemo(
    () => myClaimedItemIds.filter((id) => validItemIds.has(id)),
    [myClaimedItemIds, validItemIds],
  );

  const toggleMyClaim = (itemId: string) => {
    setMyClaimedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  };

  const onSubmit = handleSubmit((data) => {
    setServerError(null);

    const itemsForServer = items
      .map((it) => ({
        id: it.id,
        name: it.name.trim(),
        price_cents: parsePriceToCents(it.price),
      }))
      .filter((it) => it.name.length > 0 && it.price_cents > 0);

    const fd = new FormData();
    fd.append("title", data.title);
    fd.append("description", data.description ?? "");
    fd.append("total", data.total ?? "");
    fd.append("dueDate", data.dueDate ?? "");
    fd.append("membersInput", data.membersInput);
    fd.append("splitMode", splitMode);
    fd.append("items", JSON.stringify(splitMode === "item" ? itemsForServer : []));
    fd.append("taxCents", String(splitMode === "item" ? taxCents : 0));
    fd.append("discountCents", String(splitMode === "item" ? discountCents : 0));
    fd.append("includeMyself", String(includeMyself));
    fd.append(
      "myClaimedItemIds",
      JSON.stringify(splitMode === "item" && includeMyself ? liveMyClaims : []),
    );

    startTransition(async () => {
      const initial: CreateBillState = { ok: null, message: "" };
      const result = await createBill(initial, fd);
      if (result?.ok === false) {
        setServerError(
          result.ref ? `${result.message} · Ref ${result.ref}` : result.message,
        );
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            setError(field as keyof CreateBillForm, { message });
          }
        }
      }
    });
  });

  const pending = isPending || isSubmitting;

  return (
    <ReceiptCard className="p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className={cn(
            buttonClassName({ variant: "ghost", size: "sm" }),
            "!h-9 !px-2 text-foreground-soft",
          )}
        >
          <ArrowLeft size={16} aria-hidden />
          Back
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
          New bill
        </div>
      </div>

      <h1 className="mt-4 font-display text-3xl uppercase tracking-tight text-foreground">
        Jom, set up a bill
      </h1>
      <p className="mt-2 text-sm text-foreground-soft">
        Fill in the bits below and we&apos;ll spit out one share link you
        can drop in the group chat.
      </p>

      <ReceiptDivider />

      <ReceiptScanner onScanned={handleScanApplied} />

      <ReceiptDivider label="or fill in" />

      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <ModeToggle value={splitMode} onChange={setSplitMode} disabled={pending} />

        <Field
          label="Title"
          error={errors.title?.message}
          input={
            <input
              {...register("title")}
              type="text"
              autoComplete="off"
              maxLength={100}
              placeholder="Mamak after futsal"
              className={FIELD_INPUT}
              disabled={pending}
            />
          }
        />

        <Field
          label="Description"
          hint="Optional — show up on the recipient page."
          error={errors.description?.message}
          input={
            <textarea
              {...register("description")}
              rows={2}
              maxLength={500}
              placeholder="Back room, drinks included"
              className={cn(FIELD_INPUT, "h-auto py-3")}
              disabled={pending}
            />
          }
        />

        {splitMode === "equal" ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="Total (RM)"
              error={errors.total?.message}
              input={
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-foreground-faint">
                    RM
                  </span>
                  <Controller
                    control={control}
                    name="total"
                    render={({ field }) => (
                      <CurrencyInput
                        value={parsePriceToCents(field.value ?? "")}
                        onChange={(c) => field.onChange(centsToPriceString(c))}
                        placeholder="120.00"
                        disabled={pending}
                        className={cn(FIELD_INPUT, "pl-12 font-mono")}
                      />
                    )}
                  />
                </div>
              }
            />
            <Field
              label="Due date"
              hint="Optional."
              error={errors.dueDate?.message}
              input={
                <input
                  {...register("dueDate")}
                  type="date"
                  className={FIELD_INPUT}
                  disabled={pending}
                />
              }
            />
          </div>
        ) : (
          <>
            <ItemModeFields
              items={items}
              setItems={setItems}
              taxString={taxString}
              setTaxString={setTaxString}
              discountString={discountString}
              setDiscountString={setDiscountString}
              itemsSumCents={itemsSumCents}
              taxCents={taxCents}
              discountCents={discountCents}
              computedTotalCents={computedTotalCents}
              disabled={pending}
              error={errors.items?.message}
            />
            <Field
              label="Due date"
              hint="Optional."
              error={errors.dueDate?.message}
              input={
                <input
                  {...register("dueDate")}
                  type="date"
                  className={FIELD_INPUT}
                  disabled={pending}
                />
              }
            />
          </>
        )}

        <IncludeMyselfCheckbox
          checked={includeMyself}
          onChange={setIncludeMyself}
          disabled={pending}
        />

        {splitMode === "item" && includeMyself && pickerItems.length > 0 ? (
          <div className="border border-border bg-surface/40 p-4">
            <div className="text-xs font-medium uppercase tracking-widest text-foreground-soft">
              Tap what you ate
            </div>
            <p className="mt-1 text-[11px] text-foreground-faint">
              Pick the items you ordered. Your share gets auto-paid when
              the bill is created, so the link only shows your friends
              what they need to settle.
            </p>
            <div className="mt-3">
              <ItemClaimPicker
                items={pickerItems}
                members={[
                  {
                    id: ME_PLACEHOLDER_ID,
                    name: "You",
                    claimedItemIds: liveMyClaims,
                    paid: false,
                  },
                ]}
                meId={ME_PLACEHOLDER_ID}
                onToggle={toggleMyClaim}
                disabled={pending}
              />
            </div>
          </div>
        ) : null}

        <Field
          label="Add the squad"
          hint={
            splitMode === "item"
              ? "Each person picks their items on the share link."
              : "Leave the amount blank to split equally. Fill it to override one person's share."
          }
          error={errors.membersInput?.message}
          input={
            <Controller
              name="membersInput"
              control={control}
              render={({ field }) => (
                <MembersRowInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  disabled={pending}
                  invalid={Boolean(errors.membersInput?.message)}
                  showAmount={splitMode === "equal"}
                />
              )}
            />
          }
        />

        {serverError && !Object.keys(errors).length ? (
          <p role="alert" className="text-sm text-stamp">
            {serverError}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse">
          <Button
            type="submit"
            disabled={pending}
            size="lg"
            className="font-display uppercase tracking-widest sm:flex-1"
          >
            {pending ? "Creating..." : "Jom, create bill"}
          </Button>
          <Link
            href="/dashboard"
            aria-disabled={pending}
            className={buttonClassName({
              variant: "ghost",
              size: "lg",
              className: "sm:flex-1",
            })}
          >
            Cancel
          </Link>
        </div>
      </form>
    </ReceiptCard>
  );
}

// ---------- Include-myself checkbox ----------

function IncludeMyselfCheckbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 border border-border bg-surface/40 px-3 py-3 transition-colors",
        "hover:bg-surface focus-within:ring-2 focus-within:ring-foreground focus-within:ring-offset-2 focus-within:ring-offset-background",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-ringgit"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">
          Include myself in the split (you ate too)
        </span>
        <span className="text-[11px] text-foreground-faint">
          Auto-paid as the tukang bayar. Uncheck if you only paid for
          others (e.g. treating someone).
        </span>
      </span>
    </label>
  );
}

// ---------- Mode toggle ----------

function ModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: SplitMode;
  onChange: (v: SplitMode) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-widest text-foreground-soft">
        Split mode
      </div>
      <div
        role="radiogroup"
        aria-label="Split mode"
        className="mt-2 grid grid-cols-2 gap-0 border border-border bg-surface p-1"
      >
        {(["equal", "item"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value === mode}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={cn(
              "px-3 py-2 text-sm font-medium uppercase tracking-widest transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              value === mode
                ? "bg-foreground text-paper"
                : "text-foreground-soft hover:bg-surface-deep",
              disabled ? "cursor-not-allowed opacity-60" : "",
            )}
          >
            {mode === "equal" ? "Equal split" : "By items"}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-foreground-faint">
        {value === "equal"
          ? "Bill is split evenly across members (or by your custom amounts)."
          : "List each item; recipients pick what they ordered on the share link."}
      </p>
    </div>
  );
}

// ---------- Item-mode fields ----------

function ItemModeFields({
  items,
  setItems,
  taxString,
  setTaxString,
  discountString,
  setDiscountString,
  itemsSumCents,
  taxCents,
  discountCents,
  computedTotalCents,
  disabled,
  error,
}: {
  items: EditableItem[];
  setItems: React.Dispatch<React.SetStateAction<EditableItem[]>>;
  taxString: string;
  setTaxString: (s: string) => void;
  discountString: string;
  setDiscountString: (s: string) => void;
  itemsSumCents: number;
  taxCents: number;
  discountCents: number;
  computedTotalCents: number;
  disabled?: boolean;
  error?: string;
}) {
  const updateItem = (id: string, patch: Partial<EditableItem>) => {
    setItems((curr) =>
      curr.map((it) => {
        if (it.id !== id) return it;
        if (patch.price !== undefined && !PRICE_PATTERN.test(patch.price)) return it;
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

  return (
    <div className="space-y-3 border border-border bg-surface/60 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-foreground-soft">
          Items ({items.length})
        </span>
        <span className="text-[11px] text-foreground-faint">
          Each one is claimable by recipients
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-foreground-soft">
          Scan a receipt above, or add items below.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 font-mono text-xs">
              <input
                type="text"
                value={it.name}
                onChange={(e) => updateItem(it.id, { name: e.target.value })}
                placeholder="Item name"
                maxLength={80}
                disabled={disabled}
                className="min-w-0 flex-1 border border-transparent bg-surface px-2 py-1.5 text-foreground placeholder:text-foreground-faint hover:border-border focus:border-foreground focus:outline-none"
                aria-label="Item name"
              />
              <span className="text-foreground-faint">RM</span>
              <CurrencyInput
                value={parsePriceToCents(it.price)}
                onChange={(c) => updateItem(it.id, { price: centsToPriceString(c) })}
                placeholder="0.00"
                disabled={disabled}
                className="w-20 border border-transparent bg-surface px-2 py-1.5 text-foreground placeholder:text-foreground-faint hover:border-border focus:border-foreground focus:outline-none"
                aria-label={`Price of ${it.name || "item"}`}
              />
              <button
                type="button"
                onClick={() => removeItem(it.id)}
                disabled={disabled}
                aria-label={`Remove ${it.name || "item"}`}
                className="inline-flex h-7 w-7 items-center justify-center text-foreground-faint transition-[color,transform] duration-150 hover:text-stamp active:scale-90 disabled:active:scale-100 disabled:opacity-40"
              >
                <Trash2 size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={addItem}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-widest text-foreground-soft hover:text-foreground"
      >
        <Plus size={12} aria-hidden />
        Add item
      </button>

      <ReceiptDivider />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-widest text-foreground-soft">
            Tax / service (RM)
          </span>
          <CurrencyInput
            value={parsePriceToCents(taxString)}
            onChange={(c) => setTaxString(centsToPriceString(c))}
            disabled={disabled}
            placeholder="0.00"
            className={cn(FIELD_INPUT, "font-mono")}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-widest text-foreground-soft">
            Discount (RM)
          </span>
          <CurrencyInput
            value={parsePriceToCents(discountString)}
            onChange={(c) => setDiscountString(centsToPriceString(c))}
            disabled={disabled}
            placeholder="0.00"
            className={cn(FIELD_INPUT, "font-mono")}
          />
        </label>
      </div>

      <dl className="space-y-1 border-t border-border pt-3 font-mono text-xs">
        <SummaryRow label="Items sum">
          <AmountDisplay cents={itemsSumCents} size="sm" muted />
        </SummaryRow>
        {taxCents > 0 ? (
          <SummaryRow label="+ Tax / service">
            <AmountDisplay cents={taxCents} size="sm" muted />
          </SummaryRow>
        ) : null}
        {discountCents > 0 ? (
          <SummaryRow label="− Discount">
            <span className="text-ringgit">
              − <AmountDisplay cents={discountCents} size="sm" muted />
            </span>
          </SummaryRow>
        ) : null}
        <SummaryRow label="Bill total" emphasize>
          <AmountDisplay cents={computedTotalCents} size="md" />
        </SummaryRow>
      </dl>

      {error ? (
        <p role="alert" className="text-xs text-stamp">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SummaryRow({
  label,
  emphasize,
  children,
}: {
  label: string;
  emphasize?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        emphasize && "border-t border-border pt-1.5 text-foreground",
      )}
    >
      <dt
        className={cn(
          "text-foreground-soft",
          emphasize && "text-xs font-medium uppercase tracking-widest text-foreground",
        )}
      >
        {label}
      </dt>
      <dd className="tabular">{children}</dd>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  input,
}: {
  label: string;
  hint?: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-foreground-soft">
          {label}
        </span>
        {hint ? (
          <span className="text-right text-[11px] text-foreground-faint">{hint}</span>
        ) : null}
      </span>
      {input}
      {error ? (
        <span role="alert" className="text-xs text-stamp">
          {error}
        </span>
      ) : null}
    </label>
  );
}
