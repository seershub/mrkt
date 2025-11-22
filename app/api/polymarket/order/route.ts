// ============================================
// MRKT - Polymarket Order API
// Server-side order submission with Builder Attribution
// Uses official @polymarket/clob-client SDK
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { ClobClient } from "@polymarket/clob-client";
import { BuilderConfig } from "@polymarket/builder-signing-sdk";
import { SignedOrder, Side } from "@polymarket/order-utils";
import { ApiResponse } from "@/types";

// Must use nodejs runtime for SDK (uses ethers.js)
export const runtime = "nodejs";

// Configuration
const POLY_CLOB_URL = process.env.POLY_CLOB_URL || "https://clob.polymarket.com";
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

// Initialize ClobClient with builder attribution
function getClobClient(): ClobClient {
  const builderConfig = getBuilderConfig();

  return new ClobClient(
    POLY_CLOB_URL,
    CHAIN_ID,
    undefined, // No signer needed server-side (client signs)
    undefined, // No API key creds (using builder mode)
    undefined, // Default signature type
    undefined, // No funder address
    undefined, // No geo block token
    true, // Use server time
    builderConfig // Builder config for attribution
  );
}

// Request body from client
interface OrderRequest {
  // The signed order from client (EIP-712)
  signedOrder: {
    salt: string;
    maker: string;
    signer: string;
    taker: string;
    tokenId: string;
    makerAmount: string;
    takerAmount: string;
    expiration: string;
    nonce: string;
    feeRateBps: string;
    side: number; // 0 = BUY, 1 = SELL
    signatureType: number;
    signature: string;
  };
  // Order metadata
  orderType: "GTC" | "GTD" | "FOK" | "FAK";
  // Optional: for neg risk markets
  negRisk?: boolean;
}

interface OrderResponse {
  orderId: string;
  status: string;
  message?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check builder configuration
    if (!isBuilderConfigured) {
      console.warn("[MRKT] Polymarket Builder credentials not configured");

      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "BUILDER_NOT_CONFIGURED",
          message:
            "Polymarket Builder API is not configured. Running in demo mode.",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 503 });
    }

    // Parse request body
    const body = (await request.json()) as OrderRequest;

    // Validate signed order
    if (!body.signedOrder || !body.signedOrder.signature) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Missing signed order with signature",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 400 });
    }

    const { signedOrder, orderType = "GTC" } = body;

    // Validate required signed order fields
    const requiredFields = [
      "salt",
      "maker",
      "signer",
      "tokenId",
      "makerAmount",
      "takerAmount",
      "expiration",
      "signature",
    ];

    for (const field of requiredFields) {
      if (
        !signedOrder[field as keyof typeof signedOrder] &&
        signedOrder[field as keyof typeof signedOrder] !== 0
      ) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: "INVALID_ORDER",
            message: `Missing required field: ${field}`,
          },
          timestamp: new Date().toISOString(),
        };

        return NextResponse.json(response, { status: 400 });
      }
    }

    // Convert to SDK SignedOrder format
    const order: SignedOrder = {
      salt: signedOrder.salt,
      maker: signedOrder.maker,
      signer: signedOrder.signer,
      taker: signedOrder.taker || "0x0000000000000000000000000000000000000000",
      tokenId: signedOrder.tokenId,
      makerAmount: signedOrder.makerAmount,
      takerAmount: signedOrder.takerAmount,
      expiration: signedOrder.expiration,
      nonce: signedOrder.nonce || "0",
      feeRateBps: signedOrder.feeRateBps || "0",
      side: signedOrder.side as Side,
      signatureType: signedOrder.signatureType || 0,
      signature: signedOrder.signature,
    };

    console.log("[MRKT] Submitting order to Polymarket CLOB:", {
      tokenId: order.tokenId,
      side: order.side === 0 ? "BUY" : "SELL",
      maker: order.maker,
      orderType,
    });

    // Get ClobClient with builder attribution
    const clobClient = getClobClient();

    // Submit order using SDK - this handles HMAC signing automatically
    const result = await clobClient.postOrder(order, orderType as any);

    console.log("[MRKT] Polymarket order result:", result);

    // Success response
    const response: ApiResponse<OrderResponse> = {
      success: true,
      data: {
        orderId: result.orderID || result.id || "submitted",
        status: result.status || "PENDING",
        message: "Order submitted successfully with builder attribution",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[MRKT] Order API error:", error);

    // Extract error message
    let errorMessage = "Internal server error";
    let errorCode = "INTERNAL_ERROR";

    if (error instanceof Error) {
      errorMessage = error.message;

      // Parse common CLOB errors
      if (errorMessage.includes("insufficient")) {
        errorCode = "INSUFFICIENT_BALANCE";
      } else if (errorMessage.includes("price")) {
        errorCode = "INVALID_PRICE";
      } else if (errorMessage.includes("size") || errorMessage.includes("amount")) {
        errorCode = "INVALID_SIZE";
      } else if (errorMessage.includes("signature")) {
        errorCode = "INVALID_SIGNATURE";
      }
    }

    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// GET endpoint to check builder status and CLOB health
export async function GET() {
  try {
    if (isBuilderConfigured) {
      // Try to ping the CLOB
      const clobClient = getClobClient();
      await clobClient.getOk();
    }

    const response: ApiResponse<{
      configured: boolean;
      mockMode: boolean;
      clobUrl: string;
    }> = {
      success: true,
      data: {
        configured: isBuilderConfigured,
        mockMode: !isBuilderConfigured,
        clobUrl: POLY_CLOB_URL,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse<{
      configured: boolean;
      mockMode: boolean;
      clobUrl: string;
      error?: string;
    }> = {
      success: true,
      data: {
        configured: isBuilderConfigured,
        mockMode: !isBuilderConfigured,
        clobUrl: POLY_CLOB_URL,
        error: error instanceof Error ? error.message : "CLOB unreachable",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  }
}
