// ============================================
// MRKT - Unified Type System
// All Polymarket and Kalshi data maps to these types
// ============================================

// Platform identifiers
export type Platform = "polymarket" | "kalshi";

// Market status
export type MarketStatus = "open" | "closed" | "resolved" | "disputed";

// Sport categories
export type SportCategory =
  | "nfl"
  | "nba"
  | "mlb"
  | "nhl"
  | "soccer"
  | "mma"
  | "tennis"
  | "golf"
  | "esports"
  | "other";

// ============================================
// Unified Market Types
// ============================================

export interface UnifiedMarket {
  // Unique identifier (prefixed with platform: poly_ or kalshi_)
  id: string;
  // Original platform ID
  platformId: string;
  // Source platform
  platform: Platform;
  // Market question/title
  title: string;
  // Detailed description
  description: string;
  // Sport category
  category: SportCategory;
  // Current status
  status: MarketStatus;
  // Is market currently live/active
  isLive: boolean;
  // Market outcomes (YES/NO or multiple options)
  outcomes: MarketOutcome[];
  // Market resolution time
  endDate: string;
  // Market creation time
  createdAt: string;
  // Total trading volume in USD
  volume: number;
  // Available liquidity in USD
  liquidity: number;
  // Image URL for the market
  imageUrl?: string;
  // Tags for filtering
  tags: string[];
  // Original API response for debugging
  rawData?: unknown;
  // Polymarket specific: negative risk market flag
  negRisk?: boolean;
  // Minimum order size in USD
  minOrderSize?: number;
  // Condition ID (Polymarket)
  conditionId?: string;
}

export interface MarketOutcome {
  // Outcome ID
  id: string;
  // Outcome name (e.g., "Yes", "No", "Lakers", "Celtics")
  name: string;
  // Current price (0-1 representing probability)
  price: number;
  // Previous price for trend
  previousPrice?: number;
  // Token ID for trading (Polymarket specific)
  tokenId?: string;
}

// ============================================
// Trading Types
// ============================================

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";
export type OrderStatus = "pending" | "open" | "filled" | "cancelled" | "failed";

export interface TradeOrder {
  id: string;
  marketId: string;
  platform: Platform;
  outcomeId: string;
  side: OrderSide;
  type: OrderType;
  amount: number; // In USD
  shares: number;
  price: number;
  status: OrderStatus;
  createdAt: string;
  filledAt?: string;
  txHash?: string;
}

export interface TradeQuote {
  marketId: string;
  outcomeId: string;
  side: OrderSide;
  amount: number;
  estimatedShares: number;
  estimatedPrice: number;
  estimatedCost: number;
  estimatedPayout: number;
  estimatedProfit: number;
  estimatedProfitPercent: number;
  fees: number;
  slippage: number;
}

// ============================================
// User & Wallet Types
// ============================================

export interface UserWallet {
  address: string;
  chainId: number;
  // Polymarket specific
  polymarketProxy?: string;
  polymarketProxyDeployed?: boolean;
  // Balances
  usdcBalance: number;
  nativeBalance: number;
  // Allowances
  usdcAllowance: number;
}

export interface UserPortfolio {
  totalValue: number;
  totalProfit: number;
  totalProfitPercent: number;
  positions: Position[];
  recentTrades: TradeOrder[];
}

export interface Position {
  id: string;
  marketId: string;
  market: UnifiedMarket;
  outcomeId: string;
  outcomeName: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  profit: number;
  profitPercent: number;
  platform: Platform;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// Polymarket Specific Types (from their API)
// ============================================

export interface PolymarketEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  markets: PolymarketMarket[];
  image?: string;
  icon?: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  new: boolean;
  featured: boolean;
  restricted: boolean;
  liquidity: number;
  volume: number;
  volume24hr: number;
  commentCount: number;
}

export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  startDate: string;
  endDate: string;
  description: string;
  outcomes: string;
  outcomePrices: string;
  liquidity: number;
  volume: number;
  volume24hr: number;
  active: boolean;
  closed: boolean;
  archived: boolean;
  acceptingOrders: boolean;
  acceptingOrderTimestamp: string;
  clobTokenIds: string;
  image?: string;
  icon?: string;
}

export interface PolymarketOrderBook {
  market: string;
  asset_id: string;
  timestamp: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface OrderBookLevel {
  price: string;
  size: string;
}

// ============================================
// Kalshi Specific Types (from their API)
// ============================================

export interface KalshiEvent {
  event_ticker: string;
  series_ticker: string;
  sub_title: string;
  title: string;
  mutually_exclusive: boolean;
  category: string;
  markets: KalshiMarket[];
}

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  market_type: string;
  title: string;
  subtitle: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  previous_price: number;
  previous_yes_bid: number;
  previous_yes_ask: number;
  volume: number;
  volume_24h: number;
  liquidity: number;
  open_interest: number;
  status: string;
  result: string;
  cap_strike: number;
  floor_strike: number;
  close_time: string;
  expiration_time: string;
  custom_strike: string;
}

// ============================================
// Debug & Logging Types
// ============================================

export type LogLevel = "info" | "warn" | "error" | "debug" | "success";

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
  source?: string;
}

export interface DebugState {
  logs: LogEntry[];
  walletState: {
    connected: boolean;
    address?: string;
    chainId?: number;
    polymarketProxy?: string;
    usdcBalance?: number;
  };
  lastApiResponse?: {
    endpoint: string;
    status: number;
    data?: unknown;
    error?: unknown;
  };
  mockMode: boolean;
}

// ============================================
// Component Props Types
// ============================================

export interface MarketCardProps {
  market: UnifiedMarket;
  onSelect?: (market: UnifiedMarket) => void;
  compact?: boolean;
}

export interface TradeModalProps {
  market: UnifiedMarket;
  outcome: MarketOutcome;
  isOpen: boolean;
  onClose: () => void;
}

export interface FilterOptions {
  categories: SportCategory[];
  platforms: Platform[];
  status: MarketStatus[];
  sortBy: "volume" | "liquidity" | "endDate" | "price";
  sortOrder: "asc" | "desc";
  search: string;
}
