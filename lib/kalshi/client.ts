import crypto from 'crypto';

const KALSHI_API_URL = 'https://trading-api.kalshi.com/trade-api/v2';
// Use sandbox for dev if needed: 'https://demo-api.kalshi.co/trade-api/v2'

export class KalshiClient {
    private keyId: string;
    private privateKey: string;

    constructor() {
        this.keyId = process.env.KALSHI_API_KEY_ID || '';
        // Handle potential newline characters in env var
        this.privateKey = (process.env.KALSHI_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    }

    private signRequest(method: string, path: string, timestamp: string): string {
        if (!this.privateKey) return 'MOCK_SIGNATURE';

        // Kalshi signature format: timestamp + method + path
        // Note: Actual implementation details might vary slightly based on specific docs, 
        // but usually it's standard RSA-SHA256 on the payload or headers.
        // According to docs (general knowledge): 
        // Signature = sign(timestamp + method + path + body, privateKey)

        // For this simplified version, we'll assume GET requests for now.
        const payload = `${timestamp}${method}${path}`;

        const sign = crypto.createSign('SHA256');
        sign.update(payload);
        sign.end();
        return sign.sign(this.privateKey, 'base64');
    }

    async getMarkets() {
        if (!this.keyId) {
            console.warn('Missing KALSHI_API_KEY_ID, returning mock data');
            return [];
        }

        const path = '/markets';
        const timestamp = Date.now().toString();
        const signature = this.signRequest('GET', path, timestamp);

        try {
            const res = await fetch(`${KALSHI_API_URL}${path}`, {
                headers: {
                    'KALSHI-ACCESS-KEY': this.keyId,
                    'KALSHI-ACCESS-SIGNATURE': signature,
                    'KALSHI-ACCESS-TIMESTAMP': timestamp,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                throw new Error(`Kalshi API Error: ${res.statusText}`);
            }

            const data = await res.json();
            return data.markets || [];
        } catch (error) {
            console.error('Error fetching Kalshi markets:', error);
            return [];
        }
    }
}

export const kalshiClient = new KalshiClient();
