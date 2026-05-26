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
import type { BillMemberInsert } from "@/types/db";

export interface CreateBillState {
  ok: boolean | null;
  message: string;
  fieldErrors?: Partial<Record<"title" | "description" | "total" | "dueDate" | "membersInput", string>>;
}

const PG_UNIQUE_VIOLATION = "23505";

export async function createBill(
  _prev: CreateBillState,
  formData: FormData,
): Promise<CreateBillState> {
  const parsed = CreateBillActionSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    total: formData.get("total"),
    dueDate: formData.get("dueDate") ?? "",
    membersInput: formData.get("membersInput"),
  });

  if (!parsed.success) {
    const fieldErrors: CreateBillState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<CreateBillState["fieldErrors"]>;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Fix the highlighted fields.", fieldErrors };
  }

  const { title, description, total, dueDate, membersInput } = parsed.data;

  let totalCents: number;
  try {
    totalCents = toCents(total);
  } catch {
    return {
      ok: false,
      message: "Total amount is invalid.",
      fieldErrors: { total: "Use a number like 12.34." },
    };
  }

  const members = parseMembers(membersInput);
  if (members.length === 0) {
    return {
      ok: false,
      message: "Add at least one person.",
      fieldErrors: { membersInput: "Add at least one person." },
    };
  }

  // Distribute amounts: specified amounts take precedence; remainder splits
  // equally across the unspecified members. If specified already covers the
  // total, no nulls allowed (would mean RM 0 share — confusing).
  const specifiedSum = sumCents(
    members.map((m) => m.amountCents ?? 0),
  );
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

  let assignedAmounts: number[];
  if (nullCount === 0) {
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
    const split = splitEqually(remaining, nullCount);
    let cursor = 0;
    assignedAmounts = members.map((m) =>
      m.amountCents != null ? m.amountCents : split[cursor++]!,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You're not signed in." };
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
        })
        .select("id, slug")
        .single();

      if (error) {
        if (error.code === PG_UNIQUE_VIOLATION) throw new SlugCollisionError();
        throw error;
      }
      return data;
    }).then((b) => {
      // b is { id, slug } from inside the helper above
      return insertMembersOrCleanup(b.id, b.slug);
    });
  } catch (err) {
    logger.error("createBill failed", { err: err instanceof Error ? err.message : "unknown" });
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
      // Roll back: delete the just-created bill (organizer-scoped via RLS).
      await supabase.from("bills").delete().eq("id", billId);
      throw error;
    }
    return billSlug;
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/${slug}`);
}
