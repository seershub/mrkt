// ============================================
// MRKT - Polymarket Safe Wallet Hook
// Client-side RelayClient with Remote Builder Signing
// Per SDK docs: RelayClient runs in browser with user's signer
// ============================================

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

// Remote builder signing server URL
// Per SDK docs: BuilderConfig.remoteBuilderConfig.url
const getBuilderSigningUrl = (): string => {
  // Priority 1: Use external builder signing server if configured
  const externalServer = process.env.NEXT_PUBLIC_BUILDER_SIGNING_SERVER_URL;
  if (externalServer) {
    const baseUrl = externalServer.replace(/\/$/, "");
    return `${baseUrl}/sign`;
  }

  // Priority 2: Use local API endpoint
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/polymarket/builder-sign`;
  }

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
  const { address, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
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

  // RelayClient ref - use ref to avoid re-renders
  const relayClientRef = useRef<RelayClient | null>(null);
  const [isClientReady, setIsClientReady] = useState(false);

  // Check if on correct chain
  const isOnPolygon = chain?.id === CHAIN_ID;

  // ============================================
  // Initialize RelayClient with useEffect (not useMemo!)
  // ============================================
  useEffect(() => {
    // Reset client state
    relayClientRef.current = null;
    setIsClientReady(false);

    if (!walletClient) {
      console.log("[MRKT] RelayClient: Waiting for walletClient...");
      return;
    }

    if (!isOnPolygon) {
      console.log("[MRKT] RelayClient: Wrong chain. Current:", chain?.id, chain?.name);
      console.log("[MRKT] RelayClient: Please switch to Polygon (137)");
      return;
    }

    try {
      const builderSigningUrl = getBuilderSigningUrl();
      console.log("[MRKT] ========== RelayClient Init ==========");
      console.log("[MRKT] Builder signing URL:", builderSigningUrl);
      console.log("[MRKT] WalletClient account:", walletClient.account?.address);
      console.log("[MRKT] WalletClient chain:", walletClient.chain?.id);

      const builderConfig = new BuilderConfig({
        remoteBuilderConfig: {
          url: builderSigningUrl,
        },
      });
      console.log("[MRKT] BuilderConfig created");

      const client = new RelayClient(
        POLY_RELAYER_URL,
        CHAIN_ID,
        walletClient,
        builderConfig
      );

      relayClientRef.current = client;
      setIsClientReady(true);
      console.log("[MRKT] RelayClient READY!");
      console.log("[MRKT] =====================================");

      addLog({
        level: "success",
        message: "RelayClient initialized successfully",
        source: "safe",
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("[MRKT] RelayClient init FAILED:", errorMsg, error);

      addLog({
        level: "error",
        message: `RelayClient init failed: ${errorMsg}`,
        source: "safe",
      });
    }
  }, [walletClient, isOnPolygon, chain, addLog]);

  // ============================================
  // Check Safe Deployment Status
  // ============================================
  const checkSafeStatus = useCallback(async (): Promise<boolean> => {
    if (!address) return false;

    setSafeStatus((s) => ({ ...s, isLoading: true, error: null }));

    try {
      console.log("[MRKT] Checking Safe at:", `${POLY_RELAYER_URL}/deployed?address=${address}`);

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
      console.log("[MRKT] Safe status response:", data);
      const isDeployed = data.deployed === true;

      let proxyAddress: string | undefined;
      if (isDeployed) {
        try {
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
        message: isDeployed ? `Safe found: ${proxyAddress}` : "No Safe deployed yet",
        source: "safe",
      });

      return isDeployed;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to check Safe status";
      setSafeStatus({
        isDeployed: false,
        proxyAddress: undefined,
        isLoading: false,
        error: message,
      });

      addLog({
        level: "error",
        message: `Safe check failed: ${message}`,
        source: "safe",
      });

      return false;
    }
  }, [address, addLog]);

  // ============================================
  // Deploy Safe Wallet
  // ============================================
  const deploySafe = useCallback(async (): Promise<string | null> => {
    console.log("[MRKT] ========== Deploy Safe ==========");
    console.log("[MRKT] address:", address);
    console.log("[MRKT] isOnPolygon:", isOnPolygon);
    console.log("[MRKT] chain:", chain?.id, chain?.name);
    console.log("[MRKT] isClientReady:", isClientReady);
    console.log("[MRKT] relayClientRef.current:", !!relayClientRef.current);

    if (!address) {
      const msg = "Wallet not connected";
      console.error("[MRKT]", msg);
      addLog({ level: "error", message: msg, source: "safe" });
      return null;
    }

    if (!isOnPolygon) {
      const msg = `Please switch to Polygon. Current: ${chain?.name || chain?.id || 'Unknown'}`;
      console.error("[MRKT]", msg);
      addLog({ level: "error", message: msg, source: "safe" });
      return null;
    }

    if (!isClientReady || !relayClientRef.current) {
      const msg = "RelayClient not ready. Please wait or refresh the page.";
      console.error("[MRKT]", msg);
      addLog({ level: "error", message: msg, source: "safe" });
      return null;
    }

    setIsDeploying(true);
    setSafeStatus((s) => ({ ...s, error: null }));

    try {
      console.log("[MRKT] Calling relayClient.deploy()...");
      addLog({
        level: "info",
        message: "Deploying Safe wallet... Please sign in MetaMask",
        source: "safe",
      });

      // This should trigger MetaMask signature request
      const response = await relayClientRef.current.deploy();
      console.log("[MRKT] Deploy response:", response);

      addLog({
        level: "info",
        message: `Deployment submitted: ${response.transactionID}`,
        source: "safe",
      });

      let transaction = await response.wait();

      if (!transaction && response.transactionID) {
        console.log("[MRKT] Polling for transaction state...");
        transaction = await relayClientRef.current.pollUntilState(
          response.transactionID,
          [RelayerTransactionState.STATE_CONFIRMED, RelayerTransactionState.STATE_MINED],
          RelayerTransactionState.STATE_FAILED,
          30,
          2000
        );
      }

      const proxyAddress = transaction?.proxyAddress;
      console.log("[MRKT] Deploy complete. Proxy:", proxyAddress);

      if (proxyAddress) {
        setSafeStatus({
          isDeployed: true,
          proxyAddress,
          isLoading: false,
          error: null,
        });

        addLog({
          level: "success",
          message: `Safe deployed: ${proxyAddress}`,
          source: "safe",
        });

        return proxyAddress;
      }

      await checkSafeStatus();
      return safeStatus.proxyAddress || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deployment failed";
      console.error("[MRKT] Deploy error:", message, error);
      setSafeStatus((s) => ({ ...s, error: message }));

      addLog({
        level: "error",
        message: `Deploy failed: ${message}`,
        source: "safe",
      });

      return null;
    } finally {
      setIsDeploying(false);
      console.log("[MRKT] =====================================");
    }
  }, [address, isOnPolygon, chain, isClientReady, addLog, checkSafeStatus, safeStatus.proxyAddress]);

  // ============================================
  // Approve USDC for Trading
  // ============================================
  const approveUSDC = useCallback(
    async (isNegRisk: boolean = false): Promise<boolean> => {
      if (!address || !isClientReady || !relayClientRef.current || !safeStatus.proxyAddress) {
        addLog({ level: "error", message: "Safe wallet not ready", source: "safe" });
        return false;
      }

      setIsApproving(true);

      try {
        const approvalTarget = isNegRisk ? APPROVAL_TARGETS.NEG_RISK : APPROVAL_TARGETS.STANDARD;
        const targetName = isNegRisk ? "Neg Risk Adapter" : "CTF";

        addLog({
          level: "info",
          message: `Approving USDC for ${targetName}...`,
          source: "safe",
        });

        const { Interface, MaxUint256 } = await import("ethers");
        const erc20Interface = new Interface([
          "function approve(address spender, uint256 amount) returns (bool)",
        ]);

        const approvalData = erc20Interface.encodeFunctionData("approve", [
          approvalTarget,
          MaxUint256,
        ]);

        const safeTx: SafeTransaction = {
          to: CONTRACTS.USDC,
          operation: OperationType.Call,
          data: approvalData,
          value: "0",
        };

        const response = await relayClientRef.current.execute([safeTx], `USDC approval for ${targetName}`);

        let transaction = await response.wait();

        if (!transaction && response.transactionID) {
          transaction = await relayClientRef.current.pollUntilState(
            response.transactionID,
            [RelayerTransactionState.STATE_CONFIRMED, RelayerTransactionState.STATE_MINED],
            RelayerTransactionState.STATE_FAILED,
            20,
            2000
          );
        }

        addLog({
          level: "success",
          message: `USDC approved for ${targetName}!`,
          source: "safe",
        });

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Approval failed";
        addLog({ level: "error", message: `Approval failed: ${message}`, source: "safe" });
        return false;
      } finally {
        setIsApproving(false);
      }
    },
    [address, isClientReady, safeStatus.proxyAddress, addLog]
  );

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

  // Refresh status wrapper for void return
  const refreshStatus = useCallback(async () => {
    await checkSafeStatus();
  }, [checkSafeStatus]);

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
