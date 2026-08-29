import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
