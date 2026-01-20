import { NextResponse } from "next/server";
import type { Chain, TokenSearchResult } from "@/types";
import { getCache, setCache } from "@/lib/cache";
import { fetchTokenByContract } from "@/lib/aggregators/coingecko";
import { fetchDexPools } from "@/lib/aggregators/dexscreener";

const ALLOWED_CHAINS: Chain[] = [
  "ethereum",
  "bsc",
  "polygon",
  "arbitrum",
  "optimism",
  "base",
  "solana",
  "avalanche",
  "fantom",
  "zksync"
];

interface SearchBody {
  address: string;
  chain: Chain;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<SearchBody>;

    const address = body.address?.trim() ?? "";
    const chain = body.chain;

    // Validate address - allow both EVM (0x) and Solana addresses
    const isEvmAddress = address.startsWith("0x") && address.length >= 10;
    const isSolanaAddress = !address.startsWith("0x") && address.length >= 32 && address.length <= 44;
    
    if (!address || (!isEvmAddress && !isSolanaAddress)) {
      return NextResponse.json(
        { error: "Provide a valid contract address." },
        { status: 400 }
      );
    }

    if (!chain || !ALLOWED_CHAINS.includes(chain)) {
      return NextResponse.json(
        { error: "Unsupported or missing chain." },
        { status: 400 }
      );
    }

    const cacheKey = `search:${chain}:${address.toLowerCase()}`;
    const cached = getCache<TokenSearchResult>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Try CoinGecko first
    const token = await fetchTokenByContract(chain, address);
    
    // If CoinGecko doesn't have it, try DexScreener
    if (!token) {
      const dexPools = await fetchDexPools(address, chain);
      if (dexPools.length > 0) {
        const firstPool = dexPools[0];
        const result: TokenSearchResult = {
          id: `dex-${firstPool.baseToken.address}`,
          name: firstPool.baseToken.name || "Unknown",
          symbol: firstPool.baseToken.symbol || "???",
          chain,
          address: address.toLowerCase(),
          imageUrl: null,
          priceUsd: firstPool.priceUsd
        };
        
        setCache(cacheKey, result, 60_000);
        return NextResponse.json(result);
      }
      
      return NextResponse.json(
        { error: "Token not found. Try checking the address and chain." },
        { status: 404 }
      );
    }

    const result: TokenSearchResult = {
      id: token.id,
      name: token.name,
      symbol: token.symbol,
      chain,
      address: address.toLowerCase(),
      imageUrl: token.imageUrl,
      priceUsd: token.priceUsd
    };

    setCache(cacheKey, result, 60_000);

    return NextResponse.json(result);
  } catch (error) {
    console.error("/api/search error", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
