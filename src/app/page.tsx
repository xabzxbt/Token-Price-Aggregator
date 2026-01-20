"use client";

import { useState, useCallback } from "react";
import TokenSearch from "@/components/TokenSearch";
import PriceDisplay from "@/components/PriceDisplay";
import Watchlist from "@/components/Watchlist";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { Chain } from "@/types";

export type SelectedToken = {
  address: string;
  chain: Chain;
  name?: string;
  symbol?: string;
};

export default function Page() {
  const [selectedToken, setSelectedToken] = useState<SelectedToken | null>(null);
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();

  const handleTokenSelected = useCallback((token: SelectedToken) => {
    setSelectedToken(token);
  }, []);

  const handleWatchlistSelect = useCallback((address: string, chain: Chain) => {
    const item = watchlist.find(
      w => w.address.toLowerCase() === address.toLowerCase() && w.chain === chain
    );
    if (item) {
      setSelectedToken({
        address: item.address,
        chain: item.chain,
        name: item.name,
        symbol: item.symbol
      });
    }
  }, [watchlist]);

  return (
    <div className="space-y-4">
      <TokenSearch onTokenSelected={handleTokenSelected} />
      
      <Watchlist 
        watchlist={watchlist}
        onSelect={handleWatchlistSelect}
        onRemove={removeFromWatchlist}
      />
      
      <PriceDisplay 
        token={selectedToken}
        onAddToWatchlist={addToWatchlist}
        isInWatchlist={selectedToken ? isInWatchlist(selectedToken.address, selectedToken.chain) : false}
      />
    </div>
  );
}
