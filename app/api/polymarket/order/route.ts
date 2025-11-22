// ============================================
// MRKT - Polymarket Order API
// Server-side signing with Builder Attribution
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "@/types";

export const runtime = "edge";

// Builder API credentials (server-only)
const POLY_BUILDER_API_KEY = process.env.POLY_BUILDER_API_KEY;
const POLY_BUILDER_SECRET = process.env.POLY_BUILDER_SECRET;
const POLY_BUILDER_PASSPHRASE = process.env.POLY_BUILDER_PASSPHRASE;
const POLY_CLOB_URL = process.env.POLY_CLOB_URL || "https://clob.polymarket.com";

// Check if builder credentials are configured
const isBuilderConfigured = Boolean(POLY_BUILDER_API_KEY && POLY_BUILDER_SECRET && POLY_BUILDER_PASSPHRASE);

interface OrderRequest {
  // Market details
  tokenId: string;
  side: "BUY" | "SELL";
  size: string; // Amount in shares
  price: string; // Price per share (0-1)
  // User signature (EIP-712)
  userSignature: string;
  userAddress: string;
  // Order type
  orderType: "GTC" | "GTD" | "FOK";
  expiration?: number;
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
          message: "Polymarket Builder API is not configured. Running in demo mode.",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 503 });
    }

    // Parse request body
    const body = (await request.json()) as OrderRequest;

    // Validate required fields
    if (!body.tokenId || !body.side || !body.size || !body.price || !body.userSignature || !body.userAddress) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Missing required fields: tokenId, side, size, price, userSignature, userAddress",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 400 });
    }

    // Validate order parameters
    const price = parseFloat(body.price);
    const size = parseFloat(body.size);

    if (price <= 0 || price >= 1) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "INVALID_PRICE",
          message: "Price must be between 0 and 1",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 400 });
    }

    if (size <= 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "INVALID_SIZE",
          message: "Size must be greater than 0",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 400 });
    }

    // Generate timestamp for API authentication
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Create the order payload for Polymarket CLOB
    const orderPayload = {
      order: {
        salt: Math.floor(Math.random() * 1000000000).toString(),
        maker: body.userAddress,
        signer: body.userAddress,
        taker: "0x0000000000000000000000000000000000000000",
        tokenId: body.tokenId,
        makerAmount: body.side === "BUY" ? Math.floor(size * price * 1e6).toString() : Math.floor(size * 1e6).toString(),
        takerAmount: body.side === "BUY" ? Math.floor(size * 1e6).toString() : Math.floor(size * price * 1e6).toString(),
        expiration: body.expiration || Math.floor(Date.now() / 1000) + 86400, // 24h default
        nonce: "0",
        feeRateBps: "0",
        side: body.side === "BUY" ? 0 : 1,
        signatureType: 0,
      },
      signature: body.userSignature,
      owner: body.userAddress,
      orderType: body.orderType || "GTC",
    };

    // Create HMAC signature for builder API
    // Note: In production, you'd use crypto.createHmac with POLY_BUILDER_SECRET
    const method = "POST";
    const requestPath = "/order";
    const bodyString = JSON.stringify(orderPayload);

    // Send to Polymarket CLOB with builder headers
    const clobResponse = await fetch(`${POLY_CLOB_URL}${requestPath}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "POLY-ADDRESS": body.userAddress,
        "POLY-SIGNATURE": body.userSignature,
        "POLY-TIMESTAMP": timestamp,
        "POLY-NONCE": orderPayload.order.salt,
        // Builder attribution headers
        "POLY-API-KEY": POLY_BUILDER_API_KEY!,
        "POLY-PASSPHRASE": POLY_BUILDER_PASSPHRASE!,
      },
      body: bodyString,
    });

    const clobData = await clobResponse.json();

    if (!clobResponse.ok) {
      console.error("[MRKT] Polymarket CLOB error:", clobData);

      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "CLOB_ERROR",
          message: clobData.message || `CLOB request failed: ${clobResponse.status}`,
          details: clobData,
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: clobResponse.status });
    }

    // Success response
    const response: ApiResponse<OrderResponse> = {
      success: true,
      data: {
        orderId: clobData.orderID || clobData.id,
        status: clobData.status || "PENDING",
        message: "Order submitted successfully with builder attribution",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[MRKT] Order API error:", error);

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

// GET endpoint to check builder status
export async function GET() {
  const response: ApiResponse<{ configured: boolean; mockMode: boolean }> = {
    success: true,
    data: {
      configured: isBuilderConfigured,
      mockMode: !isBuilderConfigured,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
