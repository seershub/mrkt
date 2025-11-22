import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { getClobClient } from '@/lib/polymarket/clob';
import { kalshiClient } from '@/lib/kalshi/client';
import { UnifiedMarket } from '@/types';

export async function GET() {
    try {
        // 1. Fetch Polymarket Data
        const polyClient = getClobClient();
        // Fetch markets (default pagination)
        const polyRes = await polyClient.getMarkets();
        // The SDK returns a PaginationPayload which contains a 'data' array
        const polyMarketsRaw = (polyRes as any).data || [];

        const polyMarkets: UnifiedMarket[] = polyMarketsRaw.map((m: any) => ({
            id: m.condition_id || m.market_slug,
            question: m.question,
            description: m.description,
            source: 'POLY',
            outcomes: JSON.parse(m.outcomes || '[]').map((label: string, idx: number) => ({
                id: `${m.condition_id}-${idx}`,
                label,
                price: 0.5, // Placeholder: active prices need separate fetch or websocket
                probability: 0.5,
            })),
            volume: Number(m.volume || 0),
            liquidity: Number(m.liquidity || 0),
            endTime: m.end_date_iso,
            image: m.image,
            category: m.category,
            raw: m,
        }));

        // 2. Fetch Kalshi Data
        const kalshiMarketsRaw = await kalshiClient.getMarkets();
        const kalshiMarkets: UnifiedMarket[] = (kalshiMarketsRaw as any[] || []).map((m: any) => ({
            id: m.ticker,
            question: m.title,
            description: m.subtitle,
            source: 'KALSHI',
            outcomes: [{
                id: `${m.ticker}-YES`,
                label: 'Yes',
                price: 0.5, // Placeholder
                probability: 0.5,
            }, {
                id: `${m.ticker}-NO`,
                label: 'No',
                price: 0.5,
                probability: 0.5,
            }],
            volume: m.volume || 0,
            endTime: m.close_date,
            category: m.category,
            raw: m,
        }));

        // 3. Merge and Sort by Volume
        const allMarkets = [...polyMarkets, ...kalshiMarkets].sort((a, b) => b.volume - a.volume);

        return NextResponse.json({ markets: allMarkets });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
