import { describe, it, expect } from 'vitest'
import { normalizeSchwab, normalizeOKX, normalizeOKXDebt, normalizeZerion, normalizeFutuPosition } from '../utils/normalize'
import type { SchwabPosition, OKXDetail, ZerionPosition } from '../utils/normalize'
import { parseManualHoldings, toManualHoldingRecord } from '../services/manual'

describe('normalizeSchwab', () => {
  it('maps a long position correctly', () => {
    const pos: SchwabPosition = {
      instrument: { symbol: 'AAPL', description: 'Apple Inc.', assetType: 'EQUITY' },
      longQuantity: 10,
      averagePrice: 150,
      marketValue: 1700,
    }
    const result = normalizeSchwab(pos)
    expect(result.symbol).toBe('AAPL')
    expect(result.name).toBe('Apple Inc.')
    expect(result.qty).toBe(10)
    expect(result.costBasis).toBe(150)
    expect(result.marketValue).toBe(1700)
    expect(result.unrealizedPL).toBe(200)           // 1700 - (10*150)
    expect(result.unrealizedPLPercent).toBeCloseTo(13.33, 1)
    expect(result.platform).toBe('schwab')
    expect(result.type).toBe('stock')
  })

  it('handles zero cost basis without dividing by zero', () => {
    const pos: SchwabPosition = {
      instrument: { symbol: 'XYZ', assetType: 'EQUITY' },
      longQuantity: 5,
      averagePrice: 0,
      marketValue: 100,
    }
    const result = normalizeSchwab(pos)
    expect(result.unrealizedPLPercent).toBe(0)
  })
})

describe('normalizeOKX', () => {
  it('computes marketValue and PnL correctly', () => {
    const detail: OKXDetail = { ccy: 'BTC', eq: '1', eqUsd: '50000', avgPx: '40000' }
    const result = normalizeOKX(detail)
    expect(result.symbol).toBe('BTC')
    expect(result.platform).toBe('okx')
    expect(result.type).toBe('crypto')
    expect(result.qty).toBe(1)
    expect(result.marketValue).toBe(50000)
    expect(result.unrealizedPL).toBe(10000)         // 50000 - (1 * 40000)
    expect(result.unrealizedPLPercent).toBe(25)     // 10000 / 40000 * 100
  })

  it('returns zero PnL when avgPx is missing', () => {
    const detail: OKXDetail = { ccy: 'ETH', eq: '1', eqUsd: '3000' }
    const result = normalizeOKX(detail)
    expect(result.unrealizedPL).toBe(0)
    expect(result.unrealizedPLPercent).toBe(0)
  })
})

describe('normalizeZerion', () => {
  it('filters out spam and maps correctly', () => {
    const pos: ZerionPosition = {
      attributes: {
        value: 1000,
        quantity: { float: 0.5 },
        price: 2000,
        changes: { percent_1d: 2.5 },
        flags: { is_spam: false },
        fungible_info: { symbol: 'ETH', name: 'Ethereum' },
      },
    }
    const result = normalizeZerion(pos, '0xabc123def456')
    expect(result.symbol).toBe('ETH')
    expect(result.name).toBe('Ethereum')
    expect(result.qty).toBe(0.5)
    expect(result.marketValue).toBe(1000)
    expect(result.platform).toBe('zerion')
    expect(result.sourceWallet).toBe('0xabc1...f456')
  })

  it('keeps a protocol deposit as a positive asset', () => {
    const pos: ZerionPosition = {
      attributes: {
        value: 143.98,
        quantity: { float: 0.06 },
        price: 2399.7,
        changes: null,
        flags: { is_spam: false },
        fungible_info: { symbol: 'stETH', name: 'Lido Staked ETH' },
        position_type: 'deposit',
        protocol: 'LIDO',
      },
    }
    const result = normalizeZerion(pos, '0xabc123def456')
    expect(result.qty).toBe(0.06)
    expect(result.marketValue).toBe(143.98)
    expect(result.isDebt).toBeUndefined()
  })

  it('stores a protocol loan as a negative debt', () => {
    const pos: ZerionPosition = {
      attributes: {
        value: 500,
        quantity: { float: 500 },
        price: 1,
        changes: null,
        flags: { is_spam: false },
        fungible_info: { symbol: 'USDC', name: 'USD Coin' },
        position_type: 'loan',
        protocol: 'Aave V3',
      },
    }
    const result = normalizeZerion(pos, '0xabc123def456')
    expect(result.qty).toBe(-500)
    expect(result.marketValue).toBe(-500)
    expect(result.isDebt).toBe(true)
  })
})

describe('normalizeOKXDebt', () => {
  it('stores a borrowed amount as negative qty and value', () => {
    const result = normalizeOKXDebt({ ccy: 'USDT', eq: '2541.23', eqUsd: '2541.23' })
    expect(result.symbol).toBe('USDT')
    expect(result.qty).toBe(-2541.23)
    expect(result.marketValue).toBe(-2541.23)
    expect(result.unrealizedPL).toBe(0)
    expect(result.platform).toBe('okx')
    expect(result.isDebt).toBe(true)
  })
})

describe('normalizeFutuPosition', () => {
  it('maps an OpenD US position', () => {
    const result = normalizeFutuPosition({
      code: 'NVDA', name: 'NVIDIA', qty: 10, val: 1500, plVal: 300, dilutedCostPrice: 120, secMarket: 2,
    })
    expect(result.symbol).toBe('NVDA')
    expect(result.qty).toBe(10)
    expect(result.costBasis).toBe(120)
    expect(result.marketValue).toBe(1500)
    expect(result.unrealizedPL).toBe(300)
    expect(result.unrealizedPLPercent).toBeCloseTo(25) // 300 / (1500 - 300)
    expect(result.platform).toBe('futu')
    expect(result.type).toBe('stock')
  })

  it('strips a US. prefix and falls back when diluted cost is missing', () => {
    const result = normalizeFutuPosition({
      code: 'US.AAPL', name: 'Apple', qty: 1, val: 200, plVal: 0, dilutedCostPrice: 0, averageCostPrice: 190,
    })
    expect(result.symbol).toBe('AAPL')
    expect(result.costBasis).toBe(190)
    expect(result.unrealizedPLPercent).toBe(0)
  })
})

describe('manual holdings', () => {
  it('parses SYMBOL:qty@cost entries and skips malformed ones', () => {
    expect(parseManualHoldings(' tsla:13@207.9, NVDA:5 @ 120 , junk, AAPL:0@100')).toEqual([
      { symbol: 'TSLA', qty: 13, costBasis: 207.9 },
      { symbol: 'NVDA', qty: 5, costBasis: 120 },
    ])
  })

  it('values a manual holding at the given price', () => {
    const r = toManualHoldingRecord({ symbol: 'TSLA', qty: 13, costBasis: 207.9 }, 372.11)
    expect(r.marketValue).toBeCloseTo(4837.43)
    expect(r.unrealizedPL).toBeCloseTo(2134.73)
    expect(r.unrealizedPLPercent).toBeCloseTo(78.985, 2)
    expect(r.platform).toBe('futu')
    expect(r.type).toBe('stock')
  })
})
