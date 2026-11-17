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
  themeColor: "#008069", // the band, so the phone's own chrome matches it
};

export default function RootLayout({ children }) {
  return (
    // data-theme pins the light WhatsApp palette; "dark" switches it, and
    // removing it follows the device.
    <html lang="en" data-theme="light" className={`${sans.variable} ${mono.variable}`}>
      <body className="bg-ground font-sans text-body text-ink antialiased">{children}</body>
    </html>
  );
}
