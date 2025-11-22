"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bug,
  RefreshCw,
  Trash2,
  Download,
  Terminal,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Database,
  Globe,
} from "lucide-react";
import { useAccount, useBalance } from "wagmi";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebugStore } from "@/lib/stores/debug-store";
import { cn, truncateAddress, formatCurrency } from "@/lib/utils";
import { CONTRACTS, POLYGON_CHAIN_ID } from "@/lib/constants";
import { LogLevel } from "@/types";

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

export default function DebugPage() {
  const { address, isConnected, chainId } = useAccount();
  const { data: usdcBalance } = useBalance({
    address: address,
    token: CONTRACTS.USDC as `0x${string}`,
    chainId: POLYGON_CHAIN_ID,
  });

  const {
    logs,
    walletState,
    lastApiResponse,
    mockMode,
    clearLogs,
    setWalletState,
    setMockMode,
    addLog,
  } = useDebugStore();

  // Update wallet state
  useEffect(() => {
    setWalletState({
      connected: isConnected,
      address: address,
      chainId: chainId,
      usdcBalance: usdcBalance ? parseFloat(usdcBalance.formatted) : undefined,
    });
  }, [isConnected, address, chainId, usdcBalance, setWalletState]);

  // Download logs
  const downloadLogs = () => {
    const state = useDebugStore.getState();
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mrkt-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Test API
  const testApi = async () => {
    addLog({
      level: "info",
      message: "Testing API connection...",
      source: "debug",
    });

    try {
      const response = await fetch("/api/markets?pageSize=1");
      const data = await response.json();

      addLog({
        level: response.ok ? "success" : "error",
        message: `API test ${response.ok ? "passed" : "failed"}: Status ${response.status}`,
        data: data,
        source: "debug",
      });
    } catch (error) {
      addLog({
        level: "error",
        message: `API test failed: ${error instanceof Error ? error.message : "Unknown"}`,
        source: "debug",
      });
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950">
      <Header />

      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Bug className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-100">
                Debug Console
              </h1>
              <p className="text-sm text-neutral-500">
                Monitor system state and logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={testApi}>
              <Globe className="w-4 h-4 mr-2" />
              Test API
            </Button>
            <Button variant="outline" size="sm" onClick={downloadLogs}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - State */}
          <div className="space-y-6">
            {/* Wallet State */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {walletState.connected ? (
                    <Wifi className="w-4 h-4 text-green-400" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-400" />
                  )}
                  Wallet State
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Connected:</span>
                  <Badge variant={walletState.connected ? "success" : "danger"}>
                    {walletState.connected ? "Yes" : "No"}
                  </Badge>
                </div>
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
                    <span className="text-neutral-500">Chain ID:</span>
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
              </CardContent>
            </Card>

            {/* Mock Mode */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-yellow-400" />
                  System State
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">Mock Mode</span>
                  <button
                    onClick={() => setMockMode(!mockMode)}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors",
                      mockMode ? "bg-yellow-500/20" : "bg-neutral-800"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 w-4 h-4 rounded-full transition-transform",
                        mockMode
                          ? "translate-x-6 bg-yellow-400"
                          : "translate-x-1 bg-neutral-500"
                      )}
                    />
                  </button>
                </div>
                {mockMode && (
                  <p className="text-xs text-yellow-400/80">
                    Using simulated data. No real API calls.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Last API Response */}
            {lastApiResponse && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-brand-400" />
                    Last API Response
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Endpoint:</span>
                    <span className="text-neutral-300 truncate max-w-[150px]">
                      {lastApiResponse.endpoint}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Status:</span>
                    <Badge
                      variant={lastApiResponse.status >= 400 ? "danger" : "success"}
                    >
                      {lastApiResponse.status}
                    </Badge>
                  </div>
                  {lastApiResponse.error ? (
                    <div className="p-2 bg-red-500/10 rounded text-red-400 text-xs break-all">
                      {JSON.stringify(lastApiResponse.error)}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Logs */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-neutral-400" />
                    Logs ({logs.length})
                  </CardTitle>
                  <div className="flex items-center gap-2 text-xs">
                    {Object.entries(LOG_LEVEL_CONFIG).map(([level, config]) => {
                      const count = logs.filter((l) => l.level === level).length;
                      if (count === 0) return null;
                      const Icon = config.icon;
                      return (
                        <span
                          key={level}
                          className={cn("flex items-center gap-1", config.color)}
                        >
                          <Icon className="w-3 h-3" />
                          {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                {logs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
                    No logs yet
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-800">
                    {logs
                      .slice()
                      .reverse()
                      .map((entry) => {
                        const config = LOG_LEVEL_CONFIG[entry.level];
                        const Icon = config.icon;
                        const time = new Date(entry.timestamp).toLocaleTimeString(
                          "en-US",
                          {
                            hour12: false,
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            fractionalSecondDigits: 3,
                          }
                        );

                        return (
                          <div
                            key={entry.id}
                            className={cn(
                              "px-4 py-2 text-xs font-mono",
                              config.bgColor
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <Icon
                                className={cn(
                                  "w-3.5 h-3.5 mt-0.5 flex-shrink-0",
                                  config.color
                                )}
                              />
                              <span className="text-neutral-500 flex-shrink-0">
                                {time}
                              </span>
                              {entry.source && (
                                <span className="text-neutral-600 flex-shrink-0">
                                  [{entry.source}]
                                </span>
                              )}
                              <span className="text-neutral-200 break-all">
                                {entry.message}
                              </span>
                            </div>
                            {entry.data ? (
                              <pre className="mt-1 ml-6 p-2 bg-neutral-900 rounded text-neutral-400 overflow-x-auto text-2xs">
                                {JSON.stringify(entry.data, null, 2)}
                              </pre>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
