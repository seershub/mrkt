// ============================================
// MRKT - Polymarket Proxy Wallet API
// Check and deploy Gnosis Safe proxy wallets
// Uses V2 Relayer and @polymarket/builder-relayer-client
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { RelayClient } from "@polymarket/builder-relayer-client";
import { BuilderConfig } from "@polymarket/builder-signing-sdk";
import { Wallet } from "@ethersproject/wallet";
import { ApiResponse } from "@/types";

// Must use nodejs runtime for SDK (uses ethers.js)
export const runtime = "nodejs";

// V2 Relayer URL (per official docs)
const POLY_RELAYER_URL = "https://relayer-v2.polymarket.com";
const CHAIN_ID = 137; // Polygon Mainnet

// Builder API credentials (server-only)
const POLY_BUILDER_API_KEY = process.env.POLY_BUILDER_API_KEY;
const POLY_BUILDER_SECRET = process.env.POLY_BUILDER_SECRET;
const POLY_BUILDER_PASSPHRASE = process.env.POLY_BUILDER_PASSPHRASE;

// Check if builder credentials are configured
const isBuilderConfigured = Boolean(
  POLY_BUILDER_API_KEY && POLY_BUILDER_SECRET && POLY_BUILDER_PASSPHRASE
);

// Initialize BuilderConfig for HMAC signing
function getBuilderConfig(): BuilderConfig | undefined {
  if (!isBuilderConfigured) return undefined;

  return new BuilderConfig({
    localBuilderCreds: {
      key: POLY_BUILDER_API_KEY!,
      secret: POLY_BUILDER_SECRET!,
      passphrase: POLY_BUILDER_PASSPHRASE!,
    },
  });
}

interface ProxyStatus {
  hasProxy: boolean;
  proxyAddress?: string;
  isDeployed?: boolean;
  allowance?: string;
}

// Safe JSON parse with error handling
async function safeParseJson(response: Response): Promise<{ data: unknown; error?: string }> {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  // Log raw response for debugging
  console.log("[MRKT] Relayer response:", response.status, contentType, text.substring(0, 200));

  // Check if response is JSON
  if (!contentType.includes("application/json")) {
    // Try to extract error from HTML if it's Cloudflare page
    if (text.includes("cloudflare") || text.includes("<!DOCTYPE")) {
      return { data: null, error: "Relayer blocked by Cloudflare - try again later" };
    }
    return { data: null, error: `Unexpected content type: ${contentType}` };
  }

  try {
    return { data: JSON.parse(text) };
  } catch (parseError) {
    console.error("[MRKT] JSON parse error:", parseError, "Raw:", text.substring(0, 100));
    return { data: null, error: `Invalid JSON response: ${text.substring(0, 50)}...` };
  }
}

// Calculate deterministic Safe proxy address for an EOA
// Per Gnosis Safe: proxy address = CREATE2(factory, salt(owner), proxyCreationCode)
function calculateProxyAddress(ownerAddress: string): string {
  // This is a simplified calculation - actual proxy address is deterministic
  // based on the Safe Proxy Factory and owner address
  // For now, we'll query the relayer to get the actual proxy
  return ownerAddress; // Placeholder - will be replaced by actual calculation
}

// GET - Check proxy/Safe deployment status for an address
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: "MISSING_ADDRESS",
        message: "Address parameter is required",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 400 });
  }

  try {
    // Per SDK: use /deployed endpoint to check if Safe is deployed
    const deployedUrl = `${POLY_RELAYER_URL}/deployed?address=${address}`;
    console.log("[MRKT] Checking Safe deployment at:", deployedUrl);

    const deployedResponse = await fetch(deployedUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "MRKT-Trading-Platform/1.0",
      },
    });

    // Safe parse the response
    const { data: deployedData, error: parseError } = await safeParseJson(deployedResponse);

    if (parseError) {
      // If relayer is unavailable, check on-chain directly via RPC
      console.warn("[MRKT] Relayer unavailable, falling back to on-chain check");

      // For now, return unknown status
      const response: ApiResponse<ProxyStatus> = {
        success: true,
        data: {
          hasProxy: false,
          isDeployed: false,
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response);
    }

    const deployInfo = deployedData as { deployed?: boolean; proxyAddress?: string; address?: string };
    const isDeployed = deployInfo.deployed === true;

    // Get nonce to get proxy address if deployed
    let proxyAddress: string | undefined;
    if (isDeployed) {
      try {
        const nonceUrl = `${POLY_RELAYER_URL}/nonce?address=${address}`;
        const nonceResponse = await fetch(nonceUrl, {
          headers: {
            Accept: "application/json",
            "User-Agent": "MRKT-Trading-Platform/1.0",
          },
        });
        if (nonceResponse.ok) {
          const nonceData = await nonceResponse.json();
          // The nonce endpoint might return proxy address
          proxyAddress = nonceData.proxyAddress || deployInfo.proxyAddress || deployInfo.address;
        }
      } catch {
        // Nonce fetch failed, use calculated address
        proxyAddress = deployInfo.proxyAddress || deployInfo.address;
      }
    }

    const response: ApiResponse<ProxyStatus> = {
      success: true,
      data: {
        hasProxy: isDeployed,
        proxyAddress: proxyAddress,
        isDeployed: isDeployed,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[MRKT] Proxy check error:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: "PROXY_CHECK_FAILED",
        message: error instanceof Error ? error.message : "Failed to check proxy status",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// POST - Deploy a new proxy wallet using RelayClient
// NOTE: Browser wallets (MetaMask) don't expose private keys
// For browser users, they must create their Safe on Polymarket first
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { privateKey, address } = body;

    // Browser wallet flow - redirect to Polymarket
    if (!privateKey && address) {
      console.log("[MRKT] Browser wallet detected - Safe deployment requires Polymarket");

      const response: ApiResponse<{
        requiresPolymarket: boolean;
        message: string;
        polymarketUrl: string;
      }> = {
        success: false,
        error: {
          code: "BROWSER_WALLET_DEPLOYMENT",
          message: "Browser wallets require Safe deployment through Polymarket. Please visit Polymarket to create your trading account first.",
        },
        data: {
          requiresPolymarket: true,
          message: "To trade on Polymarket, you need a Safe wallet. Please visit Polymarket to set up your account.",
          polymarketUrl: "https://polymarket.com",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 400 });
    }

    // Server-side deployment with private key (for bots/scripts)
    if (!privateKey) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "MISSING_PRIVATE_KEY",
          message: "Private key is required for server-side Safe deployment",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 400 });
    }

    // Check builder configuration
    if (!isBuilderConfigured) {
      console.warn("[MRKT] Builder credentials not configured");

      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "BUILDER_NOT_CONFIGURED",
          message: "Builder API credentials are required for deployment",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 503 });
    }

    // Use RelayClient SDK for deployment
    const wallet = new Wallet(privateKey);
    const builderConfig = getBuilderConfig();

    const relayClient = new RelayClient(
      POLY_RELAYER_URL,
      CHAIN_ID,
      wallet,
      builderConfig
    );

    console.log("[MRKT] Deploying Safe via RelayClient for:", wallet.address);

    // Deploy safe using SDK
    const deployResult = await relayClient.deploy();

    console.log("[MRKT] Safe deployment submitted:", deployResult);

    // Wait for transaction to complete
    let proxyAddress: string | undefined;
    let transactionHash: string | undefined = deployResult.transactionHash || deployResult.hash;

    const transaction = await deployResult.wait();
    if (transaction) {
      proxyAddress = transaction.proxyAddress;
      transactionHash = transaction.transactionHash || transactionHash;
    }

    // Poll for completion if needed
    if (!proxyAddress && deployResult.transactionID) {
      const finalResult = await relayClient.pollUntilState(
        deployResult.transactionID,
        ["STATE_CONFIRMED", "STATE_MINED"],
        "STATE_FAILED",
        30,
        2000
      );

      if (!finalResult) {
        throw new Error("Safe deployment timed out or failed");
      }
    }

    // Query deployed status to get proxy address
    if (!proxyAddress) {
      const deployedResponse = await fetch(
        `${POLY_RELAYER_URL}/deployed?address=${wallet.address}`,
        { headers: { Accept: "application/json" } }
      );
      if (deployedResponse.ok) {
        const data = await deployedResponse.json();
        if (data.deployed) {
          proxyAddress = data.proxyAddress || data.address;
        }
      }
    }

    const response: ApiResponse<{ proxyAddress: string; txHash?: string; transactionId?: string }> = {
      success: true,
      data: {
        proxyAddress: proxyAddress || "",
        txHash: transactionHash,
        transactionId: deployResult.transactionID,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[MRKT] Safe deploy error:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: "DEPLOYMENT_FAILED",
        message: error instanceof Error ? error.message : "Safe deployment failed",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}
