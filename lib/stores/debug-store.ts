// ============================================
// MRKT - Debug Store (Zustand)
// Reactive state for debug panel
// ============================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DebugState, LogEntry, LogLevel } from "@/types";

interface DebugStore extends DebugState {
  // State
  isOpen: boolean;
  isMinimized: boolean;
  filter: LogLevel | "all";

  // Actions
  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  clearLogs: () => void;
  setWalletState: (state: Partial<DebugState["walletState"]>) => void;
  setLastApiResponse: (response: DebugState["lastApiResponse"]) => void;
  setMockMode: (enabled: boolean) => void;
  setIsOpen: (open: boolean) => void;
  setIsMinimized: (minimized: boolean) => void;
  setFilter: (filter: LogLevel | "all") => void;
  toggle: () => void;
}

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useDebugStore = create<DebugStore>()(
  persist(
    (set, get) => ({
      // Initial state
      logs: [],
      walletState: {
        connected: false,
      },
      mockMode: false,
      isOpen: false,
      isMinimized: true,
      filter: "all",

      // Actions
      addLog: (entry) => {
        const newEntry: LogEntry = {
          ...entry,
          id: generateId(),
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          logs: [...state.logs.slice(-199), newEntry],
        }));

        // Also log to console
        const prefix = `[MRKT ${entry.level.toUpperCase()}]`;
        const consoleMethod =
          entry.level === "error" ? "error" : entry.level === "warn" ? "warn" : "log";

        if (entry.data) {
          console[consoleMethod](prefix, entry.message, entry.data);
        } else {
          console[consoleMethod](prefix, entry.message);
        }
      },

      clearLogs: () => {
        set({ logs: [] });
      },

      setWalletState: (walletState) => {
        set((state) => ({
          walletState: { ...state.walletState, ...walletState },
        }));
      },

      setLastApiResponse: (response) => {
        set({ lastApiResponse: response });
      },

      setMockMode: (enabled) => {
        set({ mockMode: enabled });
        get().addLog({
          level: enabled ? "warn" : "info",
          message: enabled ? "MOCK MODE ENABLED" : "Mock mode disabled",
          source: "system",
        });
      },

      setIsOpen: (open) => {
        set({ isOpen: open });
      },

      setIsMinimized: (minimized) => {
        set({ isMinimized: minimized });
      },

      setFilter: (filter) => {
        set({ filter });
      },

      toggle: () => {
        set((state) => ({ isOpen: !state.isOpen }));
      },
    }),
    {
      name: "mrkt-debug",
      partialize: (state) => ({
        isOpen: state.isOpen,
        isMinimized: state.isMinimized,
        filter: state.filter,
      }),
    }
  )
);

// Helper hook for logging
export const useLog = () => {
  const addLog = useDebugStore((state) => state.addLog);

  return {
    info: (message: string, data?: unknown, source?: string) =>
      addLog({ level: "info", message, data, source }),
    warn: (message: string, data?: unknown, source?: string) =>
      addLog({ level: "warn", message, data, source }),
    error: (message: string, data?: unknown, source?: string) =>
      addLog({ level: "error", message, data, source }),
    debug: (message: string, data?: unknown, source?: string) =>
      addLog({ level: "debug", message, data, source }),
    success: (message: string, data?: unknown, source?: string) =>
      addLog({ level: "success", message, data, source }),
  };
};
