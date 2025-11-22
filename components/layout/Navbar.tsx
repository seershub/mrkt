'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export function Navbar() {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-brand-500" />
                        <span className="text-2xl font-bold bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
                            MRKT
                        </span>
                    </Link>

                    <div className="hidden md:flex items-center gap-6">
                        <Link href="/" className="text-sm font-medium hover:text-brand-400 transition-colors">
                            Markets
                        </Link>
                        <Link href="/portfolio" className="text-sm font-medium hover:text-brand-400 transition-colors">
                            Portfolio
                        </Link>
                        {process.env.NEXT_PUBLIC_ENABLE_LEADERBOARD === 'true' && (
                            <Link href="/leaderboard" className="text-sm font-medium hover:text-brand-400 transition-colors">
                                Leaderboard
                            </Link>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {isConnected ? (
                        <>
                            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20">
                                <div className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
                                <span className="text-sm font-mono">
                                    {address?.slice(0, 6)}...{address?.slice(-4)}
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => disconnect()}
                                className="gap-2"
                            >
                                <LogOut className="h-4 w-4" />
                                Disconnect
                            </Button>
                        </>
                    ) : (
                        <Button
                            onClick={() => connect({ connector: connectors[0] })}
                            className="gap-2 bg-brand-600 hover:bg-brand-700"
                        >
                            <Wallet className="h-4 w-4" />
                            Connect Wallet
                        </Button>
                    )}
                </div>
            </div>
        </nav>
    );
}
