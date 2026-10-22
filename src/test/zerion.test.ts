import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchZerionHoldings } from '../services/zerion'

const store: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
})

beforeEach(() => {
  Object.keys(store).forEach((key) => delete store[key])
  store.cfg_zerion = JSON.stringify({
    apiKey: ' test-api-key ',
    walletAddresses: '0x1234567890abcdef',
  })
})

describe('fetchZerionHoldings', () => {
  it('sends the encoded Basic credential in the proxy request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)

    await fetchZerionHoldings()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/zerion',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: '0x1234567890abcdef',
          credential: btoa('test-api-key:'),
        }),
      },
    )
  })

  it('includes a protocol loan as a negative holding', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [{
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
      }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const holdings = await fetchZerionHoldings()

    expect(holdings).toHaveLength(1)
    expect(holdings[0]).toMatchObject({ symbol: 'USDC', marketValue: -500, isDebt: true })
  })

  it('adds the manually entered Aave App balance as a USD holding', async () => {
    store.cfg_zerion = JSON.stringify({
      apiKey: 'test-api-key',
      walletAddresses: '',
      aaveAppBalance: '2439.25',
    })
    vi.stubGlobal('fetch', vi.fn())

    const holdings = await fetchZerionHoldings()

    expect(holdings).toHaveLength(1)
    expect(holdings[0]).toMatchObject({
      symbol: 'USD',
      name: 'Aave App',
      qty: 2439.25,
      marketValue: 2439.25,
      platform: 'zerion',
      type: 'crypto',
    })
  })

  it('adds no Aave App holding when no balance is entered', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    expect(await fetchZerionHoldings()).toEqual([])
  })

  it('includes the proxy response when authentication fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'Missing Zerion credential' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )))

    await expect(fetchZerionHoldings()).rejects.toThrow(
      '400 {"error":"Missing Zerion credential"}',
    )
  })
})
