"use client";

import { UnifiedMarket } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SPORT_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

interface MarketCardProps {
  market: UnifiedMarket;
}

export function MarketCard({ market }: MarketCardProps) {
  const category = SPORT_CATEGORIES[market.category] || SPORT_CATEGORIES.other;
  const yesOutcome = market.outcomes.find((o) => o.id.includes("yes"));
  const noOutcome = market.outcomes.find((o) => o.id.includes("no"));

  const yesPrice = yesOutcome ? Math.round(yesOutcome.price * 100) : 50;
  const noPrice = noOutcome ? Math.round(noOutcome.price * 100) : 50;

  return (
    <Link href={`/market/${market.id}`}>
      <motion.div
        whileHover={{ y: -5 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="h-full overflow-hidden border-white/10 bg-white/5 backdrop-blur-sm hover:border-white/20 hover:bg-white/10 transition-all duration-300 group">
          {/* Header Image/Gradient */}
          <div className="h-32 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-500"
              style={{ backgroundColor: category.color }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />

            <div className="absolute top-3 left-3 flex gap-2">
              <Badge variant="secondary" className="bg-black/40 backdrop-blur-md border-white/10 text-white">
                <span className="mr-1">{category.icon}</span>
                {category.name}
              </Badge>
              {market.platform === "polymarket" && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                  Polymarket
                </Badge>
              )}
              {market.platform === "kalshi" && (
                <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                  Kalshi
                </Badge>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-5 -mt-12 relative z-10">
            <h3 className="text-lg font-semibold leading-tight mb-2 line-clamp-2 min-h-[3rem] text-white group-hover:text-blue-200 transition-colors">
              {market.title}
            </h3>

            {/* Outcomes */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button
                variant="outline"
                className="h-12 flex justify-between items-center bg-green-500/5 border-green-500/20 hover:bg-green-500/10 hover:border-green-500/40 group/yes"
              >
                <span className="text-green-400 font-medium">Yes</span>
                <span className="text-lg font-bold text-white group-hover/yes:text-green-300">
                  {yesPrice}%
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-12 flex justify-between items-center bg-red-500/5 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 group/no"
              >
                <span className="text-red-400 font-medium">No</span>
                <span className="text-lg font-bold text-white group-hover/no:text-red-300">
                  {noPrice}%
                </span>
              </Button>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>Vol: ${(market.volume || 0).toLocaleString()}</span>
              </div>
              <span>{new Date(market.endDate).toLocaleDateString()}</span>
            </div>
          </div>
        </Card>
      </motion.div>
    </Link>
  );
}
