import Link from "next/link";
import { redirect } from "next/navigation";

import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { next, error } = await searchParams;

  if (user) {
    redirect(next?.startsWith("/") ? next : "/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-6 pb-12 sm:px-8">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-2xl uppercase tracking-[0.18em] text-foreground"
        >
          {APP_NAME}
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 items-center justify-center pt-12">
        <ReceiptCard className="w-full p-6 sm:p-8">
          <div className="text-center">
            <div className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
              {APP_NAME} · sign in
            </div>
            <h1 className="mt-1 font-display text-3xl uppercase tracking-tight text-foreground">
              Welcome back lah
            </h1>
            <p className="mt-2 text-sm text-foreground-soft">
              Sign in with Google. New here? Same button makes your account.
            </p>
          </div>

          <ReceiptDivider />

          <LoginForm next={next} error={error} />
        </ReceiptCard>
      </div>
    </main>
  );
}
