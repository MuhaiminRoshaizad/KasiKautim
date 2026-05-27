import { ImageResponse } from "next/og";

/*
 * Dynamic favicon via Next 16's icon convention. ImageResponse renders
 * a small ink-stamp-style "J" on paper. Single source for /icon used
 * by the manifest and the <link rel="icon"> tag Next emits.
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
          backgroundColor: "#f5f1e8",
          color: "#1a1a1a",
          fontFamily: "Arial Black, system-ui, sans-serif",
          fontWeight: 900,
          fontSize: 72,
          letterSpacing: -3,
        }}
      >
        J
      </div>
    ),
    { ...size },
  );
}
