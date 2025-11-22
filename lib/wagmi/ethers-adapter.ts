// ============================================
// MRKT - Wagmi to Ethers Adapter
// Converts wagmi/viem WalletClient to ethers Signer
// Required for Polymarket SDK (uses ethers.js)
// ============================================

"use client";

import { useMemo } from "react";
import { useWalletClient } from "wagmi";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import type { WalletClient } from "viem";

// Convert a viem WalletClient to an ethers.js Signer (ethers v6)
export function walletClientToSigner(walletClient: WalletClient): JsonRpcSigner {
  const { account, chain, transport } = walletClient;

  if (!account || !chain) {
    throw new Error("WalletClient must have account and chain");
  }

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  // Create ethers provider from the transport (ethers v6)
  const provider = new BrowserProvider(transport as any, network);

  // Get signer for the account (ethers v6 - async but we return sync for useMemo)
  // Note: In ethers v6, getSigner is async, but we need sync for the SDK
  // We use a workaround by creating a JsonRpcSigner directly
  const signer = new JsonRpcSigner(provider, account.address);

  return signer;
}

// Hook to get an ethers Signer from wagmi
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: walletClient } = useWalletClient({ chainId });

  return useMemo(() => {
    if (!walletClient) return undefined;

    try {
      return walletClientToSigner(walletClient);
    } catch (error) {
      console.error("[MRKT] Failed to convert WalletClient to Signer:", error);
      return undefined;
    }
  }, [walletClient]);
}

// Alternative: Create ethers provider from wagmi config
export function useEthersProvider({ chainId }: { chainId?: number } = {}) {
  const { data: walletClient } = useWalletClient({ chainId });

  return useMemo(() => {
    if (!walletClient) return undefined;

    const { chain, transport } = walletClient;
    if (!chain) return undefined;

    const network = {
      chainId: chain.id,
      name: chain.name,
      ensAddress: chain.contracts?.ensRegistry?.address,
    };

    return new BrowserProvider(transport as any, network);
  }, [walletClient]);
}
