"use client";

import { motion } from "framer-motion";
import { Clock, TrendingUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { UnifiedMarket, MarketOutcome } from "@/types";

interface TradingRowProps {
  market: UnifiedMarket;
  onTrade: (market: UnifiedMarket, outcome: MarketOutcome) => void;
}

export function TradingRow({ market, onTrade }: TradingRowProps) {
  const yesOutcome = market.outcomes.find(o => o.name.toLowerCase() === 'yes') || market.outcomes[0];
  const noOutcome = market.outcomes.find(o => o.name.toLowerCase() === 'no') || market.outcomes[1];

  // Format volume
  const formatCompact = (num: number) => {
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return 'Closed';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.floor(days / 7)}w`;
    return `${Math.floor(days / 30)}mo`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.002, backgroundColor: 'rgba(255,255,255,0.02)' }}
      className="flex items-center gap-4 px-4 py-3 rounded-xl border border-white/[0.06] hover:border-white/[0.1] transition-all cursor-pointer group"
    >
      {/* Platform Badge */}
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0",
        market.platform === 'polymarket'
          ? "bg-poly/20 text-poly"
          : "bg-kalshi/20 text-kalshi"
      )}>
        {market.platform === 'polymarket' ? 'PM' : 'KL'}
      </div>

      {/* Market Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-white/90 truncate group-hover:text-white transition-colors">
          {market.title}
        </h3>
        <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {formatCompact(market.volume)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(market.endDate)}
          </span>
        </div>
      </div>

      {/* Trading Buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <PriceButton
          outcome={yesOutcome}
          variant="yes"
          onClick={(e) => {
            e.stopPropagation();
            onTrade(market, yesOutcome);
          }}
        />
        <PriceButton
          outcome={noOutcome}
          variant="no"
          onClick={(e) => {
            e.stopPropagation();
            onTrade(market, noOutcome);
          }}
        />
      </div>

      {/* External Link */}
      <a
        href={market.platform === 'polymarket'
          ? `https://polymarket.com/event/${market.slug || market.platformId}`
          : `https://kalshi.com/markets/${market.platformId}`
        }
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 rounded-lg transition-all"
      >
        <ExternalLink className="w-4 h-4 text-white/40" />
      </a>
    </motion.div>
  );
}

function PriceButton({
  outcome,
  variant,
  onClick
}: {
  outcome: MarketOutcome;
  variant: 'yes' | 'no';
  onClick: (e: React.MouseEvent) => void;
}) {
  const price = Math.round(outcome.price * 100);

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "flex flex-col items-center px-4 py-2 rounded-lg border-2 transition-all min-w-[70px]",
        variant === 'yes'
          ? "border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/10"
          : "border-crimson-500/30 hover:border-crimson-500/60 hover:bg-crimson-500/10"
      )}
    >
      <span className={cn(
        "text-lg font-mono font-bold tabular-nums",
        variant === 'yes' ? "text-emerald-400" : "text-crimson-400"
      )}>
        {price}¢
      </span>
      <span className="text-[10px] text-white/40 uppercase tracking-wider">
        {outcome.name}
      </span>
    </motion.button>
  );
}
