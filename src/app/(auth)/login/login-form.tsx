"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, Mail } from "lucide-react";

import { Button } from "@/components/button";
import { signInWithMagicLink, type AuthFormState } from "@/actions/auth";

const INITIAL: AuthFormState = { ok: null, message: "" };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    signInWithMagicLink,
    INITIAL,
  );

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 size={32} className="text-ringgit" aria-hidden />
        <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
          Check your inbox
        </h2>
        <p className="max-w-xs text-sm text-foreground-soft">{state.message}</p>
        <p className="text-xs text-foreground-faint">
          Wrong email?{" "}
          <Link href="/login" className="underline hover:text-foreground">
            Try again
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-foreground-soft">
          Email
        </span>
        <div className="relative">
          <Mail
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-faint"
          />
          <input
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            required
            disabled={pending}
            placeholder="you@example.com"
            className="h-12 w-full border border-border bg-surface pl-9 pr-3 font-sans text-base text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background"
          />
        </div>
      </label>

      {state.ok === false && state.message ? (
        <p role="alert" className="text-sm text-stamp">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} size="lg" className="font-display uppercase tracking-widest">
        {pending ? "Sending..." : "Send magic link"}
      </Button>

      <p className="text-center text-xs text-foreground-faint">
        We&apos;ll email you a one-tap signin link. No password needed.
      </p>
    </form>
  );
}
