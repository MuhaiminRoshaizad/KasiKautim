"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";
import { LIMITS } from "@/lib/constants";
import {
  centsToDigits,
  digitsToCents,
  digitsToDisplay,
  sanitizeDigits,
} from "@/lib/currency-input-format";

interface CurrencyInputProps {
  /** Value in integer cents. 0 renders as empty input (placeholder shows). */
  value: number;
  /** Fires with the new cent value on every keystroke. */
  onChange: (cents: number) => void;
  /** Optional form-field name. When set, a hidden input mirrors the
   *  dotted decimal string so server actions consuming FormData with
   *  `toCents()` keep working unchanged. */
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Cap at this many cents. Default = LIMITS.totalAmountCents. */
  maxCents?: number;
  className?: string;
  "aria-label"?: string;
  id?: string;
  style?: CSSProperties;
  /** Text alignment of the input. Default right (matches receipt style). */
  align?: "left" | "right";
}

/*
 * Shift-from-right currency input (CIMB / Maybank / TNG pattern):
 * user types digits only; the decimal floats two positions from the
 * right. Internally stores integer cents to match the rest of the
 * app's money model in src/lib/money.ts.
 *
 *   Type "5"     → renders "0.05"
 *   Type "320"   → renders "3.20"
 *   Type "32000" → renders "320.00"
 *   Backspace    → digits pop from the right; display shifts right
 *
 * Pure logic lives in src/lib/currency-input-format.ts (unit-tested);
 * this component is the React shell + caret + paste handling.
 */
export function CurrencyInput({
  value,
  onChange,
  name,
  placeholder = "0.00",
  disabled = false,
  maxCents = LIMITS.totalAmountCents,
  className,
  id,
  style,
  align = "right",
  ...rest
}: CurrencyInputProps) {
  // Internal digit-string state mirrors the cents value so the parent
  // remains source-of-truth; sync on every value-from-outside change.
  const [digits, setDigits] = useState(() => centsToDigits(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync if the parent's value changes externally (e.g. scanner
  // populates the total field). Avoid the loop by comparing cents.
  // The new react-hooks/set-state-in-effect rule flags this, but
  // there's no clean alternative: the parent is the source of truth
  // for prefill, and useSyncExternalStore can't subscribe to a prop.
  useEffect(() => {
    const internalCents = digitsToCents(digits);
    if (internalCents !== value) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDigits(centsToDigits(value));
    }
  }, [value, digits]);

  const display = digitsToDisplay(digits);

  const setFromRaw = (raw: string) => {
    const next = sanitizeDigits(raw, maxCents);
    setDigits(next);
    onChange(digitsToCents(next));
  };

  // Keep caret at end so the user always types from the right edge -
  // matches the CIMB/Maybank behaviour. Without this, focusing mid-
  // string would let the user type into the middle, breaking the
  // shift-from-right illusion.
  const moveCaretToEnd = () => {
    const el = inputRef.current;
    if (!el) return;
    const len = el.value.length;
    el.setSelectionRange(len, len);
  };

  const ariaLabel = rest["aria-label"];

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        // `pattern` is iOS Safari's hint to show the decimal keyboard
        // even when a real keyboard's attached.
        pattern="[0-9]*"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => setFromRaw(e.target.value)}
        onFocus={moveCaretToEnd}
        onClick={moveCaretToEnd}
        onKeyUp={moveCaretToEnd}
        className={cn(
          align === "right" && "text-right tabular",
          className,
        )}
        style={style}
      />
      {name ? (
        // Hidden mirror that emits the dotted form so server actions
        // (createBill etc.) consuming FormData with toCents() keep
        // working unchanged — no schema changes required.
        <input type="hidden" name={name} value={display} />
      ) : null}
    </>
  );
}
