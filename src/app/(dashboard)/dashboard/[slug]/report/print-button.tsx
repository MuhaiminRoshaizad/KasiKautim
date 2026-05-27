"use client";

import { Printer } from "lucide-react";

import { buttonClassName } from "@/components/button";
import { cn } from "@/lib/cn";

/**
 * Trigger window.print(); kept as a tiny client island so the rest of the
 * report page can stay a Server Component.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        buttonClassName({ variant: "secondary", size: "sm" }),
        "!h-9",
      )}
    >
      <Printer size={14} aria-hidden />
      Print / save PDF
    </button>
  );
}
