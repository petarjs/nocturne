import type { Metadata } from "next";
import { Sora, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// next/font self-hosts these at build time — no runtime font-CDN dependency (§3.2).
const fontDisplay = Sora({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fontData = Spline_Sans_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nocturne",
  description: "A living display for AI agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontData.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
