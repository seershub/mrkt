"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Wallet,
  TrendingUp,
  ArrowRight,
  Shield,
  RefreshCw,
} from "lucide-react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatProbability } from "@/lib/utils";
import { useDebugStore } from "@/lib/stores/debug-store";
import { QUICK_BUY_AMOUNTS, TRADING } from "@/lib/constants";
import { UnifiedMarket, MarketOutcome, TradeQuote } from "@/types";
import { useUnifiedTrade } from "@/hooks/useUnifiedTrade";
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
  const payout = side === "buy" ? shares * 1 : amount;
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

  // Trade hook
  const {
    tradeState,
    proxyStatus,
    usdcBalance,
    kalshiBalance,
    checkProxyStatus,
    deployProxy,
    approveUSDC,
    executeTrade,
    resetState,
  } = useUnifiedTrade();

  // State
  const [amount, setAmount] = useState<number>(10);
  const [side] = useState<"buy" | "sell">("buy");

  // Calculate quote
  const quote = useMemo(() => calculateQuote(outcome, amount, side), [outcome, amount, side]);

  const isYes = outcome.name.toLowerCase() === "yes";
  const probability = Math.round(outcome.price * 100);

  // Determine available balance based on platform
  const availableBalance = market.platform === "polymarket" ? usdcBalance : kalshiBalance;
  const hasInsufficientBalance = side === "buy" && amount > availableBalance;

  // Determine if proxy deployment is needed (Polymarket only)
  // Only show deployment warning if we've confirmed the proxy is NOT deployed
  const needsProxyDeployment =
    market.platform === "polymarket" &&
    proxyStatus !== null &&
    !proxyStatus.isDeployed &&
    proxyStatus.needsDeployment;

  // Show proxy status if we're still checking (Polymarket only)
  const isCheckingProxy =
    market.platform === "polymarket" &&
    (proxyStatus === null || tradeState.isCheckingProxy);

  // Check if any loading state is active
  const isLoading =
    tradeState.isLoading ||
    tradeState.isCheckingProxy ||
    tradeState.isApproving ||
    tradeState.isSigning ||
    tradeState.isSubmitting;

  // Handle amount change
  const handleAmountChange = useCallback((value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setAmount(Math.min(num, TRADING.MAX_ORDER_AMOUNT));
    }
  }, []);

  // Handle proxy deployment
  const handleDeployProxy = useCallback(async () => {
    const result = await deployProxy();
    if (result) {
      toast.success("Proxy wallet deployed!", {
        description: "You can now trade on Polymarket",
      });
    } else {
      toast.error("Deployment failed", {
        description: tradeState.error || "Please try again",
      });
    }
  }, [deployProxy, tradeState.error]);

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

    if (hasInsufficientBalance) {
      toast.error("Insufficient balance", {
        description: `You have ${formatCurrency(availableBalance)} but need ${formatCurrency(amount)}`,
      });
      return;
    }

    // Execute the trade
    const result = await executeTrade({
      market,
      outcome,
      amount,
      side,
    });

    if (result.success) {
      toast.success("Order placed successfully!", {
        description: `${side === "buy" ? "Bought" : "Sold"} ${quote.estimatedShares.toFixed(2)} shares of ${outcome.name}`,
      });
      onClose();
    } else {
      toast.error("Order failed", {
        description: result.error || "Please try again",
      });
    }
  }, [
    isConnected,
    openConnectModal,
    amount,
    hasInsufficientBalance,
    availableBalance,
    executeTrade,
    market,
    outcome,
    side,
    quote.estimatedShares,
    onClose,
  ]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      resetState();
      setAmount(10);
    }
  }, [isOpen, resetState]);

  // Refresh proxy status on open
  useEffect(() => {
    if (isOpen && isConnected && market.platform === "polymarket") {
      checkProxyStatus();
    }
  }, [isOpen, isConnected, market.platform, checkProxyStatus]);

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

          {/* Modal Container - Centers modal in viewport */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-md max-h-[90vh] overflow-y-auto pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand-400" />
                  <h2 className="text-lg font-semibold text-neutral-100">
                    Place Your Bet
                  </h2>
                  <Badge variant={market.platform === "polymarket" ? "default" : "secondary"}>
                    {market.platform === "polymarket" ? "Poly" : "Kalshi"}
                  </Badge>
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

                {/* Balance Display */}
                <div className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-lg border border-neutral-700/50">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm text-neutral-400">Available Balance</span>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-mono font-medium",
                      hasInsufficientBalance ? "text-red-400" : "text-brand-400"
                    )}
                  >
                    {formatCurrency(availableBalance)}
                  </span>
                </div>

                {/* Checking Proxy Status (Polymarket only) */}
                {isCheckingProxy && (
                  <div className="p-3 bg-neutral-800/50 border border-neutral-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                      <p className="text-sm text-neutral-400">
                        Checking proxy wallet status...
                      </p>
                    </div>
                  </div>
                )}

                {/* Proxy Wallet Already Deployed (Polymarket only) */}
                {market.platform === "polymarket" &&
                  proxyStatus?.isDeployed &&
                  proxyStatus.proxyAddress && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-emerald-400">
                            Proxy Wallet Ready
                          </p>
                          <p className="text-xs text-emerald-400/80 mt-1 font-mono">
                            {proxyStatus.proxyAddress.slice(0, 6)}...{proxyStatus.proxyAddress.slice(-4)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Proxy Deployment Warning (Polymarket only) */}
                {needsProxyDeployment && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-400">
                          Proxy Wallet Required
                        </p>
                        <p className="text-xs text-yellow-400/80 mt-1">
                          Polymarket requires a proxy wallet for trading. Deploy one to continue.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDeployProxy}
                          disabled={isLoading}
                          className="mt-2 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                        >
                          {tradeState.isLoading ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              Deploying...
                            </>
                          ) : (
                            <>
                              <Shield className="w-3 h-3 mr-1" />
                              Deploy Proxy Wallet
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount Input */}
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">
                    Amount ({market.platform === "polymarket" ? "USDC" : "USD"})
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
                      className={cn(
                        "w-full pl-7 pr-4 py-3 bg-neutral-800 border rounded-lg text-lg font-mono text-neutral-200",
                        "focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500",
                        hasInsufficientBalance
                          ? "border-red-500/50"
                          : "border-neutral-700"
                      )}
                    />
                  </div>

                  {/* Insufficient balance warning */}
                  {hasInsufficientBalance && (
                    <p className="text-xs text-red-400 mt-1">
                      Insufficient balance. You need {formatCurrency(amount - availableBalance)} more.
                    </p>
                  )}

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
                            : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200",
                          quickAmount > availableBalance && "opacity-50"
                        )}
                      >
                        ${quickAmount}
                      </button>
                    ))}
                    {/* Max button */}
                    <button
                      onClick={() => setAmount(Math.floor(availableBalance))}
                      disabled={availableBalance < TRADING.MIN_ORDER_AMOUNT}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-50"
                    >
                      Max
                    </button>
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

                {/* Error Display */}
                {tradeState.error && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400">{tradeState.error}</p>
                  </div>
                )}

                {/* Info Notice */}
                <div className="flex items-start gap-2 p-3 bg-neutral-800/30 border border-neutral-700/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-neutral-500">
                    Trading involves risk. Only bet what you can afford to lose.
                    {market.platform === "polymarket" && " Orders are signed with your wallet."}
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
                  disabled={
                    isLoading ||
                    amount < TRADING.MIN_ORDER_AMOUNT ||
                    hasInsufficientBalance ||
                    needsProxyDeployment
                  }
                  className="flex-1 gap-2"
                >
                  {tradeState.isSigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing...
                    </>
                  ) : tradeState.isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
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
