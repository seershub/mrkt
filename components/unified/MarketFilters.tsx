'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X } from 'lucide-react';

interface MarketFiltersProps {
    onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
    search: string;
    source: 'ALL' | 'POLY' | 'KALSHI';
    category: string;
}

const CATEGORIES = ['All', 'Sports', 'Politics', 'Crypto', 'Entertainment'];

export function MarketFilters({ onFilterChange }: MarketFiltersProps) {
    const [filters, setFilters] = useState<FilterState>({
        search: '',
        source: 'ALL',
        category: 'All',
    });

    const updateFilters = (updates: Partial<FilterState>) => {
        const newFilters = { ...filters, ...updates };
        setFilters(newFilters);
        onFilterChange(newFilters);
    };

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search markets..."
                    value={filters.search}
                    onChange={(e) => updateFilters({ search: e.target.value })}
                    className="pl-10 bg-card border-border"
                />
            </div>

            {/* Source Filter */}
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Source:</span>
                <div className="flex gap-2">
                    {(['ALL', 'POLY', 'KALSHI'] as const).map((source) => (
                        <Button
                            key={source}
                            variant={filters.source === source ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateFilters({ source })}
                            className={filters.source === source ? 'bg-brand-600' : ''}
                        >
                            {source}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => (
                    <Badge
                        key={category}
                        variant={filters.category === category ? 'default' : 'outline'}
                        className={`cursor-pointer ${filters.category === category
                                ? 'bg-brand-500 hover:bg-brand-600'
                                : 'hover:bg-muted'
                            }`}
                        onClick={() => updateFilters({ category })}
                    >
                        {category}
                    </Badge>
                ))}
            </div>

            {/* Active Filters */}
            {(filters.search || filters.source !== 'ALL' || filters.category !== 'All') && (
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Active filters:</span>
                    {filters.search && (
                        <Badge variant="secondary" className="gap-1">
                            Search: {filters.search}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => updateFilters({ search: '' })}
                            />
                        </Badge>
                    )}
                    {filters.source !== 'ALL' && (
                        <Badge variant="secondary" className="gap-1">
                            {filters.source}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => updateFilters({ source: 'ALL' })}
                            />
                        </Badge>
                    )}
                    {filters.category !== 'All' && (
                        <Badge variant="secondary" className="gap-1">
                            {filters.category}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => updateFilters({ category: 'All' })}
                            />
                        </Badge>
                    )}
                </div>
            )}
        </div>
    );
}
