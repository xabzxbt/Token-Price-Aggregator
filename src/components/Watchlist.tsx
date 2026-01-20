"use client";

import type { WatchlistItem } from "@/hooks/useWatchlist";
import type { Chain } from "@/types";

interface WatchlistProps {
  watchlist: WatchlistItem[];
  onSelect: (address: string, chain: Chain) => void;
  onRemove: (address: string, chain: Chain) => void;
}

export default function Watchlist({ watchlist, onSelect, onRemove }: WatchlistProps) {
  if (watchlist.length === 0) {
    return null;
  }

  return (
    <div className="card p-4 bg-white border-2 border-black">
      <div className="flex items-center justify-between mb-4 border-b-2 border-black pb-2">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black">
          WATCHLIST
        </h3>
        <span className="bg-black text-white text-[10px] font-black px-2 py-0.5">{watchlist.length}</span>
      </div>
      
      <div className="flex flex-wrap gap-3">
        {watchlist.map((item) => (
          <div
            key={`${item.chain}-${item.address}`}
            className="group flex items-center gap-2 bg-white border-2 border-black px-3 py-1.5 hover:shadow-[4px_4px_0_0_#ff4d00] transition-all shadow-[2px_2px_0_0_#000] cursor-pointer"
            onClick={() => onSelect(item.address, item.chain)}
          >
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-tight">
              <span className="text-[9px] opacity-70">{item.chain.slice(0, 3)}</span>
              <span>{item.symbol}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.address, item.chain);
              }}
              className="text-black/40 hover:text-[#ff4d00] transition-colors"
              title="Remove from watchlist"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
