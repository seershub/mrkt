import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';

// Server-side ONLY client for posting orders with Builder Key
const getBuilderClient = () => {
    const chainId = 137;
    const rpcUrl = 'https://polygon-rpc.com';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    // We need a signer for the builder key? 
    // The SDK documentation says for `postOrder` with builder attribution, we need to pass the builder config.

    const builderConfig = {
        apiKey: process.env.POLY_BUILDER_API_KEY || '',
        secret: process.env.POLY_BUILDER_SECRET || '',
        passphrase: process.env.POLY_BUILDER_PASSPHRASE || '',
    };

    // We use a dummy signer because we are only relaying an ALREADY SIGNED order.
    // The SDK might enforce a signer in constructor.
    const dummyWallet = ethers.Wallet.createRandom().connect(provider);

    return new ClobClient(
        'https://clob.polymarket.com',
        chainId,
        dummyWallet,
        undefined, // creds
        undefined, // signatureType
        undefined, // funderAddress
        undefined, // geoBlockToken
        undefined, // useServerTime
        builderConfig // <--- CRITICAL: Builder Config
    );
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { signedOrder, orderType } = body;

        if (!signedOrder) {
            return NextResponse.json({ error: 'Signed order required' }, { status: 400 });
        }

        logger.info('Relaying Order with Builder Key', { orderType });

        const client = getBuilderClient();

        // Post the order. The SDK will attach the Builder API headers automatically because we passed builderConfig.
        const res = await client.postOrder(signedOrder, orderType);

        logger.success('Order Relayed Successfully', res);
        return NextResponse.json(res);

    } catch (error: any) {
        logger.error('Order Relay Error', error);
        return NextResponse.json({
            error: error.message,
            details: error.response?.data
        }, { status: 500 });
    }
}
