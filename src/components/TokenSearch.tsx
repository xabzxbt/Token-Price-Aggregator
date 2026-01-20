"use client";

import { useState } from "react";
import type { Chain } from "@/types";

export type SelectedToken = {
  address: string;
  chain: Chain;
  name?: string;
  symbol?: string;
};

interface TokenSearchProps {
  onTokenSelected: (token: SelectedToken) => void;
}

const CHAINS: { value: Chain; label: string }[] = [
  { value: "ethereum", label: "ETHEREUM" },
  { value: "bsc", label: "BNB CHAIN" },
  { value: "polygon", label: "POLYGON" },
  { value: "arbitrum", label: "ARBITRUM" },
  { value: "optimism", label: "OPTIMISM" },
  { value: "base", label: "BASE" },
  { value: "solana", label: "SOLANA" },
  { value: "avalanche", label: "AVALANCHE" },
  { value: "fantom", label: "FANTOM" },
  { value: "zksync", label: "ZKSYNC" },
];

export default function TokenSearch({ onTokenSelected }: TokenSearchProps) {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<Chain>("ethereum");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = address.trim();
    if (!trimmed || trimmed.length < 10) {
      setError("Enter a valid contract address");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: trimmed, chain })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Token not found");
        return;
      }

      onTokenSelected({
        address: data.address,
        chain: data.chain,
        name: data.name,
        symbol: data.symbol
      });
    } catch {
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-8 animate-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black tracking-tighter mb-2 italic">SEARCH TOKEN</h1>
        <p className="text-[10px] text-black font-black uppercase tracking-widest opacity-80">
          Enter contract address to compare prices across exchanges
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <select
            className="select md:w-48"
            value={chain}
            onChange={(e) => setChain(e.target.value as Chain)}
          >
            {CHAINS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="0x... CONTRACT ADDRESS"
            className="input flex-1 font-mono"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />

          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="spinner"></span>
                SEARCHING...
              </span>
            ) : (
              "SEARCH →"
            )}
          </button>
        </div>

        {error && (
          <div className="p-4 border-2 border-black bg-[#ff4d00] text-white text-xs font-black uppercase tracking-wider shadow-[8px_8px_0_0_#000]">
            ERROR: {error}
          </div>
        )}
      </form>
    </div>
  );
}
