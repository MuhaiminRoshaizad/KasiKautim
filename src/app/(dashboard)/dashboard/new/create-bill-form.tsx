"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";

import { Button, buttonClassName } from "@/components/button";
import { ReceiptCard, ReceiptDivider } from "@/components/receipt-card";
import { cn } from "@/lib/cn";
import { createBill, type CreateBillState } from "@/actions/bills";
import {
  CreateBillFormSchema,
  type CreateBillForm,
} from "@/types/schemas";

import { ReceiptScanner } from "./receipt-scanner";

const FIELD_INPUT =
  "h-12 w-full border border-border bg-surface px-3 font-sans text-base text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background";

export function CreateBillFormIsland() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateBillForm>({
    resolver: zodResolver(CreateBillFormSchema),
    defaultValues: {
      title: "",
      description: "",
      total: "",
      dueDate: "",
      membersInput: "",
      splitMode: "equal",
      items: [],
      taxCents: 0,
      discountCents: 0,
    },
  });

  const onSubmit = handleSubmit((data) => {
    setServerError(null);
    const fd = new FormData();
    fd.append("title", data.title);
    fd.append("description", data.description ?? "");
    fd.append("total", data.total ?? "");
    fd.append("dueDate", data.dueDate ?? "");
    fd.append("membersInput", data.membersInput);
    fd.append("splitMode", data.splitMode ?? "equal");
    fd.append("items", JSON.stringify(data.items ?? []));
    fd.append("taxCents", String(data.taxCents ?? 0));
    fd.append("discountCents", String(data.discountCents ?? 0));

    startTransition(async () => {
      const initial: CreateBillState = { ok: null, message: "" };
      const result = await createBill(initial, fd);
      // On success the action redirects and this code is unreachable.
      if (result?.ok === false) {
        setServerError(result.message);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            setError(field as keyof CreateBillForm, { message });
          }
        }
      }
    });
  });

  const pending = isPending || isSubmitting;

  return (
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
          New bill
        </div>
      </div>

      <h1 className="mt-4 font-display text-3xl uppercase tracking-tight text-foreground">
        Jom, create bill
      </h1>
      <p className="mt-2 text-sm text-foreground-soft">
        Fill in the basics. We mint one share link; people tap their name to pay.
      </p>

      <ReceiptDivider />

      <ReceiptScanner
        onScanned={({ title, total }) => {
          if (title) setValue("title", title, { shouldValidate: true });
          if (total) setValue("total", total, { shouldValidate: true });
        }}
      />

      <ReceiptDivider label="or fill in" />

      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field
          label="Title"
          error={errors.title?.message}
          input={
            <input
              {...register("title")}
              type="text"
              autoComplete="off"
              maxLength={100}
              placeholder="Friday lunch · Restoran Ali"
              className={FIELD_INPUT}
              disabled={pending}
            />
          }
        />

        <Field
          label="Description"
          hint="Optional — show up on the recipient page."
          error={errors.description?.message}
          input={
            <textarea
              {...register("description")}
              rows={2}
              maxLength={500}
              placeholder="Booked the back room, drinks included."
              className={cn(FIELD_INPUT, "h-auto py-3")}
              disabled={pending}
            />
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Total (RM)"
            error={errors.total?.message}
            input={
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-foreground-faint">
                  RM
                </span>
                <input
                  {...register("total")}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="120.00"
                  className={cn(FIELD_INPUT, "pl-12 font-mono tabular")}
                  disabled={pending}
                />
              </div>
            }
          />

          <Field
            label="Due date"
            hint="Optional."
            error={errors.dueDate?.message}
            input={
              <input
                {...register("dueDate")}
                type="date"
                className={FIELD_INPUT}
                disabled={pending}
              />
            }
          />
        </div>

        <Field
          label="Add the squad"
          hint='Comma- or newline-separated. Add a number to override: "Aisha 25, Faiz 30, Wani".'
          error={errors.membersInput?.message}
          input={
            <textarea
              {...register("membersInput")}
              rows={4}
              placeholder={"Aisha\nFaiz\nWani 30\nHafiz"}
              className={cn(FIELD_INPUT, "h-auto py-3 font-mono text-sm")}
              disabled={pending}
            />
          }
        />

        {serverError && !Object.keys(errors).length ? (
          <p role="alert" className="text-sm text-stamp">
            {serverError}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse">
          <Button
            type="submit"
            disabled={pending}
            size="lg"
            className="font-display uppercase tracking-widest sm:flex-1"
          >
            {pending ? "Creating..." : "Jom, create bill"}
          </Button>
          <Link
            href="/dashboard"
            aria-disabled={pending}
            className={buttonClassName({
              variant: "ghost",
              size: "lg",
              className: "sm:flex-1",
            })}
          >
            Cancel
          </Link>
        </div>
      </form>
    </ReceiptCard>
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
          <span className="text-[11px] text-foreground-faint">{hint}</span>
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
