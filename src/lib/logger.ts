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
  // Google profile identifiers - low-risk on their own but combined
  // with bill content could correlate to real identity in logs.
  "display_name",
  "displayName",
  "full_name",
  "fullName",
  "avatar_url",
  "avatarUrl",
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

  // Structured (JSON) output in production so Vercel Observability /
  // Datadog / Sentry can filter by level / message / op. Dev keeps
  // human-readable console output so terminal logs stay scannable.
  if (IS_DEV) {
    console[level](...safe);
    return;
  }

  // Convention: first arg = message string, second arg = context
  // object. Anything else gets stuffed into an `extra` array.
  const [first, ...rest] = safe;
  const message = typeof first === "string" ? first : String(first ?? "");
  const context =
    rest.length === 1 &&
    typeof rest[0] === "object" &&
    rest[0] !== null &&
    !Array.isArray(rest[0])
      ? (rest[0] as Record<string, unknown>)
      : rest.length > 0
        ? { extra: rest }
        : {};

  const record = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...context,
  };
  console[level](JSON.stringify(record));
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
