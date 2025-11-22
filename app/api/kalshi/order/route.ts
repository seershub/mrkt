// ============================================
// MRKT - Kalshi Order API
// Server-side RSA-PSS/SHA256 signed orders
// Based on: https://docs.kalshi.com/getting_started/quick_start_authenticated_requests
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

// Generate RSA-PSS/SHA256 signature for Kalshi API
// Per Kalshi docs: Sign with RSA-PSS padding, MGF1 with SHA256
function generateSignature(
  timestampMs: string,
  method: string,
  path: string
): string {
  if (!KALSHI_PRIVATE_KEY) {
    throw new Error("Kalshi private key not configured");
  }

  // Strip query params from path for signing
  const pathWithoutQuery = path.split("?")[0];

  // Message format: timestamp + method + path (without query params)
  const message = `${timestampMs}${method}${pathWithoutQuery}`;

  // Use RSA-PSS with SHA256 (correct algorithm per Kalshi docs)
  const signature = crypto.sign("sha256", Buffer.from(message), {
    key: KALSHI_PRIVATE_KEY,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });

  return signature.toString("base64");
}

// Make authenticated request to Kalshi API
async function authenticatedRequest<T>(
  method: string,
  path: string,
  body?: object
): Promise<T> {
  // Timestamp in MILLISECONDS (per Kalshi docs)
  const timestampMs = Date.now().toString();
  const bodyString = body ? JSON.stringify(body) : undefined;

  const signature = generateSignature(timestampMs, method, path);

  const response = await fetch(`${KALSHI_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "KALSHI-ACCESS-KEY": KALSHI_API_KEY_ID!,
      "KALSHI-ACCESS-SIGNATURE": signature,
      "KALSHI-ACCESS-TIMESTAMP": timestampMs,
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
