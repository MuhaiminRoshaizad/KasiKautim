import { LIMITS } from "./constants";
import { toCents } from "./money";
import type { ParsedMember } from "@/types/schemas";

/*
 * Parses the freeform "Add the squad" textarea into ParsedMember[].
 *
 * Accepts comma- or newline-separated entries, each:
 *   name                  -> { name, amountCents: null }   (use equal split)
 *   name <amount>         -> { name, amountCents: toCents(amount) }
 *   first last <amount>   -> { name: "first last", amountCents: toCents(amount) }
 *
 * Amount must be the LAST whitespace-separated token and match /^\d+(\.\d{1,2})?$/.
 * Anything else is treated as part of the name.
 */
export function parseMembers(input: string): ParsedMember[] {
  if (!input) return [];

  const out: ParsedMember[] = [];
  const seen = new Set<string>();

  for (const rawChunk of input.split(/[\n,]/)) {
    const chunk = rawChunk.trim();
    if (chunk === "") continue;

    const tokens = chunk.split(/\s+/);
    const last = tokens[tokens.length - 1];
    const isAmount = /^\d+(\.\d{1,2})?$/.test(last);

    let name: string;
    let amountCents: number | null;

    if (isAmount && tokens.length > 1) {
      name = tokens.slice(0, -1).join(" ").trim();
      amountCents = toCents(last);
    } else {
      name = chunk;
      amountCents = null;
    }

    if (name === "") continue;
    if (name.length > LIMITS.memberName) {
      name = name.slice(0, LIMITS.memberName);
    }

    const dedupeKey = name.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    out.push({ name, amountCents });
    if (out.length >= LIMITS.memberCount) break;
  }

  return out;
}
