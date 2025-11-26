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

// Rate limiting (simple in-memory)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
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
    // Rate limiting
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded" },
        { status: 429, headers: corsHeaders }
      );
    }

    if (!isBuilderConfigured) {
      console.error("[MRKT] Builder credentials not configured");
      return NextResponse.json(
        { success: false, error: "Builder credentials not configured" },
        { status: 503, headers: corsHeaders }
      );
    }

    const body = (await request.json()) as SignRequest;
    const { method, path, body: requestBody, timestamp } = body;

    if (!method || !path) {
      return NextResponse.json(
        { success: false, error: "Missing method or path" },
        { status: 400, headers: corsHeaders }
      );
    }

    const builderConfig = new BuilderConfig({
      localBuilderCreds: {
        key: POLY_BUILDER_API_KEY!,
        secret: POLY_BUILDER_SECRET!,
        passphrase: POLY_BUILDER_PASSPHRASE!,
      },
    });

    // Generate HMAC headers
    const ts = timestamp || Date.now();
    const headers = await builderConfig.generateBuilderHeaders(
      method,
      path,
      requestBody || "",
      ts
    );

    console.log("[MRKT] Builder headers generated for:", { method, path });

    return NextResponse.json(headers, { headers: corsHeaders });
  } catch (error) {
    console.error("[MRKT] Builder sign error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Signing failed" },
      { status: 500, headers: corsHeaders }
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
      : "Builder credentials not configured - check POLY_BUILDER_* env vars",
  }, { headers: corsHeaders });
}
