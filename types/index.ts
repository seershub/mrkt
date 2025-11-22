export type MarketSource = 'POLY' | 'KALSHI';

export interface UnifiedMarket {
  id: string;
  question: string;
  description?: string;
  source: MarketSource;
  outcomes: UnifiedOutcome[];
  volume: number;
  liquidity?: number;
  endTime: string; // ISO string
  image?: string;
  category?: string;
  raw: any; // Original payload for debugging
}

export interface UnifiedOutcome {
  id: string;
  label: string;
  price: number;
  probability: number;
}

export interface UnifiedOrder {
  marketId: string;
  outcomeId: string;
  side: 'BUY' | 'SELL';
  amount: number; // USDC amount
  priceLimit?: number; // For limit orders
}

export interface UserPosition {
  marketId: string;
  outcomeId: string;
  shares: number;
  avgPrice: number;
  currentValue: number;
  pnl: number;
}
