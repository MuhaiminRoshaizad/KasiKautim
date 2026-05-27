import { ImageResponse } from "next/og";

import { APP_NAME } from "@/lib/constants";

/*
 * Apple touch icon — 180x180 PNG for iOS "Add to Home Screen". Same
 * receipt motif as the favicon but with room for the wordmark below.
 * Ink-dark background frames the paper card so it pops on both light
 * and dark wallpapers.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
          color: "#1a1a1a",
        }}
      >
        <div
          style={{
            width: 110,
            height: 124,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#f5f1e8",
            paddingTop: 18,
            paddingBottom: 10,
            paddingLeft: 14,
            paddingRight: 14,
            position: "relative",
          }}
        >
          {/* Dashed torn top edge */}
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              right: 8,
              height: 3,
              backgroundImage:
                "repeating-linear-gradient(90deg, #1a1a1a 0 5px, transparent 5px 10px)",
            }}
          />
          {/* Amount lines */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <div style={{ display: "flex", height: 8, backgroundColor: "#1a1a1a", width: "70%" }} />
            <div style={{ display: "flex", height: 8, backgroundColor: "#1a1a1a", width: "55%" }} />
            <div style={{ display: "flex", height: 8, backgroundColor: "#1a1a1a", width: "82%" }} />
          </div>
          {/* Paid tick stamp */}
          <div
            style={{
              position: "absolute",
              right: 10,
              bottom: 10,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#3d7a4a",
              color: "#f5f1e8",
              fontSize: 28,
              fontWeight: 900,
              fontFamily: "Arial Black, sans-serif",
              lineHeight: 1,
            }}
          >
            ✓
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontFamily: "Arial Black, sans-serif",
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: 4,
            color: "#f5f1e8",
            textTransform: "uppercase",
          }}
        >
          {APP_NAME}
        </div>
      </div>
    ),
    { ...size },
  );
}
