// ============================================
// MRKT - Constants & Configuration
// ============================================

// Chain IDs
export const POLYGON_CHAIN_ID = 137;
export const POLYGON_TESTNET_CHAIN_ID = 80001;

// Contract Addresses (Polygon Mainnet)
// Per Polymarket docs: https://docs.polymarket.com
export const CONTRACTS = {
  // USDC.e (Bridged USDC from Ethereum) - REQUIRED for Polymarket
  // All Polymarket trades use USDC.e as collateral
  USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  // Native USDC on Polygon (NOT used by Polymarket)
  USDC_NATIVE: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  // Polymarket CTF Exchange (standard markets)
  POLYMARKET_EXCHANGE: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
  // Polymarket Neg Risk CTF Exchange (negative risk markets)
  POLYMARKET_NEG_RISK_EXCHANGE: "0xC5d563A36AE78145C45a50134d48A1215220f80a",
  // Polymarket Neg Risk Adapter (for neg risk market approvals)
  POLYMARKET_NEG_RISK_ADAPTER: "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296",
  // Conditional Token Framework (CTF) - USDC approval target for standard markets
  CONDITIONAL_TOKENS: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",
  // Gnosis Safe Proxy Factory (for MetaMask users)
  SAFE_PROXY_FACTORY: "0xaacfeea03eb1561c4e67d661e40682bd20e3541b",
  // Polymarket Proxy Factory (for MagicLink/email users)
  POLYMARKET_PROXY_FACTORY: "0xaB45c54AB0c941a2F231C04C3f49182e1A254052",
} as const;

// USDC Approval Targets per Polymarket docs:
// - Standard markets: Approve USDC to CONDITIONAL_TOKENS
// - Neg Risk markets: Approve USDC to POLYMARKET_NEG_RISK_ADAPTER
export const APPROVAL_TARGETS = {
  STANDARD: CONTRACTS.CONDITIONAL_TOKENS,
  NEG_RISK: CONTRACTS.POLYMARKET_NEG_RISK_ADAPTER,
} as const;

// API Endpoints (Per Polymarket docs)
export const API_ENDPOINTS = {
  POLYMARKET: {
    // CLOB REST API - for order book, pricing, and trading
    CLOB: process.env.POLY_CLOB_URL || "https://clob.polymarket.com",
    // Gamma API - for market metadata, events, categories
    GAMMA: "https://gamma-api.polymarket.com",
    // Data API - for user data, holdings, on-chain activities
    DATA: "https://data-api.polymarket.com",
    // V2 Relayer - for gasless transactions and Safe deployment
    RELAYER: "https://relayer-v2.polymarket.com",
    // WebSocket - for real-time market data
    WS_CLOB: "wss://ws-subscriptions-clob.polymarket.com/ws/",
    // Real-Time Data Socket - for crypto prices, comments
    WS_RTDS: "wss://ws-live-data.polymarket.com",
    // Strapi (legacy)
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
