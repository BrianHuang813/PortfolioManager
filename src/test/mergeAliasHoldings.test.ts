import { describe, it, expect } from 'vitest'
import { mergeAliasHoldings } from '../utils/mergeAliasHoldings'
import type { HoldingRecord } from '../types/holdings'

const holding = (overrides: Partial<HoldingRecord>): HoldingRecord => ({
  symbol: 'USDT',
  name: 'USDT',
  qty: 0,
  costBasis: 0,
  marketValue: 0,
  unrealizedPL: 0,
  unrealizedPLPercent: 0,
  platform: 'okx',
  type: 'crypto',
  lastUpdated: '2026-10-22T00:00:00.000Z',
  ...overrides,
})

describe('mergeAliasHoldings', () => {
  it('keeps a debt row separate from an asset with the same symbol', () => {
    const asset = holding({ platform: 'zerion', qty: 2500, marketValue: 2500 })
    const debt = holding({ qty: -2541, marketValue: -2541, isDebt: true })

    const result = mergeAliasHoldings([asset, debt])

    expect(result).toHaveLength(2)
    expect(result).toContainEqual(asset)
    expect(result).toContainEqual(debt)
  })
})
