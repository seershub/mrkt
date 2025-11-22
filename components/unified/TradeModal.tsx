"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Wallet,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { useAccount, useConnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatProbability } from "@/lib/utils";
import { useDebugStore } from "@/lib/stores/debug-store";
import { QUICK_BUY_AMOUNTS, TRADING } from "@/lib/constants";
import { UnifiedMarket, MarketOutcome, TradeQuote } from "@/types";
import { toast } from "sonner";

interface TradeModalProps {
  market: UnifiedMarket;
  outcome: MarketOutcome;
  isOpen: boolean;
  onClose: () => void;
}

// Calculate trade quote
function calculateQuote(
  outcome: MarketOutcome,
  amount: number,
  side: "buy" | "sell"
): TradeQuote {
  const price = outcome.price;
  const shares = side === "buy" ? amount / price : amount;
  const cost = side === "buy" ? amount : shares * price;
  const payout = side === "buy" ? shares * 1 : amount; // $1 per share at resolution
  const fees = cost * 0.02; // 2% fee estimate
  const profit = payout - cost - fees;
  const profitPercent = cost > 0 ? (profit / cost) * 100 : 0;

  return {
    marketId: "",
    outcomeId: outcome.id,
    side,
    amount,
    estimatedShares: shares,
    estimatedPrice: price,
    estimatedCost: cost,
    estimatedPayout: payout,
    estimatedProfit: profit,
    estimatedProfitPercent: profitPercent,
    fees,
    slippage: TRADING.DEFAULT_SLIPPAGE,
  };
}

export function TradeModal({ market, outcome, isOpen, onClose }: TradeModalProps) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const addLog = useDebugStore((s) => s.addLog);

  // State
  const [amount, setAmount] = useState<number>(10);
  const [side] = useState<"buy" | "sell">("buy");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate quote
  const quote = useMemo(() => calculateQuote(outcome, amount, side), [outcome, amount, side]);

  const isYes = outcome.name.toLowerCase() === "yes";
  const probability = Math.round(outcome.price * 100);

  // Handle amount change
  const handleAmountChange = useCallback((value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setAmount(Math.min(num, TRADING.MAX_ORDER_AMOUNT));
    }
  }, []);

  // Handle trade submission
  const handleSubmit = useCallback(async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    if (amount < TRADING.MIN_ORDER_AMOUNT) {
      toast.error(`Minimum order is ${formatCurrency(TRADING.MIN_ORDER_AMOUNT)}`);
      return;
    }

    setIsSubmitting(true);

    addLog({
      level: "info",
      message: `Placing ${side} order for ${outcome.name}`,
      data: {
        market: market.id,
        outcome: outcome.id,
        amount,
        price: outcome.price,
      },
      source: "trade",
    });

    try {
      // TODO: Implement actual trading logic
      // For now, simulate a delay and show success
      await new Promise((resolve) => setTimeout(resolve, 2000));

      addLog({
        level: "success",
        message: "Order placed successfully (simulated)",
        source: "trade",
      });

      toast.success("Order placed successfully!", {
        description: `${side === "buy" ? "Bought" : "Sold"} ${quote.estimatedShares.toFixed(2)} shares of ${outcome.name}`,
      });

      onClose();
    } catch (error) {
      addLog({
        level: "error",
        message: `Order failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        source: "trade",
      });

      toast.error("Order failed", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isConnected, openConnectModal, amount, side, outcome, market, quote, addLog, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand-400" />
                  <h2 className="text-lg font-semibold text-neutral-100">
                    Place Your Bet
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Market Title */}
                <div className="p-3 bg-neutral-800/50 rounded-lg">
                  <p className="text-sm text-neutral-400 mb-1">Betting on</p>
                  <p className="text-neutral-200 font-medium line-clamp-2">
                    {market.title}
                  </p>
                </div>

                {/* Selected Outcome */}
                <div className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg">
                  <div>
                    <p className="text-sm text-neutral-400">Your prediction</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={isYes ? "success" : "danger"}
                        className="text-base px-3 py-1"
                      >
                        {outcome.name}
                      </Badge>
                      <span className="text-neutral-300">
                        at {probability}¢ ({formatProbability(outcome.price)})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                      $
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      min={TRADING.MIN_ORDER_AMOUNT}
                      max={TRADING.MAX_ORDER_AMOUNT}
                      step="1"
                      className="w-full pl-7 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-lg font-mono text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                    />
                  </div>

                  {/* Quick Amount Buttons */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {QUICK_BUY_AMOUNTS.map((quickAmount) => (
                      <button
                        key={quickAmount}
                        onClick={() => setAmount(quickAmount)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                          amount === quickAmount
                            ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                            : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                        )}
                      >
                        ${quickAmount}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quote Summary */}
                <div className="p-4 bg-neutral-800/30 rounded-lg border border-neutral-700/50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Shares</span>
                    <span className="text-neutral-200 font-mono">
                      {quote.estimatedShares.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Avg. Price</span>
                    <span className="text-neutral-200 font-mono">
                      {(quote.estimatedPrice * 100).toFixed(1)}¢
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Est. Fees</span>
                    <span className="text-neutral-200 font-mono">
                      {formatCurrency(quote.fees)}
                    </span>
                  </div>
                  <div className="border-t border-neutral-700 pt-2 mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Total Cost</span>
                      <span className="text-neutral-100 font-semibold font-mono">
                        {formatCurrency(quote.estimatedCost + quote.fees)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-neutral-400">Potential Payout</span>
                      <span className="text-success-400 font-semibold font-mono">
                        {formatCurrency(quote.estimatedPayout)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-neutral-400">Potential Profit</span>
                      <span
                        className={cn(
                          "font-semibold font-mono",
                          quote.estimatedProfit > 0
                            ? "text-success-400"
                            : "text-danger-400"
                        )}
                      >
                        {formatCurrency(quote.estimatedProfit)} (
                        {quote.estimatedProfitPercent > 0 ? "+" : ""}
                        {quote.estimatedProfitPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 p-3 bg-warning-500/10 border border-warning-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-warning-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warning-400">
                    Trading involves risk. Only bet what you can afford to lose.
                    This is a demo - no real trades will be executed.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-4 border-t border-neutral-800">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || amount < TRADING.MIN_ORDER_AMOUNT}
                  className="flex-1 gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Placing...
                    </>
                  ) : !isConnected ? (
                    <>
                      <Wallet className="w-4 h-4" />
                      Connect Wallet
                    </>
                  ) : (
                    <>
                      Place Bet
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
