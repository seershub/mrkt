// ============================================
// MRKT - Polymarket Safe Wallet Hook
// Client-side RelayClient with Remote Builder Signing
// Per SDK docs: RelayClient runs in browser with user's signer
// ============================================

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { RelayClient } from "@polymarket/builder-relayer-client";
import { BuilderConfig } from "@polymarket/builder-signing-sdk";
import { CONTRACTS, APPROVAL_TARGETS } from "@/lib/constants";
import { useDebugStore } from "@/lib/stores/debug-store";

// Relayer configuration
const POLY_RELAYER_URL = "https://relayer-v2.polymarket.com";
const CHAIN_ID = 137; // Polygon Mainnet

// Remote builder signing server URL (our API)
const BUILDER_SIGNING_URL = "/api/polymarket/builder-sign";

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

// ERC20 ABI for approval encoding
const ERC20_INTERFACE = {
  approve: "function approve(address spender, uint256 amount) returns (bool)",
};

export function usePolymarketSafe(): UsePolymarketSafeReturn {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
  const addLog = useDebugStore((s) => s.addLog);

  const [safeStatus, setSafeStatus] = useState<SafeStatus>({
    isDeployed: false,
    proxyAddress: undefined,
    isLoading: true,
    error: null,
  });
  const [isDeploying, setIsDeploying] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Initialize RelayClient with remote builder signing
  // Per SDK docs: Use remoteBuilderConfig to point to our signing server
  // SDK supports viem WalletClient directly
  const relayClient = useMemo(() => {
    if (!walletClient) return null;

    try {
      // Configure remote builder signing
      // The SDK will call our /api/polymarket/builder-sign endpoint
      // to get HMAC headers for each request
      const builderConfig = new BuilderConfig({
        remoteBuilderConfig: {
          url: BUILDER_SIGNING_URL,
          // Token is optional - can be used for auth
          // token: "your-auth-token"
        },
      });

      // Initialize RelayClient with user's wallet (viem WalletClient)
      // and remote builder config (for HMAC signing)
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

  // Check if Safe is deployed
  const checkSafeStatus = useCallback(async (): Promise<boolean> => {
    if (!address) return false;

    setSafeStatus((s) => ({ ...s, isLoading: true, error: null }));

    try {
      addLog({
        level: "info",
        message: "Checking Safe wallet status...",
        source: "safe",
      });

      // Use fetch to check deployed status (doesn't require signer)
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
      const message = error instanceof Error ? error.message : "Failed to check Safe status";
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

  // Deploy Safe wallet using RelayClient
  // Per SDK: client.deploy() handles all the Gnosis Safe parameters
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

      // SDK handles all the deployment logic:
      // 1. Gets the correct Safe factory and parameters
      // 2. Creates deployment transaction
      // 3. User signs with their wallet (gasless for them!)
      // 4. Submits to relayer with builder attribution
      // 5. Relayer pays gas and deploys
      const response = await relayClient.deploy();

      addLog({
        level: "info",
        message: `Deployment submitted, waiting for confirmation...`,
        source: "safe",
        data: { transactionId: response.transactionID },
      });

      // Wait for deployment to complete
      const transaction = await response.wait();

      if (!transaction) {
        // Poll for completion as fallback
        const finalTx = await relayClient.pollUntilState(
          response.transactionID!,
          ["STATE_CONFIRMED", "STATE_MINED"],
          "STATE_FAILED",
          30, // max polls
          2000 // poll interval
        );

        if (!finalTx) {
          throw new Error("Safe deployment timed out or failed");
        }
      }

      // Get the proxy address
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

      // Recheck status to get proxy address
      await checkSafeStatus();
      return safeStatus.proxyAddress || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Safe deployment failed";
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

  // Approve USDC for trading using RelayClient.execute()
  // Per SDK: execute() runs transactions through the Safe
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
        const approvalTarget = isNegRisk
          ? APPROVAL_TARGETS.NEG_RISK
          : APPROVAL_TARGETS.STANDARD;
        const targetName = isNegRisk ? "Neg Risk Adapter" : "CTF";

        addLog({
          level: "info",
          message: `Approving USDC for ${targetName}...`,
          source: "safe",
        });

        // Build approval transaction
        // Per SDK: SafeTransaction format
        const { Interface, MaxUint256 } = await import("ethers");
        const erc20Interface = new Interface([
          "function approve(address spender, uint256 amount) returns (bool)",
        ]);

        const approvalData = erc20Interface.encodeFunctionData("approve", [
          approvalTarget,
          MaxUint256, // Approve max for convenience
        ]);

        const safeTx = {
          to: CONTRACTS.USDC,
          operation: 0, // Call
          data: approvalData,
          value: "0",
        };

        addLog({
          level: "info",
          message: "Please sign the approval in your wallet...",
          source: "safe",
        });

        // Execute through Safe via Relayer
        // SDK handles: signing, nonce, relayer submission
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

        // Wait for transaction
        const transaction = await response.wait();

        if (!transaction) {
          const finalTx = await relayClient.pollUntilState(
            response.transactionID!,
            ["STATE_CONFIRMED", "STATE_MINED"],
            "STATE_FAILED",
            20,
            2000
          );

          if (!finalTx) {
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
        const message = error instanceof Error ? error.message : "Approval failed";

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

  // Refresh status
  const refreshStatus = useCallback(async () => {
    await checkSafeStatus();
  }, [checkSafeStatus]);

  // Auto-check status on connect
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
