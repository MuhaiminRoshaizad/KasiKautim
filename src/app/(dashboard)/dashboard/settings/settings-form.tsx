"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/button";
import { cn } from "@/lib/cn";
import {
  updateProfile,
  type ProfileUpdateState,
} from "@/actions/profile";
import {
  ProfileUpdateSchema,
  type ProfileUpdateForm,
} from "@/types/schemas";

const FIELD =
  "h-12 w-full border border-border bg-surface px-3 font-sans text-base text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background";

const INITIAL: ProfileUpdateState = { ok: null, message: "" };

interface SettingsFormProps {
  initialDisplayName: string;
  initialDuitnowId: string;
  email: string;
}

export function SettingsForm({
  initialDisplayName,
  initialDuitnowId,
  email,
}: SettingsFormProps) {
  const [serverState, setServerState] = useState<ProfileUpdateState>(INITIAL);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileUpdateForm>({
    resolver: zodResolver(ProfileUpdateSchema),
    defaultValues: {
      displayName: initialDisplayName,
      duitnowId: initialDuitnowId,
    },
  });

  const onSubmit = handleSubmit((data) => {
    setServerState(INITIAL);
    const fd = new FormData();
    fd.append("displayName", data.displayName ?? "");
    fd.append("duitnowId", data.duitnowId ?? "");

    startTransition(async () => {
      const result = await updateProfile(INITIAL, fd);
      setServerState(result);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof ProfileUpdateForm, { message });
        }
      }
    });
  });

  const pending = isPending || isSubmitting;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field
        label="Email"
        hint="Used for signin. Not editable here."
        input={
          <input
            type="email"
            value={email}
            disabled
            className={cn(FIELD, "cursor-not-allowed opacity-60")}
          />
        }
      />

      <Field
        label="Display name"
        hint="Shows up on bills you create."
        error={errors.displayName?.message}
        input={
          <input
            {...register("displayName")}
            type="text"
            autoComplete="name"
            placeholder="Your name"
            className={FIELD}
            disabled={pending}
          />
        }
      />

      <Field
        label="DuitNow ID"
        hint="Mobile, NRIC, passport, business reg, army/police. Whatever you registered with your bank."
        error={errors.duitnowId?.message}
        input={
          <input
            {...register("duitnowId")}
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder="+60123456789"
            className={cn(FIELD, "font-mono")}
            disabled={pending}
          />
        }
      />

      {serverState.ok === true ? (
        <p role="status" className="text-sm text-ringgit">
          {serverState.message}
        </p>
      ) : null}
      {serverState.ok === false && !Object.keys(errors).length ? (
        <p role="alert" className="text-sm text-stamp">
          {serverState.message}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        size="lg"
        className="font-display uppercase tracking-widest"
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  input,
}: {
  label: string;
  hint?: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-foreground-soft">
          {label}
        </span>
        {hint ? (
          <span className="text-right text-[11px] text-foreground-faint">
            {hint}
          </span>
        ) : null}
      </span>
      {input}
      {error ? (
        <span role="alert" className="text-xs text-stamp">
          {error}
        </span>
      ) : null}
    </label>
  );
}
