import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Self-hosted at build time by next/font, so no request leaves the user's browser.
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata = {
  title: "Ankit Desk",
  robots: { index: false, follow: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // The canvas, so the phone's own chrome continues the page rather than
  // announcing a brand colour above it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }) {
  return (
    // data-theme pins the light palette; "dark" switches it, and
    // removing it follows the device.
    <html lang="en" data-theme="light" className={`${sans.variable} ${mono.variable}`}>
      <body className="bg-ground font-sans text-body text-ink antialiased">{children}</body>
    </html>
  );
}
