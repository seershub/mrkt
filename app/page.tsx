"use client";

import { motion } from "framer-motion";
import { TrendingUp, Zap, Shield, BarChart3 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { MarketGrid } from "@/components/unified/MarketGrid";
import { Badge } from "@/components/ui/badge";

// Hero stats component
function HeroStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: "Total Volume", value: "$2.4M", icon: TrendingUp },
        { label: "Active Markets", value: "128", icon: BarChart3 },
        { label: "Platforms", value: "2", icon: Zap },
        { label: "Sports", value: "9", icon: Shield },
      ].map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * i }}
          className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 text-center"
        >
          <stat.icon className="w-5 h-5 text-brand-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-neutral-100">{stat.value}</p>
          <p className="text-xs text-neutral-500">{stat.label}</p>
        </motion.div>
      ))}
    </div>
  );
}

// Hero section
function HeroSection() {
  return (
    <section className="relative pt-24 pb-12 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-950/20 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <Badge variant="default" className="mb-4">
            <Zap className="w-3 h-3 mr-1" />
            Polymarket + Kalshi in One Place
          </Badge>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-neutral-100 mb-4 tracking-tight">
            Trade Sports{" "}
            <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              Predictions
            </span>
          </h1>

          <p className="text-lg text-neutral-400 max-w-xl mx-auto">
            The Bloomberg Terminal for sports betting markets. Aggregate,
            compare, and trade on Polymarket and Kalshi from one unified
            interface.
          </p>
        </motion.div>

        <HeroStats />
      </div>
    </section>
  );
}

// Main page
export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950">
      <Header />

      <HeroSection />

      {/* Markets Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-neutral-100">
                Sports Markets
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                Live prediction markets from Polymarket and Kalshi
              </p>
            </div>
          </div>

          <MarketGrid />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-neutral-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-neutral-100">MRKT</span>
              <span className="text-xs text-neutral-600">by SeersHub</span>
            </div>

            <p className="text-xs text-neutral-600 text-center">
              MRKT aggregates data from Polymarket and Kalshi. Trading involves
              risk. Not financial advice.
            </p>

            <div className="flex items-center gap-4 text-xs text-neutral-500">
              <a href="#" className="hover:text-neutral-300 transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-neutral-300 transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-neutral-300 transition-colors">
                Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
