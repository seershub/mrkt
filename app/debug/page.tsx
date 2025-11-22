'use client';

import { useState } from 'react';
import { logger } from '@/lib/utils/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DebugPage() {
    const [loading, setLoading] = useState(false);

    const testLog = (level: 'info' | 'warn' | 'error' | 'success') => {
        logger[level](`Test ${level} message`, { timestamp: Date.now() });
    };

    const checkMarkets = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/markets');
            const data = await res.json();
            logger.success('Fetched markets', data);
        } catch (error) {
            logger.error('Failed to fetch markets', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 space-y-8">
            <h1 className="text-3xl font-bold">Debug Console</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Logger Test</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        <Button onClick={() => testLog('info')} variant="outline" className="border-blue-500 text-blue-500">Info</Button>
                        <Button onClick={() => testLog('warn')} variant="outline" className="border-yellow-500 text-yellow-500">Warn</Button>
                        <Button onClick={() => testLog('error')} variant="outline" className="border-red-500 text-red-500">Error</Button>
                        <Button onClick={() => testLog('success')} variant="outline" className="border-green-500 text-green-500">Success</Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>API Tests</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Button onClick={checkMarkets} disabled={loading}>
                            {loading ? 'Fetching...' : 'Fetch /api/markets'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
