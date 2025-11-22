"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Menu,
  X,
  BarChart3,
  Trophy,
  Wallet,
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { cn } from "@/lib/utils";
import { useDebugStore } from "@/lib/stores/debug-store";
import { SmartBalance } from "@/components/wallet/SmartBalance";

const navLinks = [
  { href: "/", label: "Markets", icon: TrendingUp },
  { href: "/portfolio", label: "Portfolio", icon: BarChart3 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const setWalletState = useDebugStore((s) => s.setWalletState);

  // Track scroll for header blur effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Update debug store when wallet connects/disconnects
  useEffect(() => {
    setWalletState({
      connected: isConnected,
      address: address,
    });
  }, [isConnected, address, setWalletState]);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
        isScrolled
          ? "bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-800/50"
          : "bg-transparent"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-neutral-100 tracking-tight">
              MRKT
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50"
                )}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Smart Balance (Trading USDC) - Desktop only */}
            {isConnected && (
              <div className="hidden lg:block">
                <SmartBalance compact />
              </div>
            )}

            {/* Connect Wallet Button */}
            <div className="hidden sm:block">
              <ConnectButton
                chainStatus="icon"
                accountStatus={{
                  smallScreen: "avatar",
                  largeScreen: "full",
                }}
                showBalance={false}
              />
            </div>

            {/* Mobile Connect (simplified) */}
            <div className="sm:hidden">
              <ConnectButton
                chainStatus="none"
                accountStatus="avatar"
                showBalance={false}
              />
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden pb-4 border-t border-neutral-800"
          >
            <div className="pt-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                    "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50"
                  )}
                >
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </Link>
              ))}

              {/* Mobile Balance Display */}
              {isConnected && (
                <div className="px-4 pt-3 mt-2 border-t border-neutral-800">
                  <SmartBalance />
                </div>
              )}
            </div>
          </motion.nav>
        )}
      </div>
    </header>
  );
}
