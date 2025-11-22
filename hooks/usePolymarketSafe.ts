// ============================================
// MRKT - Polymarket Safe Wallet Hook
// Client-side RelayClient with Remote Builder Signing
// Per SDK docs: RelayClient runs in browser with user's signer
// ============================================

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  RelayClient,
  SafeTransaction,
  OperationType,
  RelayerTransactionState,
} from "@polymarket/builder-relayer-client";
import { BuilderConfig } from "@polymarket/builder-signing-sdk";
import { CONTRACTS, APPROVAL_TARGETS } from "@/lib/constants";
import { useDebugStore } from "@/lib/stores/debug-store";

// ============================================
// Configuration per Polymarket Documentation
// ============================================

// V2 Relayer URL (per official docs)
const POLY_RELAYER_URL = "https://relayer-v2.polymarket.com";

// Polygon Mainnet chain ID
const CHAIN_ID = 137;

// Remote builder signing server URL (our API endpoint)
// Per SDK: BuilderConfig.remoteBuilderConfig.url
// Note: SDK requires full URL (http:// or https://), not relative path
const getBuilderSigningUrl = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/polymarket/builder-sign`;
  }
  // Fallback for SSR (shouldn't be used in practice)
  return "https://mrkt.seershub.com/api/polymarket/builder-sign";
};

// ============================================
// Types
// ============================================

interface SafeStatus {
  isDeployed: boolean;
  proxyAddress?: string;
  isLoading: boolean;
  error: string | null;
}

interface UsePolymarketSafeReturn {
  safeStatus: SafeStatus;
  isDeploying: boolean;
  isApproving: boolean;
  deploySafe: () => Promise<string | null>;
  approveUSDC: (isNegRisk?: boolean) => Promise<boolean>;
  checkSafeStatus: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

// ============================================
// Hook Implementation
// ============================================

export function usePolymarketSafe(): UsePolymarketSafeReturn {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
  const addLog = useDebugStore((s) => s.addLog);

  // State
  const [safeStatus, setSafeStatus] = useState<SafeStatus>({
    isDeployed: false,
    proxyAddress: undefined,
    isLoading: true,
    error: null,
  });
  const [isDeploying, setIsDeploying] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // ============================================
  // Initialize RelayClient
  // Per SDK: RelayClient(relayerUrl, chainId, signer, builderConfig)
  // SDK accepts WalletClient directly via createAbstractSigner
  // ============================================
  const relayClient = useMemo(() => {
    if (!walletClient) return null;

    try {
      // Per SDK docs: Use remoteBuilderConfig for HMAC signing
      // The SDK will POST to our /api/polymarket/builder-sign endpoint
      // to generate HMAC headers for each authenticated request
      const builderSigningUrl = getBuilderSigningUrl();
      console.log("[MRKT] Builder signing URL:", builderSigningUrl);

      const builderConfig = new BuilderConfig({
        remoteBuilderConfig: {
          url: builderSigningUrl,
          // token is optional - for additional auth
        },
      });

      // Per SDK: RelayClient accepts viem WalletClient directly
      // The SDK uses createAbstractSigner internally to convert
      const client = new RelayClient(
        POLY_RELAYER_URL,
        CHAIN_ID,
        walletClient,
        builderConfig
      );

      console.log("[MRKT] RelayClient initialized with remote signing");
      return client;
    } catch (error) {
      console.error("[MRKT] Failed to initialize RelayClient:", error);
      return null;
    }
  }, [walletClient]);

  // ============================================
  // Check Safe Deployment Status
  // Per SDK: GET /deployed?address=<address>
  // ============================================
  const checkSafeStatus = useCallback(async (): Promise<boolean> => {
    if (!address) return false;

    setSafeStatus((s) => ({ ...s, isLoading: true, error: null }));

    try {
      addLog({
        level: "info",
        message: "Checking Safe wallet status...",
        source: "safe",
      });

      // Per SDK: /deployed endpoint returns { deployed: boolean }
      const response = await fetch(
        `${POLY_RELAYER_URL}/deployed?address=${address}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Relayer returned ${response.status}`);
      }

      const data = await response.json();
      const isDeployed = data.deployed === true;

      // If deployed, get proxy address from nonce endpoint
      let proxyAddress: string | undefined;
      if (isDeployed) {
        try {
          // Per SDK: /nonce?address=<address>&signerType=EOA
          const nonceResponse = await fetch(
            `${POLY_RELAYER_URL}/nonce?address=${address}&signerType=EOA`,
            { headers: { Accept: "application/json" } }
          );
          if (nonceResponse.ok) {
            const nonceData = await nonceResponse.json();
            proxyAddress = nonceData.proxyAddress || data.proxyAddress;
          }
        } catch {
          proxyAddress = data.proxyAddress;
        }
      }

      setSafeStatus({
        isDeployed,
        proxyAddress,
        isLoading: false,
        error: null,
      });

      addLog({
        level: isDeployed ? "success" : "info",
        message: isDeployed
          ? `Safe wallet found: ${proxyAddress}`
          : "No Safe wallet deployed yet",
        source: "safe",
        data: { isDeployed, proxyAddress },
      });

      return isDeployed;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to check Safe status";
      setSafeStatus({
        isDeployed: false,
        proxyAddress: undefined,
        isLoading: false,
        error: message,
      });

      addLog({
        level: "error",
        message: `Safe status check failed: ${message}`,
        source: "safe",
      });

      return false;
    }
  }, [address, addLog]);

  // ============================================
  // Deploy Safe Wallet
  // Per SDK: relayClient.deploy()
  // Returns RelayerTransactionResponse with wait() method
  // ============================================
  const deploySafe = useCallback(async (): Promise<string | null> => {
    if (!address || !relayClient) {
      addLog({
        level: "error",
        message: "Wallet not connected or RelayClient not initialized",
        source: "safe",
      });
      return null;
    }

    setIsDeploying(true);
    setSafeStatus((s) => ({ ...s, error: null }));

    try {
      addLog({
        level: "info",
        message: "Deploying Safe wallet via Relayer...",
        source: "safe",
      });

      // Per SDK: deploy() returns RelayerTransactionResponse
      // SDK handles: Safe factory params, user signature, relayer submission
      // Relayer pays gas (gasless for user)
      const response = await relayClient.deploy();

      addLog({
        level: "info",
        message: "Deployment submitted, waiting for confirmation...",
        source: "safe",
        data: { transactionId: response.transactionID },
      });

      // Per SDK: wait() returns RelayerTransaction or undefined
      let transaction = await response.wait();

      // Per SDK: pollUntilState as fallback
      if (!transaction && response.transactionID) {
        transaction = await relayClient.pollUntilState(
          response.transactionID,
          [RelayerTransactionState.STATE_CONFIRMED, RelayerTransactionState.STATE_MINED],
          RelayerTransactionState.STATE_FAILED,
          30, // max polls
          2000 // poll interval (ms)
        );

        if (!transaction) {
          throw new Error("Safe deployment timed out or failed");
        }
      }

      // Get proxy address from transaction
      const proxyAddress = transaction?.proxyAddress;

      if (proxyAddress) {
        setSafeStatus({
          isDeployed: true,
          proxyAddress,
          isLoading: false,
          error: null,
        });

        addLog({
          level: "success",
          message: `Safe wallet deployed: ${proxyAddress}`,
          source: "safe",
          data: { proxyAddress, txHash: transaction?.transactionHash },
        });

        return proxyAddress;
      }

      // Fallback: recheck status to get proxy address
      await checkSafeStatus();
      return safeStatus.proxyAddress || null;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Safe deployment failed";
      setSafeStatus((s) => ({ ...s, error: message }));

      addLog({
        level: "error",
        message: `Safe deployment failed: ${message}`,
        source: "safe",
      });

      return null;
    } finally {
      setIsDeploying(false);
    }
  }, [address, relayClient, addLog, checkSafeStatus, safeStatus.proxyAddress]);

  // ============================================
  // Approve USDC for Trading
  // Per SDK: relayClient.execute(transactions, metadata)
  // Per Polymarket docs:
  //   - Standard markets: Approve USDC to CONDITIONAL_TOKENS
  //   - Neg Risk markets: Approve USDC to NEG_RISK_ADAPTER
  // ============================================
  const approveUSDC = useCallback(
    async (isNegRisk: boolean = false): Promise<boolean> => {
      if (!address || !relayClient || !safeStatus.proxyAddress) {
        addLog({
          level: "error",
          message: "Safe wallet not ready",
          source: "safe",
        });
        return false;
      }

      setIsApproving(true);

      try {
        // Per Polymarket docs: Different approval targets for market types
        const approvalTarget = isNegRisk
          ? APPROVAL_TARGETS.NEG_RISK
          : APPROVAL_TARGETS.STANDARD;
        const targetName = isNegRisk ? "Neg Risk Adapter" : "CTF";

        addLog({
          level: "info",
          message: `Approving USDC for ${targetName}...`,
          source: "safe",
        });

        // Build approval transaction data
        // ERC20 approve(address spender, uint256 amount)
        const { Interface, MaxUint256 } = await import("ethers");
        const erc20Interface = new Interface([
          "function approve(address spender, uint256 amount) returns (bool)",
        ]);

        const approvalData = erc20Interface.encodeFunctionData("approve", [
          approvalTarget,
          MaxUint256, // Approve max for convenience
        ]);

        // Per SDK: SafeTransaction format
        const safeTx: SafeTransaction = {
          to: CONTRACTS.USDC,
          operation: OperationType.Call,
          data: approvalData,
          value: "0",
        };

        addLog({
          level: "info",
          message: "Please sign the approval in your wallet...",
          source: "safe",
        });

        // Per SDK: execute(transactions, metadata) returns RelayerTransactionResponse
        const response = await relayClient.execute(
          [safeTx],
          `USDC approval for ${targetName}`
        );

        addLog({
          level: "info",
          message: "Approval submitted, waiting for confirmation...",
          source: "safe",
          data: { transactionId: response.transactionID },
        });

        // Per SDK: wait() for transaction confirmation
        let transaction = await response.wait();

        if (!transaction && response.transactionID) {
          transaction = await relayClient.pollUntilState(
            response.transactionID,
            [RelayerTransactionState.STATE_CONFIRMED, RelayerTransactionState.STATE_MINED],
            RelayerTransactionState.STATE_FAILED,
            20,
            2000
          );

          if (!transaction) {
            throw new Error("Approval transaction timed out");
          }
        }

        addLog({
          level: "success",
          message: `USDC approved for ${targetName}!`,
          source: "safe",
          data: { txHash: transaction?.transactionHash },
        });

        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Approval failed";

        addLog({
          level: "error",
          message: `USDC approval failed: ${message}`,
          source: "safe",
        });

        return false;
      } finally {
        setIsApproving(false);
      }
    },
    [address, relayClient, safeStatus.proxyAddress, addLog]
  );

  // ============================================
  // Refresh Status
  // ============================================
  const refreshStatus = useCallback(async () => {
    await checkSafeStatus();
  }, [checkSafeStatus]);

  // ============================================
  // Auto-check status on wallet connect
  // ============================================
  useEffect(() => {
    if (isConnected && address) {
      checkSafeStatus();
    } else {
      setSafeStatus({
        isDeployed: false,
        proxyAddress: undefined,
        isLoading: false,
        error: null,
      });
    }
  }, [isConnected, address, checkSafeStatus]);

  return {
    safeStatus,
    isDeploying,
    isApproving,
    deploySafe,
    approveUSDC,
    checkSafeStatus,
    refreshStatus,
  };
}
