import { ImageResponse } from "next/og";

/*
 * Dynamic favicon — a stylized receipt drawing instead of a letter J.
 * Paper background, dashed torn top edge, three horizontal "amount" lines,
 * a small ringgit-green tick mark in the corner suggesting "paid". The
 * whole thing is drawn with divs + borders so satori renders it reliably
 * at 96x96. Browsers downscale to 16/32/48 for the tab favicon.
 */

export const size = { width: 96, height: 96 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
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
            width: 64,
            height: 76,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#f5f1e8",
            paddingTop: 10,
            paddingBottom: 6,
            paddingLeft: 8,
            paddingRight: 8,
            position: "relative",
          }}
        >
          {/* Dashed top edge */}
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 4,
              right: 4,
              height: 2,
              backgroundImage:
                "repeating-linear-gradient(90deg, #1a1a1a 0 4px, transparent 4px 8px)",
            }}
          />
          {/* Three amount lines */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            <div style={{ display: "flex", height: 6, backgroundColor: "#1a1a1a", width: "70%" }} />
            <div style={{ display: "flex", height: 6, backgroundColor: "#1a1a1a", width: "55%" }} />
            <div style={{ display: "flex", height: 6, backgroundColor: "#1a1a1a", width: "82%" }} />
          </div>
          {/* Big paid tick */}
          <div
            style={{
              position: "absolute",
              right: 6,
              bottom: 6,
              width: 22,
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#3d7a4a",
              color: "#f5f1e8",
              fontSize: 18,
              fontWeight: 900,
              fontFamily: "Arial Black, sans-serif",
              lineHeight: 1,
            }}
          >
            ✓
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
