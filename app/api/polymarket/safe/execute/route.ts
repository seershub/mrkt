// ============================================
// MRKT - Polymarket Safe Transaction Execution API
// Execute transactions through Safe wallets via Relayer
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "@/types";
import { CONTRACTS, APPROVAL_TARGETS } from "@/lib/constants";

// Must use nodejs runtime for SDK
export const runtime = "nodejs";

// V2 Relayer URL
const POLY_RELAYER_URL = "https://relayer-v2.polymarket.com";
const CHAIN_ID = 137;

// Remote Builder Signing Server (from env or default)
const BUILDER_SIGNING_SERVER_URL =
  process.env.NEXT_PUBLIC_BUILDER_SIGNING_SERVER_URL ||
  "https://polymarket-builder-signing-server.vercel.app";

// Transaction types
interface ApprovalTransaction {
  type: "approval";
  tokenAddress: string;
  spenderAddress: string;
  amount: string | "max";
}

interface TransferTransaction {
  type: "transfer";
  tokenAddress: string;
  toAddress: string;
  amount: string;
}

type SafeTransactionRequest = ApprovalTransaction | TransferTransaction;

interface ExecuteRequest {
  ownerAddress: string;
  proxyAddress: string;
  transactions: SafeTransactionRequest[];
}

// ERC20 function signatures for encoding
const ERC20_APPROVE_SELECTOR = "0x095ea7b3"; // approve(address,uint256)
const ERC20_TRANSFER_SELECTOR = "0xa9059cbb"; // transfer(address,uint256)
const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

// Encode ERC20 approve call data
function encodeApproveData(spender: string, amount: string): string {
  const spenderPadded = spender.toLowerCase().replace("0x", "").padStart(64, "0");
  const amountHex = amount === "max" ? MAX_UINT256.replace("0x", "") : BigInt(amount).toString(16).padStart(64, "0");
  return `${ERC20_APPROVE_SELECTOR}${spenderPadded}${amountHex}`;
}

// Encode ERC20 transfer call data
function encodeTransferData(to: string, amount: string): string {
  const toPadded = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const amountHex = BigInt(amount).toString(16).padStart(64, "0");
  return `${ERC20_TRANSFER_SELECTOR}${toPadded}${amountHex}`;
}

// Safe transaction format for relayer
interface RelayerSafeTransaction {
  to: string;
  operation: number; // 0 = Call, 1 = DelegateCall
  data: string;
  value: string;
}

// Build Safe transactions from requests
function buildSafeTransactions(requests: SafeTransactionRequest[]): RelayerSafeTransaction[] {
  return requests.map((req) => {
    if (req.type === "approval") {
      return {
        to: req.tokenAddress,
        operation: 0,
        data: encodeApproveData(req.spenderAddress, req.amount === "max" ? "max" : req.amount),
        value: "0",
      };
    } else if (req.type === "transfer") {
      return {
        to: req.tokenAddress,
        operation: 0,
        data: encodeTransferData(req.toAddress, req.amount),
        value: "0",
      };
    }
    throw new Error(`Unknown transaction type: ${(req as { type: string }).type}`);
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExecuteRequest;
    const { ownerAddress, proxyAddress, transactions } = body;

    // Validate request
    if (!ownerAddress || !proxyAddress || !transactions?.length) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Missing ownerAddress, proxyAddress, or transactions",
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    console.log("[MRKT] Safe execute request:", {
      owner: ownerAddress,
      proxy: proxyAddress,
      txCount: transactions.length,
    });

    // For browser wallets, we cannot execute Safe transactions server-side
    // because we don't have the user's private key to sign.
    // The user needs to sign the Safe transaction with their wallet.

    // Option 1: Guide user to Polymarket (current fallback)
    // Option 2: Implement client-side Safe signing (complex)
    // Option 3: Use a custodial solution (not recommended for user funds)

    // For now, return a message that this requires Polymarket or client-side signing
    const response: ApiResponse<{
      requiresPolymarket: boolean;
      message: string;
    }> = {
      success: false,
      error: {
        code: "REQUIRES_POLYMARKET",
        message: "Safe transactions require wallet signature. Please use Polymarket to approve USDC.",
      },
      data: {
        requiresPolymarket: true,
        message: "To execute Safe transactions (like USDC approval), you need to sign with your wallet. Please visit Polymarket to complete the approval process.",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 400 });

    // NOTE: The code below would work if we had server-side wallet access
    // This is commented out because browser wallets don't expose private keys

    /*
    // Build Safe transactions
    const safeTransactions = buildSafeTransactions(transactions);

    // Get nonce from relayer
    const nonceResponse = await fetch(
      `${POLY_RELAYER_URL}/nonce?address=${ownerAddress}`,
      { headers: { Accept: "application/json" } }
    );

    if (!nonceResponse.ok) {
      throw new Error("Failed to get Safe nonce");
    }

    const { nonce } = await nonceResponse.json();

    // Would need to sign with user's wallet here
    // const signature = await wallet.signMessage(...);

    // Submit to relayer
    const submitResponse = await fetch(`${POLY_RELAYER_URL}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        type: "SAFE",
        from: ownerAddress,
        to: proxyAddress,
        proxyWallet: proxyAddress,
        data: encodeSafeTransactionData(safeTransactions),
        nonce,
        signature,
        signatureParams: {},
        metadata: "MRKT USDC Approval",
      }),
    });

    const result = await submitResponse.json();

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
    */

  } catch (error) {
    console.error("[MRKT] Safe execute error:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: "EXECUTION_FAILED",
        message: error instanceof Error ? error.message : "Safe transaction execution failed",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// GET - Check if Safe execution is available
export async function GET() {
  const response: ApiResponse<{
    serverExecutionAvailable: boolean;
    requiresClientSigning: boolean;
    message: string;
    approvalTargets: typeof APPROVAL_TARGETS;
  }> = {
    success: true,
    data: {
      serverExecutionAvailable: false, // We can't execute without user's private key
      requiresClientSigning: true,
      message: "Safe transactions require client-side signing. Users should approve USDC through Polymarket.",
      approvalTargets: APPROVAL_TARGETS,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
