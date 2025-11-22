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

// GET - Check proxy status for an address
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
    // Query V2 relayer for proxy status
    const proxyResponse = await fetch(
      `${POLY_RELAYER_URL}/proxy/${address}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (proxyResponse.status === 404) {
      // No proxy exists yet
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

    if (!proxyResponse.ok) {
      throw new Error(`Proxy check failed: ${proxyResponse.status}`);
    }

    const proxyData = await proxyResponse.json();
    const proxyAddress = proxyData.proxy || proxyData.address || proxyData.safeAddress;

    const response: ApiResponse<ProxyStatus> = {
      success: true,
      data: {
        hasProxy: true,
        proxyAddress,
        isDeployed: proxyData.deployed !== false,
        allowance: proxyData.allowance,
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
export async function POST(request: NextRequest) {
  try {
    // Check builder configuration for gasless deployment
    if (!isBuilderConfigured) {
      console.warn("[MRKT] Builder credentials not configured for proxy deployment");

      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "BUILDER_NOT_CONFIGURED",
          message: "Builder API is required for proxy deployment",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 503 });
    }

    const body = await request.json();
    const { privateKey } = body;

    // For server-side deployment, we need the user's private key or a signed message
    // In production, you'd use the user's wallet signature to authorize deployment
    if (!privateKey) {
      // Fallback to direct relayer API call with signature
      const { address, signature } = body;

      if (!address || !signature) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Either privateKey or (address + signature) is required",
          },
          timestamp: new Date().toISOString(),
        };

        return NextResponse.json(response, { status: 400 });
      }

      // Use direct API call with builder headers
      const builderConfig = getBuilderConfig();
      const timestamp = Date.now();
      const method = "POST";
      const path = "/proxy";

      // Generate builder headers
      const builderHeaders = await builderConfig?.generateBuilderHeaders(
        method,
        path,
        JSON.stringify({ owner: address }),
        timestamp
      );

      const deployResponse = await fetch(`${POLY_RELAYER_URL}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(builderHeaders || {}),
        },
        body: JSON.stringify({
          owner: address,
          signature,
        }),
      });

      const deployData = await deployResponse.json();

      if (!deployResponse.ok) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: "PROXY_DEPLOY_FAILED",
            message: deployData.message || `Deployment failed: ${deployResponse.status}`,
            details: deployData,
          },
          timestamp: new Date().toISOString(),
        };

        return NextResponse.json(response, { status: deployResponse.status });
      }

      const response: ApiResponse<{ proxyAddress: string; txHash?: string; transactionId?: string }> = {
        success: true,
        data: {
          proxyAddress: deployData.proxy || deployData.address || deployData.safeAddress,
          txHash: deployData.txHash,
          transactionId: deployData.transactionId,
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response);
    }

    // If private key provided, use RelayClient SDK for full deployment
    const wallet = new Wallet(privateKey);
    const builderConfig = getBuilderConfig();

    const relayClient = new RelayClient(
      POLY_RELAYER_URL,
      CHAIN_ID,
      wallet,
      builderConfig
    );

    console.log("[MRKT] Deploying proxy wallet via RelayClient...");

    // Deploy safe using SDK
    const deployResult = await relayClient.deploy();

    console.log("[MRKT] Proxy deployment result:", deployResult);

    // Poll for completion if needed
    if (deployResult.transactionId) {
      const finalResult = await relayClient.pollUntilState(
        deployResult.transactionId,
        ["CONFIRMED", "COMPLETED"],
        "FAILED",
        30, // Max polls
        2000 // Poll frequency (2s)
      );

      if (!finalResult) {
        throw new Error("Proxy deployment timed out or failed");
      }
    }

    const response: ApiResponse<{ proxyAddress: string; txHash?: string; transactionId?: string }> = {
      success: true,
      data: {
        proxyAddress: deployResult.safeAddress || deployResult.address,
        txHash: deployResult.txHash,
        transactionId: deployResult.transactionId,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[MRKT] Proxy deploy error:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Internal server error",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}
