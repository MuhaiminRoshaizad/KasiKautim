import type { MetadataRoute } from "next";

import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

/*
 * Web App Manifest — drives the Android "Add to Home Screen" install
 * prompt and the icon/title shown on the home screen launcher. iOS
 * uses apple-icon.tsx + <meta name="apple-mobile-web-app-*"> tags
 * (Next emits both automatically when this manifest is present).
 *
 * Icons point at /icon and /apple-icon — the dynamic ImageResponse
 * routes in this same app directory. Setting both 192 and 512 sizes
 * for Android lets it pick the right one for the launcher.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f1e8",
    theme_color: "#f5f1e8",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "96x96",
        type: "image/png",
      },
      {
        // Android launcher picks 192x192 on most mdpi/hdpi devices.
        src: "/api/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        // 512x512 covers xxxhdpi Android + the install prompt preview
        // and the splash screen on PWA-launched apps.
        src: "/api/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
