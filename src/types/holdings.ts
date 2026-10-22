// Spec: F3 — Canonical HoldingRecord shape shared across all platforms

export type Platform = 'schwab' | 'okx' | 'zerion' | 'futu' | 'bitcoin'
export type AssetType = 'stock' | 'crypto'

export interface HoldingRecord {
  symbol: string              // e.g. "AAPL", "BTC", "700.HK"
  name: string                // full display name
  qty: number
  costBasis: number           // per unit, USD
  marketValue: number         // total current value, USD
  unrealizedPL: number        // USD
  unrealizedPLPercent: number // e.g. 12.34 (percent, not decimal)
  platform: Platform
  platforms?: Platform[]   // set when holding is merged from multiple sources
  type: AssetType
  lastUpdated: string         // ISO 8601
  sourceWallet?: string       // Zerion only: shortened "0x123...abc"
  isDebt?: boolean            // borrowed amount (OKX flexible loan, DeFi loan); qty and marketValue are negative
}

export interface DailySnapshot {
  date: string       // "YYYY-MM-DD"
  totalValue: number
  timestamp: string  // ISO 8601 full
}

export interface NewsArticle {
  headline: string
  source: string
  datetime: number  // unix timestamp (seconds)
  url: string
}

export interface PositionAssumption {
  conviction: number        // probability from 0 to 1
  bullMultiple: number      // upside expressed as a multiple of capital
  bearMultiple: number      // absolute downside expressed as a multiple of capital
  note: string
}

export interface PositionStrategy {
  fractionalKelly: number   // e.g. 0.5 for half-Kelly
  targetExposure: number    // portfolio fraction allocated to positions, from 0 to 1
  maxPosition: number       // maximum fraction of the portfolio in one position, from 0 to 1
  rebalanceTolerance: number
  assumptions: Record<string, PositionAssumption>
  correlations: Record<string, Record<string, number>>
}

export type PlatformStatus = 'idle' | 'loading' | 'success' | 'error'

export interface PlatformState {
  status: PlatformStatus
  lastUpdated: string | null
  errorMessage: string | null
}
