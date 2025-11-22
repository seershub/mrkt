// ============================================
// MRKT - Kalshi Order API
// Server-side RSA-SHA256 signed orders
// ============================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { API_ENDPOINTS } from "@/lib/constants";
import { ApiResponse } from "@/types";

export const runtime = "nodejs"; // Need Node.js for crypto

// Kalshi API configuration
const KALSHI_URL = API_ENDPOINTS.KALSHI.BASE;
const KALSHI_API_KEY_ID = process.env.KALSHI_API_KEY_ID;
const KALSHI_PRIVATE_KEY = process.env.KALSHI_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Check if credentials are configured
const isConfigured = Boolean(KALSHI_API_KEY_ID && KALSHI_PRIVATE_KEY);

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

// Generate RSA-SHA256 signature for Kalshi API
function generateSignature(
  timestamp: string,
  method: string,
  path: string,
  body?: string
): string {
  if (!KALSHI_PRIVATE_KEY) {
    throw new Error("Kalshi private key not configured");
  }

  const message = `${timestamp}${method}${path}${body || ""}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message);
  sign.end();
  return sign.sign(KALSHI_PRIVATE_KEY, "base64");
}

// Make authenticated request to Kalshi API
async function authenticatedRequest<T>(
  method: string,
  path: string,
  body?: object
): Promise<T> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyString = body ? JSON.stringify(body) : undefined;

  const signature = generateSignature(timestamp, method, path, bodyString);

  const response = await fetch(`${KALSHI_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "KALSHI-ACCESS-KEY": KALSHI_API_KEY_ID!,
      "KALSHI-ACCESS-SIGNATURE": signature,
      "KALSHI-ACCESS-TIMESTAMP": timestamp,
    },
    body: bodyString,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Kalshi API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json() as Promise<T>;
}

export async function POST(request: NextRequest) {
  try {
    // Check if Kalshi is configured
    if (!isConfigured) {
      console.warn("[MRKT] Kalshi running in MOCK MODE - API keys not configured");

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

    // Place order via Kalshi API
    const result = await authenticatedRequest<{ order_id: string }>(
      "POST",
      "/portfolio/orders",
      {
        ticker: body.ticker,
        side: body.side,
        action: body.action,
        count: body.count,
        type: body.type,
        ...(body.type === "limit" && body.price ? { yes_price: body.price } : {}),
      }
    );

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
      configured: isConfigured,
      mockMode: !isConfigured,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
