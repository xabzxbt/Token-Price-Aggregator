"use client";

import { useState, useMemo } from "react";
import type { DexPoolPrice, CexPrice } from "@/types";

interface PriceImpactCalculatorProps {
  dexPools: DexPoolPrice[];
  cexPrices: CexPrice[];
  tokenSymbol: string;
  currentPrice: number | null;
}

type TradeDirection = "buy" | "sell";

export default function PriceImpactCalculator({
  dexPools,
  cexPrices,
  tokenSymbol,
  currentPrice
}: PriceImpactCalculatorProps) {
  const [amount, setAmount] = useState<string>("1000");
  const [direction, setDirection] = useState<TradeDirection>("buy");

  const amountNum = parseFloat(amount) || 0;

  // Calculate price impact for each exchange
  const calculations = useMemo(() => {
    if (!currentPrice || amountNum <= 0) return [];

    const results: {
      name: string;
      type: "dex" | "cex";
      tier: 1 | 2 | 3;
      price: number;
      liquidity: number | null;
      tokensReceived: number;
      priceImpact: number;
      effectivePrice: number;
      url: string | null;
    }[] = [];

    // Calculate for DEX pools
    dexPools.forEach((pool) => {
      if (!pool.priceUsd || !pool.liquidityUsd) return;

      // Estimate price impact using constant product formula (x * y = k)
      // This is simplified - real impact depends on pool type
      const liquidity = pool.liquidityUsd;
      const priceImpactPercent = estimatePriceImpact(amountNum, liquidity, direction);
      
      const effectivePrice = direction === "buy"
        ? pool.priceUsd * (1 + priceImpactPercent / 100)
        : pool.priceUsd * (1 - priceImpactPercent / 100);

      const tokensReceived = direction === "buy"
        ? amountNum / effectivePrice
        : amountNum * effectivePrice;

      results.push({
        name: formatDexName(pool.dexName),
        type: "dex",
        tier: pool.tier,
        price: pool.priceUsd,
        liquidity,
        tokensReceived,
        priceImpact: priceImpactPercent,
        effectivePrice,
        url: pool.pairUrl
      });
    });

    // Calculate for CEX (usually no/minimal price impact for reasonable amounts)
    cexPrices.forEach((cex) => {
      if (!cex.priceUsd) return;

      // CEX typically has much deeper liquidity
      // Assume minimal impact for amounts under $100k
      const priceImpactPercent = amountNum > 100000 ? amountNum / 1000000 : 0;
      
      const effectivePrice = direction === "buy"
        ? cex.priceUsd * (1 + priceImpactPercent / 100)
        : cex.priceUsd * (1 - priceImpactPercent / 100);

      const tokensReceived = direction === "buy"
        ? amountNum / effectivePrice
        : amountNum * effectivePrice;

      results.push({
        name: cex.exchange,
        type: "cex",
        tier: cex.tier,
        price: cex.priceUsd,
        liquidity: cex.volume24hUsd,
        tokensReceived,
        priceImpact: priceImpactPercent,
        effectivePrice,
        url: cex.tradeUrl
      });
    });

    // Sort by best deal (most tokens received for buy, most USD for sell)
    return results.sort((a, b) => {
      if (direction === "buy") {
        return b.tokensReceived - a.tokensReceived;
      }
      return b.tokensReceived - a.tokensReceived;
    });
  }, [dexPools, cexPrices, amountNum, direction, currentPrice]);

  const bestResult = calculations[0];
  const worstResult = calculations[calculations.length - 1];

  return (
    <div className="card p-6 bg-white border-2 border-black">
      <div className="flex items-center justify-between mb-6 border-b-2 border-black pb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black">
          PRICE IMPACT CALCULATOR
        </h3>
      </div>

      {/* Input controls */}
      <div className="flex flex-col sm:flex-row gap-6 mb-6">
        <div className="flex-1">
          <label className="text-[10px] font-black text-black/60 uppercase tracking-widest mb-2 block">
            {direction === "buy" ? "Amount (USD)" : `Amount (${tokenSymbol})`}
          </label>
          <div className="relative">
            {direction === "buy" && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-black">$</span>}
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`input font-black text-lg ${direction === "buy" ? "pl-8" : "pl-4"}`}
              placeholder={direction === "buy" ? "1000" : "10000"}
              min="0"
              step={direction === "buy" ? "100" : "1000"}
            />
          </div>
        </div>
        
        <div className="sm:w-48">
          <label className="text-[10px] font-black text-black/60 uppercase tracking-widest mb-2 block">Direction</label>
          <div className="flex border-2 border-black p-1 bg-gray-100">
            <button
              onClick={() => setDirection("buy")}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                direction === "buy"
                  ? "bg-black text-white shadow-[2px_2px_0_0_#ff4d00]"
                  : "text-black/40 hover:text-black"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setDirection("sell")}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                direction === "sell"
                  ? "bg-black text-white shadow-[2px_2px_0_0_#ff4d00]"
                  : "text-black/40 hover:text-black"
              }`}
            >
              Sell
            </button>
          </div>
        </div>
      </div>

      {/* Quick amount buttons */}
      <div className="flex flex-wrap gap-2 mb-8">
        {["100", "1000", "5000", "10000", "50000"].map((val) => (
          <button
            key={val}
            onClick={() => setAmount(val)}
            className={`px-4 py-1.5 text-[10px] font-black border-2 border-black transition-all ${
              amount === val
                ? "bg-black text-white shadow-[2px_2px_0_0_#ff4d00]"
                : "bg-white text-black hover:bg-gray-50"
            }`}
          >
            {direction === "buy" ? `$${Number(val).toLocaleString()}` : `${Number(val).toLocaleString()} ${tokenSymbol}`}
          </button>
        ))}
      </div>

      {/* Results summary */}
      {bestResult && amountNum > 0 && (
        <div className="bg-black text-white p-6 mb-8 border-2 border-black shadow-[4px_4px_0_0_#ff4d00]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-[9px] font-black text-[#ff4d00] uppercase tracking-[0.2em] mb-2">Best Option</div>
              <div className="font-black text-2xl uppercase italic tracking-tighter mb-2">{bestResult.name}</div>
              <div className="text-sm font-medium">
                {direction === "buy" ? "RECEIVE" : "GET"}: <span className="text-[#ff4d00] font-black">
                  {direction === "buy" 
                    ? `${bestResult.tokensReceived.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${tokenSymbol}`
                    : `$${bestResult.tokensReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  }
                </span>
              </div>
            </div>
            <div className="md:text-right md:border-l border-white/20 md:pl-6">
              <div className="text-[9px] font-black text-[#ff4d00] uppercase tracking-[0.2em] mb-2">Efficiency vs Worst</div>
              <div className="font-black text-4xl mb-1">
                {worstResult && bestResult.tokensReceived !== worstResult.tokensReceived
                  ? `+${(((bestResult.tokensReceived - worstResult.tokensReceived) / worstResult.tokensReceived) * 100).toFixed(2)}%`
                  : "0%"
                }
              </div>
              <div className="text-[10px] font-black uppercase opacity-80">
                COMPARED TO {worstResult?.name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed results table */}
      {calculations.length > 0 && amountNum > 0 && (
        <div className="overflow-x-auto border-2 border-black">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black">
                <th className="text-left py-3 px-4 font-black uppercase tracking-widest border-r-2 border-black">Exchange</th>
                <th className="text-right py-3 px-4 font-black uppercase tracking-widest border-r-2 border-black">Price</th>
                <th className="text-right py-3 px-4 font-black uppercase tracking-widest border-r-2 border-black">Impact</th>
                <th className="text-right py-3 px-4 font-black uppercase tracking-widest border-r-2 border-black">Eff. Price</th>
                <th className="text-right py-3 px-4 font-black uppercase tracking-widest">
                  {direction === "buy" ? tokenSymbol : "USD"}
                </th>
              </tr>
            </thead>
            <tbody>
              {calculations.slice(0, 10).map((calc, i) => (
                <tr 
                  key={`${calc.type}-${calc.name}-${i}`}
                  className={`border-b-2 border-black last:border-b-0 hover:bg-gray-50 transition-colors ${i === 0 ? "bg-green-50/50" : ""}`}
                >
                  <td className="py-3 px-4 border-r-2 border-black">
                    <div className="flex items-center gap-3">
                      <span className={`w-5 h-5 flex items-center justify-center text-[9px] font-black border border-black ${calc.tier === 1 ? 'bg-black text-white' : 'bg-white text-black'}`}>{calc.tier}</span>
                      <span className="font-black uppercase tracking-tight">{calc.name}</span>
                      <span className="text-[8px] font-black px-1.5 py-0.5 border border-black opacity-70">{calc.type.toUpperCase()}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-black border-r-2 border-black">
                    ${calc.price < 1 ? calc.price.toFixed(6) : calc.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-3 px-4 text-right font-black border-r-2 border-black ${
                    calc.priceImpact > 5 ? "text-red-500" : 
                    calc.priceImpact > 1 ? "text-[#ff4d00]" : "text-green-600"
                  }`}>
                    {calc.priceImpact.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right font-black border-r-2 border-black opacity-80">
                    ${calc.effectivePrice < 1 ? calc.effectivePrice.toFixed(6) : calc.effectivePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-black">
                    {direction === "buy"
                      ? calc.tokensReceived.toLocaleString(undefined, { maximumFractionDigits: 4 })
                      : `$${calc.tokensReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {calculations.length === 0 && (
        <div className="text-center py-8 text-black/60 text-sm">
          No exchange data available
        </div>
      )}
    </div>
  );
}

// Estimate price impact using simplified AMM formula
function estimatePriceImpact(amountUsd: number, liquidityUsd: number, direction: TradeDirection): number {
  if (liquidityUsd <= 0) return 100;
  
  // Simplified constant product formula impact estimation
  // Real impact = amount / (liquidity / 2) for 50/50 pools
  const halfLiquidity = liquidityUsd / 2;
  const impact = (amountUsd / halfLiquidity) * 100;
  
  // Cap at 50% impact
  return Math.min(impact, 50);
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
