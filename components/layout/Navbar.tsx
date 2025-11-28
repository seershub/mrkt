"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { WalletConnect } from "@/components/wallet/WalletConnect";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function Navbar() {
    const pathname = usePathname();

    const navItems = [
        { name: "Markets", href: "/" },
        { name: "Portfolio", href: "/portfolio" },
        { name: "Activity", href: "/activity" },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                            M
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                            MRKT
                        </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link key={item.href} href={item.href}>
                                    <div className="relative px-4 py-2 rounded-full transition-colors hover:bg-white/5">
                                        <span className={cn(
                                            "text-sm font-medium transition-colors",
                                            isActive ? "text-white" : "text-muted-foreground hover:text-white"
                                        )}>
                                            {item.name}
                                        </span>
                                        {isActive && (
                                            <motion.div
                                                layoutId="navbar-indicator"
                                                className="absolute inset-0 rounded-full bg-white/10"
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                            />
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-muted-foreground">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span>Polygon Mainnet</span>
                    </div>
                    <WalletConnect />
                </div>
            </div>
        </header>
    );
}
