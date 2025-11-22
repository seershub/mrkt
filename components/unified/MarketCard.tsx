"use client";

import { motion } from "framer-motion";
import { Clock, TrendingUp, Droplet, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatCompact, formatRelativeTime } from "@/lib/utils";
import { SPORT_CATEGORIES } from "@/lib/constants";
import { UnifiedMarket, MarketOutcome } from "@/types";

interface MarketCardProps {
  market: UnifiedMarket;
  onSelect?: (market: UnifiedMarket, outcome: MarketOutcome) => void;
  compact?: boolean;
}

// Outcome button component
function OutcomeButton({
  outcome,
  isYes,
  onClick,
}: {
  outcome: MarketOutcome;
  isYes: boolean;
  onClick: () => void;
}) {
  const probability = Math.round(outcome.price * 100);

  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center gap-1 h-auto py-3 border-2 transition-all",
        isYes
          ? "hover:bg-success-500/10 hover:border-success-500/50"
          : "hover:bg-danger-500/10 hover:border-danger-500/50"
      )}
    >
      <span
        className={cn(
          "text-lg font-bold tabular-nums",
          isYes ? "text-success-400" : "text-danger-400"
        )}
      >
        {probability}¢
      </span>
      <span className="text-xs text-neutral-400 uppercase tracking-wide">
        {outcome.name}
      </span>
    </Button>
  );
}

export function MarketCard({ market, onSelect, compact = false }: MarketCardProps) {
  const category = SPORT_CATEGORIES[market.category] || SPORT_CATEGORIES.other;

  // Get YES and NO outcomes (or first two outcomes)
  const yesOutcome = market.outcomes.find(
    (o) => o.name.toLowerCase() === "yes"
  ) || market.outcomes[0];
  const noOutcome = market.outcomes.find(
    (o) => o.name.toLowerCase() === "no"
  ) || market.outcomes[1];

  const handleOutcomeClick = (outcome: MarketOutcome) => {
    if (onSelect) {
      onSelect(market, outcome);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden card-hover group">
        <CardHeader className="pb-2">
          {/* Header row with category and status */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                <span className="mr-1">{category.icon}</span>
                {category.name}
              </Badge>
              {market.isLive && (
                <Badge variant="live" className="gap-1">
                  <span className="w-1.5 h-1.5 bg-success-400 rounded-full animate-pulse" />
                  LIVE
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Clock className="w-3.5 h-3.5" />
              {formatRelativeTime(market.endDate)}
            </div>
          </div>

          {/* Title */}
          <h3
            className={cn(
              "font-semibold text-neutral-100 leading-tight mt-2",
              compact ? "text-sm line-clamp-2" : "text-base line-clamp-3"
            )}
          >
            {market.title}
          </h3>

          {/* Platform indicator */}
          <div className="flex items-center gap-1 mt-1">
            <span
              className={cn(
                "text-2xs font-medium px-1.5 py-0.5 rounded",
                market.platform === "polymarket"
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-blue-500/20 text-blue-400"
              )}
            >
              {market.platform === "polymarket" ? "Polymarket" : "Kalshi"}
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {/* Outcome buttons */}
          {yesOutcome && noOutcome && (
            <div className="flex gap-2 mb-3">
              <OutcomeButton
                outcome={yesOutcome}
                isYes={true}
                onClick={() => handleOutcomeClick(yesOutcome)}
              />
              <OutcomeButton
                outcome={noOutcome}
                isYes={false}
                onClick={() => handleOutcomeClick(noOutcome)}
              />
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                {formatCompact(market.volume)} vol
              </span>
              <span className="flex items-center gap-1">
                <Droplet className="w-3.5 h-3.5" />
                {formatCompact(market.liquidity)} liq
              </span>
            </div>
            <a
              href={
                market.platform === "polymarket"
                  ? `https://polymarket.com/event/${market.slug || market.platformId}`
                  : `https://kalshi.com/markets/${market.platformId}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-brand-400"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
