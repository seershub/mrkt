'use client';

import { useQuery } from '@tanstack/react-query';
import { UnifiedMarket } from '@/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Droplets, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TradeModal } from '@/components/unified/TradeModal';

function MarketCard({ market }: { market: UnifiedMarket }) {
    const yesOutcome = market.outcomes.find(o => o.label === 'Yes') || market.outcomes[0];
    const noOutcome = market.outcomes.find(o => o.label === 'No') || market.outcomes[1];

    return (
        <Card className="bg-card border-border hover:border-brand-500 transition-all duration-300 hover:shadow-glow-sm group">
            <CardHeader className="pb-2 space-y-0">
                <div className="flex justify-between items-start">
                    <div className="flex gap-2 items-center">
                        <Badge variant="outline" className="bg-brand-500/10 text-brand-400 border-brand-500/20">
                            {market.category || 'Sports'}
                        </Badge>
                        {market.source === 'POLY' && <Badge variant="secondary" className="text-[10px]">POLY</Badge>}
                        {market.source === 'KALSHI' && <Badge variant="secondary" className="text-[10px]">KALSHI</Badge>}
                    </div>
                    <div className="flex items-center text-muted-foreground text-xs gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(market.endTime).toLocaleDateString()}</span>
                    </div>
                </div>
                <h3 className="text-lg font-bold leading-tight mt-2 line-clamp-2 group-hover:text-brand-400 transition-colors">
                    {market.question}
                </h3>
            </CardHeader>

            <CardContent className="pb-2">
                <div className="grid grid-cols-2 gap-3 mt-2">
                    {/* YES Button */}
                    <TradeModal market={market} outcome={yesOutcome}>
                        <Button
                            variant="outline"
                            className="h-auto py-3 flex flex-col items-center justify-center border-success-900/30 bg-success-950/10 hover:bg-success-950/30 hover:border-success-500/50 transition-all w-full"
                        >
                            <span className="text-success-500 font-bold text-sm">YES</span>
                            <span className="text-lg font-mono font-bold text-foreground">{(yesOutcome?.price * 100).toFixed(1)}¢</span>
                            <span className="text-[10px] text-muted-foreground">{(yesOutcome?.probability * 100).toFixed(0)}% prob</span>
                        </Button>
                    </TradeModal>

                    {/* NO Button */}
                    <TradeModal market={market} outcome={noOutcome}>
                        <Button
                            variant="outline"
                            className="h-auto py-3 flex flex-col items-center justify-center border-danger-900/30 bg-danger-950/10 hover:bg-danger-950/30 hover:border-danger-500/50 transition-all w-full"
                        >
                            <span className="text-danger-500 font-bold text-sm">NO</span>
                            <span className="text-lg font-mono font-bold text-foreground">{(noOutcome?.price * 100).toFixed(1)}¢</span>
                            <span className="text-[10px] text-muted-foreground">{(noOutcome?.probability * 100).toFixed(0)}% prob</span>
                        </Button>
                    </TradeModal>
                </div>
            </CardContent>

            <CardFooter className="pt-2 pb-4 text-xs text-muted-foreground flex justify-between border-t border-border/50 mt-2">
                <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-brand-400" />
                    <span className="font-mono">${(market.volume / 1000).toFixed(1)}K Vol</span>
                </div>
                <div className="flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-blue-400" />
                    <span className="font-mono">${(market.liquidity || 0 / 1000).toFixed(1)}K Liq</span>
                </div>
            </CardFooter>
        </Card>
    );
}

export function MarketGrid() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['markets'],
        queryFn: async () => {
            const res = await fetch('/api/markets');
            if (!res.ok) throw new Error('Failed to fetch markets');
            return res.json();
        },
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-[250px] w-full rounded-xl bg-card/50" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-10 text-red-400 bg-red-950/10 rounded-lg border border-red-900/20">
                Error loading markets: {(error as Error).message}
            </div>
        );
    }

    const markets = data?.markets || [];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {markets.map((market: UnifiedMarket) => (
                <MarketCard key={market.id} market={market} />
            ))}
        </div>
    );
}
