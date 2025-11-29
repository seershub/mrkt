# MRKT - Prediction Market Aggregator

A Next.js application for trading prediction markets across Polymarket and Kalshi with arbitrage detection.

## Features

- 🔍 **Cross-Platform Market Aggregation** - Browse markets from Polymarket and Kalshi in one place
- 📊 **Arbitrage Scanner** - AI-powered matching engine to find price inefficiencies
- 💰 **Rewards System** - Earn points for trading volume and referrals
- 📱 **Portfolio Tracking** - Monitor your positions and P&L
- 🎨 **Premium UI** - Glassmorphism design with smooth animations

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Create a `.env.local` file with:

```env
# Kalshi API
KALSHI_API_KEY=your_api_key
KALSHI_API_SECRET=your_api_secret

# Optional
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **APIs**: Polymarket CLOB, Kalshi Exchange
- **Wallet**: Privy (Polygon, Ethereum, Base)
- **State**: React Query

## Deploy on Vercel

The easiest way to deploy is using the [Vercel Platform](https://vercel.com/new).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
