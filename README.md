# MRKT - Sports Prediction Markets

> The Bloomberg Terminal for sports betting markets. Trade predictions on Polymarket and Kalshi from one unified interface.

![MRKT](https://img.shields.io/badge/MRKT-Sports%20Prediction%20Markets-blue)
![Next.js](https://img.shields.io/badge/Next.js-14.2-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Overview

MRKT (mrkt.seershub.com) is a modern sports prediction market trading platform that aggregates and enables trading on sports outcomes from **Polymarket** (Polygon) and **Kalshi** (US Regulated).

### Key Features

- **Unified Interface** - Single dashboard for all sports prediction markets
- **Multi-Platform** - Aggregate data from Polymarket and Kalshi
- **Real-Time Data** - Live market prices and trading volume
- **Advanced Filtering** - Filter by sport, platform, and market status
- **Wallet Integration** - RainbowKit + WalletConnect support
- **Debug Console** - Built-in debugging tools for development
- **Mobile Responsive** - Optimized for all screen sizes

## Tech Stack

- **Framework**: Next.js 14.2 (App Router)
- **Language**: TypeScript 5.5 (Strict Mode)
- **Styling**: Tailwind CSS 3.4 + shadcn/ui
- **State Management**: TanStack Query v5 + Zustand
- **Web3**: Wagmi v2 + Viem v2 + RainbowKit
- **Animations**: Framer Motion

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- WalletConnect Project ID (for wallet connections)

### Installation

```bash
# Clone the repository
git clone https://github.com/seershub/mrkt.git
cd mrkt

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Blockchain (Polygon)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key

# Polymarket (Server Only)
POLY_BUILDER_API_KEY=your_poly_builder_api_key
POLY_BUILDER_SECRET=your_poly_builder_secret
POLY_BUILDER_PASSPHRASE=your_poly_builder_passphrase

# Kalshi (Server Only)
KALSHI_API_KEY_ID=your_kalshi_api_key_id
KALSHI_PRIVATE_KEY=your_kalshi_private_key_pem_format
```

## Project Structure

```
mrkt/
├── app/
│   ├── api/
│   │   ├── markets/          # Unified markets API
│   │   ├── polymarket/       # Polymarket-specific endpoints
│   │   │   ├── proxy/        # Proxy wallet management
│   │   │   └── order/        # Order placement
│   │   └── kalshi/
│   │       └── order/        # Kalshi order placement
│   ├── debug/                # Debug console page
│   ├── layout.tsx            # Root layout with providers
│   └── page.tsx              # Main dashboard
├── components/
│   ├── debug/                # Debug tools
│   ├── layout/               # Layout components
│   ├── providers/            # React providers
│   ├── ui/                   # Base UI components
│   └── unified/              # Market components
├── lib/
│   ├── constants.ts          # App constants
│   ├── polymarket/           # Polymarket client
│   ├── kalshi/               # Kalshi client
│   ├── stores/               # Zustand stores
│   ├── utils/                # Utility functions
│   └── wagmi/                # Wagmi config
├── types/
│   └── index.ts              # TypeScript types
└── public/                   # Static assets
```

## API Routes

### GET /api/markets
Fetches aggregated sports markets from both Polymarket and Kalshi.

**Query Parameters:**
- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 20, max: 100)
- `categories` - Filter by sport categories (comma-separated)
- `platforms` - Filter by platform (polymarket, kalshi)
- `search` - Search query
- `sortBy` - Sort field (volume, liquidity, endDate)
- `sortOrder` - Sort direction (asc, desc)

### POST /api/polymarket/order
Place an order on Polymarket with builder attribution.

### GET /api/polymarket/proxy
Check proxy wallet status for an address.

### POST /api/kalshi/order
Place an order on Kalshi (RSA-SHA256 signed).

## Development

```bash
# Run development server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Build for production
npm run build
```

## Debug Console

Access the debug console at `/debug` or press `Ctrl + \`` to open the floating debug panel. Features:

- Wallet connection status
- USDC balance tracking
- API response monitoring
- Real-time log viewer
- Mock mode toggle

## Architecture

### Unified Market Type
All markets from both Polymarket and Kalshi are transformed into a unified `UnifiedMarket` type before reaching the UI. This ensures consistent data handling regardless of the source.

### Trading Flow

**Polymarket:**
1. User connects wallet
2. Check/deploy proxy wallet
3. Approve USDC allowance
4. Sign order (EIP-712)
5. Submit via builder API

**Kalshi:**
1. User selects outcome
2. Request sent to server
3. Server signs with RSA-SHA256
4. Execute trade on Kalshi API

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Polymarket](https://polymarket.com) - Prediction market platform
- [Kalshi](https://kalshi.com) - US regulated event contracts
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [RainbowKit](https://rainbowkit.com) - Wallet connection

---

Built with love by [SeersHub](https://seershub.com)
