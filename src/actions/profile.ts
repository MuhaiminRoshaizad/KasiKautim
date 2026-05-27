"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileUpdateSchema } from "@/types/schemas";

export interface ProfileUpdateState {
  ok: boolean | null;
  message: string;
  fieldErrors?: Partial<Record<"displayName" | "duitnowId", string>>;
}

export async function updateProfile(
  _prev: ProfileUpdateState,
  formData: FormData,
): Promise<ProfileUpdateState> {
  const parsed = ProfileUpdateSchema.safeParse({
    displayName: formData.get("displayName") ?? "",
    duitnowId: formData.get("duitnowId") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: ProfileUpdateState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<ProfileUpdateState["fieldErrors"]>;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You're not signed in." };
  }

  // Empty string → null in DB so the field reads as unset on /b/[slug].
  const displayName = parsed.data.displayName?.trim() || null;
  const duitnowId = parsed.data.duitnowId?.trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, duitnow_id: duitnowId })
    .eq("id", user.id);

  if (error) {
    logger.error("profile update failed", {
      code: error.code,
      message: error.message,
    });
    return { ok: false, message: "Couldn't save. Try again in a sec." };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: "Saved." };
}

/*
 * Welcome-flow save: same as updateProfile but also flips setup_complete
 * so the user skips /dashboard/welcome on subsequent sign-ins. Validation
 * is stricter — display_name and duitnow_id are both required (the whole
 * point of the gate). On success, redirects to /dashboard.
 */
export async function completeOnboarding(
  _prev: ProfileUpdateState,
  formData: FormData,
): Promise<ProfileUpdateState> {
  const parsed = ProfileUpdateSchema.safeParse({
    displayName: formData.get("displayName") ?? "",
    duitnowId: formData.get("duitnowId") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: ProfileUpdateState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<ProfileUpdateState["fieldErrors"]>;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Fix the highlighted fields.", fieldErrors };
  }

  const displayName = parsed.data.displayName?.trim();
  if (!displayName) {
    return {
      ok: false,
      message: "We need a display name so recipients know who's billing them.",
      fieldErrors: { displayName: "Required." },
    };
  }
  const duitnowId = parsed.data.duitnowId?.trim() || null;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You're not signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      duitnow_id: duitnowId,
      setup_complete: true,
    })
    .eq("id", user.id);

  if (error) {
    logger.error("onboarding save failed", {
      code: error.code,
      message: error.message,
    });
    return { ok: false, message: "Couldn't save. Try again in a sec." };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
