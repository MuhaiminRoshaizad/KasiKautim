import { ImageResponse } from "next/og";

import { ReceiptIcon } from "@/lib/receipt-icon";

/*
 * PWA manifest icons rendered dynamically at the sizes the Android
 * install prompt expects (192 + 512). Same mark as the browser
 * favicon via the shared ReceiptIcon component so the home-screen
 * launcher shows the same brand glyph the tab does.
 *
 * Locked to an allowlist of sizes so an attacker can't burn function
 * budget by requesting /api/icon/99999.
 */

const ALLOWED_SIZES = new Set([192, 512]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await params;
  const size = Number(rawSize);

  if (!Number.isInteger(size) || !ALLOWED_SIZES.has(size)) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(<ReceiptIcon size={size} />, {
    width: size,
    height: size,
    headers: {
      // Long cache since the icon source is in code and only changes
      // on deploy. Immutable per Next's static asset convention.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
