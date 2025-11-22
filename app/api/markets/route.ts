// ============================================
// MRKT - Unified Markets API
// Aggregates data from Polymarket and Kalshi
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { polymarketClient } from "@/lib/polymarket/clob";
import { kalshiClient } from "@/lib/kalshi/client";
import { UnifiedMarket, ApiResponse, PaginatedResponse, SportCategory, Platform } from "@/types";

export const runtime = "edge";
export const revalidate = 60;

// Sort markets by different criteria
function sortMarkets(
  markets: UnifiedMarket[],
  sortBy: string,
  sortOrder: "asc" | "desc"
): UnifiedMarket[] {
  const sorted = [...markets].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "volume":
        comparison = (b.volume || 0) - (a.volume || 0);
        break;
      case "liquidity":
        comparison = (b.liquidity || 0) - (a.liquidity || 0);
        break;
      case "endDate":
        comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
        break;
      case "price":
        const aPrice = a.outcomes[0]?.price || 0;
        const bPrice = b.outcomes[0]?.price || 0;
        comparison = bPrice - aPrice;
        break;
      default:
        comparison = (b.volume || 0) - (a.volume || 0);
    }

    return sortOrder === "asc" ? -comparison : comparison;
  });

  return sorted;
}

// Filter markets by various criteria
function filterMarkets(
  markets: UnifiedMarket[],
  filters: {
    categories?: SportCategory[];
    platforms?: Platform[];
    status?: string[];
    search?: string;
    minVolume?: number;
  }
): UnifiedMarket[] {
  return markets.filter((market) => {
    // Filter by category
    if (filters.categories?.length && !filters.categories.includes(market.category)) {
      return false;
    }

    // Filter by platform
    if (filters.platforms?.length && !filters.platforms.includes(market.platform)) {
      return false;
    }

    // Filter by status
    if (filters.status?.length && !filters.status.includes(market.status)) {
      return false;
    }

    // Filter by minimum volume
    if (filters.minVolume && market.volume < filters.minVolume) {
      return false;
    }

    // Filter by search query
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (
        !market.title.toLowerCase().includes(searchLower) &&
        !market.description.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    return true;
  });
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;

  // Parse query parameters
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20"), 100);
  const sortBy = searchParams.get("sortBy") || "volume";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
  const search = searchParams.get("search") || undefined;
  const minVolume = searchParams.get("minVolume")
    ? parseInt(searchParams.get("minVolume")!)
    : undefined;

  // Parse array parameters
  const categories = searchParams.get("categories")?.split(",") as SportCategory[] | undefined;
  const platforms = searchParams.get("platforms")?.split(",") as Platform[] | undefined;
  const status = searchParams.get("status")?.split(",");

  try {
    // Fetch from both platforms in parallel
    const [polymarketMarkets, kalshiMarkets] = await Promise.allSettled([
      polymarketClient.getSportsEvents(),
      kalshiClient.getSportsEvents(),
    ]);

    // Combine results
    let allMarkets: UnifiedMarket[] = [];

    if (polymarketMarkets.status === "fulfilled") {
      allMarkets = allMarkets.concat(polymarketMarkets.value);
    } else {
      console.error("[MRKT] Polymarket fetch failed:", polymarketMarkets.reason);
    }

    if (kalshiMarkets.status === "fulfilled") {
      allMarkets = allMarkets.concat(kalshiMarkets.value);
    } else {
      console.error("[MRKT] Kalshi fetch failed:", kalshiMarkets.reason);
    }

    // Apply filters
    const filteredMarkets = filterMarkets(allMarkets, {
      categories,
      platforms,
      status,
      search,
      minVolume,
    });

    // Sort markets
    const sortedMarkets = sortMarkets(filteredMarkets, sortBy, sortOrder);

    // Paginate
    const total = sortedMarkets.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedMarkets = sortedMarkets.slice(startIndex, startIndex + pageSize);

    const response: ApiResponse<PaginatedResponse<UnifiedMarket>> = {
      success: true,
      data: {
        items: paginatedMarkets,
        total,
        page,
        pageSize,
        hasMore: startIndex + pageSize < total,
      },
      timestamp: new Date().toISOString(),
    };

    // Add timing header
    const duration = Date.now() - startTime;

    return NextResponse.json(response, {
      headers: {
        "X-Response-Time": `${duration}ms`,
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[MRKT] Markets API error:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: "API_ERROR",
        message: error instanceof Error ? error.message : "Failed to fetch markets",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}
