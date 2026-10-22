// Merges wrapped/bridged token variants into a single canonical holding.
// e.g. cbBTC + BTCB + BTC all become BTC, summing qty and marketValue.

import type { HoldingRecord } from '../types/holdings'

// Maps any symbol variant → canonical symbol (uppercase keys for case-insensitive lookup)
const CANONICAL_MAP: Record<string, string> = {
  // Bitcoin variants
  WBTC:  'BTC',
  CBBTC: 'BTC',
  BTCB:  'BTC',
  PUMPBTC: 'BTC',
  // Ethereum variants
  WETH:   'ETH',
  WEETH:  'ETH',
  STETH:  'ETH',
  WSTETH: 'ETH',
  CBETH:  'ETH',
  // Add more as needed
}

function canonicalSymbol(symbol: string): string {
  return CANONICAL_MAP[symbol.toUpperCase()] ?? symbol
}

export function mergeAliasHoldings(holdings: HoldingRecord[]): HoldingRecord[] {
  const groups = new Map<string, HoldingRecord[]>()
  // Debt rows stay separate so a loan never nets against an asset of the same symbol
  const debts = holdings.filter((h) => h.isDebt)

  for (const h of holdings) {
    if (h.isDebt) continue
    const key = `${h.type}:${canonicalSymbol(h.symbol)}`
    const group = groups.get(key) ?? []
    group.push(h)
    groups.set(key, group)
  }

  const result: HoldingRecord[] = []

  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0])
      continue
    }

    const totalMarketValue = group.reduce((s, h) => s + h.marketValue, 0)
    const totalQty         = group.reduce((s, h) => s + h.qty, 0)
    const totalCost        = group.reduce((s, h) => s + h.qty * h.costBasis, 0)
    const totalUnrealizedPL = group.reduce((s, h) => s + h.unrealizedPL, 0)
    const unrealizedPLPercent = totalCost > 0 ? (totalUnrealizedPL / totalCost) * 100 : 0

    // Use the platform of the largest holding for type-safety
    const largest = group.reduce((a, b) => a.marketValue >= b.marketValue ? a : b)
    const canonical = canonicalSymbol(largest.symbol)
    const mostRecent = group.reduce((a, b) => a.lastUpdated > b.lastUpdated ? a : b).lastUpdated

    const uniquePlatforms = [...new Set(group.map((h) => h.platform))]

    result.push({
      symbol: canonical,
      name: largest.name.replace(largest.symbol, canonical),
      qty: totalQty,
      costBasis: totalQty > 0 ? totalCost / totalQty : 0,
      marketValue: totalMarketValue,
      unrealizedPL: totalUnrealizedPL,
      unrealizedPLPercent,
      platform: largest.platform,
      platforms: uniquePlatforms,
      type: largest.type,
      lastUpdated: mostRecent,
    })
  }

  return [...result, ...debts]
}
