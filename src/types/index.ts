export type Chain =
  | "ethereum"
  | "bsc"
  | "polygon"
  | "arbitrum"
  | "optimism"
  | "base"
  | "solana"
  | "avalanche"
  | "fantom"
  | "zksync";

export interface TokenSearchResult {
  id: string;
  name: string;
  symbol: string;
  chain: Chain;
  address: string;
  imageUrl: string | null;
  priceUsd: number | null;
}

// Exchange tier for trust scoring
export type ExchangeTier = 1 | 2 | 3;

export interface DexPoolPrice {
  chain: Chain;
  dexId: string;
  dexName: string;
  pairAddress: string;
  pairUrl: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  priceChange: {
    h1: number | null;
    h6: number | null;
    h24: number | null;
  };
  txns24h: {
    buys: number;
    sells: number;
    total: number;
  };
  createdAt: string | null;
  poolAgeHours: number | null;
  fdv: number | null;
  baseToken: {
    address: string;
    symbol: string;
    name: string;
  };
  quoteToken: {
    address: string;
    symbol: string;
    name: string;
  };
  score: number;
  tier: ExchangeTier;
}

export interface CexPrice {
  exchange: string;
  exchangeId: string;
  priceUsd: number | null;
  volume24hUsd: number | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  priceChange24h: number | null;
  score: number;
  tier: ExchangeTier;
  tradeUrl: string | null;
}

export interface TokenSecurity {
  isHoneypot: boolean | null;
  honeypotReason: string | null;
  buyTax: number | null;
  sellTax: number | null;
  isOpenSource: boolean | null;
  isProxy: boolean | null;
  isMintable: boolean | null;
  canTakeBackOwnership: boolean | null;
  ownerAddress: string | null;
  creatorAddress: string | null;
  holderCount: number | null;
  lpHolderCount: number | null;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  warnings: string[];
}

export interface ArbitrageOpportunity {
  buyFrom: {
    source: string;
    type: "dex" | "cex";
    price: number;
    chain?: Chain;
    url?: string | null;
  };
  sellTo: {
    source: string;
    type: "dex" | "cex";
    price: number;
    chain?: Chain;
    url?: string | null;
  };
  spreadPercent: number;
  estimatedGasCost: number | null;
  netProfitPercent: number | null;
  isViable: boolean;
}

export interface AggregatedPrice {
  token: {
    name: string;
    symbol: string;
    chain: Chain;
    address: string;
    imageUrl: string | null;
  };
  coingeckoPriceUsd: number | null;
  dexPools: DexPoolPrice[];
  cexPrices: CexPrice[];
  security: TokenSecurity | null;
  arbitrage: ArbitrageOpportunity[];
  bestBuy: {
    source: string;
    type: "dex" | "cex";
    price: number;
    url: string | null;
  } | null;
  bestSell: {
    source: string;
    type: "dex" | "cex";
    price: number;
    url: string | null;
  } | null;
  priceSpreadPercent: number | null;
  updatedAt: string;
}
