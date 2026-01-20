import type { Chain, TokenSecurity } from "@/types";

const GOPLUS_BASE_URL = "https://api.gopluslabs.io/api/v1";

// GoPlus chain IDs
const GOPLUS_CHAIN_IDS: Partial<Record<Chain, string>> = {
  ethereum: "1",
  bsc: "56",
  polygon: "137",
  arbitrum: "42161",
  optimism: "10",
  base: "8453",
  avalanche: "43114",
  fantom: "250",
  // Solana and zkSync not supported by GoPlus
};

async function safeFetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { 
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error("GoPlus request failed", error);
    return null;
  }
}

function calculateRiskScore(data: any): { score: number; level: "low" | "medium" | "high" | "critical" } {
  let score = 0;
  
  // Critical risks (each adds 25-40 points)
  if (data.is_honeypot === "1") score += 40;
  if (data.cannot_sell_all === "1") score += 35;
  if (data.cannot_buy === "1") score += 35;
  if (data.transfer_pausable === "1") score += 20;
  if (data.trading_cooldown === "1") score += 15;
  
  // High risks (each adds 15-25 points)
  if (data.is_proxy === "1") score += 15;
  if (data.is_mintable === "1") score += 15;
  if (data.can_take_back_ownership === "1") score += 20;
  if (data.owner_change_balance === "1") score += 25;
  if (data.hidden_owner === "1") score += 20;
  if (data.selfdestruct === "1") score += 25;
  if (data.external_call === "1") score += 10;
  
  // Tax risks
  const buyTax = parseFloat(data.buy_tax ?? "0") * 100;
  const sellTax = parseFloat(data.sell_tax ?? "0") * 100;
  if (buyTax > 10) score += Math.min((buyTax - 10) * 2, 30);
  if (sellTax > 10) score += Math.min((sellTax - 10) * 2, 30);
  
  // Positive indicators (reduce score)
  if (data.is_open_source === "1") score -= 10;
  if (data.is_in_dex === "1") score -= 5;
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Determine level
  let level: "low" | "medium" | "high" | "critical";
  if (score >= 70) level = "critical";
  else if (score >= 40) level = "high";
  else if (score >= 20) level = "medium";
  else level = "low";
  
  return { score, level };
}

function generateWarnings(data: any): string[] {
  const warnings: string[] = [];
  
  // Critical warnings
  if (data.is_honeypot === "1") {
    warnings.push("🚨 HONEYPOT DETECTED - Cannot sell tokens!");
  }
  if (data.cannot_sell_all === "1") {
    warnings.push("🚨 Cannot sell all tokens - Potential honeypot");
  }
  if (data.cannot_buy === "1") {
    warnings.push("🚨 Cannot buy - Token is not tradeable");
  }
  
  // High risk warnings
  if (data.is_proxy === "1") {
    warnings.push("⚠️ Proxy contract - Code can be changed");
  }
  if (data.is_mintable === "1") {
    warnings.push("⚠️ Mintable - New tokens can be created");
  }
  if (data.can_take_back_ownership === "1") {
    warnings.push("⚠️ Ownership can be reclaimed");
  }
  if (data.owner_change_balance === "1") {
    warnings.push("⚠️ Owner can modify balances");
  }
  if (data.hidden_owner === "1") {
    warnings.push("⚠️ Hidden owner detected");
  }
  if (data.selfdestruct === "1") {
    warnings.push("⚠️ Contract can self-destruct");
  }
  if (data.transfer_pausable === "1") {
    warnings.push("⚠️ Transfers can be paused");
  }
  if (data.trading_cooldown === "1") {
    warnings.push("⚠️ Trading cooldown enabled");
  }
  
  // Tax warnings
  const buyTax = parseFloat(data.buy_tax ?? "0") * 100;
  const sellTax = parseFloat(data.sell_tax ?? "0") * 100;
  if (buyTax > 5) {
    warnings.push(`💸 Buy tax: ${buyTax.toFixed(1)}%`);
  }
  if (sellTax > 5) {
    warnings.push(`💸 Sell tax: ${sellTax.toFixed(1)}%`);
  }
  
  // Informational
  if (data.is_open_source !== "1") {
    warnings.push("ℹ️ Contract is not verified/open source");
  }
  
  // Holder concentration
  if (data.holder_count && parseInt(data.holder_count) < 100) {
    warnings.push(`ℹ️ Low holder count: ${data.holder_count}`);
  }
  
  // LP info
  if (data.lp_holder_count && parseInt(data.lp_holder_count) < 5) {
    warnings.push(`ℹ️ Very few LP holders: ${data.lp_holder_count}`);
  }
  
  return warnings;
}

export async function fetchTokenSecurity(
  chain: Chain,
  address: string
): Promise<TokenSecurity | null> {
  const chainId = GOPLUS_CHAIN_IDS[chain];
  if (!chainId) {
    // Chain not supported by GoPlus
    return null;
  }

  const normalizedAddress = address.trim().toLowerCase();
  const url = `${GOPLUS_BASE_URL}/token_security/${chainId}?contract_addresses=${normalizedAddress}`;
  
  const response = await safeFetchJson(url);
  if (!response?.result?.[normalizedAddress]) {
    return null;
  }
  
  const data = response.result[normalizedAddress];
  const { score, level } = calculateRiskScore(data);
  const warnings = generateWarnings(data);
  
  return {
    isHoneypot: data.is_honeypot === "1" ? true : data.is_honeypot === "0" ? false : null,
    honeypotReason: data.honeypot_with_same_creator === "1" 
      ? "Creator has made honeypot tokens before" 
      : null,
    buyTax: data.buy_tax ? parseFloat(data.buy_tax) * 100 : null,
    sellTax: data.sell_tax ? parseFloat(data.sell_tax) * 100 : null,
    isOpenSource: data.is_open_source === "1" ? true : data.is_open_source === "0" ? false : null,
    isProxy: data.is_proxy === "1" ? true : data.is_proxy === "0" ? false : null,
    isMintable: data.is_mintable === "1" ? true : data.is_mintable === "0" ? false : null,
    canTakeBackOwnership: data.can_take_back_ownership === "1" ? true : data.can_take_back_ownership === "0" ? false : null,
    ownerAddress: data.owner_address || null,
    creatorAddress: data.creator_address || null,
    holderCount: data.holder_count ? parseInt(data.holder_count) : null,
    lpHolderCount: data.lp_holder_count ? parseInt(data.lp_holder_count) : null,
    riskLevel: level,
    riskScore: score,
    warnings
  };
}

// Additional pool-based risk assessment
export function assessPoolRisk(pool: {
  liquidityUsd: number | null;
  poolAgeHours: number | null;
  txns24hTotal: number;
}): { warnings: string[]; riskBoost: number } {
  const warnings: string[] = [];
  let riskBoost = 0;
  
  // Liquidity check
  if (pool.liquidityUsd !== null) {
    if (pool.liquidityUsd < 1000) {
      warnings.push("🔴 Extremely low liquidity (<$1K) - High slippage risk");
      riskBoost += 30;
    } else if (pool.liquidityUsd < 10000) {
      warnings.push("🟠 Low liquidity (<$10K) - Significant slippage expected");
      riskBoost += 15;
    } else if (pool.liquidityUsd < 50000) {
      warnings.push("🟡 Moderate liquidity (<$50K)");
      riskBoost += 5;
    }
  }
  
  // Pool age check
  if (pool.poolAgeHours !== null) {
    if (pool.poolAgeHours < 1) {
      warnings.push("🔴 Pool created less than 1 hour ago - Extreme caution!");
      riskBoost += 25;
    } else if (pool.poolAgeHours < 24) {
      warnings.push("🟠 Pool is less than 24 hours old");
      riskBoost += 15;
    } else if (pool.poolAgeHours < 72) {
      warnings.push("🟡 Pool is less than 3 days old");
      riskBoost += 5;
    }
  }
  
  // Activity check
  if (pool.txns24hTotal < 10) {
    warnings.push("ℹ️ Very low trading activity (<10 txns/day)");
    riskBoost += 10;
  }
  
  return { warnings, riskBoost };
}
