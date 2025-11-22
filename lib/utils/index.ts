// Re-export all utilities
export { cn } from "./cn";
export { logger, useLogger } from "./logger";

// Format currency
export function formatCurrency(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Format price (0-100 cents)
export function formatPrice(price: number): string {
  return `${(price * 100).toFixed(0)}¢`;
}

// Format probability
export function formatProbability(price: number): string {
  return `${(price * 100).toFixed(1)}%`;
}

// Format large numbers
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

// Format relative time
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMs < 0) {
    // Past
    if (diffMins > -60) return `${Math.abs(diffMins)}m ago`;
    if (diffHours > -24) return `${Math.abs(diffHours)}h ago`;
    return `${Math.abs(diffDays)}d ago`;
  } else {
    // Future
    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffHours < 24) return `in ${diffHours}h`;
    return `in ${diffDays}d`;
  }
}

// Truncate address
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Sleep helper
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Get price change direction
export function getPriceDirection(current: number, previous?: number): "up" | "down" | "neutral" {
  if (!previous || current === previous) return "neutral";
  return current > previous ? "up" : "down";
}

// Calculate profit
export function calculateProfit(
  shares: number,
  avgPrice: number,
  currentPrice: number
): { profit: number; profitPercent: number } {
  const cost = shares * avgPrice;
  const value = shares * currentPrice;
  const profit = value - cost;
  const profitPercent = cost > 0 ? (profit / cost) * 100 : 0;

  return { profit, profitPercent };
}
