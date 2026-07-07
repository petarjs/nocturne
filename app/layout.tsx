import type { Metadata } from "next";
import {
  Chakra_Petch,
  Geist_Mono,
  IBM_Plex_Mono,
  M_PLUS_1_Code,
  Shippori_Mincho,
  Sora,
  Space_Grotesk,
  Spline_Sans_Mono,
} from "next/font/google";
import "./globals.css";

// next/font self-hosts these at build time — no runtime font-CDN dependency (§3.2).
const fontSora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const fontSplineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
});

const fontChakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const fontIbmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const fontShipporiMincho = Shippori_Mincho({
  variable: "--font-shippori-mincho",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const fontMplus1Code = M_PLUS_1_Code({
  variable: "--font-mplus1-code",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const fontSpaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const fontGeistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fontVars = [
  fontSora.variable,
  fontSplineMono.variable,
  fontChakraPetch.variable,
  fontIbmPlexMono.variable,
  fontShipporiMincho.variable,
  fontMplus1Code.variable,
  fontSpaceGrotesk.variable,
  fontGeistMono.variable,
].join(" ");

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
    <html lang="en" className={`${fontVars} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
