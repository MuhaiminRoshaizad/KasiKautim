import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SignOutButton } from "./sign-out-button";

const ICON_BTN =
  "inline-flex h-10 w-10 items-center justify-center border border-border bg-surface text-foreground transition-colors hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/*
 * Wraps every /dashboard/* page. proxy.ts is the first line of defence;
 * this layout is the second — never trust a single gate.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pt-6 pb-12 sm:px-8">
      <header className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="font-display text-2xl uppercase tracking-[0.18em] text-foreground"
        >
          {APP_NAME}
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/settings"
            aria-label="Settings"
            title="Settings"
            className={ICON_BTN}
          >
            <Settings size={18} aria-hidden />
          </Link>
          <ThemeToggle />
          <SignOutButton iconButtonClassName={ICON_BTN} />
        </div>
      </header>

      <main className="flex-1 pt-10">{children}</main>
    </div>
  );
}
