// ============================================
// MRKT - Unified Trading Hook
// Handles both Polymarket (Web3) and Kalshi (API) trading
// ============================================

"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useSignTypedData, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits, Address, Hex } from "viem";
import { polygon } from "viem/chains";
import { CONTRACTS, TRADING } from "@/lib/constants";
import { useDebugStore } from "@/lib/stores/debug-store";
import { Platform, UnifiedMarket, MarketOutcome, ApiResponse } from "@/types";

// USDC ABI for balance and allowance checks
const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// Polymarket EIP-712 Domain
const POLYMARKET_DOMAIN = {
  name: "Polymarket CTF Exchange",
  version: "1",
  chainId: polygon.id,
  verifyingContract: CONTRACTS.POLYMARKET_EXCHANGE as Address,
} as const;

// Polymarket Order Types for EIP-712
const ORDER_TYPES = {
  Order: [
    { name: "salt", type: "uint256" },
    { name: "maker", type: "address" },
    { name: "signer", type: "address" },
    { name: "taker", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "makerAmount", type: "uint256" },
    { name: "takerAmount", type: "uint256" },
    { name: "expiration", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "feeRateBps", type: "uint256" },
    { name: "side", type: "uint8" },
    { name: "signatureType", type: "uint8" },
  ],
} as const;

// Proxy wallet status
interface ProxyStatus {
  hasProxy: boolean;
  proxyAddress?: string;
  isDeployed?: boolean;
  needsDeployment: boolean;
}

// Trade state
interface TradeState {
  isLoading: boolean;
  isCheckingProxy: boolean;
  isApproving: boolean;
  isSigning: boolean;
  isSubmitting: boolean;
  error: string | null;
  txHash?: string;
}

// Hook return type
interface UseUnifiedTradeReturn {
  // State
  tradeState: TradeState;
  proxyStatus: ProxyStatus | null;
  usdcBalance: number;
  kalshiBalance: number;

  // Actions
  checkProxyStatus: () => Promise<ProxyStatus | null>;
  deployProxy: () => Promise<string | null>;
  approveUSDC: (amount: number) => Promise<boolean>;
  executeTrade: (params: TradeParams) => Promise<TradeResult>;
  resetState: () => void;
}

interface TradeParams {
  market: UnifiedMarket;
  outcome: MarketOutcome;
  amount: number; // USD amount
  side: "buy" | "sell";
}

interface TradeResult {
  success: boolean;
  orderId?: string;
  txHash?: string;
  error?: string;
}

export function useUnifiedTrade(): UseUnifiedTradeReturn {
  const { address, isConnected } = useAccount();
  const addLog = useDebugStore((s) => s.addLog);
  const setWalletState = useDebugStore((s) => s.setWalletState);

  // State
  const [tradeState, setTradeState] = useState<TradeState>({
    isLoading: false,
    isCheckingProxy: false,
    isApproving: false,
    isSigning: false,
    isSubmitting: false,
    error: null,
  });
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [kalshiBalance, setKalshiBalance] = useState(0);

  // Wagmi hooks
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync, data: approvalTxHash } = useWriteContract();
  const { isLoading: isApprovalPending } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
  });

  // Read USDC balance for the proxy wallet
  const { data: proxyUsdcBalanceRaw } = useReadContract({
    address: CONTRACTS.USDC as Address,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: proxyStatus?.proxyAddress ? [proxyStatus.proxyAddress as Address] : undefined,
    query: {
      enabled: !!proxyStatus?.proxyAddress,
      refetchInterval: 10000,
    },
  });

  // Read USDC allowance for the exchange
  const { data: usdcAllowanceRaw } = useReadContract({
    address: CONTRACTS.USDC as Address,
    abi: USDC_ABI,
    functionName: "allowance",
    args: proxyStatus?.proxyAddress
      ? [proxyStatus.proxyAddress as Address, CONTRACTS.POLYMARKET_EXCHANGE as Address]
      : undefined,
    query: {
      enabled: !!proxyStatus?.proxyAddress,
      refetchInterval: 10000,
    },
  });

  // Calculate USDC balance in human-readable format
  const usdcBalance = proxyUsdcBalanceRaw
    ? parseFloat(formatUnits(proxyUsdcBalanceRaw as bigint, TRADING.USDC_DECIMALS))
    : 0;

  const usdcAllowance = usdcAllowanceRaw
    ? parseFloat(formatUnits(usdcAllowanceRaw as bigint, TRADING.USDC_DECIMALS))
    : 0;

  // Update debug store with balance
  useEffect(() => {
    if (proxyStatus?.proxyAddress) {
      setWalletState({
        polymarketProxy: proxyStatus.proxyAddress,
        usdcBalance,
      });
    }
  }, [proxyStatus?.proxyAddress, usdcBalance, setWalletState]);

  // Check proxy status
  const checkProxyStatus = useCallback(async (): Promise<ProxyStatus | null> => {
    if (!address) return null;

    setTradeState((s) => ({ ...s, isCheckingProxy: true, error: null }));

    try {
      addLog({
        level: "info",
        message: "Checking Polymarket proxy status",
        source: "trade",
        data: { address },
      });

      const response = await fetch(`/api/polymarket/proxy?address=${address}`);
      const result = (await response.json()) as ApiResponse<{
        hasProxy: boolean;
        proxyAddress?: string;
        isDeployed?: boolean;
      }>;

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to check proxy status");
      }

      const status: ProxyStatus = {
        hasProxy: result.data?.hasProxy ?? false,
        proxyAddress: result.data?.proxyAddress,
        isDeployed: result.data?.isDeployed,
        needsDeployment: !result.data?.hasProxy || !result.data?.isDeployed,
      };

      setProxyStatus(status);

      addLog({
        level: status.needsDeployment ? "warn" : "success",
        message: status.needsDeployment
          ? "Proxy wallet not deployed - trading on Polymarket requires deployment"
          : `Proxy wallet found: ${status.proxyAddress}`,
        source: "trade",
        data: status,
      });

      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Proxy check failed";
      setTradeState((s) => ({ ...s, error: message }));

      addLog({
        level: "error",
        message: `Proxy check failed: ${message}`,
        source: "trade",
      });

      return null;
    } finally {
      setTradeState((s) => ({ ...s, isCheckingProxy: false }));
    }
  }, [address, addLog]);

  // Deploy proxy wallet
  const deployProxy = useCallback(async (): Promise<string | null> => {
    if (!address) return null;

    setTradeState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      addLog({
        level: "info",
        message: "Requesting proxy wallet deployment",
        source: "trade",
      });

      // Sign message to authorize deployment
      const message = `Deploy Polymarket Trading Proxy for ${address}`;
      const signature = await signTypedDataAsync({
        domain: {
          name: "Polymarket",
          version: "1",
          chainId: polygon.id,
        },
        types: {
          Message: [{ name: "content", type: "string" }],
        },
        primaryType: "Message",
        message: { content: message },
      });

      // Request deployment
      const response = await fetch("/api/polymarket/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });

      const result = (await response.json()) as ApiResponse<{
        proxyAddress: string;
        txHash?: string;
      }>;

      if (!result.success) {
        throw new Error(result.error?.message || "Deployment failed");
      }

      const proxyAddress = result.data?.proxyAddress;

      setProxyStatus({
        hasProxy: true,
        proxyAddress,
        isDeployed: true,
        needsDeployment: false,
      });

      addLog({
        level: "success",
        message: `Proxy wallet deployed: ${proxyAddress}`,
        source: "trade",
        data: result.data,
      });

      return proxyAddress ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deployment failed";
      setTradeState((s) => ({ ...s, error: message }));

      addLog({
        level: "error",
        message: `Proxy deployment failed: ${message}`,
        source: "trade",
      });

      return null;
    } finally {
      setTradeState((s) => ({ ...s, isLoading: false }));
    }
  }, [address, signTypedDataAsync, addLog]);

  // Approve USDC spending
  const approveUSDC = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!proxyStatus?.proxyAddress) return false;

      setTradeState((s) => ({ ...s, isApproving: true, error: null }));

      try {
        addLog({
          level: "info",
          message: `Approving ${amount} USDC for trading`,
          source: "trade",
        });

        const amountWei = parseUnits(amount.toString(), TRADING.USDC_DECIMALS);

        await writeContractAsync({
          address: CONTRACTS.USDC as Address,
          abi: USDC_ABI,
          functionName: "approve",
          args: [CONTRACTS.POLYMARKET_EXCHANGE as Address, amountWei],
        });

        addLog({
          level: "success",
          message: "USDC approval successful",
          source: "trade",
        });

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Approval failed";
        setTradeState((s) => ({ ...s, error: message }));

        addLog({
          level: "error",
          message: `USDC approval failed: ${message}`,
          source: "trade",
        });

        return false;
      } finally {
        setTradeState((s) => ({ ...s, isApproving: false }));
      }
    },
    [proxyStatus?.proxyAddress, writeContractAsync, addLog]
  );

  // Execute trade
  const executeTrade = useCallback(
    async (params: TradeParams): Promise<TradeResult> => {
      const { market, outcome, amount, side } = params;

      if (!isConnected || !address) {
        return { success: false, error: "Wallet not connected" };
      }

      setTradeState((s) => ({ ...s, isLoading: true, error: null }));

      addLog({
        level: "info",
        message: `Initiating ${side} trade on ${market.platform}`,
        source: "trade",
        data: { market: market.id, outcome: outcome.name, amount, side },
      });

      try {
        // Route to appropriate platform handler
        if (market.platform === "polymarket") {
          return await executePolymarketTrade(params);
        } else {
          return await executeKalshiTrade(params);
        }
      } finally {
        setTradeState((s) => ({ ...s, isLoading: false }));
      }
    },
    [isConnected, address]
  );

  // Execute Polymarket trade
  const executePolymarketTrade = useCallback(
    async (params: TradeParams): Promise<TradeResult> => {
      const { market, outcome, amount, side } = params;

      // Ensure proxy is ready
      if (!proxyStatus || proxyStatus.needsDeployment) {
        return { success: false, error: "Proxy wallet not deployed. Please deploy first." };
      }

      // Check balance
      if (side === "buy" && usdcBalance < amount) {
        return {
          success: false,
          error: `Insufficient USDC balance. Have: $${usdcBalance.toFixed(2)}, Need: $${amount.toFixed(2)}`,
        };
      }

      // Check allowance
      if (side === "buy" && usdcAllowance < amount) {
        setTradeState((s) => ({ ...s, error: "Insufficient USDC allowance. Please approve first." }));
        return { success: false, error: "Insufficient USDC allowance" };
      }

      setTradeState((s) => ({ ...s, isSigning: true }));

      try {
        // Get token ID from outcome
        const tokenId = outcome.tokenId;
        if (!tokenId) {
          return { success: false, error: "Invalid market: missing token ID" };
        }

        // Calculate order amounts
        const price = outcome.price;
        const shares = amount / price;
        const sharesWei = parseUnits(shares.toFixed(TRADING.SHARE_DECIMALS), TRADING.SHARE_DECIMALS);
        const costWei = parseUnits(amount.toFixed(TRADING.USDC_DECIMALS), TRADING.USDC_DECIMALS);

        // Create order object
        const salt = Math.floor(Math.random() * 1000000000);
        const expiration = Math.floor(Date.now() / 1000) + 86400; // 24h

        const orderMessage = {
          salt: BigInt(salt),
          maker: proxyStatus.proxyAddress! as Address,
          signer: address as Address,
          taker: "0x0000000000000000000000000000000000000000" as Address,
          tokenId: BigInt(tokenId),
          makerAmount: side === "buy" ? costWei : sharesWei,
          takerAmount: side === "buy" ? sharesWei : costWei,
          expiration: BigInt(expiration),
          nonce: BigInt(0),
          feeRateBps: BigInt(0),
          side: side === "buy" ? 0 : 1,
          signatureType: 0,
        };

        addLog({
          level: "debug",
          message: "Signing EIP-712 order",
          source: "trade",
          data: { orderMessage },
        });

        // Sign the order
        const signature = await signTypedDataAsync({
          domain: POLYMARKET_DOMAIN,
          types: ORDER_TYPES,
          primaryType: "Order",
          message: orderMessage,
        });

        setTradeState((s) => ({ ...s, isSigning: false, isSubmitting: true }));

        addLog({
          level: "info",
          message: "Submitting signed order to Polymarket",
          source: "trade",
        });

        // Build the signed order object matching SDK format
        const signedOrder = {
          salt: salt.toString(),
          maker: proxyStatus.proxyAddress!,
          signer: address,
          taker: "0x0000000000000000000000000000000000000000",
          tokenId: tokenId,
          makerAmount: (side === "buy" ? costWei : sharesWei).toString(),
          takerAmount: (side === "buy" ? sharesWei : costWei).toString(),
          expiration: expiration.toString(),
          nonce: "0",
          feeRateBps: "0",
          side: side === "buy" ? 0 : 1,
          signatureType: 0,
          signature: signature,
        };

        // Submit to our API (which forwards to Polymarket with builder attribution via SDK)
        const response = await fetch("/api/polymarket/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signedOrder,
            orderType: "GTC",
            negRisk: market.negRisk || false,
          }),
        });

        const result = (await response.json()) as ApiResponse<{
          orderId: string;
          status: string;
        }>;

        if (!result.success) {
          throw new Error(result.error?.message || "Order submission failed");
        }

        addLog({
          level: "success",
          message: `Polymarket order submitted: ${result.data?.orderId}`,
          source: "trade",
          data: result.data,
        });

        return {
          success: true,
          orderId: result.data?.orderId,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Trade failed";

        addLog({
          level: "error",
          message: `Polymarket trade failed: ${message}`,
          source: "trade",
        });

        return { success: false, error: message };
      } finally {
        setTradeState((s) => ({ ...s, isSigning: false, isSubmitting: false }));
      }
    },
    [proxyStatus, usdcBalance, usdcAllowance, address, signTypedDataAsync, addLog]
  );

  // Execute Kalshi trade
  const executeKalshiTrade = useCallback(
    async (params: TradeParams): Promise<TradeResult> => {
      const { market, outcome, amount, side } = params;

      setTradeState((s) => ({ ...s, isSubmitting: true }));

      try {
        // Calculate count (number of contracts)
        const price = outcome.price * 100; // Convert to cents
        const count = Math.floor(amount / (price / 100));

        if (count < 1) {
          return { success: false, error: "Amount too small for minimum contract size" };
        }

        // Determine yes/no side based on outcome name
        const kalshiSide = outcome.name.toLowerCase() === "yes" ? "yes" : "no";

        addLog({
          level: "info",
          message: `Submitting Kalshi order: ${count} contracts`,
          source: "trade",
          data: { ticker: market.platformId, side: kalshiSide, action: side, count },
        });

        // Submit to Kalshi API
        const response = await fetch("/api/kalshi/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticker: market.platformId,
            side: kalshiSide,
            action: side,
            count,
            type: "market",
          }),
        });

        const result = (await response.json()) as ApiResponse<{
          orderId: string;
          status: string;
        }>;

        if (!result.success) {
          // Handle specific Kalshi errors
          const errorCode = result.error?.code;
          if (errorCode === "KALSHI_MOCK_MODE") {
            return { success: false, error: "Kalshi API not configured - running in demo mode" };
          }
          throw new Error(result.error?.message || "Kalshi order failed");
        }

        addLog({
          level: "success",
          message: `Kalshi order submitted: ${result.data?.orderId}`,
          source: "trade",
          data: result.data,
        });

        return {
          success: true,
          orderId: result.data?.orderId,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Trade failed";

        addLog({
          level: "error",
          message: `Kalshi trade failed: ${message}`,
          source: "trade",
        });

        return { success: false, error: message };
      } finally {
        setTradeState((s) => ({ ...s, isSubmitting: false }));
      }
    },
    [addLog]
  );

  // Fetch Kalshi balance
  const fetchKalshiBalance = useCallback(async () => {
    try {
      const response = await fetch("/api/kalshi/balance");
      const result = (await response.json()) as ApiResponse<{ balance: number }>;
      if (result.success && result.data) {
        setKalshiBalance(result.data.balance);
      }
    } catch {
      // Silently fail - Kalshi may not be configured
    }
  }, []);

  // Initial proxy check and Kalshi balance fetch
  useEffect(() => {
    if (isConnected && address) {
      checkProxyStatus();
      fetchKalshiBalance();
    }
  }, [isConnected, address, checkProxyStatus, fetchKalshiBalance]);

  // Reset state
  const resetState = useCallback(() => {
    setTradeState({
      isLoading: false,
      isCheckingProxy: false,
      isApproving: false,
      isSigning: false,
      isSubmitting: false,
      error: null,
    });
  }, []);

  return {
    tradeState,
    proxyStatus,
    usdcBalance,
    kalshiBalance,
    checkProxyStatus,
    deployProxy,
    approveUSDC,
    executeTrade,
    resetState,
  };
}
