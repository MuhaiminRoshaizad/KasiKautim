"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { LIMITS } from "@/lib/constants";

interface MembersRowInputProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Show the amount column. False for item-mode bills where shares are computed from claims. */
  showAmount: boolean;
}

interface Row {
  name: string;
  amount: string;
}

const SEPARATORS = /[,\n]+/;
const AMOUNT_TAIL = /^(.+?)\s+(\d+(?:\.\d{1,2})?)$/;

const DECIMAL_PATTERN = /^\d*(\.\d{0,2})?$/;

/*
 * Splitwise-style row layout for adding the squad. Each row is one
 * person: name field + (in equal-mode) optional amount override field
 * + remove button. "Add a row" button at the bottom. Pattern is what
 * most expense-split apps use because:
 *
 *   - One person = one row (visually unambiguous)
 *   - Custom amount has its own field (no "Wani 30" syntax to learn)
 *   - Remove is a per-row icon button, big tap target
 *   - "Add a row" is the explicit affordance to keep going
 *
 * Source of truth is still the `membersInput` string the existing
 * parseMembers parser eats — rows are derived from the string on
 * every render, serialized back when the user edits. parseMembers
 * stays untouched (40 tests still pass), the only thing changing is
 * how the user constructs that string.
 */
export function MembersRowInput({
  value,
  onChange,
  disabled,
  invalid,
  showAmount,
}: MembersRowInputProps) {
  // Derive rows from the source string. Trailing empty row is added
  // automatically below so the user always has somewhere to type.
  const rows = useMemo<Row[]>(() => {
    const chunks = value
      .split(SEPARATORS)
      .map((s) => s.trim())
      .filter(Boolean);
    return chunks.map((chunk) => {
      const match = chunk.match(AMOUNT_TAIL);
      if (match) {
        return { name: match[1], amount: match[2] };
      }
      return { name: chunk, amount: "" };
    });
  }, [value]);

  const serialize = (next: Row[]): string => {
    return next
      .map((r) => {
        const name = r.name.trim();
        if (!name) return "";
        const amt = showAmount ? r.amount.trim() : "";
        return amt ? `${name} ${amt}` : name;
      })
      .filter(Boolean)
      .join(", ");
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    const next = [...rows];
    next[i] = { ...next[i]!, ...patch };
    onChange(serialize(next));
  };

  const removeRow = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    onChange(serialize(next));
  };

  const addRow = () => {
    if (rows.length >= LIMITS.memberCount) return;
    onChange(serialize([...rows, { name: "", amount: "" }]));
  };

  const handleAmountInput = (i: number, raw: string) => {
    if (raw === "" || DECIMAL_PATTERN.test(raw)) {
      updateRow(i, { amount: raw });
    }
  };

  // Show all the user's rows + one always-empty row at the bottom for
  // quick typing without first hitting "Add a row".
  const displayRows: Row[] = [...rows, { name: "", amount: "" }];

  return (
    <div
      className={cn(
        "flex flex-col border bg-surface p-2",
        invalid ? "border-stamp" : "border-border",
      )}
    >
      <ul className="space-y-1.5">
        {displayRows.map((row, i) => {
          const isTrailing = i === displayRows.length - 1;
          const filled = row.name.trim() !== "" || row.amount.trim() !== "";
          return (
            <li
              key={i}
              // text-base (16px) is the iOS Safari auto-zoom threshold;
              // text-sm (14px) would trigger zoom-on-focus and never
              // zoom back out.
              className="flex items-center gap-2 font-mono text-base"
            >
              <span
                aria-hidden
                className={cn(
                  "shrink-0 font-mono text-[10px] tabular text-foreground-faint",
                  "w-5 text-right",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <input
                type="text"
                value={row.name}
                onChange={(e) => {
                  if (isTrailing && e.target.value.trim() !== "") {
                    // Adding the trailing row to the persisted list -
                    // gate on the cap so the trailing input can't
                    // bypass the disabled "Add a row" button.
                    if (rows.length >= LIMITS.memberCount) return;
                    const persisted = [...rows, { name: e.target.value, amount: "" }];
                    onChange(serialize(persisted));
                  } else {
                    updateRow(i, { name: e.target.value });
                  }
                }}
                disabled={
                  disabled || (isTrailing && rows.length >= LIMITS.memberCount)
                }
                maxLength={LIMITS.memberName}
                placeholder={isTrailing ? "Add a name..." : "Name"}
                className="min-w-0 flex-1 border border-transparent bg-paper px-2 py-1.5 text-foreground placeholder:text-foreground-faint hover:border-border focus:border-foreground focus:outline-none disabled:bg-transparent"
                aria-label={`Member ${i + 1} name`}
              />
              {showAmount ? (
                <>
                  <span className="shrink-0 text-foreground-faint">RM</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(e) => handleAmountInput(i, e.target.value)}
                    disabled={disabled || isTrailing}
                    placeholder="—"
                    className="w-20 shrink-0 border border-transparent bg-paper px-2 py-1.5 text-right tabular text-foreground placeholder:text-foreground-faint hover:border-border focus:border-foreground focus:outline-none disabled:bg-transparent"
                    aria-label={`Member ${i + 1} custom amount`}
                  />
                </>
              ) : null}
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={disabled || !filled || isTrailing}
                aria-label={`Remove member ${i + 1}`}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-foreground-faint hover:text-stamp disabled:opacity-30 disabled:hover:text-foreground-faint"
              >
                <Trash2 size={12} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={addRow}
          disabled={disabled || rows.length >= LIMITS.memberCount}
          className="inline-flex items-center gap-1 self-start px-2 py-1 text-[11px] font-medium uppercase tracking-widest text-foreground-soft hover:text-foreground disabled:opacity-40"
        >
          <Plus size={12} aria-hidden />
          Add a row
        </button>
        {rows.length >= LIMITS.memberCount ? (
          <span className="text-[10px] uppercase tracking-widest text-stamp">
            Max {LIMITS.memberCount} reached
          </span>
        ) : null}
      </div>
    </div>
  );
}
