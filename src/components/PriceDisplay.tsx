"use client";

import { useState } from "react";
import useSWR from "swr";
import type { AggregatedPrice, DexPoolPrice, CexPrice, TokenSecurity, ExchangeTier, Chain } from "@/types";
import type { SelectedToken } from "@/app/page";
import PriceChart from "./PriceChart";
import PriceImpactCalculator from "./PriceImpactCalculator";

const fetcher = async (url: string): Promise<AggregatedPrice> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load");
  return data;
};

interface PriceDisplayProps {
  token: SelectedToken | null;
  onAddToWatchlist?: (item: { address: string; chain: Chain; symbol: string; name: string }) => void;
  isInWatchlist?: boolean;
}

// Helper functions
function formatPrice(num: number | null): string {
  if (num === null) return "—";
  if (num < 0.00001) return `$${num.toExponential(2)}`;
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

function formatDexName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/v2/gi, "V2")
    .replace(/v3/gi, "V3")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function PriceChange({ value }: { value: number | null }) {
  if (value === null) return <span className="text-black/40">—</span>;
  const isPositive = value >= 0;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-black border border-black shadow-[1.5px_1.5px_0_0_#000] ${isPositive ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
      {isPositive ? "+" : "-"}{Math.abs(value).toFixed(2)}%
    </span>
  );
}

function TierBadge({ tier }: { tier: ExchangeTier }) {
  return <span className={`inline-flex items-center justify-center w-5 h-5 text-[9px] font-black border border-black shadow-[1.5px_1.5px_0_0_#000] ${tier === 1 ? 'bg-black text-white' : 'bg-white text-black'}`}>{tier}</span>;
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
    <div className={`card p-6 border-2 ${levelClass} bg-white shadow-[8px_8px_0_0_#000]`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-black">SECURITY ANALYSIS</h3>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black/60">{security.riskLevel} RISK</span>
          <span className="bg-black text-white text-[11px] font-black px-3 py-1 border border-black shadow-[2px_2px_0_0_#ff4d00]">{security.riskScore}/100</span>
        </div>
      </div>

      {security.warnings.length > 0 && (
        <div className="space-y-2 mb-6 border-l-2 border-black pl-4">
          {security.warnings.slice(0, 5).map((w, i) => (
            <div key={i} className="flex items-center gap-4 group">
              <div className="w-1.5 h-1.5 bg-[#ff4d00] rotate-45"></div>
              <p className="text-[12px] font-black uppercase tracking-widest text-black group-hover:text-[#ff4d00] transition-colors italic">
                {w}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t-2 border-black">
        {security.buyTax !== null && (
          <div className="p-4 border-r-2 border-black">
            <div className="text-black/60 text-[9px] font-black uppercase tracking-widest mb-1">Buy Tax</div>
            <div className="text-xl font-black">{security.buyTax.toFixed(1)}%</div>
          </div>
        )}
        {security.sellTax !== null && (
          <div className="p-4 border-r-2 border-black">
            <div className="text-black/60 text-[9px] font-black uppercase tracking-widest mb-1">Sell Tax</div>
            <div className="text-xl font-black">{security.sellTax.toFixed(1)}%</div>
          </div>
        )}
        {security.holderCount !== null && (
          <div className="p-4 border-r-2 border-black">
            <div className="text-black/60 text-[9px] font-black uppercase tracking-widest mb-1">Holders</div>
            <div className="text-xl font-black">{security.holderCount.toLocaleString()}</div>
          </div>
        )}
        {security.isOpenSource !== null && (
          <div className="p-4">
            <div className="text-black/60 text-[9px] font-black uppercase tracking-widest mb-1">Verified</div>
            <div className="text-xl font-black">{security.isOpenSource ? "YES" : "NO"}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// CEX Card
function CexCard({ cex, isBestBuy, isBestSell }: { cex: CexPrice; isBestBuy: boolean; isBestSell: boolean }) {
  const cardClass = `exchange-card bg-white border-2 border-black p-5 transition-all hover:shadow-[6px_6px_0_0_#ff4d00] ${isBestBuy ? "shadow-[4px_4px_0_0_#3b82f6]" : isBestSell ? "shadow-[4px_4px_0_0_#22c55e]" : "shadow-[4px_4px_0_0_#000]"}`;
  
  return (
    <a href={cex.tradeUrl || "#"} target="_blank" rel="noopener noreferrer" className={cardClass}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-black text-white font-black border-2 border-black">
            {cex.exchange.charAt(0)}
          </div>
          <div>
            <div className="font-black text-sm uppercase tracking-tight leading-none mb-1">{cex.exchange}</div>
            <div className="text-[9px] text-black/60 font-black uppercase tracking-widest">CEX EXCHANGE</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TierBadge tier={cex.tier} />
          {isBestBuy && <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 border border-black uppercase">BEST BUY</span>}
          {isBestSell && <span className="bg-green-600 text-white text-[8px] font-black px-1.5 py-0.5 border border-black uppercase">BEST SELL</span>}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl font-black italic tracking-tighter">{formatPrice(cex.priceUsd)}</span>
        <PriceChange value={cex.priceChange24h} />
      </div>

      <div className="grid grid-cols-3 gap-1 border-t-2 border-black pt-4">
        <div>
          <div className="text-black/60 text-[8px] font-black uppercase tracking-widest mb-1">Volume 24h</div>
          <div className="font-black text-[10px]">{formatVolume(cex.volume24hUsd)}</div>
        </div>
        <div>
          <div className="text-black/60 text-[8px] font-black uppercase tracking-widest mb-1">Spread</div>
          <div className="font-black text-[10px]">{cex.spread !== null ? `${cex.spread.toFixed(3)}%` : "—"}</div>
        </div>
        <div>
          <div className="text-black/60 text-[8px] font-black uppercase tracking-widest mb-1">Bid/Ask</div>
          <div className="font-black text-[9px] font-mono">
            {cex.bid && cex.ask ? `${cex.bid.toFixed(4)}/${cex.ask.toFixed(4)}` : "—"}
          </div>
        </div>
      </div>
    </a>
  );
}

// DEX Card
function DexCard({ pool, isBestBuy, isBestSell }: { pool: DexPoolPrice; isBestBuy: boolean; isBestSell: boolean }) {
  const cardClass = `exchange-card bg-white border-2 border-black p-5 transition-all hover:shadow-[6px_6px_0_0_#ff4d00] ${isBestBuy ? "shadow-[4px_4px_0_0_#3b82f6]" : isBestSell ? "shadow-[4px_4px_0_0_#22c55e]" : "shadow-[4px_4px_0_0_#000]"}`;
  const isNew = pool.poolAgeHours !== null && pool.poolAgeHours < 24;
  const lowLiq = pool.liquidityUsd !== null && pool.liquidityUsd < 10000;

  return (
    <a href={pool.pairUrl || "#"} target="_blank" rel="noopener noreferrer" className={cardClass}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-black text-white font-black border-2 border-black">
            {pool.dexName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-black text-sm uppercase tracking-tight leading-none mb-1">{formatDexName(pool.dexName)}</div>
            <div className="text-[9px] text-black/60 font-black uppercase tracking-widest">
              {pool.chain} · {pool.baseToken.symbol}/{pool.quoteToken.symbol}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <TierBadge tier={pool.tier} />
          {isNew && <span className="bg-black text-white text-[8px] font-black px-1.5 py-0.5 border border-black shadow-[1.5px_1.5px_0_0_#ff4d00]">NEW</span>}
          {lowLiq && <span className="bg-[#ff4d00] text-white text-[8px] font-black px-1.5 py-0.5 border border-black shadow-[1.5px_1.5px_0_0_#000]">LOW LIQ</span>}
          {isBestBuy && <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 border border-black uppercase">BEST BUY</span>}
          {isBestSell && <span className="bg-green-600 text-white text-[8px] font-black px-1.5 py-0.5 border border-black uppercase">BEST SELL</span>}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl font-black italic tracking-tighter">{formatPrice(pool.priceUsd)}</span>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-black uppercase opacity-40">1h</span>
            <PriceChange value={pool.priceChange.h1} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 border-t-2 border-black pt-4">
        <div>
          <div className="text-black/60 text-[8px] font-black uppercase tracking-widest mb-1">Liquidity</div>
          <div className={`font-black text-[10px] ${lowLiq ? "text-amber-600" : ""}`}>{formatVolume(pool.liquidityUsd)}</div>
        </div>
        <div>
          <div className="text-black/60 text-[8px] font-black uppercase tracking-widest mb-1">Volume 24h</div>
          <div className="font-black text-[10px]">{formatVolume(pool.volume24h)}</div>
        </div>
        <div>
          <div className="text-black/60 text-[8px] font-black uppercase tracking-widest mb-1">Txns 24h</div>
          <div className="font-black text-[10px]">{pool.txns24h.total || "—"}</div>
        </div>
        <div>
          <div className="text-black/60 text-[8px] font-black uppercase tracking-widest mb-1">Pool Age</div>
          <div className={`font-black text-[10px] ${isNew ? "text-amber-600" : ""}`}>
            {pool.poolAgeHours !== null 
              ? pool.poolAgeHours < 1 ? `${Math.round(pool.poolAgeHours * 60)}m`
              : pool.poolAgeHours < 24 ? `${Math.round(pool.poolAgeHours)}h`
              : pool.poolAgeHours < 720 ? `${Math.round(pool.poolAgeHours / 24)}d`
              : `${Math.round(pool.poolAgeHours / 720)}mo`
              : "—"}
          </div>
        </div>
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
    <div className="mb-12">
      <div className="flex items-center gap-4 mb-6">
        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-black">
          {title}
        </h4>
        <div className="flex-1 h-0.5 bg-black opacity-10"></div>
        <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 shadow-[2px_2px_0_0_#ff4d00]">{items.length}</span>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

// Active Tab type
type ActiveTab = "overview" | "chart" | "calculator";

// Main Component
export default function PriceDisplay({ token, onAddToWatchlist, isInWatchlist }: PriceDisplayProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  
  const key = token 
    ? `/api/price?address=${encodeURIComponent(token.address)}&chain=${encodeURIComponent(token.chain)}` 
    : null;

  const { data, error, isLoading } = useSWR<AggregatedPrice>(key, fetcher, {
    refreshInterval: 10_000,
    revalidateOnFocus: false
  });

  if (!token) {
    return (
      <div className="card p-24 flex items-center justify-center text-center">
        <p className="text-black/60 uppercase tracking-[0.2em] font-black text-sm">
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
        <span className="text-black/60 uppercase tracking-wider text-sm">Loading prices...</span>
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

  // Get best DEX pool for chart
  const bestDexPool = dexPools[0];

  return (
    <div className="space-y-6 animate-in">
      {/* Token Header */}
      <div className="card p-8 bg-white border-2 border-black">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {tokenInfo.imageUrl ? (
              <img src={tokenInfo.imageUrl} alt="" className="w-16 h-16 rounded-full border-2 border-black shadow-[3px_3px_0_0_#ff4d00]" />
            ) : (
              <div className="w-16 h-16 bg-black text-white flex items-center justify-center text-3xl font-black border-2 border-black shadow-[3px_3px_0_0_#ff4d00]">
                {tokenInfo.symbol?.charAt(0) || "?"}
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-4xl font-black tracking-tighter italic uppercase">{tokenInfo.symbol || tokenInfo.name}</h2>
                {onAddToWatchlist && (
                  <button
                    onClick={() => onAddToWatchlist({
                      address: tokenInfo.address,
                      chain: tokenInfo.chain,
                      symbol: tokenInfo.symbol || "",
                      name: tokenInfo.name || ""
                    })}
                    className={`p-2 border-2 border-black transition-all ${
                      isInWatchlist 
                        ? "bg-yellow-400 text-black shadow-[2px_2px_0_0_#ff4d00]" 
                        : "bg-white text-black/30 hover:text-[#ff4d00] hover:border-[#ff4d00]"
                    }`}
                    title={isInWatchlist ? "In watchlist" : "Add to watchlist"}
                  >
                    <svg className="w-5 h-5" fill={isInWatchlist ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-[10px] font-black text-black/60 uppercase tracking-[0.2em] mt-1">
                {tokenInfo.chain.toUpperCase()} NETWORK · 
                <code className="ml-2 text-[10px] bg-gray-100 text-black px-2 py-0.5 border border-black/10">
                  {tokenInfo.address}
                </code>
              </p>
            </div>
          </div>
          <div className="md:text-right">
            {coingeckoPriceUsd && (
              <div className="text-5xl font-black tracking-tighter mb-1">{formatPrice(coingeckoPriceUsd)}</div>
            )}
            <div className="text-[10px] font-black text-[#ff4d00] uppercase tracking-widest">
              LIVE DATA · UPDATED {new Date(data.updatedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 pt-6 border-t-2 border-black flex flex-wrap gap-3">
          {[
            { id: "overview" as const, label: "Market Overview" },
            { id: "chart" as const, label: "Live Chart" },
            { id: "calculator" as const, label: "Price Impact" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-8 py-3 text-[12px] font-black uppercase tracking-[0.25em] transition-all border-2 border-black italic ${
                activeTab === tab.id
                  ? "bg-black text-white shadow-[6px_6px_0_0_#ff4d00]"
                  : "bg-white text-black hover:bg-gray-50 hover:shadow-[4px_4px_0_0_#ff4d00]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <>
          {/* Best Buy/Sell */}
          {(bestBuy || bestSell) && (
            <div className="grid md:grid-cols-3 gap-4">
              {bestBuy && (
                <a href={bestBuy.url || "#"} target="_blank" rel="noopener noreferrer"
                  className="card p-5 border-2 border-black bg-white shadow-[6px_6px_0_0_#000] hover:shadow-[6px_6px_0_0_#ff4d00] transition-all">
                  <div className="text-[10px] font-black text-black/60 uppercase tracking-[0.2em] mb-2">Best Buy</div>
                  <div className="text-3xl font-black mb-1 leading-none">{formatPrice(bestBuy.price)}</div>
                  <div className="text-xs text-black/60 font-bold uppercase tracking-wider">{bestBuy.source}</div>
                  <div className="mt-4 pt-3 border-t-2 border-black/5 text-[10px] font-black text-black/40 uppercase tracking-widest">Open →</div>
                </a>
              )}
              
              {priceSpreadPercent !== null && (
                <div className="card p-5 flex flex-col items-center justify-center bg-white border-2 border-black shadow-[6px_6px_0_0_#000] hover:shadow-[6px_6px_0_0_#ff4d00] transition-all">
                  <div className="text-[10px] font-black text-black/60 uppercase tracking-[0.2em] mb-2">Spread</div>
                  <div className={`text-4xl font-black ${priceSpreadPercent > 5 ? "text-[#ff4d00]" : "text-black"}`}>
                    {priceSpreadPercent.toFixed(2)}%
                  </div>
                </div>
              )}

              {bestSell && (
                <a href={bestSell.url || "#"} target="_blank" rel="noopener noreferrer"
                  className="card p-5 border-2 border-black bg-white shadow-[6px_6px_0_0_#000] hover:shadow-[6px_6px_0_0_#ff4d00] transition-all">
                  <div className="text-[10px] font-black text-black/60 uppercase tracking-[0.2em] mb-2">Best Sell</div>
                  <div className="text-3xl font-black mb-1 leading-none">{formatPrice(bestSell.price)}</div>
                  <div className="text-xs text-black/60 font-bold uppercase tracking-wider">{bestSell.source}</div>
                  <div className="mt-4 pt-3 border-t-2 border-black/5 text-[10px] font-black text-black/40 uppercase tracking-widest">Open →</div>
                </a>
              )}
            </div>
          )}

          {/* Security */}
          <SecuritySection security={security} />

          {/* CEX Section */}
          {cexPrices.length > 0 && (
            <div className="pt-8 border-t-2 border-black mt-12">
              <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-black mb-10 flex items-center gap-4">
                <span className="bg-black text-white px-4 py-2 shadow-[4px_4px_0_0_#ff4d00]">CENTRALIZED EXCHANGES</span>
                <span className="opacity-20 text-2xl font-black italic">/ {cexPrices.length}</span>
              </h3>
              <TierSection title="Tier 1 — Top Exchanges" items={cexTier1} type="cex" minPrice={minPrice} maxPrice={maxPrice} />
              <TierSection title="Tier 2 — Major Exchanges" items={cexTier2} type="cex" minPrice={minPrice} maxPrice={maxPrice} />
              <TierSection title="Tier 3 — Other Exchanges" items={cexTier3} type="cex" minPrice={minPrice} maxPrice={maxPrice} />
            </div>
          )}

          {/* DEX Section */}
          {dexPools.length > 0 && (
            <div className="pt-8 border-t-2 border-black mt-12">
              <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-black mb-10 flex items-center gap-4">
                <span className="bg-black text-white px-4 py-2 shadow-[4px_4px_0_0_#ff4d00]">DECENTRALIZED EXCHANGES</span>
                <span className="opacity-20 text-2xl font-black italic">/ {dexPools.length}</span>
              </h3>
              <TierSection title="Tier 1 — Top DEXes" items={dexTier1} type="dex" minPrice={minPrice} maxPrice={maxPrice} />
              <TierSection title="Tier 2 — Major DEXes" items={dexTier2} type="dex" minPrice={minPrice} maxPrice={maxPrice} />
              <TierSection title="Tier 3 — Other DEXes" items={dexTier3} type="dex" minPrice={minPrice} maxPrice={maxPrice} />
            </div>
          )}
        </>
      )}

      {activeTab === "chart" && bestDexPool && (
        <PriceChart 
          pairAddress={bestDexPool.pairAddress}
          chain={bestDexPool.chain}
          symbol={tokenInfo.symbol || "TOKEN"}
        />
      )}

      {activeTab === "calculator" && (
        <PriceImpactCalculator
          dexPools={dexPools}
          cexPrices={cexPrices}
          tokenSymbol={tokenInfo.symbol || "TOKEN"}
          currentPrice={coingeckoPriceUsd}
        />
      )}

      {/* Empty state */}
      {cexPrices.length === 0 && dexPools.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-black/60 uppercase tracking-wider">No price data found for this token</p>
        </div>
      )}
    </div>
  );
}
