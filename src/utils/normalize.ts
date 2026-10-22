// Spec: F3 — per-platform raw response → HoldingRecord mappers

import type { HoldingRecord } from '../types/holdings'

// ─── Schwab ────────────────────────────────────────────────────────────────

export interface SchwabPosition {
  instrument: {
    symbol: string
    description?: string
    assetType: string
  }
  longQuantity?: number
  shortQuantity?: number
  averagePrice?: number
  marketValue?: number
  currentDayProfitLoss?: number
  currentDayProfitLossPercentage?: number
}

export function normalizeSchwab(pos: SchwabPosition): HoldingRecord {
  const qty = pos.longQuantity ?? pos.shortQuantity ?? 0
  const costBasis = pos.averagePrice ?? 0
  const marketValue = pos.marketValue ?? 0
  const cost = qty * costBasis
  const unrealizedPL = marketValue - cost
  const unrealizedPLPercent = cost > 0 ? (unrealizedPL / cost) * 100 : 0

  return {
    symbol: pos.instrument.symbol,
    name: pos.instrument.description ?? pos.instrument.symbol,
    qty,
    costBasis,
    marketValue,
    unrealizedPL,
    unrealizedPLPercent,
    platform: 'schwab',
    type: 'stock',
    lastUpdated: new Date().toISOString(),
  }
}

// ─── OKX ───────────────────────────────────────────────────────────────────

export interface OKXDetail {
  ccy: string
  eq: string      // quantity in currency terms (e.g. 0.001 BTC)
  eqUsd: string   // total USD value (e.g. 45.23)
  avgPx?: string  // average open price in USD per unit
}

export function normalizeOKX(detail: OKXDetail): HoldingRecord {
  const qty = parseFloat(detail.eq) || 0
  const marketValue = parseFloat(detail.eqUsd ?? '0') || 0
  const costBasis = parseFloat(detail.avgPx ?? '0') || 0
  const cost = qty * costBasis
  const unrealizedPL = cost > 0 ? marketValue - cost : 0
  const unrealizedPLPercent = cost > 0 ? (unrealizedPL / cost) * 100 : 0

  return {
    symbol: detail.ccy,
    name: detail.ccy,
    qty,
    costBasis,
    marketValue,
    unrealizedPL,
    unrealizedPLPercent,
    platform: 'okx',
    type: 'crypto',
    lastUpdated: new Date().toISOString(),
  }
}

// Borrowed amount (OKX flexible loan) — negative qty/value so totals show net worth
export function normalizeOKXDebt(detail: OKXDetail): HoldingRecord {
  const h = normalizeOKX(detail)
  return { ...h, qty: -h.qty, marketValue: -h.marketValue, isDebt: true }
}

// ─── Zerion ────────────────────────────────────────────────────────────────

export interface ZerionPositionAttributes {
  value: number | null
  quantity: { float: number } | null
  price: number | null
  changes: { percent_1d: number | null } | null
  flags: { is_spam: boolean }
  fungible_info: {
    symbol: string
    name: string
  }
  position_type?: string        // wallet | deposit | loan | staked | locked | reward | investment
  protocol?: string | null
}

export interface ZerionPosition {
  attributes: ZerionPositionAttributes
  relationships?: { dapp?: { data?: { id: string } } }  // e.g. "aave-v3"
}

export function normalizeZerion(pos: ZerionPosition, walletAddress: string): HoldingRecord {
  const { attributes } = pos
  const symbol = attributes.fungible_info.symbol ?? ''
  const name = attributes.fungible_info.name ?? symbol
  // Protocol loans (e.g. Aave borrow) are debt — stored negative so totals show net worth
  const isDebt = attributes.position_type === 'loan'
  const sign = isDebt ? -1 : 1
  const qty = sign * Math.abs(attributes.quantity?.float ?? 0)
  const marketValue = sign * Math.abs(attributes.value ?? 0)
  // Zerion doesn't provide cost basis; default to 0 (PnL unavailable)
  const costBasis = 0
  const unrealizedPL = 0
  const unrealizedPLPercent = 0

  const short = walletAddress.length > 10
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : walletAddress

  return {
    symbol,
    name,
    qty,
    costBasis,
    marketValue,
    unrealizedPL,
    unrealizedPLPercent,
    platform: 'zerion',
    type: 'crypto',
    lastUpdated: new Date().toISOString(),
    sourceWallet: short,
    ...(isDebt && { isDebt }),
  }
}

// ─── Futu (futu-bridge /positions, US market) ──────────────────────────────

/** Subset of OpenD's Trd_Common.Position, as served by server/futu-bridge */
export interface FutuPosition {
  positionID?: string
  code: string                // "AAPL" (raw proto) or "US.AAPL"
  name: string
  qty: number
  val: number                 // market value, USD for US positions
  plVal: number
  dilutedCostPrice?: number
  averageCostPrice?: number
  costPrice?: number
  secMarket?: number          // Trd_Common.TrdSecMarket, 2 = US
}

// A cost price of 0 means "not provided" in OpenD, so fall back with || rather than ??
export function normalizeFutuPosition(pos: FutuPosition): HoldingRecord {
  const marketValue = pos.val
  const unrealizedPL = pos.plVal
  const cost = marketValue - unrealizedPL
  const unrealizedPLPercent = cost !== 0 ? (unrealizedPL / Math.abs(cost)) * 100 : 0

  return {
    symbol: pos.code.replace(/^US./, ''),
    name: pos.name,
    qty: pos.qty,
    costBasis: pos.dilutedCostPrice || pos.averageCostPrice || pos.costPrice || 0,
    marketValue,
    unrealizedPL,
    unrealizedPLPercent,
    platform: 'futu',
    type: 'stock',
    lastUpdated: new Date().toISOString(),
  }
}
