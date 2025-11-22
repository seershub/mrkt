// ============================================
// MRKT - Polymarket Proxy Wallet API
// Check and deploy Gnosis Safe proxy wallets
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "@/types";
import { keccak256, encodePacked, getAddress } from "viem";
import { CONTRACTS } from "@/lib/constants";

export const runtime = "edge";

const POLY_RELAYER_URL = "https://relayer.polymarket.com";

// Gnosis Safe constants for computing CREATE2 address
const SAFE_SINGLETON = "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552";

interface ProxyStatus {
  hasProxy: boolean;
  proxyAddress?: string;
  computedAddress?: string; // Always returned so users can fund before deployment
  isDeployed?: boolean;
  allowance?: string;
}

// Compute the deterministic proxy address using CREATE2
// This allows users to see their proxy address and fund it before deployment
function computeProxyAddress(ownerAddress: string): string {
  try {
    // Polymarket uses a specific salt based on owner address
    const salt = keccak256(
      encodePacked(
        ["address", "uint256"],
        [getAddress(ownerAddress), BigInt(0)]
      )
    );

    // Simplified proxy init code hash for Gnosis Safe
    const proxyInitCode = encodePacked(
      ["bytes", "bytes32"],
      [
        "0x608060405234801561001057600080fd5b50" as `0x${string}`,
        keccak256(encodePacked(["address"], [SAFE_SINGLETON as `0x${string}`])),
      ]
    );
    const initCodeHash = keccak256(proxyInitCode);

    // CREATE2 formula: keccak256(0xff ++ factory ++ salt ++ initCodeHash)
    const create2Address = keccak256(
      encodePacked(
        ["bytes1", "address", "bytes32", "bytes32"],
        [
          "0xff",
          CONTRACTS.SAFE_PROXY_FACTORY as `0x${string}`,
          salt,
          initCodeHash,
        ]
      )
    );

    // Extract last 20 bytes as address
    return getAddress(`0x${create2Address.slice(-40)}`);
  } catch (error) {
    console.error("[MRKT] Failed to compute proxy address:", error);
    return "";
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
    // Always compute expected proxy address (useful for pre-funding)
    const computedAddress = computeProxyAddress(address);

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
      // No proxy exists yet - return computed address for pre-funding
      const response: ApiResponse<ProxyStatus> = {
        success: true,
        data: {
          hasProxy: false,
          computedAddress: computedAddress || undefined,
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
    const actualProxyAddress = proxyData.proxy || proxyData.address;

    const response: ApiResponse<ProxyStatus> = {
      success: true,
      data: {
        hasProxy: true,
        proxyAddress: actualProxyAddress,
        computedAddress: computedAddress || actualProxyAddress,
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
