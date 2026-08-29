import type { Metadata, Viewport } from "next";
import SmoothScroll from "@/components/SmoothScroll";
import "./globals.css";

export const metadata: Metadata = {
  title: "Software Engineer — Portfolio",
  description:
    "Systems, graphics, and the web. Selected work from a software engineer building real-time rendering and distributed infrastructure.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Software Engineer — Portfolio",
    description: "Systems, graphics, and the web.",
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
    <html lang="en" className="scroll-smooth">
      <body className="grain antialiased">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
