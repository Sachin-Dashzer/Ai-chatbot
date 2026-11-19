// The faces, self-hosted at build time by next/font, so no request leaves the
// user's browser and nothing falls back to a system face.
//
// Archivo, with Archivo Narrow for the printed furniture of a form: a
// workhorse grotesk drawn for signage and forms, with true tabular figures —
// which every column on these screens depends on. The narrow cut does one job
// and one only, the way a form's printed labels are set tighter than the hand
// that fills it in.
import { Archivo, Archivo_Narrow } from "next/font/google";
import "./globals.css";

const sans = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-sans",
});

const narrow = Archivo_Narrow({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--font-narrow",
});

export const metadata = {
  title: "Love",
  robots: { index: false, follow: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // The board, so the phone's own chrome continues the frame rather than
  // announcing a brand colour above it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#dce3dc" },
    { media: "(prefers-color-scheme: dark)", color: "#0d110f" },
  ],
};

export default function RootLayout({ children }) {
  return (
    // data-theme pins the light palette; "dark" switches it, and removing it
    // follows the device.
    <html lang="en" data-theme="light" className={`${sans.variable} ${narrow.variable}`}>
      <body className="bg-board font-sans text-body text-ink antialiased">{children}</body>
    </html>
  );
}
