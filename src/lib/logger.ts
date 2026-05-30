/*
 * Dev/prod-aware logger with naive PII redaction.
 * Use this everywhere instead of console.* — the only file allowed to call
 * console.* directly. ESLint no-console rule lands in a later commit and will
 * have an inline exception here.
 */

const REDACT_KEYS = new Set([
  "email",
  "phone",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "session",
  "user",
  "user_id",
  "userId",
  "member_token",
  "memberToken",
  "duitnow_id",
  "duitnowId",
  "service_role_key",
  "anon_key",
  "api_key",
  "apiKey",
  // Payment audit fields — currently not logged anywhere, but
  // conservative inclusion keeps a future logger.error({ row }) from
  // accidentally leaking method / note / proof path to server logs.
  "payment_method",
  "paymentMethod",
  "payment_note",
  "paymentNote",
  "payment_proof_url",
  "paymentProofUrl",
  "proof_url",
  "proofUrl",
]);

const IS_DEV = process.env.NODE_ENV !== "production";

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[max-depth]";
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

function emit(level: "debug" | "info" | "warn" | "error", args: unknown[]) {
  if (!IS_DEV && level === "debug") return;
  const safe = args.map((a) => redact(a));
  console[level](...safe);
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
