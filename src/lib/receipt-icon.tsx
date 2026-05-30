/*
 * Shared receipt-icon JSX used by both the dynamic favicon
 * (src/app/icon.tsx at 96x96) and the PWA manifest icons (the
 * /api/icon/[size] route at 192x192 + 512x512). Refactored out
 * so the brand mark stays consistent across all surfaces - the
 * Android install prompt should show the same look as the browser
 * favicon, just bigger.
 *
 * Sizes scale proportionally from the 96px baseline so the
 * dashed-edge stamp + bar widths + paid tick stay visually
 * balanced at any output size.
 */
interface ReceiptIconProps {
  size: number;
}

export function ReceiptIcon({ size }: ReceiptIconProps) {
  const s = size / 96;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1a1a1a",
      }}
    >
      <div
        style={{
          width: 64 * s,
          height: 76 * s,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f5f1e8",
          paddingTop: 10 * s,
          paddingBottom: 6 * s,
          paddingLeft: 8 * s,
          paddingRight: 8 * s,
          position: "relative",
        }}
      >
        {/* Dashed top edge */}
        <div
          style={{
            position: "absolute",
            top: 4 * s,
            left: 4 * s,
            right: 4 * s,
            height: 2 * s,
            backgroundImage: `repeating-linear-gradient(90deg, #1a1a1a 0 ${4 * s}px, transparent ${4 * s}px ${8 * s}px)`,
          }}
        />
        {/* Three amount lines */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6 * s,
            marginTop: 6 * s,
          }}
        >
          <div style={{ display: "flex", height: 6 * s, backgroundColor: "#1a1a1a", width: "70%" }} />
          <div style={{ display: "flex", height: 6 * s, backgroundColor: "#1a1a1a", width: "55%" }} />
          <div style={{ display: "flex", height: 6 * s, backgroundColor: "#1a1a1a", width: "82%" }} />
        </div>
        {/* Big paid tick */}
        <div
          style={{
            position: "absolute",
            right: 6 * s,
            bottom: 6 * s,
            width: 22 * s,
            height: 22 * s,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#326640",
            color: "#f5f1e8",
            fontSize: 18 * s,
            fontWeight: 900,
            fontFamily: "Arial Black, sans-serif",
            lineHeight: 1,
          }}
        >
          ✓
        </div>
      </div>
    </div>
  );
}
