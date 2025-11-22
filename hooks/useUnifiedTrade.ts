// ============================================
// MRKT - Unified Trading Hook
// Handles both Polymarket (Web3) and Kalshi (API) trading
// ============================================

"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useSignTypedData, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits, Address, Hex } from "viem";
import { polygon } from "viem/chains";
import { CONTRACTS, TRADING, API_ENDPOINTS, APPROVAL_TARGETS } from "@/lib/constants";

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

  // Read USDC allowance for the CTF (Conditional Tokens Framework)
  // Per Polymarket docs: USDC must be approved to CTF, not the Exchange
  const { data: usdcAllowanceRaw } = useReadContract({
    address: CONTRACTS.USDC as Address,
    abi: USDC_ABI,
    functionName: "allowance",
    args: proxyStatus?.proxyAddress
      ? [proxyStatus.proxyAddress as Address, APPROVAL_TARGETS.STANDARD as Address]
      : undefined,
    query: {
      enabled: !!proxyStatus?.proxyAddress,
      refetchInterval: 10000,
    },
  });

  // Also check Neg Risk Adapter allowance for neg risk markets
  const { data: negRiskAllowanceRaw } = useReadContract({
    address: CONTRACTS.USDC as Address,
    abi: USDC_ABI,
    functionName: "allowance",
    args: proxyStatus?.proxyAddress
      ? [proxyStatus.proxyAddress as Address, APPROVAL_TARGETS.NEG_RISK as Address]
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

  const negRiskAllowance = negRiskAllowanceRaw
    ? parseFloat(formatUnits(negRiskAllowanceRaw as bigint, TRADING.USDC_DECIMALS))
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
  // NOTE: Browser wallets cannot deploy directly - must use Polymarket first
  const deployProxy = useCallback(async (): Promise<string | null> => {
    if (!address) return null;

    setTradeState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      addLog({
        level: "info",
        message: "Checking proxy wallet deployment options",
        source: "trade",
      });

      // For browser wallets, we can't deploy directly - redirect to Polymarket
      // This is because deployment requires SDK with private key access
      const response = await fetch("/api/polymarket/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      const result = (await response.json()) as ApiResponse<{
        proxyAddress?: string;
        requiresPolymarket?: boolean;
        polymarketUrl?: string;
        message?: string;
      }>;

      // Check if user needs to go to Polymarket
      if (result.data?.requiresPolymarket || result.error?.code === "BROWSER_WALLET_DEPLOYMENT") {
        const errorMsg = "To trade on Polymarket, you need a Safe wallet. Please visit polymarket.com to set up your account first, then return here to trade.";

        addLog({
          level: "warn",
          message: errorMsg,
          source: "trade",
          data: { polymarketUrl: "https://polymarket.com" },
        });

        setTradeState((s) => ({ ...s, error: errorMsg }));

        // Open Polymarket in new tab
        window.open("https://polymarket.com", "_blank");

        return null;
      }

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
        message: `Safe wallet deployed: ${proxyAddress}`,
        source: "trade",
        data: result.data,
      });

      return proxyAddress ?? null;
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
  }, [address, addLog]);

  // Approve USDC spending
  // NOTE: For Polymarket, USDC approval must be done THROUGH the Safe wallet to CTF
  // Browser wallets cannot execute Safe transactions directly - need server-side
  // or user must approve via Polymarket web app
  const approveUSDC = useCallback(
    async (amount: number, isNegRisk: boolean = false): Promise<boolean> => {
      if (!proxyStatus?.proxyAddress) {
        addLog({
          level: "error",
          message: "No Safe wallet found. Please set up your account on Polymarket first.",
          source: "trade",
        });
        return false;
      }

      setTradeState((s) => ({ ...s, isApproving: true, error: null }));

      try {
        // Check current allowance
        const currentAllowance = isNegRisk ? negRiskAllowance : usdcAllowance;
        const approvalTarget = isNegRisk ? APPROVAL_TARGETS.NEG_RISK : APPROVAL_TARGETS.STANDARD;

        if (currentAllowance >= amount) {
          addLog({
            level: "info",
            message: `USDC already approved (${currentAllowance.toFixed(2)} >= ${amount})`,
            source: "trade",
          });
          return true;
        }

        addLog({
          level: "info",
          message: `Requesting USDC approval for ${isNegRisk ? "Neg Risk Adapter" : "CTF"}`,
          source: "trade",
          data: { amount, target: approvalTarget, currentAllowance },
        });

        // For browser wallets, approval must be done through Safe
        // This requires server-side execution or Polymarket web app
        // For now, we call our API to execute the Safe transaction
        const response = await fetch("/api/polymarket/safe/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerAddress: address,
            proxyAddress: proxyStatus.proxyAddress,
            transactions: [
              {
                type: "approval",
                tokenAddress: CONTRACTS.USDC,
                spenderAddress: approvalTarget,
                amount: "max", // Approve max for convenience
              },
            ],
          }),
        });

        const result = await response.json();

        if (!result.success) {
          // If server can't execute, guide user to Polymarket
          if (result.error?.code === "REQUIRES_POLYMARKET") {
            const errorMsg = "USDC approval must be done through your Safe wallet. Please visit Polymarket to approve USDC for trading.";
            addLog({
              level: "warn",
              message: errorMsg,
              source: "trade",
            });
            setTradeState((s) => ({ ...s, error: errorMsg }));
            window.open("https://polymarket.com", "_blank");
            return false;
          }
          throw new Error(result.error?.message || "Approval failed");
        }

        addLog({
          level: "success",
          message: "USDC approval successful",
          source: "trade",
          data: result.data,
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
    [proxyStatus?.proxyAddress, address, usdcAllowance, negRiskAllowance, addLog]
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

      // Check allowance - use correct target based on market type
      const requiredAllowance = market.negRisk ? negRiskAllowance : usdcAllowance;
      const approvalTarget = market.negRisk ? "Neg Risk Adapter" : "CTF";

      if (side === "buy" && requiredAllowance < amount) {
        const errorMsg = `Insufficient USDC allowance on ${approvalTarget}. Current: $${requiredAllowance.toFixed(2)}, Need: $${amount.toFixed(2)}. Please approve USDC on Polymarket first.`;
        setTradeState((s) => ({ ...s, error: errorMsg }));
        addLog({
          level: "warn",
          message: errorMsg,
          source: "trade",
          data: { requiredAllowance, amount, approvalTarget },
        });
        return { success: false, error: errorMsg };
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

        // Determine exchange contract based on negRisk
        // Per docs: negRisk markets use POLYMARKET_NEG_RISK_EXCHANGE
        const exchangeContract = market.negRisk
          ? CONTRACTS.POLYMARKET_NEG_RISK_EXCHANGE
          : CONTRACTS.POLYMARKET_EXCHANGE;

        // Create order object
        const salt = Math.floor(Math.random() * 1000000000);
        const expiration = Math.floor(Date.now() / 1000) + 86400; // 24h

        // Per docs: When using proxy wallet with browser wallet (MetaMask),
        // use POLY_GNOSIS_SAFE (type 2) signature type
        const signatureType = SIGNATURE_TYPE.POLY_GNOSIS_SAFE;

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
          signatureType: signatureType,
        };

        // Get correct domain for this market type
        const domain = getPolymarketDomain(market.negRisk ?? false);

        addLog({
          level: "debug",
          message: "Signing EIP-712 order",
          source: "trade",
          data: { orderMessage, domain, exchangeContract },
        });

        // Sign the order with correct domain
        const signature = await signTypedDataAsync({
          domain,
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
        // Per docs: signatureType must match wallet type
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
          signatureType: signatureType, // Type 2 for POLY_GNOSIS_SAFE
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
    [proxyStatus, usdcBalance, usdcAllowance, negRiskAllowance, address, signTypedDataAsync, addLog]
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
