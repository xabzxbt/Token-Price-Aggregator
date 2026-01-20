"use client";

import { useState } from "react";
import TokenSearch from "@/components/TokenSearch";
import PriceDisplay from "@/components/PriceDisplay";
import type { Chain } from "@/types";

export type SelectedToken = {
  address: string;
  chain: Chain;
  name?: string;
  symbol?: string;
};

export default function Page() {
  const [selectedToken, setSelectedToken] = useState<SelectedToken | null>(null);

  return (
    <div className="space-y-4">
      <TokenSearch onTokenSelected={setSelectedToken} />
      <PriceDisplay token={selectedToken} />
    </div>
  );
}
