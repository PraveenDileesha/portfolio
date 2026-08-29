import type { Metadata, Viewport } from "next";
import { Caveat } from "next/font/google";
import "./globals.css";

// Self-hosted at build time via next/font: no runtime request to Google, and
// no CSP change needed since it's served from this origin.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Praveen Dileesha",
  description: "Sunset sea — a real-time rendered fishing boat at golden hour.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Praveen Dileesha",
    description: "Sunset sea — a real-time rendered fishing boat at golden hour.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#090d16",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={caveat.variable}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
