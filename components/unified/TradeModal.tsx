'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UnifiedMarket, UnifiedOutcome } from '@/types';
import { useAccount, useBalance, useReadContract, useWriteContract } from 'wagmi';
import { logger } from '@/lib/utils/logger';
import { Loader2, AlertCircle } from 'lucide-react';
import { POLYMARKET_CONTRACTS } from '@/lib/constants';
import { toast } from 'sonner';
import { parseUnits, formatUnits } from 'viem';

interface TradeModalProps {
    market: UnifiedMarket;
    outcome: UnifiedOutcome;
    children: React.ReactNode;
}

// ERC20 ABI for basic interactions
const ERC20_ABI = [
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    }
] as const;

export function TradeModal({ market, outcome, children }: TradeModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();

    // USDC Balance
    const { data: usdcBalance } = useReadContract({
        address: POLYMARKET_CONTRACTS.USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address && market.source === 'POLY' }
    });

    // USDC Allowance for Proxy/Exchange
    // Note: Usually we approve the Proxy, but for simplicity/docs we might approve the Exchange or Proxy Factory.
    // Polymarket uses a Proxy Wallet. The User approves the PROXY WALLET to spend their USDC.
    // But we don't know the Proxy Address yet without querying.
    // For this implementation, we'll assume we approve the Exchange directly or skip if we can't find proxy.
    // Ideally, we fetch the proxy address from the API first.

    const [proxyAddress, setProxyAddress] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && address && market.source === 'POLY') {
            // Fetch Proxy Address
            // In a real app, this would be a proper API call or contract read
            // setProxyAddress('0x...'); 
        }
    }, [isOpen, address, market.source]);

    const handleTrade = async () => {
        if (!isConnected) {
            toast.error('Please connect your wallet');
            return;
        }

        if (!amount || Number(amount) <= 0) {
            toast.error('Invalid amount');
            return;
        }

        setLoading(true);
        try {
            if (market.source === 'POLY') {
                await handlePolyTrade();
            } else {
                await handleKalshiTrade();
            }
            setIsOpen(false);
            setAmount('');
        } catch (error: any) {
            logger.error('Trade Failed', error);
            toast.error(error.message || 'Trade failed');
        } finally {
            setLoading(false);
        }
    };

    const handlePolyTrade = async () => {
        logger.info('Starting Polymarket Trade...');
        toast.info('Initiating Polymarket order...');

        // 1. Check Balance
        const cost = Number(amount) * outcome.price; // Approx cost
        // Note: Real cost calc is complex (clob), this is an estimate

        // 2. Check/Deploy Proxy
        // In production, we would call the Relayer to deploy if needed.

        // 3. Approve USDC (if needed)
        // if (allowance < cost) { await approve(...) }

        // 4. Create Order Object
        const order = {
            maker: address,
            taker: '0x0000000000000000000000000000000000000000',
            tokenId: outcome.id,
            makerAmount: amount,
            takerAmount: '0',
            side: 'BUY',
            feeRateBps: '0',
            nonce: Date.now().toString(),
        };

        // 5. Sign Order (Mock for now, would use useSignTypedData)
        const signature = '0xMOCK_SIGNATURE_FOR_VERCEL_TEST';

        // 6. Relay Order
        const res = await fetch('/api/polymarket/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                signedOrder: { ...order, signature },
                orderType: 'FOK'
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Relayer failed');
        }

        const data = await res.json();
        logger.success('Polymarket Order Placed', data);
        toast.success('Order placed successfully!');
    };

    const handleKalshiTrade = async () => {
        logger.info('Starting Kalshi Trade...');
        toast.info('Submitting to Kalshi...');

        const res = await fetch('/api/kalshi/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker: market.id,
                side: 'yes',
                count: Number(amount),
                price: outcome.price
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Kalshi API failed');
        }

        const data = await res.json();
        logger.success('Kalshi Order Placed', data);
        toast.success('Kalshi order executed!');
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card border-border">
                <DialogHeader>
                    <DialogTitle>Trade {market.question}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Outcome</span>
                        <span className="font-bold text-lg">{outcome.label}</span>
                    </div>

                    <div className="p-3 bg-muted/20 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Price</span>
                            <span className="font-mono font-bold">{(outcome.price * 100).toFixed(1)}¢</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Prob</span>
                            <span className="font-mono">{(outcome.probability * 100).toFixed(0)}%</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex justify-between">
                            <span>Amount (Shares)</span>
                            {market.source === 'POLY' && usdcBalance && (
                                <span className="text-xs text-muted-foreground">
                                    Bal: {formatUnits(usdcBalance, 6)} USDC
                                </span>
                            )}
                        </label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            className="font-mono text-lg"
                        />
                    </div>

                    {market.source === 'POLY' && !isConnected && (
                        <div className="flex items-center gap-2 text-yellow-500 text-xs bg-yellow-500/10 p-2 rounded">
                            <AlertCircle className="w-4 h-4" />
                            <span>Connect wallet to trade on Polymarket</span>
                        </div>
                    )}

                    <Button
                        onClick={handleTrade}
                        disabled={loading || !amount || (market.source === 'POLY' && !isConnected)}
                        className="w-full bg-brand-600 hover:bg-brand-700 font-bold text-md py-6"
                    >
                        {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Place Order'}
                    </Button>

                    <p className="text-[10px] text-center text-muted-foreground">
                        {market.source === 'POLY' ? 'Powered by Polymarket & Polygon' : 'Regulated by Kalshi (US)'}
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
