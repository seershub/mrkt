// ============================================
// MRKT - Wagmi Configuration
// Web3 wallet connection setup
// ============================================

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygon } from "wagmi/chains";

// Chain configuration
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo";

export const config = getDefaultConfig({
  appName: "MRKT",
  projectId,
  chains: [polygon],
  ssr: true,
});

// Export chain for use elsewhere
export { polygon };
