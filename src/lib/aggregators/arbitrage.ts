import type { Chain, DexPoolPrice, CexPrice, ArbitrageOpportunity } from "@/types";

// Estimated gas costs in USD by chain (for a typical swap)
const ESTIMATED_GAS_COSTS: Record<Chain, number> = {
  ethereum: 15,    // ~$15 for a swap on mainnet
  bsc: 0.3,        // ~$0.30
  polygon: 0.05,   // ~$0.05
  arbitrum: 0.5,   // ~$0.50
  optimism: 0.3,   // ~$0.30
  base: 0.1,       // ~$0.10
  solana: 0.01,    // ~$0.01
  avalanche: 0.5,  // ~$0.50
  fantom: 0.05,    // ~$0.05
  zksync: 0.2,     // ~$0.20
};

// CEX withdrawal fees estimation (varies by token, this is a rough average)
const CEX_WITHDRAWAL_FEE_USD = 5;

// Minimum spread % to consider an opportunity
const MIN_SPREAD_THRESHOLD = 0.5;

// Minimum net profit % after fees to flag as viable
const MIN_VIABLE_PROFIT = 1.0;

interface PriceSource {
  source: string;
  type: "dex" | "cex";
  price: number;
  chain?: Chain;
  url?: string | null;
}

export function findArbitrageOpportunities(
  dexPools: DexPoolPrice[],
  cexPrices: CexPrice[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  
  // Collect all valid prices
  const allPrices: PriceSource[] = [];
  
  // Add DEX prices
  for (const pool of dexPools) {
    if (pool.priceUsd !== null && pool.liquidityUsd !== null && pool.liquidityUsd >= 1000) {
      allPrices.push({
        source: `${pool.dexName} (${pool.chain})`,
        type: "dex",
        price: pool.priceUsd,
        chain: pool.chain,
        url: pool.pairUrl
      });
    }
  }
  
  // Add CEX prices
  for (const cex of cexPrices) {
    if (cex.priceUsd !== null) {
      allPrices.push({
        source: cex.exchange,
        type: "cex",
        price: cex.priceUsd,
        url: cex.tradeUrl
      });
    }
  }
  
  if (allPrices.length < 2) return [];
  
  // Sort by price ascending
  allPrices.sort((a, b) => a.price - b.price);
  
  const lowestPrice = allPrices[0];
  const highestPrice = allPrices[allPrices.length - 1];
  
  // Calculate spread
  const spreadPercent = ((highestPrice.price - lowestPrice.price) / lowestPrice.price) * 100;
  
  if (spreadPercent < MIN_SPREAD_THRESHOLD) return [];
  
  // Calculate gas costs
  let estimatedGasCost = 0;
  
  // If buying on DEX
  if (lowestPrice.type === "dex" && lowestPrice.chain) {
    estimatedGasCost += ESTIMATED_GAS_COSTS[lowestPrice.chain] || 1;
  }
  
  // If selling on DEX
  if (highestPrice.type === "dex" && highestPrice.chain) {
    estimatedGasCost += ESTIMATED_GAS_COSTS[highestPrice.chain] || 1;
  }
  
  // Cross-chain transfer costs (if different chains)
  if (lowestPrice.chain && highestPrice.chain && lowestPrice.chain !== highestPrice.chain) {
    // Bridge fees roughly
    estimatedGasCost += 10;
  }
  
  // CEX withdrawal fee
  if (lowestPrice.type === "cex" || highestPrice.type === "cex") {
    estimatedGasCost += CEX_WITHDRAWAL_FEE_USD;
  }
  
  // Calculate net profit assuming $1000 trade
  const tradeAmount = 1000;
  const tokensReceived = tradeAmount / lowestPrice.price;
  const saleValue = tokensReceived * highestPrice.price;
  const netProfit = saleValue - tradeAmount - estimatedGasCost;
  const netProfitPercent = (netProfit / tradeAmount) * 100;
  
  const isViable = netProfitPercent >= MIN_VIABLE_PROFIT;
  
  opportunities.push({
    buyFrom: {
      source: lowestPrice.source,
      type: lowestPrice.type,
      price: lowestPrice.price,
      chain: lowestPrice.chain,
      url: lowestPrice.url
    },
    sellTo: {
      source: highestPrice.source,
      type: highestPrice.type,
      price: highestPrice.price,
      chain: highestPrice.chain,
      url: highestPrice.url
    },
    spreadPercent,
    estimatedGasCost,
    netProfitPercent,
    isViable
  });
  
  // Also find DEX-to-DEX opportunities on same chain (lower fees)
  const poolsByChain = new Map<Chain, DexPoolPrice[]>();
  for (const pool of dexPools) {
    if (pool.priceUsd === null || pool.liquidityUsd === null || pool.liquidityUsd < 1000) continue;
    const existing = poolsByChain.get(pool.chain) || [];
    existing.push(pool);
    poolsByChain.set(pool.chain, existing);
  }
  
  for (const [chain, pools] of poolsByChain) {
    if (pools.length < 2) continue;
    
    pools.sort((a, b) => (a.priceUsd ?? 0) - (b.priceUsd ?? 0));
    const lowest = pools[0];
    const highest = pools[pools.length - 1];
    
    if (lowest.priceUsd === null || highest.priceUsd === null) continue;
    
    const chainSpread = ((highest.priceUsd - lowest.priceUsd) / lowest.priceUsd) * 100;
    if (chainSpread < MIN_SPREAD_THRESHOLD) continue;
    
    // Skip if it's the same as the main opportunity
    if (lowest.dexName === lowestPrice.source.split(" ")[0] && 
        highest.dexName === highestPrice.source.split(" ")[0]) {
      continue;
    }
    
    const chainGasCost = (ESTIMATED_GAS_COSTS[chain] || 1) * 2; // Two swaps
    const chainTradeAmount = 1000;
    const chainTokens = chainTradeAmount / lowest.priceUsd;
    const chainSaleValue = chainTokens * highest.priceUsd;
    const chainNetProfit = chainSaleValue - chainTradeAmount - chainGasCost;
    const chainNetProfitPercent = (chainNetProfit / chainTradeAmount) * 100;
    
    if (chainNetProfitPercent >= MIN_VIABLE_PROFIT * 0.5) { // Lower threshold for same-chain
      opportunities.push({
        buyFrom: {
          source: `${lowest.dexName} (${chain})`,
          type: "dex",
          price: lowest.priceUsd,
          chain,
          url: lowest.pairUrl
        },
        sellTo: {
          source: `${highest.dexName} (${chain})`,
          type: "dex",
          price: highest.priceUsd,
          chain,
          url: highest.pairUrl
        },
        spreadPercent: chainSpread,
        estimatedGasCost: chainGasCost,
        netProfitPercent: chainNetProfitPercent,
        isViable: chainNetProfitPercent >= MIN_VIABLE_PROFIT
      });
    }
  }
  
  // Sort by viability and profit
  opportunities.sort((a, b) => {
    if (a.isViable !== b.isViable) return a.isViable ? -1 : 1;
    return (b.netProfitPercent ?? 0) - (a.netProfitPercent ?? 0);
  });
  
  return opportunities;
}

export function calculateBestBuySell(
  dexPools: DexPoolPrice[],
  cexPrices: CexPrice[],
  coingeckoPrice: number | null
): {
  bestBuy: { source: string; type: "dex" | "cex"; price: number; url: string | null } | null;
  bestSell: { source: string; type: "dex" | "cex"; price: number; url: string | null } | null;
  spreadPercent: number | null;
} {
  const allPrices: { source: string; type: "dex" | "cex"; price: number; url: string | null }[] = [];
  
  // Add DEX prices (only from pools with decent liquidity)
  for (const pool of dexPools) {
    if (pool.priceUsd !== null && pool.liquidityUsd !== null && pool.liquidityUsd >= 500) {
      allPrices.push({
        source: `${pool.dexName} (${pool.chain})`,
        type: "dex",
        price: pool.priceUsd,
        url: pool.pairUrl
      });
    }
  }
  
  // Add CEX prices
  for (const cex of cexPrices) {
    if (cex.priceUsd !== null) {
      allPrices.push({
        source: cex.exchange,
        type: "cex",
        price: cex.priceUsd,
        url: cex.tradeUrl
      });
    }
  }
  
  if (allPrices.length === 0) {
    return { bestBuy: null, bestSell: null, spreadPercent: null };
  }
  
  // Sort by price
  allPrices.sort((a, b) => a.price - b.price);
  
  const bestBuy = allPrices[0];
  const bestSell = allPrices[allPrices.length - 1];
  
  const spreadPercent = allPrices.length > 1
    ? ((bestSell.price - bestBuy.price) / bestBuy.price) * 100
    : null;
  
  return { bestBuy, bestSell, spreadPercent };
}
