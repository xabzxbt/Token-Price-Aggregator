import type { CexPrice, ExchangeTier } from "@/types";

/**
 * CEX Aggregator - збирає ціни з централізованих бірж
 * Всі API безкоштовні і не потребують ключів
 */

// CEX tier classification
export const CEX_TIERS: Record<string, { tier: ExchangeTier; name: string }> = {
  // Tier 1: Top 5 за обсягом, надійність, регуляція
  binance: { tier: 1, name: "Binance" },
  coinbase: { tier: 1, name: "Coinbase" },
  kraken: { tier: 1, name: "Kraken" },
  okx: { tier: 1, name: "OKX" },
  bybit: { tier: 1, name: "Bybit" },
  
  // Tier 2: Великі біржі з хорошою репутацією
  kucoin: { tier: 2, name: "KuCoin" },
  gateio: { tier: 2, name: "Gate.io" },
  htx: { tier: 2, name: "HTX" },
  bitfinex: { tier: 2, name: "Bitfinex" },
  cryptocom: { tier: 2, name: "Crypto.com" },
  bitstamp: { tier: 2, name: "Bitstamp" },
  gemini: { tier: 2, name: "Gemini" },
  
  // Tier 3: Менші біржі
  mexc: { tier: 3, name: "MEXC" },
  bitget: { tier: 3, name: "Bitget" },
  lbank: { tier: 3, name: "LBank" },
  bingx: { tier: 3, name: "BingX" },
  phemex: { tier: 3, name: "Phemex" },
};

function getCexInfo(exchangeId: string): { tier: ExchangeTier; name: string } {
  const normalized = exchangeId.toLowerCase().replace(/[\s.-]/g, "");
  return CEX_TIERS[normalized] ?? { tier: 3, name: exchangeId };
}

function calculateCexScore(cex: {
  volume24hUsd: number | null;
  tier: ExchangeTier;
  spread: number | null;
}): number {
  const volumeScore = Math.min((cex.volume24hUsd ?? 0) / 10_000_000, 100);
  const tierScore = cex.tier === 1 ? 100 : cex.tier === 2 ? 60 : 30;
  const spreadScore = cex.spread !== null ? Math.max(0, 100 - cex.spread * 1000) : 50;
  return volumeScore * 0.40 + tierScore * 0.40 + spreadScore * 0.20;
}

// Генерує правильний URL для торгівлі конкретною парою
function getTradeUrl(exchange: string, symbol: string, quoteSymbol = "USDT"): string {
  const sym = symbol.toUpperCase();
  const quote = quoteSymbol.toUpperCase();
  
  const urls: Record<string, string> = {
    binance: `https://www.binance.com/en/trade/${sym}_${quote}?type=spot`,
    okx: `https://www.okx.com/trade-spot/${sym.toLowerCase()}-${quote.toLowerCase()}`,
    bybit: `https://www.bybit.com/trade/spot/${sym}/${quote}`,
    kucoin: `https://www.kucoin.com/trade/${sym}-${quote}`,
    gateio: `https://www.gate.io/trade/${sym}_${quote}`,
    htx: `https://www.htx.com/trade/${sym.toLowerCase()}_${quote.toLowerCase()}`,
    mexc: `https://www.mexc.com/exchange/${sym}_${quote}`,
    bitget: `https://www.bitget.com/spot/${sym}${quote}`,
    kraken: `https://pro.kraken.com/app/trade/${sym.toLowerCase()}-${quote.toLowerCase()}`,
    coinbase: `https://www.coinbase.com/advanced-trade/spot/${sym}-${quote}`,
    cryptocom: `https://crypto.com/exchange/trade/${sym}_${quote}`,
    bitstamp: `https://www.bitstamp.net/markets/${sym.toLowerCase()}/${quote.toLowerCase()}/`,
    gemini: `https://exchange.gemini.com/trade/${sym}${quote}`,
    bitfinex: `https://trading.bitfinex.com/t/${sym}:${quote}`,
    lbank: `https://www.lbank.com/trade/${sym.toLowerCase()}_${quote.toLowerCase()}`,
    bingx: `https://bingx.com/en-us/spot/${sym}${quote}/`,
    phemex: `https://phemex.com/spot/trade/${sym}${quote}`,
  };
  
  return urls[exchange.toLowerCase()] || `https://www.coingecko.com/en/coins/${sym.toLowerCase()}`;
}

async function safeFetchJson(url: string, timeout = 5000): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { 
      signal: controller.signal, 
      cache: "no-store",
      headers: { "Accept": "application/json" }
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ===== TIER 1 EXCHANGES =====

async function fetchBinancePrice(symbol: string): Promise<CexPrice | null> {
  const pair = `${symbol.toUpperCase()}USDT`;
  const [tickerData, bookData] = await Promise.all([
    safeFetchJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`),
    safeFetchJson(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${pair}`)
  ]);
  
  if (!tickerData || typeof tickerData !== "object") return null;
  const ticker = tickerData as Record<string, unknown>;
  const book = bookData as Record<string, unknown> | null;
  if (!ticker.lastPrice) return null;

  const priceUsd = parseFloat(String(ticker.lastPrice));
  const volume24hUsd = parseFloat(String(ticker.quoteVolume ?? "0"));
  const priceChange24h = parseFloat(String(ticker.priceChangePercent ?? "0"));
  const bid = book?.bidPrice ? parseFloat(String(book.bidPrice)) : null;
  const ask = book?.askPrice ? parseFloat(String(book.askPrice)) : null;
  const spread = bid && ask ? ((ask - bid) / bid) * 100 : null;
  const info = getCexInfo("binance");

  return {
    exchange: info.name,
    exchangeId: "binance",
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    volume24hUsd: Number.isFinite(volume24hUsd) ? volume24hUsd : null,
    bid, ask, spread,
    priceChange24h: Number.isFinite(priceChange24h) ? priceChange24h : null,
    tier: info.tier,
    score: 0,
    tradeUrl: getTradeUrl("binance", symbol)
  };
}

async function fetchOKXPrice(symbol: string): Promise<CexPrice | null> {
  const pair = `${symbol.toUpperCase()}-USDT`;
  const data = await safeFetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${pair}`);
  
  if (!data || typeof data !== "object") return null;
  const response = data as { data?: unknown[] };
  if (!response.data?.[0]) return null;
  const ticker = response.data[0] as Record<string, unknown>;

  const priceUsd = parseFloat(String(ticker.last ?? "0"));
  const volume24hUsd = parseFloat(String(ticker.volCcy24h ?? "0"));
  const open24h = parseFloat(String(ticker.open24h ?? "0"));
  const priceChange24h = open24h ? ((priceUsd - open24h) / open24h) * 100 : null;
  const bid = ticker.bidPx ? parseFloat(String(ticker.bidPx)) : null;
  const ask = ticker.askPx ? parseFloat(String(ticker.askPx)) : null;
  const spread = bid && ask ? ((ask - bid) / bid) * 100 : null;
  const info = getCexInfo("okx");

  return {
    exchange: info.name,
    exchangeId: "okx",
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    volume24hUsd: Number.isFinite(volume24hUsd) ? volume24hUsd : null,
    bid, ask, spread, priceChange24h,
    tier: info.tier,
    score: 0,
    tradeUrl: getTradeUrl("okx", symbol)
  };
}

async function fetchBybitPrice(symbol: string): Promise<CexPrice | null> {
  const pair = `${symbol.toUpperCase()}USDT`;
  const data = await safeFetchJson(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${pair}`);
  
  if (!data || typeof data !== "object") return null;
  const response = data as { result?: { list?: unknown[] } };
  if (!response.result?.list?.[0]) return null;
  const ticker = response.result.list[0] as Record<string, unknown>;

  const priceUsd = parseFloat(String(ticker.lastPrice ?? "0"));
  const volume24hUsd = parseFloat(String(ticker.turnover24h ?? "0"));
  const priceChange24h = parseFloat(String(ticker.price24hPcnt ?? "0")) * 100;
  const bid = ticker.bid1Price ? parseFloat(String(ticker.bid1Price)) : null;
  const ask = ticker.ask1Price ? parseFloat(String(ticker.ask1Price)) : null;
  const spread = bid && ask ? ((ask - bid) / bid) * 100 : null;
  const info = getCexInfo("bybit");

  return {
    exchange: info.name,
    exchangeId: "bybit",
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    volume24hUsd: Number.isFinite(volume24hUsd) ? volume24hUsd : null,
    bid, ask, spread,
    priceChange24h: Number.isFinite(priceChange24h) ? priceChange24h : null,
    tier: info.tier,
    score: 0,
    tradeUrl: getTradeUrl("bybit", symbol)
  };
}

async function fetchKrakenPrice(symbol: string): Promise<CexPrice | null> {
  // Kraken uses different symbols (XBT for BTC, etc)
  const krakenSymbol = symbol.toUpperCase() === "BTC" ? "XBT" : symbol.toUpperCase();
  const pair = `${krakenSymbol}USDT`;
  const data = await safeFetchJson(`https://api.kraken.com/0/public/Ticker?pair=${pair}`);
  
  if (!data || typeof data !== "object") return null;
  const response = data as { result?: Record<string, unknown>; error?: string[] };
  if (response.error?.length) return null;
  
  const resultKeys = Object.keys(response.result || {});
  if (!resultKeys.length) return null;
  const ticker = response.result![resultKeys[0]] as Record<string, unknown>;

  const lastTrade = ticker.c as string[] | undefined;
  const priceUsd = lastTrade ? parseFloat(lastTrade[0]) : null;
  const volume = ticker.v as string[] | undefined;
  const volume24hUsd = volume ? parseFloat(volume[1]) * (priceUsd || 0) : null;
  const open = ticker.o as string | undefined;
  const priceChange24h = open && priceUsd ? ((priceUsd - parseFloat(open)) / parseFloat(open)) * 100 : null;
  const bidArr = ticker.b as string[] | undefined;
  const askArr = ticker.a as string[] | undefined;
  const bid = bidArr ? parseFloat(bidArr[0]) : null;
  const ask = askArr ? parseFloat(askArr[0]) : null;
  const spread = bid && ask ? ((ask - bid) / bid) * 100 : null;
  const info = getCexInfo("kraken");

  return {
    exchange: info.name,
    exchangeId: "kraken",
    priceUsd: priceUsd && Number.isFinite(priceUsd) ? priceUsd : null,
    volume24hUsd: volume24hUsd && Number.isFinite(volume24hUsd) ? volume24hUsd : null,
    bid, ask, spread,
    priceChange24h: priceChange24h && Number.isFinite(priceChange24h) ? priceChange24h : null,
    tier: info.tier,
    score: 0,
    tradeUrl: getTradeUrl("kraken", symbol)
  };
}

// ===== TIER 2 EXCHANGES =====

async function fetchKucoinPrice(symbol: string): Promise<CexPrice | null> {
  const pair = `${symbol.toUpperCase()}-USDT`;
  const data = await safeFetchJson(`https://api.kucoin.com/api/v1/market/stats?symbol=${pair}`);
  
  if (!data || typeof data !== "object") return null;
  const response = data as { data?: Record<string, unknown> };
  if (!response.data) return null;
  const ticker = response.data;

  const priceUsd = parseFloat(String(ticker.last ?? "0"));
  const volume24hUsd = parseFloat(String(ticker.volValue ?? "0"));
  const priceChange24h = parseFloat(String(ticker.changeRate ?? "0")) * 100;
  const bid = ticker.buy ? parseFloat(String(ticker.buy)) : null;
  const ask = ticker.sell ? parseFloat(String(ticker.sell)) : null;
  const spread = bid && ask ? ((ask - bid) / bid) * 100 : null;
  const info = getCexInfo("kucoin");

  return {
    exchange: info.name,
    exchangeId: "kucoin",
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    volume24hUsd: Number.isFinite(volume24hUsd) ? volume24hUsd : null,
    bid, ask, spread,
    priceChange24h: Number.isFinite(priceChange24h) ? priceChange24h : null,
    tier: info.tier,
    score: 0,
    tradeUrl: getTradeUrl("kucoin", symbol)
  };
}

async function fetchGateioPrice(symbol: string): Promise<CexPrice | null> {
  const pair = `${symbol.toUpperCase()}_USDT`;
  const data = await safeFetchJson(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${pair}`);
  
  if (!Array.isArray(data) || !data[0]) return null;
  const ticker = data[0] as Record<string, unknown>;

  const priceUsd = parseFloat(String(ticker.last ?? "0"));
  const volume24hUsd = parseFloat(String(ticker.quote_volume ?? "0"));
  const priceChange24h = parseFloat(String(ticker.change_percentage ?? "0"));
  const bid = ticker.highest_bid ? parseFloat(String(ticker.highest_bid)) : null;
  const ask = ticker.lowest_ask ? parseFloat(String(ticker.lowest_ask)) : null;
  const spread = bid && ask ? ((ask - bid) / bid) * 100 : null;
  const info = getCexInfo("gateio");

  return {
    exchange: info.name,
    exchangeId: "gateio",
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    volume24hUsd: Number.isFinite(volume24hUsd) ? volume24hUsd : null,
    bid, ask, spread,
    priceChange24h: Number.isFinite(priceChange24h) ? priceChange24h : null,
    tier: info.tier,
    score: 0,
    tradeUrl: getTradeUrl("gateio", symbol)
  };
}

async function fetchHtxPrice(symbol: string): Promise<CexPrice | null> {
  const pair = `${symbol.toLowerCase()}usdt`;
  const data = await safeFetchJson(`https://api.huobi.pro/market/detail/merged?symbol=${pair}`);
  
  if (!data || typeof data !== "object") return null;
  const response = data as { tick?: Record<string, unknown>; status?: string };
  if (response.status !== "ok" || !response.tick) return null;
  const ticker = response.tick;

  const priceUsd = parseFloat(String(ticker.close ?? "0"));
  const volume24hUsd = parseFloat(String(ticker.vol ?? "0")) * priceUsd;
  const open = parseFloat(String(ticker.open ?? "0"));
  const priceChange24h = open ? ((priceUsd - open) / open) * 100 : null;
  const bid = Array.isArray(ticker.bid) ? Number(ticker.bid[0]) : null;
  const ask = Array.isArray(ticker.ask) ? Number(ticker.ask[0]) : null;
  const spread = bid && ask ? ((ask - bid) / bid) * 100 : null;
  const info = getCexInfo("htx");

  return {
    exchange: info.name,
    exchangeId: "htx",
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    volume24hUsd: Number.isFinite(volume24hUsd) ? volume24hUsd : null,
    bid, ask, spread, priceChange24h,
    tier: info.tier,
    score: 0,
    tradeUrl: getTradeUrl("htx", symbol)
  };
}

// ===== TIER 3 EXCHANGES =====

async function fetchMexcPrice(symbol: string): Promise<CexPrice | null> {
  const pair = `${symbol.toUpperCase()}USDT`;
  const data = await safeFetchJson(`https://api.mexc.com/api/v3/ticker/24hr?symbol=${pair}`);
  
  if (!data || typeof data !== "object") return null;
  const ticker = data as Record<string, unknown>;
  if (!ticker.lastPrice) return null;

  const priceUsd = parseFloat(String(ticker.lastPrice));
  const volume24hUsd = parseFloat(String(ticker.quoteVolume ?? "0"));
  const priceChange24h = parseFloat(String(ticker.priceChangePercent ?? "0"));
  const bid = ticker.bidPrice ? parseFloat(String(ticker.bidPrice)) : null;
  const ask = ticker.askPrice ? parseFloat(String(ticker.askPrice)) : null;
  const spread = bid && ask ? ((ask - bid) / bid) * 100 : null;
  const info = getCexInfo("mexc");

  return {
    exchange: info.name,
    exchangeId: "mexc",
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    volume24hUsd: Number.isFinite(volume24hUsd) ? volume24hUsd : null,
    bid, ask, spread,
    priceChange24h: Number.isFinite(priceChange24h) ? priceChange24h : null,
    tier: info.tier,
    score: 0,
    tradeUrl: getTradeUrl("mexc", symbol)
  };
}

async function fetchBitgetPrice(symbol: string): Promise<CexPrice | null> {
  const pair = `${symbol.toUpperCase()}USDT`;
  const data = await safeFetchJson(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${pair}`);
  
  if (!data || typeof data !== "object") return null;
  const response = data as { data?: unknown[] };
  if (!response.data?.[0]) return null;
  const ticker = response.data[0] as Record<string, unknown>;

  const priceUsd = parseFloat(String(ticker.lastPr ?? "0"));
  const volume24hUsd = parseFloat(String(ticker.quoteVolume ?? "0"));
  const open = parseFloat(String(ticker.open ?? "0"));
  const priceChange24h = open ? ((priceUsd - open) / open) * 100 : null;
  const bid = ticker.bidPr ? parseFloat(String(ticker.bidPr)) : null;
  const ask = ticker.askPr ? parseFloat(String(ticker.askPr)) : null;
  const spread = bid && ask ? ((ask - bid) / bid) * 100 : null;
  const info = getCexInfo("bitget");

  return {
    exchange: info.name,
    exchangeId: "bitget",
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    volume24hUsd: Number.isFinite(volume24hUsd) ? volume24hUsd : null,
    bid, ask, spread, priceChange24h,
    tier: info.tier,
    score: 0,
    tradeUrl: getTradeUrl("bitget", symbol)
  };
}

async function fetchBingXPrice(symbol: string): Promise<CexPrice | null> {
  const pair = `${symbol.toUpperCase()}-USDT`;
  const data = await safeFetchJson(`https://open-api.bingx.com/openApi/spot/v1/ticker/24hr?symbol=${pair}`);
  
  if (!data || typeof data !== "object") return null;
  const response = data as { data?: Record<string, unknown> };
  if (!response.data) return null;
  const ticker = response.data;

  const priceUsd = parseFloat(String(ticker.lastPrice ?? "0"));
  const volume24hUsd = parseFloat(String(ticker.quoteVolume ?? "0"));
  const priceChange24h = parseFloat(String(ticker.priceChangePercent ?? "0"));
  const bid = ticker.bidPrice ? parseFloat(String(ticker.bidPrice)) : null;
  const ask = ticker.askPrice ? parseFloat(String(ticker.askPrice)) : null;
  const spread = bid && ask ? ((ask - bid) / bid) * 100 : null;
  const info = getCexInfo("bingx");

  return {
    exchange: info.name,
    exchangeId: "bingx",
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    volume24hUsd: Number.isFinite(volume24hUsd) ? volume24hUsd : null,
    bid, ask, spread,
    priceChange24h: Number.isFinite(priceChange24h) ? priceChange24h : null,
    tier: info.tier,
    score: 0,
    tradeUrl: getTradeUrl("bingx", symbol)
  };
}

// ===== MAIN FUNCTION =====

export async function fetchCexPrices(symbol: string): Promise<CexPrice[]> {
  const results = await Promise.allSettled([
    // Tier 1
    fetchBinancePrice(symbol),
    fetchOKXPrice(symbol),
    fetchBybitPrice(symbol),
    fetchKrakenPrice(symbol),
    // Tier 2
    fetchKucoinPrice(symbol),
    fetchGateioPrice(symbol),
    fetchHtxPrice(symbol),
    // Tier 3
    fetchMexcPrice(symbol),
    fetchBitgetPrice(symbol),
    fetchBingXPrice(symbol),
  ]);

  const prices = results
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter((price): price is CexPrice => price !== null && price.priceUsd !== null && price.priceUsd > 0);

  // Calculate scores
  prices.forEach(p => {
    p.score = calculateCexScore({ volume24hUsd: p.volume24hUsd, tier: p.tier, spread: p.spread });
  });

  // Sort by tier first, then by score
  return prices.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return b.score - a.score;
  });
}

export function groupCexByTier(prices: CexPrice[]): { tier1: CexPrice[]; tier2: CexPrice[]; tier3: CexPrice[] } {
  return {
    tier1: prices.filter(p => p.tier === 1),
    tier2: prices.filter(p => p.tier === 2),
    tier3: prices.filter(p => p.tier === 3),
  };
}
