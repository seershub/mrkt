import { NextRequest, NextResponse } from "next/server";
import { API_ENDPOINTS } from "@/lib/constants";

export const runtime = "edge";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get("limit") || "100";
        const cursor = searchParams.get("cursor");
        const status = searchParams.get("status") || "open";

        // Construct Kalshi API URL
        let kalshiUrl = `${API_ENDPOINTS.KALSHI.BASE}/events?status=${status}&with_nested_markets=true&category=Sports&limit=${limit}`;
        if (cursor) {
            kalshiUrl += `&cursor=${cursor}`;
        }

        console.log("[MRKT] Proxying Kalshi request:", kalshiUrl);

        const response = await fetch(kalshiUrl, {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            next: { revalidate: 60 },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[MRKT] Kalshi Proxy Error:", response.status, errorText);
            return NextResponse.json(
                { error: `Kalshi API error: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("[MRKT] Kalshi Proxy Fatal Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch from Kalshi" },
            { status: 500 }
        );
    }
}
