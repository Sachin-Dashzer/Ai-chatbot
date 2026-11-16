import "./globals.css";

export const metadata = {
  title: "Ankit Desk",
  robots: { index: false, follow: false },
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-stone-100 text-stone-900 antialiased dark:bg-stone-900 dark:text-stone-100">{children}</body>
    </html>
  );
}
