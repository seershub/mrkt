// ============================================
// MRKT - Smart Balance Display
// Shows trading-relevant balances (Proxy USDC, Kalshi USD)
// ============================================

"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits, Address } from "viem";
import { Wallet, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { CONTRACTS, TRADING } from "@/lib/constants";
import { useDebugStore } from "@/lib/stores/debug-store";
import { ApiResponse } from "@/types";

// USDC ABI for balance check
const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

interface SmartBalanceProps {
  className?: string;
  compact?: boolean;
}

export function SmartBalance({ className, compact = false }: SmartBalanceProps) {
  const { address, isConnected } = useAccount();
  const addLog = useDebugStore((s) => s.addLog);
  const setWalletState = useDebugStore((s) => s.setWalletState);

  // State
  const [proxyAddress, setProxyAddress] = useState<string | null>(null);
  const [kalshiBalance, setKalshiBalance] = useState<number | null>(null);
  const [isLoadingProxy, setIsLoadingProxy] = useState(false);
  const [isLoadingKalshi, setIsLoadingKalshi] = useState(false);
  const [proxyError, setProxyError] = useState<string | null>(null);

  // Read USDC balance for the proxy wallet
  const { data: proxyUsdcBalanceRaw, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.USDC as Address,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: proxyAddress ? [proxyAddress as Address] : undefined,
    query: {
      enabled: !!proxyAddress,
      refetchInterval: 15000, // Refresh every 15s
    },
  });

  // Calculate balance
  const proxyUsdcBalance = proxyUsdcBalanceRaw
    ? parseFloat(formatUnits(proxyUsdcBalanceRaw as bigint, TRADING.USDC_DECIMALS))
    : 0;

  // Fetch proxy address
  useEffect(() => {
    async function fetchProxy() {
      if (!address) {
        setProxyAddress(null);
        return;
      }

      setIsLoadingProxy(true);
      setProxyError(null);

      try {
        const response = await fetch(`/api/polymarket/proxy?address=${address}`);
        const result = (await response.json()) as ApiResponse<{
          hasProxy: boolean;
          proxyAddress?: string;
          isDeployed?: boolean;
        }>;

        if (result.success && result.data?.proxyAddress) {
          setProxyAddress(result.data.proxyAddress);
          setWalletState({
            polymarketProxy: result.data.proxyAddress,
          });
        } else {
          setProxyAddress(null);
          setProxyError("No proxy wallet");
        }
      } catch (error) {
        setProxyError("Failed to fetch proxy");
        addLog({
          level: "error",
          message: "Failed to fetch proxy address",
          source: "wallet",
        });
      } finally {
        setIsLoadingProxy(false);
      }
    }

    fetchProxy();
  }, [address, addLog, setWalletState]);

  // Fetch Kalshi balance
  useEffect(() => {
    async function fetchKalshi() {
      if (!isConnected) {
        setKalshiBalance(null);
        return;
      }

      setIsLoadingKalshi(true);

      try {
        const response = await fetch("/api/kalshi/balance");
        const result = (await response.json()) as ApiResponse<{
          balance: number;
          configured: boolean;
        }>;

        if (result.success && result.data) {
          setKalshiBalance(result.data.balance);
        } else {
          setKalshiBalance(null);
        }
      } catch {
        setKalshiBalance(null);
      } finally {
        setIsLoadingKalshi(false);
      }
    }

    fetchKalshi();
  }, [isConnected]);

  // Update debug store with balance
  useEffect(() => {
    if (proxyUsdcBalance > 0) {
      setWalletState({ usdcBalance: proxyUsdcBalance });
    }
  }, [proxyUsdcBalance, setWalletState]);

  // Refresh handler
  const handleRefresh = () => {
    refetchBalance();
    // Re-fetch Kalshi
    if (isConnected) {
      fetch("/api/kalshi/balance")
        .then((r) => r.json())
        .then((result: ApiResponse<{ balance: number }>) => {
          if (result.success && result.data) {
            setKalshiBalance(result.data.balance);
          }
        })
        .catch(() => {});
    }
  };

  if (!isConnected) {
    return null;
  }

  // Compact view for header
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-800/50 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-brand-400" />
          <span className="text-xs text-neutral-300 font-mono">
            {isLoadingProxy ? "..." : formatCurrency(proxyUsdcBalance)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("p-4 bg-neutral-900/50 rounded-xl border border-neutral-800", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-medium text-neutral-200">Trading Balances</span>
        </div>
        <button
          onClick={handleRefresh}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
          title="Refresh balances"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Polymarket USDC Balance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="https://polymarket.com/icons/logo-mark.svg"
              alt="Polymarket"
              className="w-4 h-4"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="text-xs text-neutral-400">Polymarket</span>
          </div>
          <div className="flex items-center gap-2">
            {isLoadingProxy ? (
              <span className="text-xs text-neutral-500">Loading...</span>
            ) : proxyError ? (
              <div className="flex items-center gap-1 text-xs text-yellow-400">
                <AlertCircle className="w-3 h-3" />
                <span>{proxyError}</span>
              </div>
            ) : (
              <span className="text-sm font-mono text-brand-400 font-medium">
                {formatCurrency(proxyUsdcBalance)}
              </span>
            )}
          </div>
        </div>

        {/* Kalshi USD Balance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500 flex items-center justify-center text-[8px] font-bold text-white">
              K
            </div>
            <span className="text-xs text-neutral-400">Kalshi</span>
          </div>
          <div className="flex items-center gap-2">
            {isLoadingKalshi ? (
              <span className="text-xs text-neutral-500">Loading...</span>
            ) : kalshiBalance === null ? (
              <span className="text-xs text-neutral-500">Not connected</span>
            ) : (
              <span className="text-sm font-mono text-blue-400 font-medium">
                {formatCurrency(kalshiBalance)}
              </span>
            )}
          </div>
        </div>

        {/* Total */}
        <div className="pt-2 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">Total Available</span>
            <span className="text-sm font-mono text-neutral-200 font-semibold">
              {formatCurrency(proxyUsdcBalance + (kalshiBalance || 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Proxy address info */}
      {proxyAddress && (
        <div className="mt-3 pt-3 border-t border-neutral-800">
          <div className="flex items-center gap-1 text-2xs text-neutral-500">
            <CheckCircle className="w-3 h-3 text-green-400" />
            <span>Proxy: {proxyAddress.slice(0, 6)}...{proxyAddress.slice(-4)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
