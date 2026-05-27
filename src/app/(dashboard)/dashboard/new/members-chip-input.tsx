"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";

interface MembersChipInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Only used to color the border red; the message itself is rendered by the parent Field. */
  invalid?: boolean;
}

const SEPARATORS = /[,\n]+/;
const AMOUNT_TAIL = /^(.+?)\s+(\d+(?:\.\d{1,2})?)$/;

/*
 * Industry-standard chip input for adding the squad. Mirrors the pattern
 * used by Gmail recipients / Slack channel members / iOS Contacts: type a
 * name, press Enter or comma to commit it as a chip, tap the × to remove.
 * Backspace on empty input pops the last chip (Gmail behavior). Pasting
 * "Aisha, Faiz, Wani" auto-splits into three chips.
 *
 * Source of truth is the joined string in the form's `membersInput`
 * field — same shape the parseMembers parser expects. We never invent a
 * new format; chips are derived from the string on every render so the
 * field and the visual stay in sync without a separate state branch.
 *
 * Amount-override syntax ("Wani 30") still works: the chip splits visually
 * into "Wani · RM 30" so the override is visible at a glance.
 */
export function MembersChipInput({
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
}: MembersChipInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const chips = value
    .split(SEPARATORS)
    .map((s) => s.trim())
    .filter(Boolean);

  const commit = (raw: string) => {
    if (!raw.trim()) return;
    const parsed = raw
      .split(SEPARATORS)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length === 0) return;
    // Dedupe by name (case-insensitive); keep first occurrence.
    const seen = new Set(chips.map((c) => extractName(c).toLowerCase()));
    const fresh = parsed.filter((c) => {
      const key = extractName(c).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length === 0) return;
    onChange([...chips, ...fresh].join(", "));
    setDraft("");
  };

  const removeAt = (idx: number) => {
    const next = chips.filter((_, i) => i !== idx);
    onChange(next.join(", "));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && chips.length > 0) {
      e.preventDefault();
      removeAt(chips.length - 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (SEPARATORS.test(text)) {
      e.preventDefault();
      commit(text);
    }
  };

  const onBlur = () => {
    if (draft.trim()) commit(draft);
  };

  return (
    <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-12 w-full cursor-text flex-wrap items-center gap-1.5 border bg-surface p-2",
          "focus-within:ring-2 focus-within:ring-foreground focus-within:ring-offset-2 focus-within:ring-offset-background",
          invalid ? "border-stamp" : "border-border",
        )}
      >
        {chips.map((chip, i) => {
          const match = chip.match(AMOUNT_TAIL);
          const label = match ? match[1] : chip;
          const amount = match ? match[2] : null;
          return (
            <span
              key={`${chip}-${i}`}
              className="inline-flex items-center gap-1.5 border border-border bg-paper px-2 py-1 font-mono text-sm text-foreground"
            >
              <span className="truncate max-w-40">{label}</span>
              {amount ? (
                <>
                  <span aria-hidden className="text-foreground-faint">·</span>
                  <span className="tabular text-foreground-soft">
                    RM {amount}
                  </span>
                </>
              ) : null}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(i);
                }}
                disabled={disabled}
                aria-label={`Remove ${label}`}
                className="inline-flex h-6 w-6 -mr-1 items-center justify-center text-foreground-faint hover:text-stamp focus-visible:outline-none focus-visible:text-stamp"
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={onBlur}
          placeholder={chips.length === 0 ? placeholder : "Add another"}
          disabled={disabled}
          aria-label="Add a member"
          className="min-w-32 flex-1 border-none bg-transparent font-mono text-sm text-foreground placeholder:text-foreground-faint focus:outline-none"
        />
    </div>
  );
}

function extractName(chunk: string): string {
  const match = chunk.match(AMOUNT_TAIL);
  return match ? match[1] : chunk;
}
