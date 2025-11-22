// ============================================
// MRKT - Kalshi Balance API
// Fetch user balance from Kalshi
// ============================================

import { NextResponse } from "next/server";
import crypto from "crypto";
import { API_ENDPOINTS } from "@/lib/constants";
import { ApiResponse } from "@/types";

export const runtime = "nodejs";

// Kalshi API configuration
const KALSHI_URL = API_ENDPOINTS.KALSHI.BASE;
const KALSHI_API_KEY_ID = process.env.KALSHI_API_KEY_ID;
const KALSHI_PRIVATE_KEY = process.env.KALSHI_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Check if credentials are configured
const isConfigured = Boolean(KALSHI_API_KEY_ID && KALSHI_PRIVATE_KEY);

// Generate RSA-PSS/SHA256 signature
function generateSignature(
  timestampMs: string,
  method: string,
  path: string
): string {
  if (!KALSHI_PRIVATE_KEY) {
    throw new Error("Kalshi private key not configured");
  }

  const pathWithoutQuery = path.split("?")[0];
  const message = `${timestampMs}${method}${pathWithoutQuery}`;

  const signature = crypto.sign("sha256", Buffer.from(message), {
    key: KALSHI_PRIVATE_KEY,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });

  return signature.toString("base64");
}

export async function GET() {
  // If not configured, return mock balance for demo
  if (!isConfigured) {
    const response: ApiResponse<{ balance: number; configured: boolean }> = {
      success: true,
      data: {
        balance: 0,
        configured: false,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  }

  try {
    const timestampMs = Date.now().toString();
    const path = "/portfolio/balance";
    const signature = generateSignature(timestampMs, "GET", path);

    const balanceResponse = await fetch(`${KALSHI_URL}${path}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "KALSHI-ACCESS-KEY": KALSHI_API_KEY_ID!,
        "KALSHI-ACCESS-SIGNATURE": signature,
        "KALSHI-ACCESS-TIMESTAMP": timestampMs,
      },
    });

    if (!balanceResponse.ok) {
      const error = await balanceResponse.json().catch(() => ({}));
      throw new Error(`Kalshi API error: ${balanceResponse.status} - ${JSON.stringify(error)}`);
    }

    const data = await balanceResponse.json();

    // Kalshi returns balance in cents, convert to dollars
    const balanceUsd = (data.balance || 0) / 100;

    const response: ApiResponse<{ balance: number; configured: boolean }> = {
      success: true,
      data: {
        balance: balanceUsd,
        configured: true,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[MRKT] Kalshi balance error:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: "BALANCE_FETCH_FAILED",
        message: error instanceof Error ? error.message : "Failed to fetch balance",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}
