// ============================================
// MRKT - Debug Logger System
// Captures and stores logs for debugging UI
// ============================================

import { LogEntry, LogLevel, DebugState } from "@/types";

// Maximum logs to keep in memory
const MAX_LOGS = 200;

// Global debug state
let debugState: DebugState = {
  logs: [],
  walletState: {
    connected: false,
  },
  mockMode: false,
};

// Subscribers for state changes
type Subscriber = (state: DebugState) => void;
const subscribers: Set<Subscriber> = new Set();

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Format timestamp
const formatTimestamp = (): string => {
  return new Date().toISOString();
};

// Notify subscribers
const notifySubscribers = (): void => {
  subscribers.forEach((callback) => callback(debugState));
};

// Add log entry
const addLog = (level: LogLevel, message: string, data?: unknown, source?: string): LogEntry => {
  const entry: LogEntry = {
    id: generateId(),
    level,
    message,
    timestamp: formatTimestamp(),
    data,
    source,
  };

  debugState = {
    ...debugState,
    logs: [...debugState.logs.slice(-MAX_LOGS + 1), entry],
  };

  // Also log to browser console with appropriate level
  const consoleMethod = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  const prefix = `[MRKT ${level.toUpperCase()}]`;

  if (data) {
    console[consoleMethod](prefix, message, data);
  } else {
    console[consoleMethod](prefix, message);
  }

  notifySubscribers();
  return entry;
};

// Logger object with methods for each level
export const logger = {
  info: (message: string, data?: unknown, source?: string): LogEntry => {
    return addLog("info", message, data, source);
  },

  warn: (message: string, data?: unknown, source?: string): LogEntry => {
    return addLog("warn", message, data, source);
  },

  error: (message: string, data?: unknown, source?: string): LogEntry => {
    return addLog("error", message, data, source);
  },

  debug: (message: string, data?: unknown, source?: string): LogEntry => {
    return addLog("debug", message, data, source);
  },

  success: (message: string, data?: unknown, source?: string): LogEntry => {
    return addLog("success", message, data, source);
  },

  // Log API request
  api: (endpoint: string, method: string, data?: unknown): LogEntry => {
    return addLog("info", `API ${method} ${endpoint}`, data, "api");
  },

  // Log API response
  apiResponse: (endpoint: string, status: number, data?: unknown, error?: unknown): void => {
    debugState = {
      ...debugState,
      lastApiResponse: {
        endpoint,
        status,
        data,
        error,
      },
    };

    if (status >= 400) {
      addLog("error", `API Error: ${endpoint} - Status ${status}`, error || data, "api");
    } else {
      addLog("success", `API Success: ${endpoint} - Status ${status}`, undefined, "api");
    }

    notifySubscribers();
  },

  // Update wallet state
  setWalletState: (walletState: Partial<DebugState["walletState"]>): void => {
    debugState = {
      ...debugState,
      walletState: {
        ...debugState.walletState,
        ...walletState,
      },
    };

    addLog(
      "info",
      `Wallet state updated: ${walletState.connected ? "Connected" : "Disconnected"}`,
      walletState,
      "wallet"
    );

    notifySubscribers();
  },

  // Set mock mode
  setMockMode: (enabled: boolean): void => {
    debugState = {
      ...debugState,
      mockMode: enabled,
    };

    addLog(
      enabled ? "warn" : "info",
      enabled ? "MOCK MODE ENABLED - Using simulated data" : "Mock mode disabled",
      undefined,
      "system"
    );

    notifySubscribers();
  },

  // Clear logs
  clear: (): void => {
    debugState = {
      ...debugState,
      logs: [],
    };
    notifySubscribers();
  },

  // Get current state
  getState: (): DebugState => {
    return debugState;
  },

  // Subscribe to state changes
  subscribe: (callback: Subscriber): (() => void) => {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  },

  // Get logs by level
  getLogsByLevel: (level: LogLevel): LogEntry[] => {
    return debugState.logs.filter((log) => log.level === level);
  },

  // Get logs by source
  getLogsBySource: (source: string): LogEntry[] => {
    return debugState.logs.filter((log) => log.source === source);
  },

  // Export logs as JSON
  exportLogs: (): string => {
    return JSON.stringify(debugState, null, 2);
  },
};

// Default export
export default logger;

// Hook for React components
export const useLogger = () => {
  return logger;
};
