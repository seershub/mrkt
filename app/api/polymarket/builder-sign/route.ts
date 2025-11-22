// ============================================
// MRKT - Polymarket Builder Signing Endpoint
// Remote builder authentication for client-side SDK
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { BuilderConfig } from "@polymarket/builder-signing-sdk";

export const runtime = "nodejs";

// Builder API credentials (server-only secrets)
const POLY_BUILDER_API_KEY = process.env.POLY_BUILDER_API_KEY;
const POLY_BUILDER_SECRET = process.env.POLY_BUILDER_SECRET;
const POLY_BUILDER_PASSPHRASE = process.env.POLY_BUILDER_PASSPHRASE;

const isBuilderConfigured = Boolean(
  POLY_BUILDER_API_KEY && POLY_BUILDER_SECRET && POLY_BUILDER_PASSPHRASE
);

// Initialize BuilderConfig for HMAC signing
function getBuilderConfig(): BuilderConfig | null {
  if (!isBuilderConfigured) return null;

  return new BuilderConfig({
    localBuilderCreds: {
      key: POLY_BUILDER_API_KEY!,
      secret: POLY_BUILDER_SECRET!,
      passphrase: POLY_BUILDER_PASSPHRASE!,
    },
  });
}

interface SignRequest {
  method: string;
  path: string;
  body?: string;
  timestamp?: number;
}

// POST - Sign builder headers for client-side SDK
export async function POST(request: NextRequest) {
  try {
    // Verify authorization (optional - add your own auth logic)
    const authHeader = request.headers.get("authorization");
    // You could verify a session token here

    if (!isBuilderConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: "Builder credentials not configured",
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as SignRequest;
    const { method, path, body: requestBody, timestamp } = body;

    if (!method || !path) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing method or path",
        },
        { status: 400 }
      );
    }

    const builderConfig = getBuilderConfig();
    if (!builderConfig) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to initialize builder config",
        },
        { status: 500 }
      );
    }

    // Generate HMAC headers
    const ts = timestamp || Date.now();
    const headers = await builderConfig.generateBuilderHeaders(
      method,
      path,
      requestBody || "",
      ts
    );

    console.log("[MRKT] Generated builder headers for:", { method, path });

    return NextResponse.json({
      success: true,
      headers: headers,
      timestamp: ts,
    });
  } catch (error) {
    console.error("[MRKT] Builder sign error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Signing failed",
      },
      { status: 500 }
    );
  }
}

// GET - Check builder status
export async function GET() {
  return NextResponse.json({
    success: true,
    configured: isBuilderConfigured,
    message: isBuilderConfigured
      ? "Builder signing is available"
      : "Builder credentials not configured",
  });
}
