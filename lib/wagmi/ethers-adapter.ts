// ============================================
// MRKT - Wagmi to Ethers Adapter
// Converts wagmi/viem WalletClient to ethers Signer
// Per wagmi docs: https://wagmi.sh/react/ethers-adapters
// ============================================

"use client";

import { useMemo } from "react";
import { useWalletClient, usePublicClient } from "wagmi";
import type { Account, Chain, Client, Transport, WalletClient } from "viem";

// ============================================
// Ethers v6 Adapter (for our installed ethers)
// ============================================

// Convert a viem WalletClient to an ethers v6 JsonRpcSigner
// Note: Async version per ethers v6 API
export async function walletClientToEthersSigner(
  walletClient: WalletClient
): Promise<import("ethers").JsonRpcSigner> {
  const { BrowserProvider } = await import("ethers");
  const { account, chain, transport } = walletClient;

  if (!account || !chain) {
    throw new Error("WalletClient must have account and chain");
  }

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  // Create ethers v6 BrowserProvider from the transport
  const provider = new BrowserProvider(transport as any, network);

  // Get signer for the account (async in ethers v6)
  const signer = await provider.getSigner(account.address);

  return signer;
}

// Convert a viem Client to an ethers v6 Provider
export function clientToEthersProvider(
  client: Client<Transport, Chain>
): import("ethers").BrowserProvider {
  const { BrowserProvider } = require("ethers");
  const { chain, transport } = client;

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  return new BrowserProvider(transport as any, network);
}

// ============================================
// React Hooks
// ============================================

// Hook to get an ethers v6 Signer from wagmi
// Returns Promise-based getter since ethers v6 getSigner is async
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: walletClient } = useWalletClient({ chainId });

  return useMemo(() => {
    if (!walletClient) return undefined;

    // Return a function that creates the signer (async)
    return async () => {
      try {
        return await walletClientToEthersSigner(walletClient);
      } catch (error) {
        console.error("[MRKT] Failed to convert WalletClient to Signer:", error);
        return undefined;
      }
    };
  }, [walletClient]);
}

// Hook to get an ethers v6 Provider from wagmi
export function useEthersProvider({ chainId }: { chainId?: number } = {}) {
  const publicClient = usePublicClient({ chainId });

  return useMemo(() => {
    if (!publicClient) return undefined;

    try {
      return clientToEthersProvider(publicClient);
    } catch (error) {
      console.error("[MRKT] Failed to convert PublicClient to Provider:", error);
      return undefined;
    }
  }, [publicClient]);
}

// ============================================
// Polymarket SDK Compatibility
// ============================================

// Note: The Polymarket SDK (@polymarket/builder-relayer-client) bundles
// ethers v5.8.0 and accepts WalletClient directly via createAbstractSigner.
//
// Per SDK source (builder-abstract-signer/factory.d.ts):
// export declare function createAbstractSigner(
//   chainId: number,
//   signer: Wallet | JsonRpcSigner | WalletClient
// ): IAbstractSigner;
//
// Therefore, for RelayClient, we pass WalletClient directly without conversion.
// This avoids ethers v5/v6 version conflicts.

// Export the WalletClient type check for SDK compatibility
export function isValidPolymarketSigner(
  signer: unknown
): signer is WalletClient {
  if (!signer || typeof signer !== "object") return false;
  const client = signer as WalletClient;
  return (
    typeof client.account !== "undefined" &&
    typeof client.chain !== "undefined" &&
    typeof client.transport !== "undefined"
  );
}
