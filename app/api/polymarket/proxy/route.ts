// ============================================
// MRKT - Polymarket Proxy Wallet API
// Check and deploy Gnosis Safe proxy wallets
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "@/types";

export const runtime = "edge";

const POLY_RELAYER_URL = "https://relayer.polymarket.com";

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
    // Check if user has a proxy wallet on Polymarket
    const proxyResponse = await fetch(
      `${POLY_RELAYER_URL}/proxy/${address}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (proxyResponse.status === 404) {
      // No proxy exists
      const response: ApiResponse<ProxyStatus> = {
        success: true,
        data: {
          hasProxy: false,
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response);
    }

    if (!proxyResponse.ok) {
      throw new Error(`Proxy check failed: ${proxyResponse.status}`);
    }

    const proxyData = await proxyResponse.json();

    const response: ApiResponse<ProxyStatus> = {
      success: true,
      data: {
        hasProxy: true,
        proxyAddress: proxyData.proxy || proxyData.address,
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

// POST - Deploy a new proxy wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, signature } = body;

    if (!address || !signature) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Address and signature are required",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 400 });
    }

    // Request proxy deployment from Polymarket relayer
    const deployResponse = await fetch(
      `${POLY_RELAYER_URL}/proxy`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner: address,
          signature: signature,
        }),
      }
    );

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

    const response: ApiResponse<{ proxyAddress: string; txHash?: string }> = {
      success: true,
      data: {
        proxyAddress: deployData.proxy || deployData.address,
        txHash: deployData.txHash,
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
