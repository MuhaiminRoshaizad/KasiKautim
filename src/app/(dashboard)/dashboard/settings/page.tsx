import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonClassName } from "@/components/button";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { cn } from "@/lib/cn";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout has already guarded; defensive null-check keeps TS happy.
  const email = user?.email ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, duitnow_id")
    .eq("id", user?.id ?? "")
    .single();

  return (
    <div className="mx-auto max-w-xl">
      <ReceiptCard className="p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className={cn(
              buttonClassName({ variant: "ghost", size: "sm" }),
              "!h-9 !px-2 text-foreground-soft",
            )}
          >
            <ArrowLeft size={16} aria-hidden />
            Back
          </Link>
          <div className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
            Settings
          </div>
        </div>

        <h1 className="mt-4 font-display text-3xl uppercase tracking-tight text-foreground">
          Your profile
        </h1>
        <p className="mt-2 text-sm text-foreground-soft">
          Add a DuitNow ID so recipients can copy it straight to their banking
          app.
        </p>

        <ReceiptDivider />

        <SettingsForm
          email={email}
          initialDisplayName={profile?.display_name ?? ""}
          initialDuitnowId={profile?.duitnow_id ?? ""}
        />
      </ReceiptCard>
    </div>
  );
}
