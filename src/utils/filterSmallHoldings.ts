// Drops dust: holdings (or debts) whose absolute USD value is under $1.

import type { HoldingRecord } from '../types/holdings'

const MIN_ABS_VALUE_USD = 1

export function filterSmallHoldings(holdings: HoldingRecord[]): HoldingRecord[] {
  return holdings.filter((h) => Math.abs(h.marketValue) >= MIN_ABS_VALUE_USD)
}
