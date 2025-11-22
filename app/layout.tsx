import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConsoleLogger } from "@/components/debug/ConsoleLogger";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MRKT | Poly SeersHub",
  description: "Unified Sports Prediction Markets",
};

import { Providers } from "@/components/providers";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          {children}
          <ConsoleLogger />
          <Toaster position="bottom-right" theme="dark" />
        </Providers>
      </body>
    </html>
  );
}
