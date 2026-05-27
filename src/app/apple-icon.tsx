import { ImageResponse } from "next/og";

/*
 * Apple touch icon — 180x180 PNG iOS uses when "Add to Home Screen" is
 * tapped. Paper card with a centered "J" + dashed line + JOMSPLIT
 * wordmark, mimicking the in-app receipt aesthetic. No transparency:
 * iOS rounds the corners itself.
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
          backgroundColor: "#f5f1e8",
          color: "#1a1a1a",
          fontFamily: "Arial Black, system-ui, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            fontWeight: 900,
            fontSize: 124,
            lineHeight: 1,
            letterSpacing: -6,
            marginTop: -8,
          }}
        >
          J
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 4,
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#7a7468",
          }}
        >
          Jomsplit
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 18,
            left: 22,
            right: 22,
            height: 2,
            backgroundImage:
              "repeating-linear-gradient(90deg, #e5dfd0 0 6px, transparent 6px 10px)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
