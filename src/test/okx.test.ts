import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchOKXHoldings } from '../services/okx'

const store: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
})

const okxResponse = (data: unknown) => new Response(
  JSON.stringify({ code: '0', msg: '', data }),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
)

beforeEach(() => {
  Object.keys(store).forEach((key) => delete store[key])
  store.cfg_okx = JSON.stringify({ apiKey: 'key', secret: 'secret', passphrase: 'pass' })
})

describe('fetchOKXHoldings', () => {
  it('adds flexible-loan collateral as assets and the loan as a negative debt', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = decodeURIComponent(String(input))
      if (url.includes('/api/v5/account/balance')) {
        return okxResponse([{ details: [{ ccy: 'USDT', eq: '10', eqUsd: '10' }] }])
      }
      if (url.includes('/api/v5/asset/balances')) return okxResponse([])
      if (url.includes('/api/v5/finance/savings/balance')) return okxResponse([])
      if (url.includes('/api/v5/finance/flexible-loan/loan-info')) {
        return okxResponse([{
          collateralData: [{ ccy: 'BTC', amt: '0.05' }],
          loanData: [{ ccy: 'USDT', amt: '2500' }],
        }])
      }
      if (url.includes('/api/v5/market/ticker?instId=BTC-USDT')) return okxResponse([{ last: '80000' }])
      return new Response('not found', { status: 404 })
    }))

    const holdings = await fetchOKXHoldings()

    const btc = holdings.find((h) => h.symbol === 'BTC')
    expect(btc?.qty).toBe(0.05)
    expect(btc?.marketValue).toBeCloseTo(4000)
    expect(holdings.find((h) => h.symbol === 'USDT' && !h.isDebt)).toMatchObject({ qty: 10, marketValue: 10 })
    expect(holdings.find((h) => h.isDebt)).toMatchObject({ symbol: 'USDT', qty: -2500, marketValue: -2500 })
  })
})
