import { MarketGrid } from '@/components/unified/MarketGrid';

export default function Home() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            MRKT <span className="text-brand-500">.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            The Bloomberg Terminal for Sports Prediction Markets.
            Trade across Polymarket and Kalshi from a single interface.
          </p>
        </div>

        {/* Market Grid */}
        <MarketGrid />
      </div>
    </main>
  );
}
