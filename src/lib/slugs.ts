import { customAlphabet } from "nanoid";

import {
  MEMBER_TOKEN_LENGTH,
  SLUG_LENGTH,
  SLUG_RETRY_ATTEMPTS,
} from "./constants";

const SLUG_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const TOKEN_ALPHABET =
  "0123456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz";

const slugGenerator = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH);
const tokenGenerator = customAlphabet(TOKEN_ALPHABET, MEMBER_TOKEN_LENGTH);

export function newSlug(): string {
  return slugGenerator();
}

export function newMemberToken(): string {
  return tokenGenerator();
}

/**
 * Try `insert(slug)` up to SLUG_RETRY_ATTEMPTS times with a fresh slug each attempt.
 * Callers must throw `SlugCollisionError` from inside `insert` when the underlying
 * UNIQUE constraint trips so the helper knows to retry instead of bubbling.
 */
export class SlugCollisionError extends Error {
  constructor(message = "slug collision") {
    super(message);
    this.name = "SlugCollisionError";
  }
}

export async function withSlugRetry<T>(
  insert: (slug: string) => Promise<T>,
  attempts: number = SLUG_RETRY_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await insert(newSlug());
    } catch (err) {
      if (!(err instanceof SlugCollisionError)) throw err;
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new SlugCollisionError("slug collision retries exhausted");
}
