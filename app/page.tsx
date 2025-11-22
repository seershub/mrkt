'use client';

import { useState } from 'react';
import { MarketGrid } from "@/components/unified/MarketGrid";
import { Navbar } from "@/components/layout/Navbar";
import { MarketFilters, FilterState } from "@/components/unified/MarketFilters";

export default function Home() {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    source: 'ALL',
    category: 'All',
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            Prediction Markets
          </h1>
          <p className="text-muted-foreground">
            Trade on real-world events across Polymarket and Kalshi
          </p>
        </div>

        <MarketFilters onFilterChange={setFilters} />

        <MarketGrid filters={filters} />
      </main>
    </div>
  );
}
