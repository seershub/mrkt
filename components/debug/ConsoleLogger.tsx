"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bug,
  X,
  Minimize2,
  Maximize2,
  Trash2,
  Copy,
  Download,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useDebugStore } from "@/lib/stores/debug-store";
import { cn, truncateAddress, formatCurrency } from "@/lib/utils";
import { LogLevel, LogEntry } from "@/types";

const LOG_LEVEL_CONFIG: Record<
  LogLevel,
  { icon: React.ElementType; color: string; bgColor: string }
> = {
  info: { icon: Info, color: "text-blue-400", bgColor: "bg-blue-500/10" },
  warn: { icon: AlertTriangle, color: "text-yellow-400", bgColor: "bg-yellow-500/10" },
  error: { icon: AlertCircle, color: "text-red-400", bgColor: "bg-red-500/10" },
  debug: { icon: Bug, color: "text-purple-400", bgColor: "bg-purple-500/10" },
  success: { icon: CheckCircle, color: "text-green-400", bgColor: "bg-green-500/10" },
};

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const config = LOG_LEVEL_CONFIG[entry.level];
  const Icon = config.icon;

  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className={cn(
        "border-b border-neutral-800 py-1.5 px-2 text-xs font-mono",
        config.bgColor
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", config.color)} />
        <span className="text-neutral-500 flex-shrink-0">{time}</span>
        {entry.source && (
          <span className="text-neutral-600 flex-shrink-0">[{entry.source}]</span>
        )}
        <span className="text-neutral-200 flex-1 break-all">{entry.message}</span>
        {entry.data ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-neutral-500 hover:text-neutral-300"
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        ) : null}
      </div>
      {expanded && entry.data ? (
        <pre className="mt-1 ml-5 p-2 bg-neutral-900 rounded text-neutral-400 overflow-x-auto">
          {JSON.stringify(entry.data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function WalletStatus() {
  const walletState = useDebugStore((s) => s.walletState);

  return (
    <div className="p-3 border-b border-neutral-800">
      <div className="flex items-center gap-2 mb-2">
        {walletState.connected ? (
          <Wifi className="w-4 h-4 text-green-400" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-400" />
        )}
        <span className="text-xs font-medium text-neutral-200">
          {walletState.connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {walletState.connected && (
        <div className="space-y-1 text-xs font-mono">
          {walletState.address && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Address:</span>
              <span className="text-neutral-300">
                {truncateAddress(walletState.address)}
              </span>
            </div>
          )}
          {walletState.chainId && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Chain:</span>
              <span className="text-neutral-300">{walletState.chainId}</span>
            </div>
          )}
          {walletState.polymarketProxy && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Proxy:</span>
              <span className="text-green-400">
                {truncateAddress(walletState.polymarketProxy)}
              </span>
            </div>
          )}
          {walletState.usdcBalance !== undefined && (
            <div className="flex justify-between">
              <span className="text-neutral-500">USDC:</span>
              <span className="text-brand-400">
                {formatCurrency(walletState.usdcBalance)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApiStatus() {
  const lastApiResponse = useDebugStore((s) => s.lastApiResponse);

  if (!lastApiResponse) return null;

  const isError = lastApiResponse.status >= 400;

  return (
    <div className="p-3 border-b border-neutral-800">
      <div className="text-xs font-medium text-neutral-400 mb-2">Last API Call</div>
      <div className="space-y-1 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-neutral-500">Endpoint:</span>
          <span className="text-neutral-300 truncate max-w-[180px]">
            {lastApiResponse.endpoint}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Status:</span>
          <span className={isError ? "text-red-400" : "text-green-400"}>
            {lastApiResponse.status}
          </span>
        </div>
        {lastApiResponse.error ? (
          <div className="mt-2 p-2 bg-red-500/10 rounded text-red-400 break-all">
            {JSON.stringify(lastApiResponse.error)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ConsoleLogger() {
  const {
    logs,
    isOpen,
    isMinimized,
    filter,
    mockMode,
    setIsOpen,
    setIsMinimized,
    setFilter,
    clearLogs,
  } = useDebugStore();

  const [copied, setCopied] = useState(false);

  // Filter logs
  const filteredLogs =
    filter === "all" ? logs : logs.filter((log) => log.level === filter);

  // Copy logs to clipboard
  const copyLogs = async () => {
    const debugState = useDebugStore.getState();
    await navigator.clipboard.writeText(JSON.stringify(debugState, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download logs
  const downloadLogs = () => {
    const debugState = useDebugStore.getState();
    const blob = new Blob([JSON.stringify(debugState, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mrkt-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Keyboard shortcut to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "`" && e.ctrlKey) {
        setIsOpen(!isOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  // Floating button when closed
  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg",
          "bg-neutral-900 border border-neutral-700",
          "hover:bg-neutral-800 transition-colors",
          mockMode && "border-yellow-500/50"
        )}
        title="Open Debug Console (Ctrl+`)"
      >
        <Bug
          className={cn("w-5 h-5", mockMode ? "text-yellow-400" : "text-neutral-400")}
        />
        {logs.filter((l) => l.level === "error").length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
            {logs.filter((l) => l.level === "error").length}
          </span>
        )}
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={cn(
          "fixed bottom-4 right-4 z-50 rounded-lg overflow-hidden shadow-2xl",
          "bg-neutral-950 border border-neutral-800",
          isMinimized ? "w-80" : "w-96"
        )}
        style={{ maxHeight: isMinimized ? "auto" : "70vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-neutral-900 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Bug
              className={cn(
                "w-4 h-4",
                mockMode ? "text-yellow-400" : "text-brand-400"
              )}
            />
            <span className="text-sm font-medium text-neutral-200">
              Debug Console
            </span>
            {mockMode && (
              <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-2xs rounded">
                MOCK
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearLogs}
              className="p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-neutral-300"
              title="Clear logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={copyLogs}
              className="p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-neutral-300"
              title="Copy logs"
            >
              {copied ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={downloadLogs}
              className="p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-neutral-300"
              title="Download logs"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-neutral-300"
              title={isMinimized ? "Expand" : "Minimize"}
            >
              {isMinimized ? (
                <Maximize2 className="w-3.5 h-3.5" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-neutral-300"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Wallet & API Status */}
            <WalletStatus />
            <ApiStatus />

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-2 border-b border-neutral-800 overflow-x-auto">
              {(["all", "info", "success", "warn", "error", "debug"] as const).map(
                (level) => {
                  const count =
                    level === "all"
                      ? logs.length
                      : logs.filter((l) => l.level === level).length;

                  return (
                    <button
                      key={level}
                      onClick={() => setFilter(level)}
                      className={cn(
                        "px-2 py-1 text-2xs rounded flex items-center gap-1",
                        filter === level
                          ? "bg-brand-500/20 text-brand-400"
                          : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
                      )}
                    >
                      {level === "all" ? "All" : level.charAt(0).toUpperCase() + level.slice(1)}
                      {count > 0 && (
                        <span className="text-neutral-600">({count})</span>
                      )}
                    </button>
                  );
                }
              )}
            </div>

            {/* Logs */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: "calc(70vh - 280px)" }}
            >
              {filteredLogs.length === 0 ? (
                <div className="p-4 text-center text-neutral-500 text-sm">
                  No logs to display
                </div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {filteredLogs.map((entry) => (
                    <LogEntryRow key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-neutral-800 text-2xs text-neutral-600">
              Press <kbd className="px-1 py-0.5 bg-neutral-800 rounded">Ctrl</kbd> +{" "}
              <kbd className="px-1 py-0.5 bg-neutral-800 rounded">`</kbd> to toggle
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
