export const POLYGON_CHAIN_ID = 137;

export const POLYMARKET_CONTRACTS = {
    // Polygon Mainnet Addresses
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Native USDC (Bridged) - Check if Poly uses Native or Bridged. Usually Bridged on Polygon POS.
    // Actually Polymarket uses the bridged USDC.e usually: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174

    EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E', // CTF Exchange
    PROXY_FACTORY: '0xaAC5D4240AF87249B3f71bc8E4a2cae074dB18D5', // Gnosis Safe Proxy Factory (Check docs for exact Poly implementation)

    // Relayer URL (Official Polymarket Relayer)
    RELAYER_URL: 'https://m-relayer.polymarket.com',
};

export const KALSHI_API_URL = 'https://trading-api.kalshi.com/trade-api/v2';
