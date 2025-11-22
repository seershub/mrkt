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
    // Per docs: use query parameter format
    const proxyUrl = `${POLY_RELAYER_URL}/proxy?address=${address}`;
    console.log("[MRKT] Checking proxy at:", proxyUrl);

    const proxyResponse = await fetch(proxyUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "MRKT-Trading-Platform/1.0",
      },
    });

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

    // Safe parse the response
    const { data: proxyData, error: parseError } = await safeParseJson(proxyResponse);

    if (parseError) {
      throw new Error(parseError);
    }

    if (!proxyResponse.ok) {
      const errorMsg = (proxyData as { message?: string })?.message || `Proxy check failed: ${proxyResponse.status}`;
      throw new Error(errorMsg);
    }

    const proxyInfo = proxyData as { proxy?: string; address?: string; safeAddress?: string; deployed?: boolean; allowance?: string };
    const proxyAddress = proxyInfo.proxy || proxyInfo.address || proxyInfo.safeAddress;

    const response: ApiResponse<ProxyStatus> = {
      success: true,
      data: {
        hasProxy: !!proxyAddress,
        proxyAddress,
        isDeployed: proxyInfo.deployed !== false,
        allowance: proxyInfo.allowance,
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

      // Generate builder headers if config available
      let builderHeaders: Record<string, string> = {};
      if (builderConfig) {
        try {
          const headers = await builderConfig.generateBuilderHeaders(
            method,
            path,
            JSON.stringify({ owner: address }),
            timestamp
          );
          if (headers) {
            builderHeaders = headers as Record<string, string>;
          }
        } catch (headerError) {
          console.error("[MRKT] Builder header generation failed:", headerError);
        }
      }

      console.log("[MRKT] Deploying proxy to:", `${POLY_RELAYER_URL}${path}`);

      const deployResponse = await fetch(`${POLY_RELAYER_URL}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "MRKT-Trading-Platform/1.0",
          ...builderHeaders,
        },
        body: JSON.stringify({
          owner: address,
          signature,
        }),
      });

      // Safe parse the response
      const { data: deployData, error: parseError } = await safeParseJson(deployResponse);

      if (parseError) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: "PROXY_DEPLOY_FAILED",
            message: parseError,
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 500 });
      }

      if (!deployResponse.ok) {
        const errorData = deployData as { message?: string };
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: "PROXY_DEPLOY_FAILED",
            message: errorData?.message || `Deployment failed: ${deployResponse.status}`,
            details: deployData,
          },
          timestamp: new Date().toISOString(),
        };

        return NextResponse.json(response, { status: deployResponse.status });
      }

      const resultData = deployData as { proxy?: string; address?: string; safeAddress?: string; txHash?: string; transactionId?: string };
      const response: ApiResponse<{ proxyAddress: string; txHash?: string; transactionId?: string }> = {
        success: true,
        data: {
          proxyAddress: resultData.proxy || resultData.address || resultData.safeAddress || "",
          txHash: resultData.txHash,
          transactionId: resultData.transactionId,
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

    // Wait for transaction to complete and get proxy address
    let proxyAddress: string | undefined;
    let transactionHash: string | undefined = deployResult.transactionHash || deployResult.hash;

    // Use wait() to get the final transaction with proxyAddress
    const transaction = await deployResult.wait();
    if (transaction) {
      proxyAddress = transaction.proxyAddress;
      transactionHash = transaction.transactionHash || transactionHash;
    }

    // Fallback: poll if wait() didn't return transaction
    if (!proxyAddress && deployResult.transactionID) {
      const finalResult = await relayClient.pollUntilState(
        deployResult.transactionID,
        ["STATE_CONFIRMED", "STATE_MINED"],
        "STATE_FAILED",
        30, // Max polls
        2000 // Poll frequency (2s)
      );

      if (!finalResult) {
        throw new Error("Proxy deployment timed out or failed");
      }
    }

    if (!proxyAddress) {
      // Query the proxy address after deployment
      const proxyResponse = await fetch(
        `${POLY_RELAYER_URL}/proxy/${wallet.address}`,
        { headers: { Accept: "application/json" } }
      );
      if (proxyResponse.ok) {
        const proxyData = await proxyResponse.json();
        proxyAddress = proxyData.proxy || proxyData.address || proxyData.safeAddress;
      }
    }

    const response: ApiResponse<{ proxyAddress: string; txHash?: string; transactionId?: string }> = {
      success: true,
      data: {
        proxyAddress: proxyAddress || wallet.address, // Fallback to EOA if proxy not found
        txHash: transactionHash,
        transactionId: deployResult.transactionID,
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
