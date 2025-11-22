"use client";

import { ReactNode, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { config } from "@/lib/wagmi/config";
import { ConsoleLogger } from "@/components/debug/ConsoleLogger";
import { useDebugStore } from "@/lib/stores/debug-store";

import "@rainbow-me/rainbowkit/styles.css";

// Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

// Initialize debug logging
function DebugInitializer() {
  const addLog = useDebugStore((s) => s.addLog);

  useEffect(() => {
    addLog({
      level: "info",
      message: "MRKT initialized",
      source: "system",
    });

    // Log environment info
    addLog({
      level: "debug",
      message: `Environment: ${process.env.NODE_ENV}`,
      source: "system",
    });
  }, [addLog]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={darkTheme({
              accentColor: "#0ea5e9",
              accentColorForeground: "white",
              borderRadius: "medium",
              fontStack: "system",
            })}
            modalSize="compact"
          >
            {mounted ? children : null}
            <Toaster
              position="bottom-right"
              theme="dark"
              richColors
              closeButton
              toastOptions={{
                style: {
                  background: "#171717",
                  border: "1px solid #262626",
                },
              }}
            />
            <ConsoleLogger />
            <DebugInitializer />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
