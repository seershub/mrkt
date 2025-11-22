// ============================================
// MRKT - Kalshi API Client
// Public API client for market data (Edge compatible)
// Note: Authenticated requests use separate server-only module
// ============================================

import { API_ENDPOINTS } from "@/lib/constants";
import {
  KalshiEvent,
  KalshiMarket,
  UnifiedMarket,
  MarketOutcome,
  SportCategory,
} from "@/types";

// Kalshi API base URL
const KALSHI_URL = API_ENDPOINTS.KALSHI.BASE;

// Map Kalshi categories to our sport categories
const KALSHI_CATEGORY_MAP: Record<string, SportCategory> = {
  sports: "other",
  "sports-nfl": "nfl",
  "sports-nba": "nba",
  "sports-mlb": "mlb",
  "sports-nhl": "nhl",
  "sports-soccer": "soccer",
  "sports-mma": "mma",
  "sports-tennis": "tennis",
  "sports-golf": "golf",
};

// Detect sport category from Kalshi data
function detectKalshiCategory(market: KalshiMarket, event?: KalshiEvent): SportCategory {
  const category = event?.category || market.market_type || "";
  const lowerCategory = category.toLowerCase();

  // Check direct mapping
  for (const [key, value] of Object.entries(KALSHI_CATEGORY_MAP)) {
    if (lowerCategory.includes(key)) return value;
  }

  // Check title for sports keywords
  const title = (market.title || "").toLowerCase();

  if (title.includes("nfl") || title.includes("super bowl")) return "nfl";
  if (title.includes("nba") || title.includes("basketball")) return "nba";
  if (title.includes("mlb") || title.includes("baseball")) return "mlb";
  if (title.includes("nhl") || title.includes("hockey")) return "nhl";
  if (title.includes("soccer") || title.includes("world cup")) return "soccer";
  if (title.includes("ufc") || title.includes("mma") || title.includes("boxing")) return "mma";
  if (title.includes("tennis")) return "tennis";
  if (title.includes("golf") || title.includes("pga")) return "golf";

  return "other";
}

// Transform Kalshi market to UnifiedMarket
export function transformKalshiMarket(
  market: KalshiMarket,
  event?: KalshiEvent
): UnifiedMarket {
  // Create outcomes from yes/no prices
  const outcomes: MarketOutcome[] = [
    {
      id: `${market.ticker}-yes`,
      name: "Yes",
      price: market.yes_bid ? market.yes_bid / 100 : 0.5,
      previousPrice: market.previous_yes_bid ? market.previous_yes_bid / 100 : undefined,
    },
    {
      id: `${market.ticker}-no`,
      name: "No",
      price: market.no_bid ? market.no_bid / 100 : 0.5,
    },
  ];

  // Determine status
  let status: "open" | "closed" | "resolved" | "disputed" = "open";
  if (market.status === "closed" || market.status === "settled") {
    status = market.result ? "resolved" : "closed";
  }

  return {
    id: `kalshi_${market.ticker}`,
    platformId: market.ticker,
    platform: "kalshi",
    title: market.title,
    description: market.subtitle || "",
    category: detectKalshiCategory(market, event),
    status,
    isLive: market.status === "active" || market.status === "open",
    outcomes,
    endDate: market.close_time || market.expiration_time,
    createdAt: new Date().toISOString(), // Kalshi doesn't provide creation date
    volume: market.volume || 0,
    liquidity: market.liquidity || market.open_interest || 0,
    tags: event ? [event.category] : [],
    rawData: market,
  };
}

// Kalshi client class (Edge compatible - public endpoints only)
export class KalshiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = KALSHI_URL;
  }

  // Make public (unauthenticated) request - Edge compatible
  private async publicRequest<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`Kalshi API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // Check if authenticated mode is available (always false in Edge)
  isMockMode(): boolean {
    // Authenticated features require server-side Node.js runtime
    // Use /api/kalshi/order for authenticated requests
    return true;
  }

  // Get sports events
  async getSportsEvents(): Promise<UnifiedMarket[]> {
    try {
      // Kalshi's public events endpoint
      const data = await this.publicRequest<{ events: KalshiEvent[] }>(
        "/events?status=open&with_nested_markets=true&category=Sports"
      );

      const markets: UnifiedMarket[] = [];

      for (const event of data.events || []) {
        for (const market of event.markets || []) {
          markets.push(transformKalshiMarket(market, event));
        }
      }

      return markets;
    } catch (error) {
      console.error("[MRKT] Kalshi getSportsEvents error:", error);
      return [];
    }
  }

  // Get all active markets
  async getActiveMarkets(limit = 100): Promise<UnifiedMarket[]> {
    try {
      const data = await this.publicRequest<{ markets: KalshiMarket[] }>(
        `/markets?status=open&limit=${limit}`
      );

      return (data.markets || [])
        .filter((m) => detectKalshiCategory(m) !== "other")
        .map((m) => transformKalshiMarket(m));
    } catch (error) {
      console.error("[MRKT] Kalshi getActiveMarkets error:", error);
      return [];
    }
  }

  // Get single market
  async getMarket(ticker: string): Promise<UnifiedMarket | null> {
    try {
      const data = await this.publicRequest<{ market: KalshiMarket }>(
        `/markets/${ticker}`
      );

      if (!data.market) return null;
      return transformKalshiMarket(data.market);
    } catch (error) {
      console.error("[MRKT] Kalshi getMarket error:", error);
      return null;
    }
  }

  // Get market orderbook
  async getOrderBook(
    ticker: string
  ): Promise<{ yes: { price: number; quantity: number }[]; no: { price: number; quantity: number }[] } | null> {
    try {
      const data = await this.publicRequest<{
        orderbook: {
          yes: { price: number; quantity: number }[];
          no: { price: number; quantity: number }[];
        };
      }>(`/markets/${ticker}/orderbook`);

      return data.orderbook;
    } catch (error) {
      console.error("[MRKT] Kalshi getOrderBook error:", error);
      return null;
    }
  }
}

// Export singleton for public endpoints
export const kalshiClient = new KalshiClient();
