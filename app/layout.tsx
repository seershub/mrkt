import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MRKT - Prediction Market Aggregator",
  description:
    "Trade prediction markets across Polymarket and Kalshi. Find arbitrage opportunities and maximize your edge.",
  keywords: [
    "prediction markets",
    "polymarket",
    "kalshi",
    "arbitrage",
    "crypto trading",
    "market aggregator",
    "sports betting",
    "politics",
  ],
  authors: [{ name: "MRKT" }],
  openGraph: {
    title: "MRKT - Prediction Market Aggregator",
    description: "Trade prediction markets across Polymarket and Kalshi",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MRKT - Prediction Market Aggregator",
    description: "Trade prediction markets across Polymarket and Kalshi",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="font-sans antialiased bg-background text-foreground min-h-screen"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
