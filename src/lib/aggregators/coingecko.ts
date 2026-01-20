import type { Chain } from "@/types";

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

const PLATFORM_BY_CHAIN: Record<Chain, string> = {
  ethereum: "ethereum",
  bsc: "binance-smart-chain",
  polygon: "polygon-pos",
  arbitrum: "arbitrum-one",
  optimism: "optimistic-ethereum",
  base: "base",
  solana: "solana",
  avalanche: "avalanche",
  fantom: "fantom",
  zksync: "zksync"
};

export type CoinGeckoTokenSummary = {
  id: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  priceUsd: number | null;
  tickers: Array<{
    marketName: string;
    target: string;
    priceUsd: number | null;
    volumeUsd: number | null;
    isCex: boolean;
  }>;
};

async function safeFetchJson(url: string): Promise<any | null> {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    const headers: Record<string, string> = {};
    
    if (apiKey) {
      headers["x-cg-demo-api-key"] = apiKey;
    }

    const res = await fetch(url, {
      headers,
      next: { revalidate: 0 }
    } as any);

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`CoinGecko error: ${res.status}`);
    }

    return res.json();
  } catch (error) {
    console.error("CoinGecko request failed", error);
    return null;
  }
}

export async function fetchTokenByContract(
  chain: Chain,
  address: string
): Promise<CoinGeckoTokenSummary | null> {
  const platformId = PLATFORM_BY_CHAIN[chain];
  const normalizedAddress = address.trim().toLowerCase();

  const url = `${COINGECKO_BASE_URL}/coins/${platformId}/contract/${normalizedAddress}`;
  const data = await safeFetchJson(url);
  if (!data) return null;

  const price = data.market_data?.current_price?.usd;
  const image = data.image;
  
  const rawTickers = Array.isArray(data.tickers) ? data.tickers : [];
  const tickers = rawTickers.map((t: any) => {
    const marketName = String(t.market?.name ?? "");
    // Common DEX markers in CoinGecko market names
    const isDex = 
      marketName.includes("Uniswap") || 
      marketName.includes("PancakeSwap") || 
      marketName.includes("Raydium") || 
      marketName.includes("Sushiswap") ||
      marketName.includes("Curve") ||
      marketName.includes("Balancer") ||
      marketName.includes("Orca") ||
      marketName.includes("Jupiter");

    return {
      marketName,
      target: String(t.target ?? ""),
      priceUsd: typeof t.converted_last?.usd === "number" ? t.converted_last.usd : null,
      volumeUsd: typeof t.converted_volume?.usd === "number" ? t.converted_volume.usd : null,
      isCex: !isDex && t.is_anomaly === false && t.is_stale === false
    };
  });

  return {
    id: String(data.id ?? ""),
    name: String(data.name ?? ""),
    symbol: String(data.symbol ?? "").toUpperCase(),
    imageUrl: image?.small ?? image?.thumb ?? null,
    priceUsd: typeof price === "number" ? price : null,
    tickers
  };
}
