import { ImageResponse } from "next/og";

import { APP_NAME } from "@/lib/constants";
import { formatMYR } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PublicBillMemberRpc, PublicBillRpc } from "@/types/db";

export const runtime = "nodejs";

/*
 * Per-slug OG image rendered by next/og as a 1200x630 PNG. WhatsApp /
 * Telegram / iMessage unfurl /b/[slug] against this. Receipt-styled
 * paper background + ink palette hard-coded (CSS vars don't resolve in
 * the satori runtime).
 */

const TITLE_MAX = 60;

const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

function sanitize(text: string): string {
  return text.replace(CONTROL_CHARS, "").trim();
}

function cap(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

interface OgPayload {
  title: string;
  totalCents: number;
  organizer: string;
  paidCount: number;
  memberCount: number;
  collectedCents: number;
  allPaid: boolean;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const payload = await loadPayload(slug);

  return new ImageResponse(<OgFrame payload={payload} />, {
    width: 1200,
    height: 630,
    headers: {
      "cache-control":
        "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

async function loadPayload(slug: string): Promise<OgPayload | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: bill } = await supabase
      .rpc("get_public_bill", { p_slug: slug })
      .maybeSingle<PublicBillRpc>();
    if (!bill) return null;

    const { data: members } = await supabase.rpc("get_public_bill_members", {
      p_slug: slug,
    });
    const memberList = (members as PublicBillMemberRpc[] | null) ?? [];
    const paidMembers = memberList.filter((m) => m.paid);
    const collectedCents = paidMembers.reduce(
      (acc, m) => acc + (m.paid_amount_cents ?? m.amount_owed_cents),
      0,
    );

    return {
      title: cap(sanitize(bill.title), TITLE_MAX),
      totalCents: bill.total_cents,
      organizer: sanitize(bill.organizer_display_name ?? "Someone"),
      paidCount: paidMembers.length,
      memberCount: memberList.length,
      collectedCents,
      allPaid:
        memberList.length > 0 && paidMembers.length === memberList.length,
    };
  } catch {
    return null;
  }
}

const COLORS = {
  paper: "#f5f1e8",
  paperDeep: "#ede7d6",
  ink: "#1a1a1a",
  inkSoft: "#4a4a4a",
  inkFaint: "#7a7468",
  ringgit: "#3d7a4a",
  stamp: "#c8412c",
  grid: "#e5dfd0",
} as const;

function OgFrame({ payload }: { payload: OgPayload | null }) {
  if (!payload) return <FallbackFrame />;

  const progress =
    payload.totalCents > 0
      ? Math.min(1, payload.collectedCents / payload.totalCents)
      : 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLORS.paper,
        backgroundImage: `linear-gradient(180deg, ${COLORS.paper} 0%, ${COLORS.paperDeep} 100%)`,
        padding: "64px 80px",
        color: COLORS.ink,
        fontFamily: "system-ui, sans-serif",
        position: "relative",
      }}
    >
      <Header />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          marginTop: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 6,
            color: COLORS.inkFaint,
            textTransform: "uppercase",
          }}
        >
          Bill from {payload.organizer}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 78,
            fontWeight: 900,
            lineHeight: 1.05,
            marginTop: 12,
            letterSpacing: -2,
            textTransform: "uppercase",
            maxWidth: 1040,
          }}
        >
          {payload.title}
        </div>

        <Divider />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 18,
                letterSpacing: 5,
                color: COLORS.inkSoft,
                textTransform: "uppercase",
              }}
            >
              Total
            </span>
            <span
              style={{
                fontSize: 96,
                fontWeight: 800,
                lineHeight: 1,
                marginTop: 8,
                color: COLORS.ink,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatMYR(payload.totalCents)}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <span
              style={{
                fontSize: 18,
                letterSpacing: 5,
                color: COLORS.inkSoft,
                textTransform: "uppercase",
              }}
            >
              {payload.allPaid ? "Settled" : "Collected"}
            </span>
            <span
              style={{
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1,
                marginTop: 8,
                color: payload.allPaid ? COLORS.ringgit : COLORS.ink,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatMYR(payload.collectedCents)}
            </span>
            <span
              style={{
                fontSize: 22,
                marginTop: 6,
                color: COLORS.inkFaint,
              }}
            >
              {payload.paidCount} of {payload.memberCount} paid
            </span>
          </div>
        </div>

        <ProgressBar progress={progress} allPaid={payload.allPaid} />
      </div>

      <Footer allPaid={payload.allPaid} />

      {payload.allPaid ? <PaidStamp /> : null}
    </div>
  );
}

function FallbackFrame() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.paper,
        backgroundImage: `linear-gradient(180deg, ${COLORS.paper} 0%, ${COLORS.paperDeep} 100%)`,
        color: COLORS.ink,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 36,
          letterSpacing: 14,
          color: COLORS.inkFaint,
          textTransform: "uppercase",
        }}
      >
        {APP_NAME}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 84,
          fontWeight: 900,
          lineHeight: 1,
          marginTop: 24,
          letterSpacing: -2,
          textTransform: "uppercase",
        }}
      >
        Jom split.
      </div>
      <div
        style={{
          fontSize: 28,
          marginTop: 24,
          color: COLORS.inkSoft,
          maxWidth: 900,
          textAlign: "center",
        }}
      >
        No awkward chasing. Built for Malaysian group chats.
      </div>
    </div>
  );
}

function Header() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontWeight: 900,
          letterSpacing: 8,
          textTransform: "uppercase",
        }}
      >
        {APP_NAME}
      </div>
      <div
        style={{
          fontSize: 16,
          letterSpacing: 4,
          color: COLORS.inkFaint,
          textTransform: "uppercase",
        }}
      >
        Receipt · MYR
      </div>
    </div>
  );
}

function Footer({ allPaid }: { allPaid: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 16,
        fontSize: 22,
        color: COLORS.inkSoft,
      }}
    >
      <div style={{ display: "flex" }}>
        {allPaid ? "Settled · Terima kasih" : "Tap to claim your share"}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 18,
          letterSpacing: 4,
          color: COLORS.inkFaint,
          textTransform: "uppercase",
        }}
      >
        jomsplit
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        marginTop: 32,
        marginBottom: 32,
        height: 2,
        width: "100%",
        backgroundImage: `repeating-linear-gradient(90deg, ${COLORS.grid} 0 8px, transparent 8px 14px)`,
      }}
    />
  );
}

function ProgressBar({
  progress,
  allPaid,
}: {
  progress: number;
  allPaid: boolean;
}) {
  const pct = Math.round(progress * 100);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        marginTop: 32,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 18,
          letterSpacing: 4,
          color: COLORS.inkSoft,
          textTransform: "uppercase",
        }}
      >
        <span>Progress</span>
        <span>{pct}%</span>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 8,
          height: 14,
          width: "100%",
          backgroundColor: COLORS.grid,
        }}
      >
        <div
          style={{
            display: "flex",
            width: `${pct}%`,
            backgroundColor: allPaid ? COLORS.ringgit : COLORS.ink,
          }}
        />
      </div>
    </div>
  );
}

function PaidStamp() {
  return (
    <div
      style={{
        position: "absolute",
        right: 96,
        top: 152,
        transform: "rotate(-8deg)",
        display: "flex",
        padding: "14px 28px",
        border: `6px solid ${COLORS.ringgit}`,
        color: COLORS.ringgit,
        fontSize: 56,
        fontWeight: 900,
        letterSpacing: 6,
        textTransform: "uppercase",
        opacity: 0.92,
      }}
    >
      Paid in full
    </div>
  );
}
