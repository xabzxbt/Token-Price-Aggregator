import type { Chain, DexPoolPrice, ExchangeTier } from "@/types";

const DEX_SCREENER_BASE_URL = "https://api.dexscreener.com/latest/dex";

// Chain ID mapping for DexScreener
const CHAIN_ID_BY_CHAIN: Record<Chain, string> = {
  ethereum: "ethereum",
  bsc: "bsc",
  polygon: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  solana: "solana",
  avalanche: "avalanche",
  fantom: "fantom",
  zksync: "zksync"
};

// Reverse mapping
const CHAIN_BY_CHAIN_ID: Record<string, Chain> = Object.fromEntries(
  Object.entries(CHAIN_ID_BY_CHAIN).map(([k, v]) => [v, k as Chain])
);

// DEX tier classification (trust level)
const DEX_TIERS: Record<string, ExchangeTier> = {
  // Tier 1: Established, audited, high TVL
  uniswap: 1,
  "uniswap_v3": 1,
  "uniswap_v2": 1,
  pancakeswap: 1,
  "pancakeswap_v3": 1,
  "pancakeswap_v2": 1,
  sushiswap: 1,
  "sushiswap_v3": 1,
  curve: 1,
  balancer: 1,
  "balancer_v2": 1,
  raydium: 1,
  orca: 1,
  trader_joe: 1,
  "trader_joe_v2": 1,
  camelot: 1,
  velodrome: 1,
  aerodrome: 1,
  
  // Tier 2: Known, moderate trust
  quickswap: 2,
  "quickswap_v3": 2,
  spookyswap: 2,
  spiritswap: 2,
  baseswap: 2,
  maverick: 2,
  thena: 2,
  syncswap: 2,
  mute: 2,
  zkswap: 2,
  jupiter: 2,
  meteora: 2,
  
  // Tier 3: Unknown/new - default
};

function getDexTier(dexId: string): ExchangeTier {
  const normalizedId = dexId.toLowerCase().replace(/[-_\s]/g, "_");
  return DEX_TIERS[normalizedId] ?? 3;
}

function calculateDexScore(pool: {
  liquidityUsd: number | null;
  volume24h: number | null;
  tier: ExchangeTier;
  poolAgeHours: number | null;
  txns24hTotal: number;
}): number {
  const liquidityScore = Math.min((pool.liquidityUsd ?? 0) / 1_000_000, 100); // Max 100 for $1M+
  const volumeScore = Math.min((pool.volume24h ?? 0) / 500_000, 100); // Max 100 for $500K+
  const tierScore = pool.tier === 1 ? 100 : pool.tier === 2 ? 60 : 30;
  const ageScore = pool.poolAgeHours !== null 
    ? Math.min(pool.poolAgeHours / 720, 100) // Max 100 for 30+ days
    : 50;
  const activityScore = Math.min(pool.txns24hTotal / 100, 100); // Max 100 for 100+ txns

  return (
    liquidityScore * 0.35 +
    volumeScore * 0.25 +
    tierScore * 0.20 +
    ageScore * 0.10 +
    activityScore * 0.10
  );
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(num) ? num : null;
}

function calculatePoolAge(createdAt: number | null): number | null {
  if (!createdAt) return null;
  const now = Date.now();
  const ageMs = now - createdAt;
  return ageMs / (1000 * 60 * 60); // Hours
}

async function safeFetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`DexScreener error: ${res.status}`);
    }

    return res.json();
  } catch (error) {
    console.error("DexScreener request failed", error);
    return null;
  }
}

export async function fetchDexPools(
  address: string,
  filterChain?: Chain
): Promise<DexPoolPrice[]> {
  const normalizedAddress = address.trim().toLowerCase();
  const url = `${DEX_SCREENER_BASE_URL}/tokens/${normalizedAddress}`;

  const data = await safeFetchJson(url);
  const pairs = Array.isArray(data?.pairs) ? data.pairs : [];

  const allowedChainIds = new Set(Object.values(CHAIN_ID_BY_CHAIN));

  return pairs
    .filter((pair: any) => {
      const chainId = String(pair.chainId);
      if (!allowedChainIds.has(chainId)) return false;
      if (filterChain && chainId !== CHAIN_ID_BY_CHAIN[filterChain]) return false;
      return true;
    })
    .map((pair: any) => {
      const chainId = String(pair.chainId);
      const chain = CHAIN_BY_CHAIN_ID[chainId];
      if (!chain) return null;

      const priceUsd = parseNumber(pair.priceUsd);
      const liquidityUsd = parseNumber(pair.liquidity?.usd);
      const volume24h = parseNumber(pair.volume?.h24);
      const createdAtTimestamp = pair.pairCreatedAt ? Number(pair.pairCreatedAt) : null;
      const poolAgeHours = calculatePoolAge(createdAtTimestamp);
      const tier = getDexTier(pair.dexId ?? "");
      
      const txns = pair.txns?.h24 ?? {};
      const txns24h = {
        buys: Number(txns.buys ?? 0),
        sells: Number(txns.sells ?? 0),
        total: Number(txns.buys ?? 0) + Number(txns.sells ?? 0)
      };

      const score = calculateDexScore({
        liquidityUsd,
        volume24h,
        tier,
        poolAgeHours,
        txns24hTotal: txns24h.total
      });

      return {
        chain,
        dexId: String(pair.dexId ?? ""),
        dexName: String(pair.dexId ?? "").replace(/_/g, " "),
        pairAddress: String(pair.pairAddress ?? ""),
        pairUrl: pair.url ?? null,
        priceUsd,
        liquidityUsd,
        volume24h,
        priceChange: {
          h1: parseNumber(pair.priceChange?.h1),
          h6: parseNumber(pair.priceChange?.h6),
          h24: parseNumber(pair.priceChange?.h24)
        },
        txns24h,
        createdAt: createdAtTimestamp ? new Date(createdAtTimestamp).toISOString() : null,
        poolAgeHours,
        fdv: parseNumber(pair.fdv),
        baseToken: {
          address: String(pair.baseToken?.address ?? ""),
          symbol: String(pair.baseToken?.symbol ?? ""),
          name: String(pair.baseToken?.name ?? "")
        },
        quoteToken: {
          address: String(pair.quoteToken?.address ?? ""),
          symbol: String(pair.quoteToken?.symbol ?? ""),
          name: String(pair.quoteToken?.name ?? "")
        },
        score,
        tier
      } satisfies DexPoolPrice;
    })
    .filter(Boolean) as DexPoolPrice[];
}

// Search tokens by name/symbol on DexScreener
export async function searchDexTokens(query: string): Promise<{
  address: string;
  chain: Chain;
  name: string;
  symbol: string;
  priceUsd: number | null;
}[]> {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
  const data = await safeFetchJson(url);
  const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
  
  const seen = new Set<string>();
  const results: {
    address: string;
    chain: Chain;
    name: string;
    symbol: string;
    priceUsd: number | null;
  }[] = [];

  for (const pair of pairs) {
    const chainId = String(pair.chainId);
    const chain = CHAIN_BY_CHAIN_ID[chainId];
    if (!chain) continue;

    const baseToken = pair.baseToken;
    const key = `${chain}:${baseToken?.address}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      address: String(baseToken?.address ?? ""),
      chain,
      name: String(baseToken?.name ?? ""),
      symbol: String(baseToken?.symbol ?? ""),
      priceUsd: parseNumber(pair.priceUsd)
    });

    if (results.length >= 20) break;
  }

  return results;
}
