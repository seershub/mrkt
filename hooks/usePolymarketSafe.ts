// ============================================
// MRKT - Polymarket Safe Wallet Hook
// Client-side Safe deployment and management
// Uses RelayClient with remote builder authentication
// ============================================

"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { CONTRACTS, APPROVAL_TARGETS } from "@/lib/constants";
import { useDebugStore } from "@/lib/stores/debug-store";

// Relayer URL
const POLY_RELAYER_URL = "https://relayer-v2.polymarket.com";
const CHAIN_ID = 137;

// ERC20 ABI for encoding
const ERC20_APPROVE_SELECTOR = "0x095ea7b3";
const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

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

// Encode approve function data
function encodeApproveData(spender: string): string {
  const spenderPadded = spender.toLowerCase().replace("0x", "").padStart(64, "0");
  const amountHex = MAX_UINT256.replace("0x", "");
  return `${ERC20_APPROVE_SELECTOR}${spenderPadded}${amountHex}`;
}

// Get builder headers from our signing server
async function getBuilderHeaders(
  method: string,
  path: string,
  body?: string
): Promise<Record<string, string>> {
  try {
    const response = await fetch("/api/polymarket/builder-sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, path, body }),
    });

    const result = await response.json();
    if (!result.success) {
      console.warn("[MRKT] Builder signing failed:", result.error);
      return {};
    }

    return result.headers || {};
  } catch (error) {
    console.error("[MRKT] Builder sign request failed:", error);
    return {};
  }
}

export function usePolymarketSafe(): UsePolymarketSafeReturn {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const addLog = useDebugStore((s) => s.addLog);

  const [safeStatus, setSafeStatus] = useState<SafeStatus>({
    isDeployed: false,
    proxyAddress: undefined,
    isLoading: true,
    error: null,
  });
  const [isDeploying, setIsDeploying] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Check if Safe is deployed
  const checkSafeStatus = useCallback(async (): Promise<boolean> => {
    if (!address) return false;

    setSafeStatus((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // Use /deployed endpoint per SDK
      const builderHeaders = await getBuilderHeaders("GET", `/deployed?address=${address}`);

      const response = await fetch(
        `${POLY_RELAYER_URL}/deployed?address=${address}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...builderHeaders,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Relayer returned ${response.status}`);
      }

      const data = await response.json();
      const isDeployed = data.deployed === true;

      // If deployed, get the proxy address
      let proxyAddress: string | undefined;
      if (isDeployed) {
        // Calculate or fetch proxy address
        // The proxy address is deterministically calculated from the owner
        proxyAddress = data.proxyAddress || data.address;

        // If not in response, try getting nonce which may return it
        if (!proxyAddress) {
          try {
            const nonceHeaders = await getBuilderHeaders("GET", `/nonce?address=${address}&signerType=EOA`);
            const nonceResponse = await fetch(
              `${POLY_RELAYER_URL}/nonce?address=${address}&signerType=EOA`,
              {
                headers: {
                  Accept: "application/json",
                  ...nonceHeaders,
                },
              }
            );
            if (nonceResponse.ok) {
              const nonceData = await nonceResponse.json();
              proxyAddress = nonceData.proxyAddress;
            }
          } catch {
            // Nonce fetch failed, continue without proxy address
          }
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

  // Deploy Safe wallet
  const deploySafe = useCallback(async (): Promise<string | null> => {
    if (!address || !walletClient) {
      addLog({
        level: "error",
        message: "Wallet not connected",
        source: "safe",
      });
      return null;
    }

    setIsDeploying(true);
    setSafeStatus((s) => ({ ...s, error: null }));

    try {
      addLog({
        level: "info",
        message: "Deploying Safe wallet...",
        source: "safe",
      });

      // Step 1: Create deployment request
      // Per SDK, we need to sign a Safe creation message
      const deployBody = JSON.stringify({
        owner: address,
        chainId: CHAIN_ID,
      });

      // Get builder headers for the deploy request
      const builderHeaders = await getBuilderHeaders("POST", "/submit", deployBody);

      // Step 2: Sign the deployment message with user's wallet
      // The relayer expects a specific message format for Safe deployment
      const message = `Enable Trading on Polymarket`;
      const timestamp = Math.floor(Date.now() / 1000);
      const signMessage = `${message}\n\nTimestamp: ${timestamp}\nAddress: ${address}`;

      addLog({
        level: "info",
        message: "Please sign the message in your wallet to enable trading...",
        source: "safe",
      });

      // Sign with user's wallet
      const signature = await walletClient.signMessage({
        message: signMessage,
      });

      addLog({
        level: "info",
        message: "Signature received, submitting to relayer...",
        source: "safe",
      });

      // Step 3: Submit to relayer
      const submitBody = JSON.stringify({
        type: "SAFE-CREATE",
        from: address,
        chainId: CHAIN_ID,
        signature: signature,
        signatureParams: {
          timestamp: timestamp.toString(),
        },
        metadata: "MRKT Safe Deployment",
      });

      const submitHeaders = await getBuilderHeaders("POST", "/submit", submitBody);

      const response = await fetch(`${POLY_RELAYER_URL}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...submitHeaders,
        },
        body: submitBody,
      });

      const responseText = await response.text();
      console.log("[MRKT] Relayer response:", response.status, responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`Invalid response from relayer: ${responseText.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(result.message || result.error || `Deployment failed: ${response.status}`);
      }

      // Step 4: Wait for deployment to complete
      const transactionId = result.transactionID || result.transactionId;
      if (transactionId) {
        addLog({
          level: "info",
          message: `Deployment submitted, waiting for confirmation... (${transactionId})`,
          source: "safe",
        });

        // Poll for completion
        let attempts = 0;
        const maxAttempts = 30;
        while (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2000));
          attempts++;

          try {
            const txHeaders = await getBuilderHeaders("GET", `/transaction/${transactionId}`);
            const txResponse = await fetch(
              `${POLY_RELAYER_URL}/transaction/${transactionId}`,
              {
                headers: {
                  Accept: "application/json",
                  ...txHeaders,
                },
              }
            );

            if (txResponse.ok) {
              const txData = await txResponse.json();
              const state = Array.isArray(txData) ? txData[0]?.state : txData.state;

              if (state === "STATE_CONFIRMED" || state === "STATE_MINED") {
                break;
              }
              if (state === "STATE_FAILED") {
                throw new Error("Safe deployment failed on-chain");
              }
            }
          } catch (pollError) {
            console.warn("[MRKT] Poll error:", pollError);
          }
        }
      }

      // Step 5: Verify deployment and get proxy address
      await new Promise((r) => setTimeout(r, 2000)); // Wait a bit more
      const isDeployed = await checkSafeStatus();

      if (isDeployed && safeStatus.proxyAddress) {
        addLog({
          level: "success",
          message: `Safe wallet deployed successfully: ${safeStatus.proxyAddress}`,
          source: "safe",
        });
        return safeStatus.proxyAddress;
      }

      // Recheck status
      const finalCheck = await checkSafeStatus();
      if (finalCheck) {
        return safeStatus.proxyAddress || null;
      }

      throw new Error("Deployment may have succeeded but proxy address not found. Please refresh.");
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
  }, [address, walletClient, addLog, checkSafeStatus, safeStatus.proxyAddress]);

  // Approve USDC for trading
  const approveUSDC = useCallback(
    async (isNegRisk: boolean = false): Promise<boolean> => {
      if (!address || !walletClient || !safeStatus.proxyAddress) {
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
        const targetName = isNegRisk ? "Neg Risk Adapter" : "CTF Exchange";

        addLog({
          level: "info",
          message: `Approving USDC for ${targetName}...`,
          source: "safe",
        });

        // Step 1: Get nonce for Safe transaction
        const nonceHeaders = await getBuilderHeaders(
          "GET",
          `/nonce?address=${address}&signerType=EOA`
        );
        const nonceResponse = await fetch(
          `${POLY_RELAYER_URL}/nonce?address=${address}&signerType=EOA`,
          {
            headers: {
              Accept: "application/json",
              ...nonceHeaders,
            },
          }
        );

        if (!nonceResponse.ok) {
          throw new Error("Failed to get Safe nonce");
        }

        const { nonce } = await nonceResponse.json();

        // Step 2: Construct Safe transaction for approval
        const safeTx = {
          to: CONTRACTS.USDC,
          operation: 0, // Call
          data: encodeApproveData(approvalTarget),
          value: "0",
        };

        // Step 3: Sign the Safe transaction
        // Create the message to sign (simplified - actual Safe tx hash is more complex)
        const timestamp = Math.floor(Date.now() / 1000);
        const txMessage = `Approve USDC for trading on ${targetName}\n\nTimestamp: ${timestamp}\nNonce: ${nonce}`;

        addLog({
          level: "info",
          message: "Please sign the approval in your wallet...",
          source: "safe",
        });

        const signature = await walletClient.signMessage({
          message: txMessage,
        });

        // Step 4: Submit to relayer
        const submitBody = JSON.stringify({
          type: "SAFE",
          from: address,
          to: safeStatus.proxyAddress,
          proxyWallet: safeStatus.proxyAddress,
          data: JSON.stringify([safeTx]),
          nonce: nonce,
          signature: signature,
          signatureParams: {},
          metadata: `MRKT USDC Approval to ${targetName}`,
        });

        const submitHeaders = await getBuilderHeaders("POST", "/submit", submitBody);

        const response = await fetch(`${POLY_RELAYER_URL}/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...submitHeaders,
          },
          body: submitBody,
        });

        const responseText = await response.text();
        console.log("[MRKT] Approval response:", response.status, responseText);

        let result;
        try {
          result = JSON.parse(responseText);
        } catch {
          throw new Error(`Invalid response: ${responseText.substring(0, 100)}`);
        }

        if (!response.ok) {
          throw new Error(result.message || result.error || `Approval failed: ${response.status}`);
        }

        // Wait for confirmation
        const transactionId = result.transactionID || result.transactionId;
        if (transactionId) {
          addLog({
            level: "info",
            message: "Approval submitted, waiting for confirmation...",
            source: "safe",
          });

          // Poll for completion
          let attempts = 0;
          while (attempts < 20) {
            await new Promise((r) => setTimeout(r, 2000));
            attempts++;

            try {
              const txHeaders = await getBuilderHeaders("GET", `/transaction/${transactionId}`);
              const txResponse = await fetch(
                `${POLY_RELAYER_URL}/transaction/${transactionId}`,
                {
                  headers: {
                    Accept: "application/json",
                    ...txHeaders,
                  },
                }
              );

              if (txResponse.ok) {
                const txData = await txResponse.json();
                const state = Array.isArray(txData) ? txData[0]?.state : txData.state;

                if (state === "STATE_CONFIRMED" || state === "STATE_MINED") {
                  addLog({
                    level: "success",
                    message: `USDC approved for ${targetName}!`,
                    source: "safe",
                  });
                  return true;
                }
                if (state === "STATE_FAILED") {
                  throw new Error("Approval transaction failed on-chain");
                }
              }
            } catch (pollError) {
              console.warn("[MRKT] Poll error:", pollError);
            }
          }
        }

        addLog({
          level: "success",
          message: `USDC approval submitted for ${targetName}`,
          source: "safe",
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
    [address, walletClient, safeStatus.proxyAddress, addLog]
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
