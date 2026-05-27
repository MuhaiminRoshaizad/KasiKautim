import { redirect } from "next/navigation";

import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { APP_NAME } from "@/lib/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { WelcomeForm } from "./welcome-form";

export const metadata = { title: "Welcome" };

/*
 * One-time onboarding gate. Hit only when profile.setup_complete is
 * false — the dashboard layout enforces the redirect. If a returning
 * user lands here directly via URL, we send them back to /dashboard
 * since they've already finished setup.
 */
export default async function WelcomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/welcome");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, duitnow_id, setup_complete")
    .eq("id", user.id)
    .single();

  if (profile?.setup_complete) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-xl">
      <ReceiptCard className="p-6 sm:p-8">
        <div className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
          {APP_NAME} · Welcome
        </div>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-tight text-foreground">
          Set up your profile lah
        </h1>
        <p className="mt-2 text-sm text-foreground-soft">
          We&apos;ll show your name on every bill you create, and the DuitNow
          ID lets your friends pay you back with one tap.
        </p>

        <ReceiptDivider />

        <WelcomeForm
          initialDisplayName={profile?.display_name ?? ""}
          initialDuitnowId={profile?.duitnow_id ?? ""}
        />
      </ReceiptCard>
    </div>
  );
}
