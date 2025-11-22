// ============================================
// MRKT - Kalshi Order API
// Server-side RSA-SHA256 signed orders
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { kalshiClient } from "@/lib/kalshi/client";
import { ApiResponse } from "@/types";

export const runtime = "nodejs"; // Need Node.js for crypto

interface OrderRequest {
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count: number;
  type: "market" | "limit";
  price?: number;
}

interface OrderResponse {
  orderId: string;
  status: string;
  message?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check if Kalshi is in mock mode
    if (kalshiClient.isMockMode()) {
      console.warn("[MRKT] Kalshi running in MOCK MODE");

      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "KALSHI_MOCK_MODE",
          message: "Kalshi API keys not configured. Running in demo mode.",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 503 });
    }

    // Parse request body
    const body = (await request.json()) as OrderRequest;

    // Validate required fields
    if (!body.ticker || !body.side || !body.action || !body.count || !body.type) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Missing required fields: ticker, side, action, count, type",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 400 });
    }

    // Validate order parameters
    if (body.count <= 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "INVALID_COUNT",
          message: "Count must be greater than 0",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 400 });
    }

    if (body.type === "limit" && (!body.price || body.price < 1 || body.price > 99)) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "INVALID_PRICE",
          message: "Limit orders require price between 1 and 99 cents",
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 400 });
    }

    // Place order via Kalshi client
    const result = await kalshiClient.placeOrder({
      ticker: body.ticker,
      side: body.side,
      action: body.action,
      count: body.count,
      type: body.type,
      price: body.price,
    });

    const response: ApiResponse<OrderResponse> = {
      success: true,
      data: {
        orderId: result.order_id,
        status: "SUBMITTED",
        message: "Order submitted successfully",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[MRKT] Kalshi order error:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: "ORDER_FAILED",
        message: error instanceof Error ? error.message : "Order submission failed",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// GET - Check Kalshi API status
export async function GET() {
  const response: ApiResponse<{ configured: boolean; mockMode: boolean }> = {
    success: true,
    data: {
      configured: !kalshiClient.isMockMode(),
      mockMode: kalshiClient.isMockMode(),
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
