import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';

// Public client for fetching markets (no auth needed for public data)
// For trading, we will need a signer, but for now we just want to fetch markets.
// The SDK might require a signer even for read-only, or we can pass a dummy one or use a specific read-only mode if available.
// Checking standard usage: usually new ClobClient(chain_id, provider/signer)

const chainId = 137; // Polygon Mainnet
const rpcUrl = 'https://polygon-rpc.com'; // Or use Alchemy if env var present

export const getClobClient = () => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    // The first argument MUST be the CLOB API Host.
    // We pass undefined for the signer since we only need read-only access here.
    return new ClobClient('https://clob.polymarket.com', chainId, undefined);
};

export const POLYGON_EXPLORER = 'https://polygonscan.com';
