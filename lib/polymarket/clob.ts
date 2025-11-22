// ============================================
// MRKT - Polymarket CLOB Client
// Official SDK wrapper with builder attribution
// Per Polymarket docs: https://docs.polymarket.com
// ============================================

import { API_ENDPOINTS } from "@/lib/constants";
import {
  PolymarketEvent,
  PolymarketMarket,
  PolymarketOrderBook,
  UnifiedMarket,
  MarketOutcome,
  SportCategory,
} from "@/types";

// Polymarket API endpoints (per official docs)
const CLOB_URL = API_ENDPOINTS.POLYMARKET.CLOB;
const GAMMA_URL = API_ENDPOINTS.POLYMARKET.GAMMA;
const DATA_URL = API_ENDPOINTS.POLYMARKET.DATA;

// Map Polymarket tags to our categories
const TAG_TO_CATEGORY: Record<string, SportCategory> = {
  nfl: "nfl",
  "nfl-football": "nfl",
  football: "nfl",
  nba: "nba",
  basketball: "nba",
  mlb: "mlb",
  baseball: "mlb",
  nhl: "nhl",
  hockey: "nhl",
  soccer: "soccer",
  "premier-league": "soccer",
  "champions-league": "soccer",
  mma: "mma",
  ufc: "mma",
  boxing: "mma",
  tennis: "tennis",
  golf: "golf",
  pga: "golf",
  esports: "esports",
  gaming: "esports",
};

// Detect sport category from event/market data
function detectCategory(title: string, tags?: string[]): SportCategory {
  const lowerTitle = title.toLowerCase();

  // Check tags first
  if (tags) {
    for (const tag of tags) {
      const category = TAG_TO_CATEGORY[tag.toLowerCase()];
      if (category) return category;
    }
  }

  // Check title keywords
  if (lowerTitle.includes("nfl") || lowerTitle.includes("super bowl")) return "nfl";
  if (lowerTitle.includes("nba") || lowerTitle.includes("basketball")) return "nba";
  if (lowerTitle.includes("mlb") || lowerTitle.includes("baseball")) return "mlb";
  if (lowerTitle.includes("nhl") || lowerTitle.includes("hockey")) return "nhl";
  if (
    lowerTitle.includes("soccer") ||
    lowerTitle.includes("premier league") ||
    lowerTitle.includes("champions league") ||
    lowerTitle.includes("world cup")
  )
    return "soccer";
  if (lowerTitle.includes("ufc") || lowerTitle.includes("mma") || lowerTitle.includes("boxing"))
    return "mma";
  if (lowerTitle.includes("tennis") || lowerTitle.includes("wimbledon")) return "tennis";
  if (lowerTitle.includes("golf") || lowerTitle.includes("pga")) return "golf";
  if (lowerTitle.includes("esports") || lowerTitle.includes("gaming")) return "esports";

  return "other";
}

// Extended Polymarket market type with additional fields from CLOB
interface ExtendedPolymarketMarket extends PolymarketMarket {
  negRisk?: boolean;
  enableOrderBook?: boolean;
  minimumOrderSize?: string;
  minimumTickSize?: string;
  orderPriceMinTickSize?: number;
  tokens?: Array<{
    token_id: string;
    outcome: string;
    price?: number;
    winner?: boolean;
  }>;
}

// Parse outcomes from Polymarket market
function parseOutcomes(market: ExtendedPolymarketMarket): MarketOutcome[] {
  try {
    const outcomes = JSON.parse(market.outcomes || '["Yes", "No"]') as string[];
    const prices = JSON.parse(market.outcomePrices || "[0.5, 0.5]") as string[];
    const tokenIds = JSON.parse(market.clobTokenIds || "[]") as string[];

    return outcomes.map((name, index) => ({
      id: `${market.id}-${index}`,
      name,
      price: parseFloat(prices[index] || "0.5"),
      tokenId: tokenIds[index],
    }));
  } catch {
    // Try to use tokens array if available
    if (market.tokens && market.tokens.length > 0) {
      return market.tokens.map((token, index) => ({
        id: `${market.id}-${index}`,
        name: token.outcome || (index === 0 ? "Yes" : "No"),
        price: token.price || 0.5,
        tokenId: token.token_id,
      }));
    }
    // Default YES/NO outcomes
    return [
      { id: `${market.id}-0`, name: "Yes", price: 0.5 },
      { id: `${market.id}-1`, name: "No", price: 0.5 },
    ];
  }
}

// Transform Polymarket event to UnifiedMarket
export function transformPolymarketEvent(event: PolymarketEvent & { negRisk?: boolean }): UnifiedMarket[] {
  return event.markets.map((market) => {
    const extMarket = market as ExtendedPolymarketMarket;
    const outcomes = parseOutcomes(extMarket);

    return {
      id: `poly_${market.id}`,
      platformId: market.id,
      platform: "polymarket",
      title: market.question || event.title,
      description: market.description || event.description,
      category: detectCategory(event.title),
      status: market.closed ? "closed" : market.active ? "open" : "resolved",
      isLive: market.active && !market.closed,
      outcomes,
      endDate: market.endDate || event.endDate,
      createdAt: market.startDate || event.startDate,
      volume: market.volume || 0,
      liquidity: market.liquidity || 0,
      imageUrl: market.image || event.image,
      tags: [],
      rawData: market,
      // Polymarket-specific fields
      negRisk: extMarket.negRisk ?? event.negRisk ?? false,
      conditionId: market.conditionId,
      minOrderSize: extMarket.minimumOrderSize ? parseFloat(extMarket.minimumOrderSize) : undefined,
    };
  });
}

// Transform single Polymarket market to UnifiedMarket
export function transformPolymarketMarket(market: PolymarketMarket): UnifiedMarket {
  const extMarket = market as ExtendedPolymarketMarket;
  const outcomes = parseOutcomes(extMarket);

  return {
    id: `poly_${market.id}`,
    platformId: market.id,
    platform: "polymarket",
    title: market.question,
    description: market.description,
    category: detectCategory(market.question),
    status: market.closed ? "closed" : market.active ? "open" : "resolved",
    isLive: market.active && !market.closed,
    outcomes,
    endDate: market.endDate,
    createdAt: market.startDate,
    volume: market.volume || 0,
    liquidity: market.liquidity || 0,
    imageUrl: market.image,
    tags: [],
    rawData: market,
    // Polymarket-specific fields
    negRisk: extMarket.negRisk ?? false,
    conditionId: market.conditionId,
    minOrderSize: extMarket.minimumOrderSize ? parseFloat(extMarket.minimumOrderSize) : undefined,
  };
}

// Polymarket client class
// Uses Gamma API for market data and CLOB API for trading data
// Per docs: https://docs.polymarket.com
export class PolymarketClient {
  private baseUrl: string;
  private gammaUrl: string;
  private dataUrl: string;

  constructor() {
    this.baseUrl = CLOB_URL;
    this.gammaUrl = GAMMA_URL;
    this.dataUrl = DATA_URL;
  }

  // Fetch ALL active events from Gamma API (no category filter)
  // This is the main method for getting markets
  async getAllEvents(limit = 100): Promise<UnifiedMarket[]> {
    const response = await fetch(
      `${this.gammaUrl}/events?closed=false&order=id&ascending=false&limit=${limit}`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket Gamma API error: ${response.status}`);
    }

    const events = (await response.json()) as (PolymarketEvent & { negRisk?: boolean })[];

    // Transform all events to unified markets (no filtering)
    return events.flatMap(transformPolymarketEvent);
  }

  // Fetch sports events from Gamma API (filtered)
  // Per docs: Use /events endpoint with proper parameters
  async getSportsEvents(): Promise<UnifiedMarket[]> {
    // Get all events first, then filter for sports
    const allMarkets = await this.getAllEvents();
    return allMarkets.filter((m) => m.category !== "other");
  }

  // Fetch all active markets
  // Per docs: /markets endpoint with order=id, ascending=false, closed=false
  async getActiveMarkets(limit = 100): Promise<UnifiedMarket[]> {
    const response = await fetch(
      `${this.gammaUrl}/markets?closed=false&order=id&ascending=false&limit=${limit}`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket Gamma API error: ${response.status}`);
    }

    const markets = (await response.json()) as PolymarketMarket[];

    // Filter for sports-related markets
    return markets
      .filter((m) => detectCategory(m.question) !== "other")
      .map(transformPolymarketMarket);
  }

  // Fetch single market by ID or slug
  // Per docs: /markets/{id} or /markets/slug/{slug}
  async getMarket(marketId: string): Promise<UnifiedMarket | null> {
    const response = await fetch(`${this.gammaUrl}/markets/${marketId}`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Polymarket Gamma API error: ${response.status}`);
    }

    const market = (await response.json()) as PolymarketMarket;
    return transformPolymarketMarket(market);
  }

  // Fetch event by slug
  // Per docs: /events/slug/{slug}
  async getEventBySlug(slug: string): Promise<UnifiedMarket[] | null> {
    const response = await fetch(`${this.gammaUrl}/events/slug/${slug}`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Polymarket Gamma API error: ${response.status}`);
    }

    const event = (await response.json()) as PolymarketEvent & { negRisk?: boolean };
    return transformPolymarketEvent(event);
  }

  // Fetch order book for a market
  // Per docs: GET /book?token_id={token_id}
  async getOrderBook(tokenId: string): Promise<PolymarketOrderBook | null> {
    const response = await fetch(`${this.baseUrl}/book?token_id=${tokenId}`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 5 }, // Short cache for order book
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Polymarket CLOB error: ${response.status}`);
    }

    return (await response.json()) as PolymarketOrderBook;
  }

  // Get price for a specific token
  // Per docs: GET /price?token_id={token_id}&side={BUY|SELL}
  async getPrice(tokenId: string, side: "BUY" | "SELL" = "BUY"): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/price?token_id=${tokenId}&side=${side}`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 10 },
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket CLOB error: ${response.status}`);
    }

    const data = (await response.json()) as { price: string };
    return parseFloat(data.price);
  }

  // Get midpoint price
  // Per docs: GET /midpoint?token_id={token_id}
  async getMidpointPrice(tokenId: string): Promise<number> {
    const response = await fetch(`${this.baseUrl}/midpoint?token_id=${tokenId}`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 10 },
    });

    if (!response.ok) {
      throw new Error(`Polymarket CLOB error: ${response.status}`);
    }

    const data = (await response.json()) as { mid: string };
    return parseFloat(data.mid);
  }

  // Get price history
  // Per docs: GET /prices-history?market={clob_token_id}
  async getPriceHistory(
    tokenId: string,
    interval?: "1h" | "6h" | "1d" | "1w" | "1m" | "max"
  ): Promise<{ t: number; p: number }[]> {
    const params = new URLSearchParams({ market: tokenId });
    if (interval) params.append("interval", interval);

    const response = await fetch(`${this.baseUrl}/prices-history?${params}`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`Polymarket CLOB error: ${response.status}`);
    }

    const data = (await response.json()) as { history: { t: number; p: number }[] };
    return data.history;
  }

  // Get user balances from Data API
  // Per docs: Data API for user holdings
  async getUserBalances(address: string): Promise<{ balance: number; positions: unknown[] } | null> {
    try {
      const response = await fetch(
        `${this.dataUrl}/users/${address}/balances`,
        {
          headers: {
            Accept: "application/json",
          },
          next: { revalidate: 30 },
        }
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        return null; // Silently fail for Data API
      }

      return await response.json();
    } catch {
      return null;
    }
  }

  // Search markets using Gamma API
  async searchMarkets(query: string): Promise<UnifiedMarket[]> {
    // Per docs: Gamma search uses different endpoint pattern
    const response = await fetch(
      `${this.gammaUrl}/markets?closed=false&limit=50&order=id&ascending=false`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket Gamma API error: ${response.status}`);
    }

    const markets = (await response.json()) as PolymarketMarket[];

    // Client-side filter for search (Gamma doesn't have text search param)
    const queryLower = query.toLowerCase();
    return markets
      .filter(
        (m) =>
          m.question.toLowerCase().includes(queryLower) ||
          m.description.toLowerCase().includes(queryLower)
      )
      .map(transformPolymarketMarket);
  }

  // Check CLOB health
  // Per docs: GET /
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`, {
        headers: { Accept: "application/json" },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const polymarketClient = new PolymarketClient();
