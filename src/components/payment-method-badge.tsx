import { Banknote, CreditCard, QrCode, Smartphone, Wallet } from "lucide-react";

import { cn } from "@/lib/cn";
import type { PaymentMethodDb } from "@/types/db";

const META: Record<
  PaymentMethodDb,
  { label: string; Icon: typeof Banknote; tone: "neutral" | "blue" | "green" | "yellow" }
> = {
  cash: { label: "Cash", Icon: Banknote, tone: "green" },
  online_transfer: { label: "Online", Icon: Smartphone, tone: "blue" },
  duitnow_qr: { label: "QR", Icon: QrCode, tone: "blue" },
  ewallet: { label: "E-wallet", Icon: Wallet, tone: "yellow" },
  other: { label: "Other", Icon: CreditCard, tone: "neutral" },
};

const TONE: Record<"neutral" | "blue" | "green" | "yellow", string> = {
  neutral: "border-border text-foreground-soft",
  blue: "border-foreground/30 text-foreground",
  green: "border-ringgit text-ringgit",
  yellow: "border-highlighter text-foreground",
};

interface PaymentMethodBadgeProps {
  method: PaymentMethodDb | null;
  className?: string;
}

export function PaymentMethodBadge({ method, className }: PaymentMethodBadgeProps) {
  if (!method) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-foreground-faint",
          className,
        )}
      >
        —
      </span>
    );
  }
  const m = META[method];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest",
        TONE[m.tone],
        className,
      )}
    >
      <m.Icon size={10} aria-hidden />
      {m.label}
    </span>
  );
}
