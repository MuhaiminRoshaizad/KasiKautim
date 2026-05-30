import { ImageResponse } from "next/og";

import { ReceiptIcon } from "@/lib/receipt-icon";

/*
 * Dynamic favicon — a stylized receipt drawing instead of a letter J.
 * Paper background, dashed torn top edge, three horizontal "amount" lines,
 * a small ringgit-green tick mark in the corner suggesting "paid". The
 * JSX itself lives in src/lib/receipt-icon.tsx so /api/icon/[size] can
 * reuse the same mark for the PWA manifest icons.
 */

export const size = { width: 96, height: 96 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<ReceiptIcon size={96} />, { ...size });
}
