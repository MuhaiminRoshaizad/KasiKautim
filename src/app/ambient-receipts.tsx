import { AmountDisplay } from "@/components/amount-display";
import { ProgressBar } from "@/components/progress-bar";
import { cn } from "@/lib/cn";

/*
 * Decorative infinite-scroll receipt strips for the landing margins.
 * Sits in the empty viewport space outside the max-w-5xl content
 * container on lg+ screens, gently scrolling vertically to give the
 * page atmosphere — like a stack of carbon-copy receipts being fed
 * through a thermal printer.
 *
 * Hidden below lg (mobile + tablet) so the foreground content stays
 * uncluttered on narrow screens. pointer-events: none so the strips
 * never intercept clicks. Low opacity + behind content (z-0) so they
 * texture without competing with copy.
 *
 * Animation: two columns each duplicate the same receipt list, then
 * translate the whole inner stack upward by exactly -50% of its height.
 * At the 50% mark the duplicated content occupies the original position
 * so the loop is seamless (no visible jump). prefers-reduced-motion
 * pauses the animation.
 *
 * The fake receipts pull from a small set of Malaysian merchant names
 * + plausible bill totals + varying paid progress, so the casual eye
 * recognizes "this is what the app does" without zooming in.
 */

interface FakeReceipt {
  slug: string;
  merchant: string;
  totalCents: number;
  paidCents: number;
  members: number;
  paidMembers: number;
  settled?: boolean;
}

const SAMPLE_RECEIPTS: FakeReceipt[] = [
  { slug: "NPNK7G2X", merchant: "RESTORAN ALI", totalCents: 8_640, paidCents: 8_640, members: 4, paidMembers: 4, settled: true },
  { slug: "MK22LL09", merchant: "Mamak Pelita", totalCents: 4_320, paidCents: 2_160, members: 3, paidMembers: 1 },
  { slug: "KH7XYZ44", merchant: "Kopitiam Haji", totalCents: 5_580, paidCents: 5_580, members: 6, paidMembers: 6, settled: true },
  { slug: "TC4N9PQR", merchant: "Tealive · KLCC", totalCents: 3_950, paidCents: 1_975, members: 2, paidMembers: 1 },
  { slug: "PK11MA2X", merchant: "Pak Long Nasi Kandar", totalCents: 12_780, paidCents: 8_520, members: 6, paidMembers: 4 },
  { slug: "JM5BB7TT", merchant: "Jaya Grocer", totalCents: 18_645, paidCents: 6_215, members: 5, paidMembers: 2 },
  { slug: "GR9ZX01M", merchant: "Grab · Subang", totalCents: 2_840, paidCents: 2_840, members: 2, paidMembers: 2, settled: true },
  { slug: "RN23QQ8L", merchant: "Restoran Nasi Beriani", totalCents: 9_900, paidCents: 4_950, members: 4, paidMembers: 2 },
  { slug: "ZT4G9HK7", merchant: "ZUS Coffee", totalCents: 3_420, paidCents: 1_140, members: 3, paidMembers: 1 },
  { slug: "AY7QQ2RT", merchant: "Ayam Penyet Bestari", totalCents: 6_750, paidCents: 6_750, members: 3, paidMembers: 3, settled: true },
];

export function AmbientReceipts() {
  return (
    <>
      <ReceiptStrip side="left" />
      <ReceiptStrip side="right" />
    </>
  );
}

function ReceiptStrip({ side }: { side: "left" | "right" }) {
  // Each side animates with a different speed/offset so the two strips
  // don't feel mechanically synced — gives a more "natural shelf" feel.
  const animation =
    side === "left"
      ? "[animation:ambient-scroll_70s_linear_infinite]"
      : "[animation:ambient-scroll_85s_linear_infinite_reverse]";
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-y-0 z-0 hidden w-[16rem] select-none overflow-hidden opacity-60 motion-reduce:opacity-30 2xl:block",
        // Visibility gated at 2xl (1536px+) where the gutter beside the
        // max-w-5xl content (1024px) is ≥256px = our strip width. At
        // narrower widths (tablet, small desktop) the strip would
        // collide with the hero content.
        side === "left" ? "left-0" : "right-0",
        // Soft fade-in at top and fade-out at bottom so the strip doesn't
        // collide hard with the viewport edges.
        "[mask-image:linear-gradient(to_bottom,transparent_0%,black_8%,black_92%,transparent_100%)]",
      )}
    >
      <div className={cn("flex flex-col gap-0", animation, "motion-reduce:animate-none")}>
        {/* Render the list twice. The keyframe translates by -50%, so when
            the duplicate hits the position the original was at, the loop
            visually continues without a jump. */}
        {[...SAMPLE_RECEIPTS, ...SAMPLE_RECEIPTS].map((r, i) => (
          <FakeReceiptCard key={`${r.slug}-${i}`} receipt={r} />
        ))}
      </div>
    </div>
  );
}

function FakeReceiptCard({ receipt }: { receipt: FakeReceipt }) {
  const progress = receipt.totalCents > 0 ? receipt.paidCents / receipt.totalCents : 0;
  return (
    <div className="relative isolate border-x border-border bg-surface paper-grain torn-bottom px-5 pb-6 pt-5">
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-[9px] uppercase tracking-widest text-foreground-faint">
          {receipt.slug}
        </div>
        {receipt.settled ? (
          <span className="select-none border border-ringgit px-1.5 py-0.5 font-display text-[9px] uppercase tracking-widest text-ringgit">
            Settled
          </span>
        ) : null}
      </div>
      <div className="mt-1 font-display text-base uppercase leading-tight tracking-tight text-foreground">
        {receipt.merchant}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2 font-mono text-[10px] text-foreground-faint">
        <span>{receipt.members} members</span>
        <span>
          {receipt.paidMembers} / {receipt.members} paid
        </span>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <AmountDisplay cents={receipt.paidCents} size="sm" muted={!receipt.settled} />
        <span className="font-mono text-[10px] text-foreground-faint tabular">
          / <AmountDisplay cents={receipt.totalCents} size="sm" muted />
        </span>
      </div>

      <div className="mt-2">
        <ProgressBar value={progress} />
      </div>
    </div>
  );
}
