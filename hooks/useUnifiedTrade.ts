// ============================================
// MRKT - Unified Trading Hook
// Handles both Polymarket (Web3) and Kalshi (API) trading
// ============================================

"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useSignTypedData, useReadContract, useWalletClient } from "wagmi";
import { parseUnits, formatUnits, Address } from "viem";
import { polygon } from "viem/chains";
import { CONTRACTS, TRADING, APPROVAL_TARGETS } from "@/lib/constants";
import { usePolymarketSafe } from "./usePolymarketSafe";

// Polymarket Signature Types per docs
// https://docs.polymarket.com/developers/clob-api/authentication
const SIGNATURE_TYPE = {
  EOA: 0, // Trading directly from EOA (no proxy)
  POLY_PROXY: 1, // MagicLink/email users with proxy
  POLY_GNOSIS_SAFE: 2, // MetaMask/browser wallet users with proxy
} as const;
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

// Polymarket EIP-712 Domain (use function to handle negRisk markets)
// Per docs: negRisk markets use Neg Risk CTF Exchange
function getPolymarketDomain(isNegRisk: boolean = false) {
  return {
    name: "Polymarket CTF Exchange",
    version: "1",
    chainId: polygon.id,
    verifyingContract: (isNegRisk
      ? CONTRACTS.POLYMARKET_NEG_RISK_EXCHANGE
      : CONTRACTS.POLYMARKET_EXCHANGE) as Address,
  } as const;
}

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
  const { data: walletClient } = useWalletClient();

  // Use Polymarket Safe hook for Safe operations
  const {
    safeStatus,
    isDeploying,
    isApproving: isSafeApproving,
    deploySafe,
    approveUSDC: approveSafeUSDC,
    checkSafeStatus,
  } = usePolymarketSafe();

  // Read USDC balance for the Safe wallet
  const { data: proxyUsdcBalanceRaw } = useReadContract({
    address: CONTRACTS.USDC as Address,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: safeStatus.proxyAddress ? [safeStatus.proxyAddress as Address] : undefined,
    query: {
      enabled: !!safeStatus.proxyAddress,
      refetchInterval: 10000,
    },
  });

  // Read USDC allowance for the CTF (Conditional Tokens Framework)
  // Per Polymarket docs: USDC must be approved to CTF, not the Exchange
  const { data: usdcAllowanceRaw } = useReadContract({
    address: CONTRACTS.USDC as Address,
    abi: USDC_ABI,
    functionName: "allowance",
    args: safeStatus.proxyAddress
      ? [safeStatus.proxyAddress as Address, APPROVAL_TARGETS.STANDARD as Address]
      : undefined,
    query: {
      enabled: !!safeStatus.proxyAddress,
      refetchInterval: 10000,
    },
  });

  // Also check Neg Risk Adapter allowance for neg risk markets
  const { data: negRiskAllowanceRaw } = useReadContract({
    address: CONTRACTS.USDC as Address,
    abi: USDC_ABI,
    functionName: "allowance",
    args: safeStatus.proxyAddress
      ? [safeStatus.proxyAddress as Address, APPROVAL_TARGETS.NEG_RISK as Address]
      : undefined,
    query: {
      enabled: !!safeStatus.proxyAddress,
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

  const negRiskAllowance = negRiskAllowanceRaw
    ? parseFloat(formatUnits(negRiskAllowanceRaw as bigint, TRADING.USDC_DECIMALS))
    : 0;

  // Sync proxyStatus with safeStatus for backwards compatibility
  useEffect(() => {
    if (safeStatus.isDeployed && safeStatus.proxyAddress) {
      setProxyStatus({
        hasProxy: true,
        proxyAddress: safeStatus.proxyAddress,
        isDeployed: true,
        needsDeployment: false,
      });
    } else if (!safeStatus.isLoading) {
      setProxyStatus({
        hasProxy: false,
        proxyAddress: undefined,
        isDeployed: false,
        needsDeployment: true,
      });
    }
  }, [safeStatus]);

  // Update debug store with balance
  useEffect(() => {
    if (safeStatus.proxyAddress) {
      setWalletState({
        polymarketProxy: safeStatus.proxyAddress,
        usdcBalance,
      });
    }
  }, [safeStatus.proxyAddress, usdcBalance, setWalletState]);

  // Check proxy/Safe status - uses usePolymarketSafe hook
  const checkProxyStatus = useCallback(async (): Promise<ProxyStatus | null> => {
    if (!address) return null;

    setTradeState((s) => ({ ...s, isCheckingProxy: true, error: null }));

    try {
      const isDeployed = await checkSafeStatus();

      const status: ProxyStatus = {
        hasProxy: isDeployed,
        proxyAddress: safeStatus.proxyAddress,
        isDeployed: isDeployed,
        needsDeployment: !isDeployed,
      };

      setProxyStatus(status);
      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Status check failed";
      setTradeState((s) => ({ ...s, error: message }));
      return null;
    } finally {
      setTradeState((s) => ({ ...s, isCheckingProxy: false }));
    }
  }, [address, checkSafeStatus, safeStatus.proxyAddress]);

  // Deploy Safe wallet - gasless via Relayer (no redirect to Polymarket!)
  const deployProxy = useCallback(async (): Promise<string | null> => {
    if (!address) return null;

    setTradeState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      addLog({
        level: "info",
        message: "Deploying Safe wallet for trading...",
        source: "trade",
      });

      // Use the Safe hook to deploy - this handles signing and relayer submission
      const proxyAddress = await deploySafe();

      if (proxyAddress) {
        // Immediately update proxyStatus
        setProxyStatus({
          hasProxy: true,
          proxyAddress,
          isDeployed: true,
          needsDeployment: false,
        });

        addLog({
          level: "success",
          message: `Safe wallet deployed: ${proxyAddress}`,
          source: "trade",
        });

        return proxyAddress;
      }

      // Always refresh status after deploy attempt
      await checkSafeStatus();
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deployment failed";
      setTradeState((s) => ({ ...s, error: message }));

      addLog({
        level: "error",
        message: `Safe deployment failed: ${message}`,
        source: "trade",
      });

      return null;
    } finally {
      setTradeState((s) => ({ ...s, isLoading: false }));
    }
  }, [address, deploySafe, checkSafeStatus, addLog]);

  // Approve USDC spending - gasless via Relayer (no redirect to Polymarket!)
  const approveUSDC = useCallback(
    async (amount: number, isNegRisk: boolean = false): Promise<boolean> => {
      if (!safeStatus.proxyAddress) {
        addLog({
          level: "error",
          message: "No Safe wallet found. Please deploy your Safe first.",
          source: "trade",
        });
        return false;
      }

      setTradeState((s) => ({ ...s, isApproving: true, error: null }));

      try {
        // Check current allowance
        const currentAllowance = isNegRisk ? negRiskAllowance : usdcAllowance;
        const targetName = isNegRisk ? "Neg Risk Adapter" : "CTF";

        if (currentAllowance >= amount) {
          addLog({
            level: "info",
            message: `USDC already approved for ${targetName} (${currentAllowance.toFixed(2)} >= ${amount})`,
            source: "trade",
          });
          return true;
        }

        addLog({
          level: "info",
          message: `Approving USDC for ${targetName}...`,
          source: "trade",
          data: { amount, isNegRisk, currentAllowance },
        });

        // Use the Safe hook for gasless approval
        const success = await approveSafeUSDC(isNegRisk);

        if (success) {
          addLog({
            level: "success",
            message: `USDC approved for ${targetName}!`,
            source: "trade",
          });
        }

        return success;
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
    [safeStatus.proxyAddress, usdcAllowance, negRiskAllowance, approveSafeUSDC, addLog]
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

      // 1. Prerequisites check
      if (!safeStatus.isDeployed || !safeStatus.proxyAddress) {
        return {
          success: false,
          error: "Safe wallet not deployed. Please click 'Deploy Proxy Wallet' first."
        };
      }

      // 2. Token ID validation
      const tokenId = outcome.tokenId;
      if (!tokenId || tokenId === '0' || tokenId === '') {
        addLog({
          level: "error",
          message: "Invalid token ID",
          data: { tokenId, outcome },
          source: "trade",
        });
        return {
          success: false,
          error: "Invalid market: missing token ID. This market may not support trading yet."
        };
      }

      // 3. Balance check
      if (side === "buy" && usdcBalance < amount) {
        return {
          success: false,
          error: `Insufficient USDC. Have: $${usdcBalance.toFixed(2)}, Need: $${amount.toFixed(2)}. Deposit USDC to your Safe wallet: ${safeStatus.proxyAddress}`,
        };
      }

      // 4. Allowance check
      const isNegRisk = market.negRisk ?? false;
      const requiredAllowance = isNegRisk ? negRiskAllowance : usdcAllowance;

      if (side === "buy" && requiredAllowance < amount) {
        const targetName = isNegRisk ? "Neg Risk Adapter" : "Conditional Token Framework";

        addLog({
          level: "warn",
          message: `Insufficient allowance on ${targetName}`,
          data: { requiredAllowance, amount },
          source: "trade",
        });

        // Auto-approve
        setTradeState(s => ({ ...s, isApproving: true }));
        const approved = await approveSafeUSDC(isNegRisk);
        setTradeState(s => ({ ...s, isApproving: false }));

        if (!approved) {
          return {
            success: false,
            error: `Failed to approve USDC for ${targetName}. Please try again.`
          };
        }

        // Wait for allowance update
        await new Promise(r => setTimeout(r, 3000));
      }

      // 5. Minimum order size check
      const minSize = market.minOrderSize || 1;
      if (amount < minSize) {
        return {
          success: false,
          error: `Minimum order size is $${minSize}`
        };
      }

      setTradeState((s) => ({ ...s, isSigning: true }));

      try {
        // 6. Calculate order amounts
        const price = outcome.price;
        const shares = amount / price;
        const sharesWei = parseUnits(shares.toFixed(6), 6);
        const costWei = parseUnits(amount.toFixed(6), 6);

        // 7. Create order
        const salt = Math.floor(Math.random() * 2147483647); // Int32 max
        const expiration = Math.floor(Date.now() / 1000) + 86400;

        const orderMessage = {
          salt: BigInt(salt),
          maker: safeStatus.proxyAddress as Address,
          signer: address as Address,
          taker: "0x0000000000000000000000000000000000000000" as Address,
          tokenId: BigInt(tokenId),
          makerAmount: side === "buy" ? costWei : sharesWei,
          takerAmount: side === "buy" ? sharesWei : costWei,
          expiration: BigInt(expiration),
          nonce: BigInt(0),
          feeRateBps: BigInt(0),
          side: side === "buy" ? 0 : 1,
          signatureType: 2, // POLY_GNOSIS_SAFE for browser wallets
        };

        const domain = getPolymarketDomain(isNegRisk);

        addLog({
          level: "debug",
          message: "Signing order",
          data: {
            tokenId,
            amount,
            side,
            isNegRisk,
            domain: domain.verifyingContract
          },
          source: "trade",
        });

        // 8. Sign
        const signature = await signTypedDataAsync({
          domain,
          types: ORDER_TYPES,
          primaryType: "Order",
          message: orderMessage,
        });

        setTradeState((s) => ({ ...s, isSigning: false, isSubmitting: true }));

        // 9. Submit
        const signedOrder = {
          salt: salt.toString(),
          maker: safeStatus.proxyAddress!,
          signer: address,
          taker: "0x0000000000000000000000000000000000000000",
          tokenId: tokenId,
          makerAmount: (side === "buy" ? costWei : sharesWei).toString(),
          takerAmount: (side === "buy" ? sharesWei : costWei).toString(),
          expiration: expiration.toString(),
          nonce: "0",
          feeRateBps: "0",
          side: side === "buy" ? 0 : 1,
          signatureType: 2,
          signature: signature,
        };

        const response = await fetch("/api/polymarket/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signedOrder,
            orderType: "GTC",
            negRisk: isNegRisk,
          }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "Order submission failed");
        }

        addLog({
          level: "success",
          message: `Order placed: ${result.data?.orderId}`,
          source: "trade",
        });

        return {
          success: true,
          orderId: result.data?.orderId,
        };

      } catch (error) {
        const message = error instanceof Error ? error.message : "Trade failed";

        addLog({
          level: "error",
          message: `Trade failed: ${message}`,
          source: "trade",
        });

        return { success: false, error: message };
      } finally {
        setTradeState((s) => ({ ...s, isSigning: false, isSubmitting: false }));
      }
    },
    [safeStatus, usdcBalance, usdcAllowance, negRiskAllowance, address, signTypedDataAsync, approveSafeUSDC, addLog]
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

  // Initial Kalshi balance fetch (Safe status is handled by usePolymarketSafe hook)
  useEffect(() => {
    if (isConnected && address) {
      fetchKalshiBalance();
    }
  }, [isConnected, address, fetchKalshiBalance]);

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
