import { NextResponse } from "next/server";
import type { AggregatedPrice, Chain, CexPrice, DexPoolPrice } from "@/types";
import { getCache, setCache } from "@/lib/cache";
import { fetchTokenByContract } from "@/lib/aggregators/coingecko";
import { fetchDexPools } from "@/lib/aggregators/dexscreener";
import { fetchCexPrices as fetchDirectCexPrices } from "@/lib/aggregators/cex";
import { fetchTokenSecurity, assessPoolRisk } from "@/lib/aggregators/security";
import { findArbitrageOpportunities, calculateBestBuySell } from "@/lib/aggregators/arbitrage";

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = (searchParams.get("address") ?? "").trim();
    const chainParam = searchParams.get("chain") as Chain | null;

    // Validate address - allow both EVM (0x) and Solana addresses
    const isEvmAddress = address.startsWith("0x") && address.length >= 10;
    const isSolanaAddress = !address.startsWith("0x") && address.length >= 32 && address.length <= 44;
    
    if (!address || (!isEvmAddress && !isSolanaAddress)) {
      return NextResponse.json(
        { error: "Provide a valid contract address." },
        { status: 400 }
      );
    }

    if (!chainParam || !ALLOWED_CHAINS.includes(chainParam)) {
      return NextResponse.json(
        { error: "Unsupported or missing chain." },
        { status: 400 }
      );
    }

    const cacheKey = `price:${chainParam}:${address.toLowerCase()}`;
    const cached = getCache<AggregatedPrice>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch data from all sources in parallel
    const [coingeckoToken, dexPools, security] = await Promise.all([
      fetchTokenByContract(chainParam, address),
      fetchDexPools(address, chainParam),
      fetchTokenSecurity(chainParam, address)
    ]);

    // Fetch CEX prices if we have a symbol
    const directCexPrices = coingeckoToken?.symbol 
      ? await fetchDirectCexPrices(coingeckoToken.symbol)
      : [];

    // Process CEX prices from CoinGecko tickers
    const cexMap = new Map<string, CexPrice>();
    const normalizeName = (name: string) => name.trim().toLowerCase()
      .replace(/\s+/g, "")
      .replace(/exchange$/i, "")
      .replace(/international$/i, "")
      .replace(/global$/i, "");

    // Helper to generate trade URL
    const getTradeUrlForCex = (exchange: string, symbol: string): string => {
      const sym = symbol.toUpperCase();
      const urls: Record<string, string> = {
        binance: `https://www.binance.com/en/trade/${sym}_USDT?type=spot`,
        coinbase: `https://www.coinbase.com/advanced-trade/spot/${sym}-USD`,
        kraken: `https://pro.kraken.com/app/trade/${sym.toLowerCase()}-usd`,
        okx: `https://www.okx.com/trade-spot/${sym.toLowerCase()}-usdt`,
        bybit: `https://www.bybit.com/trade/spot/${sym}/USDT`,
        kucoin: `https://www.kucoin.com/trade/${sym}-USDT`,
        gateio: `https://www.gate.io/trade/${sym}_USDT`,
        htx: `https://www.htx.com/trade/${sym.toLowerCase()}_usdt`,
        huobi: `https://www.htx.com/trade/${sym.toLowerCase()}_usdt`,
        mexc: `https://www.mexc.com/exchange/${sym}_USDT`,
        bitget: `https://www.bitget.com/spot/${sym}USDT`,
        cryptocom: `https://crypto.com/exchange/trade/${sym}_USDT`,
        bitstamp: `https://www.bitstamp.net/markets/${sym.toLowerCase()}/usd/`,
        gemini: `https://exchange.gemini.com/trade/${sym}USD`,
        bitfinex: `https://trading.bitfinex.com/t/${sym}:USD`,
      };
      const key = exchange.toLowerCase().replace(/[\s.-]/g, "");
      return urls[key] || `https://www.coingecko.com/en/coins/${sym.toLowerCase()}`;
    };

    // Add tickers from CoinGecko
    (coingeckoToken?.tickers ?? [])
      .filter((t) => t.isCex && t.priceUsd !== null)
      .forEach((t) => {
        const key = normalizeName(t.marketName);
        const existing = cexMap.get(key);
        if (!existing || (t.volumeUsd ?? 0) > (existing.volume24hUsd ?? 0)) {
          cexMap.set(key, {
            exchange: t.marketName,
            exchangeId: key,
            priceUsd: t.priceUsd,
            volume24hUsd: t.volumeUsd,
            bid: null,
            ask: null,
            spread: null,
            priceChange24h: null,
            score: 50,
            tier: 2,
            tradeUrl: getTradeUrlForCex(t.marketName, coingeckoToken?.symbol || "")
          });
        }
      });

    // Merge direct CEX data (more accurate)
    directCexPrices.forEach((c) => {
      const key = normalizeName(c.exchange);
      cexMap.set(key, c);
    });

    const cexPrices = Array.from(cexMap.values())
      .sort((a, b) => b.score - a.score);

    // Process DEX pools from CoinGecko
    const coingeckoDexPools: DexPoolPrice[] = (coingeckoToken?.tickers ?? [])
      .filter((t) => !t.isCex && t.priceUsd !== null)
      .map((t) => ({
        chain: chainParam,
        dexId: "coingecko",
        dexName: `${t.marketName} (CG)`,
        pairAddress: t.target,
        pairUrl: null,
        priceUsd: t.priceUsd,
        liquidityUsd: t.volumeUsd,
        volume24h: t.volumeUsd,
        priceChange: { h1: null, h6: null, h24: null },
        txns24h: { buys: 0, sells: 0, total: 0 },
        createdAt: null,
        poolAgeHours: null,
        fdv: null,
        baseToken: { address: "", symbol: "", name: "" },
        quoteToken: { address: "", symbol: "", name: "" },
        score: 40,
        tier: 2
      }));

    // Combine and sort DEX pools
    const allDexPools = [...dexPools, ...coingeckoDexPools]
      .filter((pool) => pool.liquidityUsd !== null && pool.liquidityUsd >= 100)
      .sort((a, b) => b.score - a.score);

    // Calculate arbitrage opportunities
    const arbitrage = findArbitrageOpportunities(allDexPools, cexPrices);

    // Calculate best buy/sell
    const { bestBuy, bestSell, spreadPercent } = calculateBestBuySell(
      allDexPools, 
      cexPrices, 
      coingeckoToken?.priceUsd ?? null
    );

    if (!coingeckoToken && !allDexPools.length && !cexPrices.length) {
      return NextResponse.json(
        { error: "No price data available for this token." },
        { status: 404 }
      );
    }

    const result: AggregatedPrice = {
      token: {
        name: coingeckoToken?.name ?? allDexPools[0]?.baseToken?.name ?? "Unknown token",
        symbol: coingeckoToken?.symbol ?? allDexPools[0]?.baseToken?.symbol ?? "",
        chain: chainParam,
        address: address.toLowerCase(),
        imageUrl: coingeckoToken?.imageUrl ?? null
      },
      coingeckoPriceUsd: coingeckoToken?.priceUsd ?? null,
      dexPools: allDexPools,
      cexPrices,
      security,
      arbitrage,
      bestBuy,
      bestSell,
      priceSpreadPercent: spreadPercent,
      updatedAt: new Date().toISOString()
    };

    setCache(cacheKey, result, 10_000); // cache for 10s

    return NextResponse.json(result);
  } catch (error) {
    console.error("/api/price error", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
