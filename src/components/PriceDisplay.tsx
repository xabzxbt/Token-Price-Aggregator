"use client";

import useSWR from "swr";
import type { AggregatedPrice, DexPoolPrice, CexPrice, TokenSecurity, ExchangeTier } from "@/types";
import type { SelectedToken } from "@/app/page";

const fetcher = async (url: string): Promise<AggregatedPrice> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load");
  return data;
};

interface PriceDisplayProps {
  token: SelectedToken | null;
}

// Helper functions
function formatPrice(num: number | null): string {
  if (num === null) return "—";
  if (num < 0.000001) return `$${num.toFixed(10)}`;
  if (num < 0.0001) return `$${num.toFixed(8)}`;
  if (num < 0.01) return `$${num.toFixed(6)}`;
  if (num < 1) return `$${num.toFixed(4)}`;
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatVolume(num: number | null): string {
  if (num === null) return "—";
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

function PriceChange({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400">—</span>;
  const isPositive = value >= 0;
  return (
    <span className={isPositive ? "price-positive" : "price-negative"}>
      {isPositive ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function TierBadge({ tier }: { tier: ExchangeTier }) {
  return (
    <span className={`tier-badge tier-${tier}`}>
      {tier}
    </span>
  );
}

// Security Section
function SecuritySection({ security }: { security: TokenSecurity | null }) {
  if (!security) return null;

  const levelClass = {
    low: "risk-low",
    medium: "risk-medium", 
    high: "risk-high",
    critical: "risk-critical"
  }[security.riskLevel];

  return (
    <div className={`card p-6 border-2 ${levelClass}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title mb-0">SECURITY ANALYSIS</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold uppercase">
            {security.riskLevel} RISK
          </span>
          <span className="tag tag-outline">{security.riskScore}/100</span>
        </div>
      </div>

      {security.warnings.length > 0 && (
        <div className="space-y-1 mb-4">
          {security.warnings.slice(0, 5).map((w, i) => (
            <p key={i} className="text-sm">{w}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {security.buyTax !== null && (
          <div className="p-3 bg-white/50">
            <div className="text-gray-500 text-xs uppercase">Buy Tax</div>
            <div className="font-bold">{security.buyTax.toFixed(1)}%</div>
          </div>
        )}
        {security.sellTax !== null && (
          <div className="p-3 bg-white/50">
            <div className="text-gray-500 text-xs uppercase">Sell Tax</div>
            <div className="font-bold">{security.sellTax.toFixed(1)}%</div>
          </div>
        )}
        {security.holderCount !== null && (
          <div className="p-3 bg-white/50">
            <div className="text-gray-500 text-xs uppercase">Holders</div>
            <div className="font-bold">{security.holderCount.toLocaleString()}</div>
          </div>
        )}
        {security.isOpenSource !== null && (
          <div className="p-3 bg-white/50">
            <div className="text-gray-500 text-xs uppercase">Verified</div>
            <div className="font-bold">{security.isOpenSource ? "YES" : "NO"}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// CEX Card
function CexCard({ cex, isBestBuy, isBestSell }: { cex: CexPrice; isBestBuy: boolean; isBestSell: boolean }) {
  const cardClass = isBestBuy ? "exchange-card best-buy" : isBestSell ? "exchange-card best-sell" : "exchange-card";
  
  return (
    <a href={cex.tradeUrl || "#"} target="_blank" rel="noopener noreferrer" className={cardClass}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`icon-box${cex.tier === 1 ? "" : "-outline"} text-sm`}>
            {cex.exchange.charAt(0)}
          </div>
          <div>
            <div className="font-bold">{cex.exchange}</div>
            <div className="text-xs text-gray-500 uppercase">CEX</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TierBadge tier={cex.tier} />
          {isBestBuy && <span className="tag tag-black">BEST BUY</span>}
          {isBestSell && <span className="tag tag-success">BEST SELL</span>}
        </div>
      </div>

      <div className="flex items-baseline justify-between mb-3">
        <span className="text-2xl font-bold">{formatPrice(cex.priceUsd)}</span>
        <PriceChange value={cex.priceChange24h} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-gray-500 uppercase">Volume 24h</div>
          <div className="font-medium">{formatVolume(cex.volume24hUsd)}</div>
        </div>
        <div>
          <div className="text-gray-500 uppercase">Spread</div>
          <div className="font-medium">{cex.spread !== null ? `${cex.spread.toFixed(3)}%` : "—"}</div>
        </div>
        <div>
          <div className="text-gray-500 uppercase">Bid/Ask</div>
          <div className="font-medium font-mono text-[10px]">
            {cex.bid && cex.ask ? `${cex.bid.toFixed(4)}/${cex.ask.toFixed(4)}` : "—"}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-500 uppercase tracking-wider">OPEN TRADE →</span>
      </div>
    </a>
  );
}

// DEX Card
function DexCard({ pool, isBestBuy, isBestSell }: { pool: DexPoolPrice; isBestBuy: boolean; isBestSell: boolean }) {
  const cardClass = isBestBuy ? "exchange-card best-buy" : isBestSell ? "exchange-card best-sell" : "exchange-card";
  const isNew = pool.poolAgeHours !== null && pool.poolAgeHours < 24;
  const lowLiq = pool.liquidityUsd !== null && pool.liquidityUsd < 10000;

  return (
    <a href={pool.pairUrl || "#"} target="_blank" rel="noopener noreferrer" className={cardClass}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`icon-box${pool.tier === 1 ? "" : "-outline"} text-sm`}>
            {pool.dexName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold capitalize">{pool.dexName}</div>
            <div className="text-xs text-gray-500 uppercase">{pool.chain} · {pool.baseToken.symbol}/{pool.quoteToken.symbol}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TierBadge tier={pool.tier} />
          {isNew && <span className="tag tag-warning">NEW</span>}
          {isBestBuy && <span className="tag tag-black">BEST BUY</span>}
          {isBestSell && <span className="tag tag-success">BEST SELL</span>}
        </div>
      </div>

      <div className="flex items-baseline justify-between mb-3">
        <span className="text-2xl font-bold">{formatPrice(pool.priceUsd)}</span>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">1h:</span> <PriceChange value={pool.priceChange.h1} />
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">24h:</span> <PriceChange value={pool.priceChange.h24} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <div className="text-gray-500 uppercase">Liquidity</div>
          <div className={`font-medium ${lowLiq ? "text-amber-600" : ""}`}>{formatVolume(pool.liquidityUsd)}</div>
        </div>
        <div>
          <div className="text-gray-500 uppercase">Volume 24h</div>
          <div className="font-medium">{formatVolume(pool.volume24h)}</div>
        </div>
        <div>
          <div className="text-gray-500 uppercase">Txns 24h</div>
          <div className="font-medium">{pool.txns24h.total}</div>
        </div>
        <div>
          <div className="text-gray-500 uppercase">Age</div>
          <div className={`font-medium ${isNew ? "text-amber-600" : ""}`}>
            {pool.poolAgeHours !== null 
              ? pool.poolAgeHours < 1 ? `${Math.round(pool.poolAgeHours * 60)}m`
              : pool.poolAgeHours < 24 ? `${Math.round(pool.poolAgeHours)}h`
              : pool.poolAgeHours < 720 ? `${Math.round(pool.poolAgeHours / 24)}d`
              : `${Math.round(pool.poolAgeHours / 720)}mo`
              : "—"}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-500 uppercase tracking-wider">OPEN SWAP →</span>
      </div>
    </a>
  );
}

// Tier Section
function TierSection({ title, items, type, minPrice, maxPrice }: {
  title: string;
  items: (CexPrice | DexPoolPrice)[];
  type: "cex" | "dex";
  minPrice: number | null;
  maxPrice: number | null;
}) {
  if (items.length === 0) return null;

  const isNear = (p: number | null, target: number | null) => 
    p !== null && target !== null && Math.abs(p - target) < (target * 0.001);

  return (
    <div className="mb-8">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
        {title}
        <span className="tag tag-gray">{items.length}</span>
      </h4>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const price = item.priceUsd;
          const isBestBuy = isNear(price, minPrice);
          const isBestSell = isNear(price, maxPrice);
          
          if (type === "cex") {
            return <CexCard key={`cex-${i}`} cex={item as CexPrice} isBestBuy={isBestBuy} isBestSell={isBestSell} />;
          }
          return <DexCard key={`dex-${i}`} pool={item as DexPoolPrice} isBestBuy={isBestBuy} isBestSell={isBestSell} />;
        })}
      </div>
    </div>
  );
}

// Main Component
export default function PriceDisplay({ token }: PriceDisplayProps) {
  const key = token 
    ? `/api/price?address=${encodeURIComponent(token.address)}&chain=${encodeURIComponent(token.chain)}` 
    : null;

  const { data, error, isLoading } = useSWR<AggregatedPrice>(key, fetcher, {
    refreshInterval: 10_000,
    revalidateOnFocus: false
  });

  if (!token) {
    return (
      <div className="card p-16 text-center">
        <div className="icon-box-outline mx-auto mb-4 text-gray-400">?</div>
        <p className="text-gray-500 uppercase tracking-wider text-sm">
          Enter token address to view prices
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 border-2 border-red-500">
        <h2 className="font-bold mb-2">ERROR</h2>
        <p className="text-gray-600">{String(error.message)}</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="card p-16 flex items-center justify-center gap-3">
        <span className="spinner"></span>
        <span className="text-gray-500 uppercase tracking-wider text-sm">Loading prices...</span>
      </div>
    );
  }

  const { token: tokenInfo, dexPools, cexPrices, security, bestBuy, bestSell, priceSpreadPercent, coingeckoPriceUsd } = data;

  // Get all prices for min/max
  const allPrices = [
    ...dexPools.filter(p => p.priceUsd !== null).map(p => p.priceUsd!),
    ...cexPrices.filter(c => c.priceUsd !== null).map(c => c.priceUsd!)
  ];
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : null;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : null;

  // Group by tier
  const cexTier1 = cexPrices.filter(c => c.tier === 1);
  const cexTier2 = cexPrices.filter(c => c.tier === 2);
  const cexTier3 = cexPrices.filter(c => c.tier === 3);
  
  const dexTier1 = dexPools.filter(d => d.tier === 1);
  const dexTier2 = dexPools.filter(d => d.tier === 2);
  const dexTier3 = dexPools.filter(d => d.tier === 3);

  return (
    <div className="space-y-6 animate-in">
      {/* Token Header */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {tokenInfo.imageUrl ? (
              <img src={tokenInfo.imageUrl} alt="" className="w-14 h-14 rounded-full border border-gray-200" />
            ) : (
              <div className="icon-box text-xl">{tokenInfo.symbol?.charAt(0) || "?"}</div>
            )}
            <div>
              <h2 className="text-2xl font-bold">{tokenInfo.symbol || tokenInfo.name}</h2>
              <p className="text-sm text-gray-500">
                {tokenInfo.chain.toUpperCase()} · 
                <code className="ml-1 text-xs bg-gray-100 px-2 py-0.5">
                  {tokenInfo.address.slice(0, 8)}...{tokenInfo.address.slice(-6)}
                </code>
              </p>
            </div>
          </div>
          <div className="text-right">
            {coingeckoPriceUsd && (
              <div className="text-3xl font-bold">{formatPrice(coingeckoPriceUsd)}</div>
            )}
            <div className="text-xs text-gray-400 uppercase tracking-wider">
              Updated {new Date(data.updatedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Best Buy/Sell */}
      {(bestBuy || bestSell) && (
        <div className="grid md:grid-cols-3 gap-4">
          {bestBuy && (
            <a href={bestBuy.url || "#"} target="_blank" rel="noopener noreferrer"
              className="card p-5 border-2 border-blue-500 bg-blue-50 hover:shadow-[4px_4px_0_0_#3b82f6] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Best Buy</div>
              <div className="text-2xl font-bold mb-1">{formatPrice(bestBuy.price)}</div>
              <div className="text-sm text-gray-600">{bestBuy.source}</div>
              <div className="mt-3 pt-2 border-t border-blue-200 text-xs text-blue-600 uppercase">Open →</div>
            </a>
          )}
          
          {priceSpreadPercent !== null && (
            <div className="card p-5 flex flex-col items-center justify-center bg-gray-50">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Spread</div>
              <div className={`text-3xl font-bold ${priceSpreadPercent > 2 ? "text-amber-500" : ""}`}>
                {priceSpreadPercent.toFixed(2)}%
              </div>
            </div>
          )}

          {bestSell && (
            <a href={bestSell.url || "#"} target="_blank" rel="noopener noreferrer"
              className="card p-5 border-2 border-green-500 bg-green-50 hover:shadow-[4px_4px_0_0_#22c55e] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5">
              <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Best Sell</div>
              <div className="text-2xl font-bold mb-1">{formatPrice(bestSell.price)}</div>
              <div className="text-sm text-gray-600">{bestSell.source}</div>
              <div className="mt-3 pt-2 border-t border-green-200 text-xs text-green-600 uppercase">Open →</div>
            </a>
          )}
        </div>
      )}

      {/* Security */}
      <SecuritySection security={security} />

      {/* CEX Section */}
      {cexPrices.length > 0 && (
        <div>
          <h3 className="section-title">CENTRALIZED EXCHANGES ({cexPrices.length})</h3>
          <TierSection title="Tier 1 — Top Exchanges" items={cexTier1} type="cex" minPrice={minPrice} maxPrice={maxPrice} />
          <TierSection title="Tier 2 — Major Exchanges" items={cexTier2} type="cex" minPrice={minPrice} maxPrice={maxPrice} />
          <TierSection title="Tier 3 — Other Exchanges" items={cexTier3} type="cex" minPrice={minPrice} maxPrice={maxPrice} />
        </div>
      )}

      {/* DEX Section */}
      {dexPools.length > 0 && (
        <div>
          <h3 className="section-title">DECENTRALIZED EXCHANGES ({dexPools.length})</h3>
          <TierSection title="Tier 1 — Top DEXes" items={dexTier1} type="dex" minPrice={minPrice} maxPrice={maxPrice} />
          <TierSection title="Tier 2 — Major DEXes" items={dexTier2} type="dex" minPrice={minPrice} maxPrice={maxPrice} />
          <TierSection title="Tier 3 — Other DEXes" items={dexTier3} type="dex" minPrice={minPrice} maxPrice={maxPrice} />
        </div>
      )}

      {/* Empty state */}
      {cexPrices.length === 0 && dexPools.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-gray-500 uppercase tracking-wider">No price data found for this token</p>
        </div>
      )}
    </div>
  );
}
