"use client";

import { useState, useEffect, useCallback } from "react";
import type { Chain } from "@/types";

export interface WatchlistItem {
  address: string;
  chain: Chain;
  symbol: string;
  name: string;
  addedAt: number;
}

const STORAGE_KEY = "token-price-watchlist";
const MAX_ITEMS = 20;

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WatchlistItem[];
        setWatchlist(parsed);
      }
    } catch (e) {
      console.error("Failed to load watchlist", e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when watchlist changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
      } catch (e) {
        console.error("Failed to save watchlist", e);
      }
    }
  }, [watchlist, isLoaded]);

  const addToWatchlist = useCallback((item: Omit<WatchlistItem, "addedAt">) => {
    setWatchlist((prev) => {
      // Check if already exists
      const exists = prev.some(
        (w) => w.address.toLowerCase() === item.address.toLowerCase() && w.chain === item.chain
      );
      if (exists) return prev;

      // Add to beginning, limit to MAX_ITEMS
      const newList = [
        { ...item, addedAt: Date.now() },
        ...prev
      ].slice(0, MAX_ITEMS);

      return newList;
    });
  }, []);

  const removeFromWatchlist = useCallback((address: string, chain: Chain) => {
    setWatchlist((prev) =>
      prev.filter(
        (w) => !(w.address.toLowerCase() === address.toLowerCase() && w.chain === chain)
      )
    );
  }, []);

  const isInWatchlist = useCallback(
    (address: string, chain: Chain) => {
      return watchlist.some(
        (w) => w.address.toLowerCase() === address.toLowerCase() && w.chain === chain
      );
    },
    [watchlist]
  );

  const clearWatchlist = useCallback(() => {
    setWatchlist([]);
  }, []);

  return {
    watchlist,
    isLoaded,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    clearWatchlist
  };
}
