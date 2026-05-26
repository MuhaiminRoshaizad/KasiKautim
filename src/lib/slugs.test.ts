import { describe, expect, it, vi } from "vitest";

import {
  newMemberToken,
  newSlug,
  SlugCollisionError,
  withSlugRetry,
} from "./slugs";

describe("newSlug", () => {
  it("returns a string of the configured length", () => {
    const slug = newSlug();
    expect(slug).toHaveLength(8);
    expect(slug).toMatch(/^[0-9a-z]+$/);
  });

  it("produces distinct slugs across calls", () => {
    const set = new Set(Array.from({ length: 50 }, () => newSlug()));
    expect(set.size).toBe(50);
  });
});

describe("newMemberToken", () => {
  it("returns a high-entropy token", () => {
    const token = newMemberToken();
    expect(token).toHaveLength(16);
    expect(token).toMatch(/^[0-9A-Za-z]+$/);
  });
});

describe("withSlugRetry", () => {
  it("returns the first successful insert", async () => {
    const insert = vi.fn(async (slug: string) => `inserted:${slug}`);
    const result = await withSlugRetry(insert);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(result).toMatch(/^inserted:/);
  });

  it("retries on SlugCollisionError up to N attempts", async () => {
    let calls = 0;
    const insert = vi.fn(async (slug: string) => {
      calls++;
      if (calls < 3) throw new SlugCollisionError();
      return slug;
    });
    const result = await withSlugRetry(insert, 3);
    expect(insert).toHaveBeenCalledTimes(3);
    expect(result).toBeTypeOf("string");
  });

  it("re-throws non-collision errors immediately", async () => {
    const insert = vi.fn(async () => {
      throw new Error("network is sad");
    });
    await expect(withSlugRetry(insert)).rejects.toThrow("network is sad");
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("throws SlugCollisionError after exhausting retries", async () => {
    const insert = vi.fn(async () => {
      throw new SlugCollisionError();
    });
    await expect(withSlugRetry(insert, 3)).rejects.toBeInstanceOf(
      SlugCollisionError,
    );
    expect(insert).toHaveBeenCalledTimes(3);
  });
});
