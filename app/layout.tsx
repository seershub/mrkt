import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MRKT - Sports Prediction Markets",
  description:
    "Trade sports predictions on Polymarket and Kalshi. The Bloomberg Terminal for sports betting markets.",
  keywords: [
    "prediction markets",
    "sports betting",
    "polymarket",
    "kalshi",
    "crypto trading",
    "sports predictions",
    "nfl",
    "nba",
    "mlb",
  ],
  authors: [{ name: "SeersHub" }],
  openGraph: {
    title: "MRKT - Sports Prediction Markets",
    description: "Trade sports predictions on Polymarket and Kalshi",
    url: "https://mrkt.seershub.com",
    siteName: "MRKT",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MRKT - Sports Prediction Markets",
    description: "Trade sports predictions on Polymarket and Kalshi",
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
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
