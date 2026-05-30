import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SignOutButton } from "./sign-out-button";

// h-11 on mobile meets the 44px tap-target minimum (iOS HIG / Material);
// tightens to 40px at sm+ where mouse precision is higher.
const ICON_BTN =
  "inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-[color,background-color,transform] duration-150 hover:bg-surface-deep active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/*
 * Wraps every /dashboard/* page. proxy.ts is the first line of defence;
 * this layout is the second — never trust a single gate.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use the lightweight session check (cookie-only, no network) since
  // proxy.ts already ran getUser() in middleware. Saves a ~150ms
  // round-trip to Supabase Auth on every dashboard navigation.
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");
  const user = session.user;

  // Gate first-time signups behind /dashboard/welcome until they've
  // confirmed their display name + (optional) DuitNow ID. Skip the
  // gate when we ARE on /welcome (avoids a redirect loop). pathname
  // is set by proxy-session.ts as the x-pathname request header.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!pathname.includes("/dashboard/welcome")) {
    const supabase = await createSupabaseServerClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("setup_complete")
      .eq("id", user.id)
      .single();
    if (profile && !profile.setup_complete) {
      redirect("/dashboard/welcome");
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 pt-6 pb-12 sm:px-8">
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
