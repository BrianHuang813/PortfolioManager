import { describe, it, expect } from 'vitest'
import { filterSmallHoldings } from '../utils/filterSmallHoldings'
import type { HoldingRecord } from '../types/holdings'

const holding = (overrides: Partial<HoldingRecord>): HoldingRecord => ({
  symbol: 'ETH',
  name: 'ETH',
  qty: 1,
  costBasis: 0,
  marketValue: 100,
  unrealizedPL: 0,
  unrealizedPLPercent: 0,
  platform: 'okx',
  type: 'crypto',
  lastUpdated: '2026-10-27T00:00:00.000Z',
  ...overrides,
})

describe('filterSmallHoldings', () => {
  it('drops holdings worth less than $1', () => {
    const dust = holding({ symbol: 'SOL', marketValue: 0.006 })
    const real = holding({ symbol: 'BTC', marketValue: 5410 })

    expect(filterSmallHoldings([dust, real])).toEqual([real])
  })

  it('keeps a holding worth exactly $1', () => {
    const edge = holding({ marketValue: 1 })

    expect(filterSmallHoldings([edge])).toEqual([edge])
  })

  it('keeps a large debt (negative value) and drops a tiny one', () => {
    const bigDebt = holding({ symbol: 'USDT', marketValue: -2822, isDebt: true })
    const tinyDebt = holding({ symbol: 'LINK', marketValue: -0.5, isDebt: true })

    expect(filterSmallHoldings([bigDebt, tinyDebt])).toEqual([bigDebt])
  })
})
