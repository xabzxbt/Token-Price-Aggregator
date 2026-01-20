"use client";

import { useState, useEffect } from "react";
import type { Chain } from "@/types";

interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceChartProps {
  pairAddress: string;
  chain: Chain;
  symbol: string;
}

type TimeFrame = "24h" | "7d" | "30d";

const TIMEFRAME_CONFIG: Record<TimeFrame, { resolution: string; bars: number }> = {
  "24h": { resolution: "15", bars: 96 },    // 15 min bars, 96 bars = 24h
  "7d": { resolution: "60", bars: 168 },    // 1h bars, 168 bars = 7d
  "30d": { resolution: "240", bars: 180 },  // 4h bars, 180 bars = 30d
};

export default function PriceChart({ pairAddress, chain, symbol }: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<TimeFrame>("24h");
  const [data, setData] = useState<OHLCVData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOHLCV() {
      setLoading(true);
      setError(null);

      try {
        const config = TIMEFRAME_CONFIG[timeframe];
        // DexScreener doesn't have public OHLCV API, so we'll use a simple price history simulation
        // In production, you'd use a proper OHLCV API like Birdeye, GeckoTerminal, etc.
        
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/pairs/${chain}/${pairAddress}`
        );
        
        if (!res.ok) throw new Error("Failed to fetch price data");
        
        const json = await res.json();
        const pair = json.pair || json.pairs?.[0];
        
        if (!pair) throw new Error("Pair not found");

        // Generate mock OHLCV data based on current price and price changes
        const currentPrice = parseFloat(pair.priceUsd) || 0;
        const priceChange24h = pair.priceChange?.h24 || 0;
        
        // Create realistic-looking price data
        const mockData = generateMockOHLCV(currentPrice, priceChange24h, config.bars, timeframe);
        setData(mockData);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chart");
      } finally {
        setLoading(false);
      }
    }

    if (pairAddress && chain) {
      fetchOHLCV();
    }
  }, [pairAddress, chain, timeframe]);

  // Calculate chart dimensions and data
  const chartHeight = 200;
  const chartWidth = "100%";
  
  const prices = data.map(d => d.close);
  const minPrice = Math.min(...prices) * 0.995;
  const maxPrice = Math.max(...prices) * 1.005;
  const priceRange = maxPrice - minPrice || 1;

  // Calculate if price went up or down
  const priceUp = data.length > 1 && data[data.length - 1].close >= data[0].close;

  // Generate SVG path for the line chart
  const generatePath = () => {
    if (data.length < 2) return "";
    
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = ((maxPrice - d.close) / priceRange) * 100;
      return `${x},${y}`;
    });
    
    return `M ${points.join(" L ")}`;
  };

  // Generate area fill path
  const generateAreaPath = () => {
    if (data.length < 2) return "";
    
    const linePath = generatePath();
    return `${linePath} L 100,100 L 0,100 Z`;
  };

  return (
    <div className="card p-6 bg-white border-2 border-black">
      <div className="flex items-center justify-between mb-6 border-b-2 border-black pb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black">
          PRICE CHART — {symbol}
        </h3>
        <div className="flex gap-2">
          {(["24h", "7d", "30d"] as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all border-2 border-black ${
                timeframe === tf
                  ? "bg-black text-white shadow-[2px_2px_0_0_#ff4d00]"
                  : "bg-white text-black hover:bg-gray-50"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[200px] flex items-center justify-center">
          <span className="spinner"></span>
        </div>
      ) : error ? (
        <div className="h-[200px] flex items-center justify-center text-black/60 text-sm">
          {error}
        </div>
      ) : data.length > 0 ? (
        <div className="relative">
          {/* Price labels */}
          <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between text-[10px] text-black/60 font-mono">
            <span>${maxPrice.toFixed(maxPrice < 0.01 ? 6 : 4)}</span>
            <span>${((maxPrice + minPrice) / 2).toFixed(maxPrice < 0.01 ? 6 : 4)}</span>
            <span>${minPrice.toFixed(minPrice < 0.01 ? 6 : 4)}</span>
          </div>
          
          {/* Chart */}
          <div className="ml-16">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full"
              style={{ height: chartHeight }}
            >
              {/* Grid lines */}
              <line x1="0" y1="25" x2="100" y2="25" stroke="#f0f0f0" strokeWidth="0.5" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="#f0f0f0" strokeWidth="0.5" />
              <line x1="0" y1="75" x2="100" y2="75" stroke="#f0f0f0" strokeWidth="0.5" />
              
              {/* Area fill */}
              <path
                d={generateAreaPath()}
                fill={priceUp ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)"}
              />
              
              {/* Line */}
              <path
                d={generatePath()}
                fill="none"
                stroke={priceUp ? "#22c55e" : "#ef4444"}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-black/60 uppercase">Open</div>
              <div className="font-mono font-medium">${data[0]?.close.toFixed(6)}</div>
            </div>
            <div>
              <div className="text-black/60 uppercase">High</div>
              <div className="font-mono font-medium text-green-600">${maxPrice.toFixed(6)}</div>
            </div>
            <div>
              <div className="text-black/60 uppercase">Low</div>
              <div className="font-mono font-medium text-red-500">${minPrice.toFixed(6)}</div>
            </div>
            <div>
              <div className="text-black/60 uppercase">Close</div>
              <div className="font-mono font-medium">${data[data.length - 1]?.close.toFixed(6)}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-black/60 text-sm">
          No data available
        </div>
      )}
    </div>
  );
}

// Helper to generate mock OHLCV data
function generateMockOHLCV(
  currentPrice: number,
  priceChange24h: number,
  bars: number,
  timeframe: TimeFrame
): OHLCVData[] {
  const data: OHLCVData[] = [];
  const now = Date.now();
  
  // Calculate time interval based on timeframe
  const intervals: Record<TimeFrame, number> = {
    "24h": 15 * 60 * 1000,      // 15 min
    "7d": 60 * 60 * 1000,       // 1 hour
    "30d": 4 * 60 * 60 * 1000,  // 4 hours
  };
  const interval = intervals[timeframe];
  
  // Start price (work backwards from current)
  const totalChange = priceChange24h / 100;
  const startPrice = currentPrice / (1 + totalChange);
  
  // Generate random walk with trend
  let price = startPrice;
  const trend = totalChange / bars;
  const volatility = Math.abs(totalChange) * 0.3 || 0.02;
  
  for (let i = 0; i < bars; i++) {
    const timestamp = now - (bars - i) * interval;
    
    // Random movement with trend
    const randomMove = (Math.random() - 0.5) * volatility * price;
    const trendMove = trend * price;
    price = price + randomMove + trendMove;
    
    // Ensure price stays positive
    price = Math.max(price, currentPrice * 0.5);
    
    // Generate OHLCV
    const high = price * (1 + Math.random() * 0.01);
    const low = price * (1 - Math.random() * 0.01);
    const open = i === 0 ? startPrice : data[i - 1].close;
    const close = price;
    const volume = Math.random() * 1000000;
    
    data.push({ timestamp, open, high, low, close, volume });
  }
  
  // Adjust last point to match current price
  if (data.length > 0) {
    data[data.length - 1].close = currentPrice;
  }
  
  return data;
}
