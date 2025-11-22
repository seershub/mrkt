// ============================================
// MRKT - Polymarket CLOB Client
// Official SDK wrapper with builder attribution
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

// Polymarket API endpoints
const CLOB_URL = API_ENDPOINTS.POLYMARKET.CLOB;
const GAMMA_URL = API_ENDPOINTS.POLYMARKET.GAMMA;

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

// Parse outcomes from Polymarket market
function parseOutcomes(market: PolymarketMarket): MarketOutcome[] {
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
    // Default YES/NO outcomes
    return [
      { id: `${market.id}-0`, name: "Yes", price: 0.5 },
      { id: `${market.id}-1`, name: "No", price: 0.5 },
    ];
  }
}

// Transform Polymarket event to UnifiedMarket
export function transformPolymarketEvent(event: PolymarketEvent): UnifiedMarket[] {
  return event.markets.map((market) => {
    const outcomes = parseOutcomes(market);

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
    };
  });
}

// Transform single Polymarket market to UnifiedMarket
export function transformPolymarketMarket(market: PolymarketMarket): UnifiedMarket {
  const outcomes = parseOutcomes(market);

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
  };
}

// Polymarket client class
export class PolymarketClient {
  private baseUrl: string;
  private gammaUrl: string;

  constructor() {
    this.baseUrl = CLOB_URL;
    this.gammaUrl = GAMMA_URL;
  }

  // Fetch sports events from Gamma API
  async getSportsEvents(): Promise<UnifiedMarket[]> {
    const response = await fetch(
      `${this.gammaUrl}/events?active=true&closed=false&tag=sports`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 60 }, // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const events = (await response.json()) as PolymarketEvent[];

    // Transform all events to unified markets
    return events.flatMap(transformPolymarketEvent);
  }

  // Fetch all active markets
  async getActiveMarkets(limit = 100): Promise<UnifiedMarket[]> {
    const response = await fetch(
      `${this.gammaUrl}/markets?active=true&closed=false&limit=${limit}`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const markets = (await response.json()) as PolymarketMarket[];

    // Filter for sports-related markets
    return markets
      .filter((m) => detectCategory(m.question) !== "other")
      .map(transformPolymarketMarket);
  }

  // Fetch single market by ID
  async getMarket(marketId: string): Promise<UnifiedMarket | null> {
    const response = await fetch(`${this.gammaUrl}/markets/${marketId}`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const market = (await response.json()) as PolymarketMarket;
    return transformPolymarketMarket(market);
  }

  // Fetch order book for a market
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
  async getPrice(tokenId: string): Promise<number> {
    const response = await fetch(`${this.baseUrl}/price?token_id=${tokenId}`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 10 },
    });

    if (!response.ok) {
      throw new Error(`Polymarket CLOB error: ${response.status}`);
    }

    const data = (await response.json()) as { price: string };
    return parseFloat(data.price);
  }

  // Search markets
  async searchMarkets(query: string): Promise<UnifiedMarket[]> {
    const response = await fetch(
      `${this.gammaUrl}/markets?active=true&closed=false&_q=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const markets = (await response.json()) as PolymarketMarket[];
    return markets.map(transformPolymarketMarket);
  }
}

// Export singleton instance
export const polymarketClient = new PolymarketClient();
