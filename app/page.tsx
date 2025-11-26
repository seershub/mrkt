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
    <section className="relative pt-28 pb-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-terminal-bg">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(59,130,246,0.06),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <span className="text-sm font-medium text-gold">
              Polymarket × Kalshi Aggregator
            </span>
          </motion.div>

          {/* Headline */}
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-white mb-6 leading-[1.1] tracking-tight">
            Trade Predictions
            <br />
            <span className="bg-gradient-to-r from-gold via-emerald-400 to-gold bg-clip-text text-transparent animate-gradient">
              At The Best Price
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-white/50 max-w-2xl mx-auto mb-12 font-light">
            Compare odds across prediction markets.
            Execute trades with optimal pricing, zero hassle.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="bg-gold hover:bg-gold/90 text-terminal-bg font-semibold px-8 h-12 rounded-lg transition-colors inline-flex items-center gap-2">
              Start Trading
              <TrendingUp className="w-4 h-4" />
            </button>
            <button className="border border-white/10 hover:bg-white/5 h-12 px-8 rounded-lg text-white transition-colors">
              Explore Markets
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {[
            { label: 'Active Markets', value: '2,400+' },
            { label: '24h Volume', value: '$12.4M' },
            { label: 'Platforms', value: '2' },
            { label: 'Avg Spread', value: '0.3¢' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="text-center p-6 rounded-xl bg-terminal-card/50 border border-white/[0.04]"
            >
              <div className="text-3xl font-bold text-white mb-1 font-mono">
                {stat.value}
              </div>
              <div className="text-sm text-white/40">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
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
