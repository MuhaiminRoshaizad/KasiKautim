import type { Metadata, Viewport } from "next";
import { Anton, Caveat, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { ThemeBootstrap } from "@/components/theme-bootstrap";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import { siteUrl } from "@/lib/site-url";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: APP_NAME }],
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0d0b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${anton.variable} ${caveat.variable}`}
    >
      <head>
        <ThemeBootstrap />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {/*
         * WCAG 2.4.1 — keyboard-only users can jump past the header
         * nav to the page's main landmark. Visually hidden until
         * focused, at which point it pops to the top-left of every
         * route as a styled chip. Pages add id="main" to their <main>.
         */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-foreground focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg"
        >
          Skip to content
        </a>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "!bg-surface !text-foreground !border-border !font-sans !rounded-none",
            },
          }}
        />
      </body>
    </html>
  );
}
