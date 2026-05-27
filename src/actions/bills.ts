"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { parseMembers } from "@/lib/members-parser";
import { splitEqually, sumCents, toCents } from "@/lib/money";
import {
  SlugCollisionError,
  newMemberToken,
  withSlugRetry,
} from "@/lib/slugs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateBillActionSchema } from "@/types/schemas";
import type { BillItemInput } from "@/types/schemas";
import type { BillMemberInsert } from "@/types/db";

export interface CreateBillState {
  ok: boolean | null;
  message: string;
  fieldErrors?: Partial<
    Record<
      "title" | "description" | "total" | "dueDate" | "membersInput" | "items",
      string
    >
  >;
}

const PG_UNIQUE_VIOLATION = "23505";

export async function createBill(
  _prev: CreateBillState,
  formData: FormData,
): Promise<CreateBillState> {
  // Items + numeric fields arrive as JSON-encoded strings to round-trip via FormData.
  const rawItems = formData.get("items");
  let parsedItems: BillItemInput[] = [];
  if (typeof rawItems === "string" && rawItems.length > 0) {
    try {
      parsedItems = JSON.parse(rawItems) as BillItemInput[];
    } catch {
      return {
        ok: false,
        message: "Items payload couldn't be parsed.",
        fieldErrors: { items: "Internal error — re-scan and try again." },
      };
    }
  }

  // Organizer-claimed item IDs arrive as a JSON array (FormData round-trip).
  const rawMyClaims = formData.get("myClaimedItemIds");
  let parsedMyClaims: string[] = [];
  if (typeof rawMyClaims === "string" && rawMyClaims.length > 0) {
    try {
      parsedMyClaims = JSON.parse(rawMyClaims) as string[];
    } catch {
      return {
        ok: false,
        message: "Couldn't read your claimed items. Refresh and try again.",
      };
    }
  }

  const parsed = CreateBillActionSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    total: formData.get("total") ?? "",
    dueDate: formData.get("dueDate") ?? "",
    membersInput: formData.get("membersInput"),
    splitMode: formData.get("splitMode") ?? "equal",
    items: parsedItems,
    taxCents: Number(formData.get("taxCents") ?? "0"),
    discountCents: Number(formData.get("discountCents") ?? "0"),
    includeMyself: formData.get("includeMyself") === "true",
    myClaimedItemIds: parsedMyClaims,
  });

  if (!parsed.success) {
    const fieldErrors: CreateBillState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<CreateBillState["fieldErrors"]>;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Fix the highlighted fields.", fieldErrors };
  }

  const {
    title,
    description,
    total,
    dueDate,
    membersInput,
    splitMode,
    items,
    taxCents,
    discountCents,
    includeMyself,
    myClaimedItemIds,
  } = parsed.data;

  // ----- Member names parsing -----

  const members = parseMembers(membersInput);
  if (members.length === 0) {
    return {
      ok: false,
      message: "Add at least one person.",
      fieldErrors: { membersInput: "Add at least one person." },
    };
  }

  // ----- Total + per-member amount computation -----

  let totalCents: number;
  let assignedAmounts: number[];
  // Organizer's auto-paid share, computed alongside the per-member splits
  // below. Item-mode computes from claimed items + proportional tax share;
  // equal-mode treats organizer as one extra null-amount participant and
  // gives them the remainder-absorbing slot from splitEqually.
  let organizerShareCents = 0;

  if (splitMode === "item") {
    // Item-mode: total = sum(items) + tax - discount.
    // Per-member amounts start at 0 and recompute as claims arrive.
    const itemsSum = items.reduce((acc, it) => acc + it.price_cents, 0);
    totalCents = itemsSum + taxCents - discountCents;
    if (totalCents < 0) {
      return {
        ok: false,
        message: "Discount can't exceed items + tax.",
        fieldErrors: { items: "Discount > items + tax." },
      };
    }
    assignedAmounts = members.map(() => 0);

    if (includeMyself) {
      const myClaims = new Set(myClaimedItemIds);
      const mySubtotal = items
        .filter((it) => myClaims.has(it.id))
        .reduce((a, it) => a + it.price_cents, 0);
      const netCharge = taxCents - discountCents;
      const myTaxShare =
        itemsSum > 0 ? Math.floor((mySubtotal * netCharge) / itemsSum) : 0;
      organizerShareCents = mySubtotal + myTaxShare;
    }
  } else {
    // Equal-mode: existing flow — total required, distribute across members.
    try {
      totalCents = toCents(total ?? "");
    } catch {
      return {
        ok: false,
        message: "Total amount is invalid.",
        fieldErrors: { total: "Use a number like 12.34." },
      };
    }
    const specifiedSum = sumCents(members.map((m) => m.amountCents ?? 0));
    const nullCount = members.filter((m) => m.amountCents == null).length;

    if (specifiedSum > totalCents) {
      return {
        ok: false,
        message: "Your custom amounts already exceed the total.",
        fieldErrors: {
          membersInput: `Custom amounts sum to more than RM ${(totalCents / 100).toFixed(2)}.`,
        },
      };
    }

    // When includeMyself is on, the organizer is treated as one extra
    // null-amount participant. splitEqually puts the remainder on the
    // last slot — we map it to the organizer so they absorb the sen,
    // not a friend (the organizer has the most context for the rounding).
    const totalNullCount = nullCount + (includeMyself ? 1 : 0);

    if (totalNullCount === 0) {
      if (specifiedSum !== totalCents) {
        return {
          ok: false,
          message: "Custom amounts must sum to the total.",
          fieldErrors: {
            membersInput: `Sum of custom amounts (RM ${(specifiedSum / 100).toFixed(2)}) doesn't match the total.`,
          },
        };
      }
      assignedAmounts = members.map((m) => m.amountCents as number);
    } else {
      const remaining = totalCents - specifiedSum;
      const split = splitEqually(remaining, totalNullCount);
      let cursor = 0;
      assignedAmounts = members.map((m) =>
        m.amountCents != null ? m.amountCents : split[cursor++]!,
      );
      if (includeMyself) {
        // Last slot in split[] is the organizer's — splitEqually puts the
        // rounding remainder on the last entry, so they absorb the sen.
        organizerShareCents = split[cursor]!;
      }
    }
  }

  // ----- Insert -----

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You're not signed in." };
  }

  // Need the organizer's display_name when includeMyself is on, so we
  // can show "You · paid" on the bill detail. Onboarding gate guarantees
  // setup_complete=true users have a display_name; fall back to email
  // local part defensively if anything's off.
  let organizerDisplayName = "";
  if (includeMyself) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    organizerDisplayName =
      profile?.display_name?.trim() ||
      user.email?.split("@")[0] ||
      "You";
  }

  let slug: string;
  try {
    slug = await withSlugRetry(async (candidate) => {
      const { data, error } = await supabase
        .from("bills")
        .insert({
          slug: candidate,
          organizer_id: user.id,
          title,
          description: description?.trim() ? description.trim() : null,
          total_cents: totalCents,
          currency: "MYR",
          due_date: dueDate || null,
          split_mode: splitMode,
          items: splitMode === "item" ? items : [],
          tax_cents: splitMode === "item" ? taxCents : 0,
          discount_cents: splitMode === "item" ? discountCents : 0,
        })
        .select("id, slug")
        .single();

      if (error) {
        if (error.code === PG_UNIQUE_VIOLATION) throw new SlugCollisionError();
        throw error;
      }
      return data;
    }).then((b) => insertMembersOrCleanup(b.id, b.slug));
  } catch (err) {
    logger.error("createBill failed", {
      err: err instanceof Error ? err.message : "unknown",
    });
    return {
      ok: false,
      message: "Couldn't create the bill. Try again in a sec.",
    };
  }

  async function insertMembersOrCleanup(billId: string, billSlug: string) {
    const rows: BillMemberInsert[] = members.map((m, i) => ({
      bill_id: billId,
      name: m.name,
      amount_owed_cents: assignedAmounts[i]!,
      member_token: newMemberToken(),
    }));

    const { error } = await supabase.from("bill_members").insert(rows);
    if (error) {
      await supabase.from("bills").delete().eq("id", billId);
      throw error;
    }

    // Organizer-as-diner: insert a paid, is_organizer member row using
    // the share computed up-front. claimed_item_ids drives display in
    // item-mode (so others see "Shared with: Aisha" badges); the
    // _recompute_item_shares trigger will skip this row going forward
    // since paid=true, so the snapshotted paid_amount_cents stays put.
    if (includeMyself) {
      const { error: orgError } = await supabase
        .from("bill_members")
        .insert({
          bill_id: billId,
          name: organizerDisplayName,
          amount_owed_cents: organizerShareCents,
          member_token: newMemberToken(),
          is_organizer: true,
          paid: true,
          paid_at: new Date().toISOString(),
          paid_amount_cents: organizerShareCents,
          payment_method: "cash",
          claimed_item_ids: splitMode === "item" ? myClaimedItemIds : [],
        });
      if (orgError) {
        // Roll back the bill so we never leave a partial "no organizer"
        // bill when the checkbox said otherwise. Members cascade-delete.
        await supabase.from("bills").delete().eq("id", billId);
        throw orgError;
      }
    }

    return billSlug;
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/${slug}`);
}

/*
 * Tukang bayar deletes their own bill. Cascades to bill_members and
 * payment_events via the ON DELETE CASCADE in 0001_init.sql; payment
 * proof images in Storage are NOT auto-cleaned (documented in
 * README "Known limitations"). RLS scopes DELETE to the bill's
 * organizer_id; an attempt against someone else's bill silently
 * affects 0 rows and we fall through to the redirect.
 */
export async function deleteBill(formData: FormData): Promise<void> {
  const slug = formData.get("slug");
  if (typeof slug !== "string" || slug.length < 4 || slug.length > 32) {
    logger.warn("deleteBill called with invalid slug");
    redirect("/dashboard");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("bills").delete().eq("slug", slug);
  if (error) {
    logger.error("deleteBill failed", { code: error.code, message: error.message });
    redirect(`/dashboard/${slug}?error=delete_failed`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
