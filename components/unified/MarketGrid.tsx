"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, RefreshCw, Search, Filter, X } from "lucide-react";
import { MarketCard } from "./MarketCard";
import { TradeModal } from "./TradeModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDebugStore } from "@/lib/stores/debug-store";
import { SPORT_CATEGORIES } from "@/lib/constants";
import {
  UnifiedMarket,
  MarketOutcome,
  PaginatedResponse,
  ApiResponse,
  SportCategory,
  Platform,
} from "@/types";

// Fetch markets from our unified API
async function fetchMarkets(params: {
  page?: number;
  pageSize?: number;
  categories?: SportCategory[];
  platforms?: Platform[];
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<PaginatedResponse<UnifiedMarket>> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", params.page.toString());
  if (params.pageSize) searchParams.set("pageSize", params.pageSize.toString());
  if (params.categories?.length)
    searchParams.set("categories", params.categories.join(","));
  if (params.platforms?.length)
    searchParams.set("platforms", params.platforms.join(","));
  if (params.search) searchParams.set("search", params.search);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);

  const response = await fetch(`/api/markets?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.status}`);
  }

  const data = (await response.json()) as ApiResponse<PaginatedResponse<UnifiedMarket>>;

  if (!data.success || !data.data) {
    throw new Error(data.error?.message || "Failed to fetch markets");
  }

  return data.data;
}

// Category filter button
function CategoryFilter({
  category,
  isSelected,
  onClick,
}: {
  category: { name: string; icon: string };
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
        isSelected
          ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
          : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 border border-transparent"
      )}
    >
      <span>{category.icon}</span>
      <span>{category.name}</span>
    </button>
  );
}

export function MarketGrid() {
  const addLog = useDebugStore((s) => s.addLog);
  const setLastApiResponse = useDebugStore((s) => s.setLastApiResponse);

  // State
  const [selectedCategories, setSelectedCategories] = useState<SportCategory[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("volume");
  const [page, setPage] = useState(1);

  // Trade modal state
  const [selectedMarket, setSelectedMarket] = useState<UnifiedMarket | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);

  // Fetch markets
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      "markets",
      page,
      selectedCategories,
      selectedPlatforms,
      searchQuery,
      sortBy,
    ],
    queryFn: async () => {
      addLog({
        level: "info",
        message: "Fetching markets...",
        source: "api",
      });

      try {
        const result = await fetchMarkets({
          page,
          pageSize: 20,
          categories: selectedCategories.length ? selectedCategories : undefined,
          platforms: selectedPlatforms.length ? selectedPlatforms : undefined,
          search: searchQuery || undefined,
          sortBy,
          sortOrder: "desc",
        });

        setLastApiResponse({
          endpoint: "/api/markets",
          status: 200,
          data: { total: result.total, items: result.items.length },
        });

        addLog({
          level: "success",
          message: `Fetched ${result.items.length} markets`,
          source: "api",
        });

        return result;
      } catch (err) {
        setLastApiResponse({
          endpoint: "/api/markets",
          status: 500,
          error: err instanceof Error ? err.message : "Unknown error",
        });

        addLog({
          level: "error",
          message: `Failed to fetch markets: ${err instanceof Error ? err.message : "Unknown"}`,
          source: "api",
        });

        throw err;
      }
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Handlers
  const handleCategoryToggle = useCallback((category: SportCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
    setPage(1);
  }, []);

  const handlePlatformToggle = useCallback((platform: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
    setPage(1);
  }, []);

  const handleMarketSelect = useCallback(
    (market: UnifiedMarket, outcome: MarketOutcome) => {
      setSelectedMarket(market);
      setSelectedOutcome(outcome);
      setIsTradeModalOpen(true);

      addLog({
        level: "info",
        message: `Selected market: ${market.title}`,
        data: { marketId: market.id, outcome: outcome.name },
        source: "ui",
      });
    },
    [addLog]
  );

  const handleCloseModal = useCallback(() => {
    setIsTradeModalOpen(false);
    setSelectedMarket(null);
    setSelectedOutcome(null);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedCategories([]);
    setSelectedPlatforms([]);
    setSearchQuery("");
    setPage(1);
  }, []);

  const hasFilters =
    selectedCategories.length > 0 ||
    selectedPlatforms.length > 0 ||
    searchQuery.length > 0;

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-500 mr-2">
            <Filter className="w-4 h-4 inline mr-1" />
            Sports:
          </span>
          {Object.entries(SPORT_CATEGORIES)
            .filter(([key]) => key !== "other")
            .map(([key, value]) => (
              <CategoryFilter
                key={key}
                category={value}
                isSelected={selectedCategories.includes(key as SportCategory)}
                onClick={() => handleCategoryToggle(key as SportCategory)}
              />
            ))}
        </div>

        {/* Platform filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500 mr-2">Platform:</span>
          <button
            onClick={() => handlePlatformToggle("polymarket")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              selectedPlatforms.includes("polymarket")
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 border border-transparent"
            )}
          >
            Polymarket
          </button>
          <button
            onClick={() => handlePlatformToggle("kalshi")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              selectedPlatforms.includes("kalshi")
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 border border-transparent"
            )}
          >
            Kalshi
          </button>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-sm text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Clear filters
            </button>
          )}
        </div>

        {/* Sort and Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="volume">Volume</option>
              <option value="liquidity">Liquidity</option>
              <option value="endDate">End Date</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            {data && (
              <span className="text-sm text-neutral-500">
                {data.total} markets
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={cn("w-4 h-4", isFetching && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-12 h-12 text-danger-400 mb-4" />
          <h3 className="text-lg font-semibold text-neutral-200 mb-2">
            Failed to load markets
          </h3>
          <p className="text-sm text-neutral-500 mb-4">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      )}

      {/* Markets Grid */}
      {data && data.items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {data.items.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                onSelect={handleMarketSelect}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Empty State */}
      {data && data.items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="w-12 h-12 text-neutral-600 mb-4" />
          <h3 className="text-lg font-semibold text-neutral-200 mb-2">
            No markets found
          </h3>
          <p className="text-sm text-neutral-500 mb-4">
            Try adjusting your filters or search query
          </p>
          {hasFilters && (
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Pagination */}
      {data && data.hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Load More
          </Button>
        </div>
      )}

      {/* Trade Modal */}
      {selectedMarket && selectedOutcome && (
        <TradeModal
          market={selectedMarket}
          outcome={selectedOutcome}
          isOpen={isTradeModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
