// ============================================
// MRKT - Constants & Configuration
// ============================================

// Chain IDs
export const POLYGON_CHAIN_ID = 137;
export const POLYGON_TESTNET_CHAIN_ID = 80001;

// Contract Addresses (Polygon Mainnet)
export const CONTRACTS = {
  // USDC on Polygon (Native USDC)
  USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  // USDC.e (Bridged USDC)
  USDC_E: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  // Polymarket Exchange
  POLYMARKET_EXCHANGE: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
  // Polymarket Conditional Tokens
  CONDITIONAL_TOKENS: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",
  // Polymarket CLOB
  POLYMARKET_CLOB: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",
  // Gnosis Safe Proxy Factory (for Polymarket proxy wallets)
  SAFE_PROXY_FACTORY: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  POLYMARKET: {
    CLOB: process.env.POLY_CLOB_URL || "https://clob.polymarket.com",
    GAMMA: "https://gamma-api.polymarket.com",
    STRAPI: "https://strapi-matic.poly.market",
  },
  KALSHI: {
    BASE: process.env.KALSHI_API_URL || "https://trading-api.kalshi.com/trade-api/v2",
    DEMO: "https://demo-api.kalshi.co/trade-api/v2",
  },
} as const;

// Sport Categories with Icons
export const SPORT_CATEGORIES = {
  nfl: { name: "NFL", icon: "🏈", color: "#013369" },
  nba: { name: "NBA", icon: "🏀", color: "#C9082A" },
  mlb: { name: "MLB", icon: "⚾", color: "#002D72" },
  nhl: { name: "NHL", icon: "🏒", color: "#000000" },
  soccer: { name: "Soccer", icon: "⚽", color: "#00FF87" },
  mma: { name: "MMA", icon: "🥊", color: "#D20A0A" },
  tennis: { name: "Tennis", icon: "🎾", color: "#00A651" },
  golf: { name: "Golf", icon: "⛳", color: "#006747" },
  esports: { name: "Esports", icon: "🎮", color: "#9146FF" },
  other: { name: "Other", icon: "🎯", color: "#6B7280" },
} as const;

// Market Status Labels
export const MARKET_STATUS = {
  open: { label: "Open", color: "success" },
  closed: { label: "Closed", color: "neutral" },
  resolved: { label: "Resolved", color: "brand" },
  disputed: { label: "Disputed", color: "warning" },
} as const;

// Trading Constants
export const TRADING = {
  MIN_ORDER_AMOUNT: 1, // $1 minimum
  MAX_ORDER_AMOUNT: 100000, // $100k maximum
  DEFAULT_SLIPPAGE: 0.02, // 2%
  PRICE_DECIMALS: 2,
  SHARE_DECIMALS: 6,
  USDC_DECIMALS: 6,
} as const;

// Quick Buy Amounts
export const QUICK_BUY_AMOUNTS = [10, 25, 50, 100, 250, 500] as const;

// Supported Chains
export const SUPPORTED_CHAINS = [
  {
    id: POLYGON_CHAIN_ID,
    name: "Polygon",
    network: "polygon",
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
  },
] as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  THEME: "mrkt-theme",
  WALLET_CONNECTION: "mrkt-wallet",
  DEBUG_ENABLED: "mrkt-debug",
  FAVORITE_MARKETS: "mrkt-favorites",
  RECENT_SEARCHES: "mrkt-recent-searches",
} as const;

// Error Codes
export const ERROR_CODES = {
  WALLET_NOT_CONNECTED: "WALLET_NOT_CONNECTED",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  INSUFFICIENT_ALLOWANCE: "INSUFFICIENT_ALLOWANCE",
  PROXY_NOT_DEPLOYED: "PROXY_NOT_DEPLOYED",
  ORDER_FAILED: "ORDER_FAILED",
  NETWORK_ERROR: "NETWORK_ERROR",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
  MARKET_CLOSED: "MARKET_CLOSED",
  API_ERROR: "API_ERROR",
} as const;
