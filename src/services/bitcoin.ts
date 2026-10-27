// Bitcoin mainchain address balance via Blockstream Esplora (public, no API key)
// BTC addresses (bc1/1/3) are read from the Zerion walletAddresses config field.
// Price fetched from OKX public ticker (no auth required).

import { getConfig } from '../utils/storage'
import { STORAGE_KEYS } from '../config/constants'
import type { HoldingRecord } from '../types/holdings'

interface ZerionConfig {
  walletAddresses: string
}

interface BlockstreamStats {
  funded_txo_sum: number
  spent_txo_sum: number
}

interface BlockstreamAddress {
  chain_stats: BlockstreamStats
  mempool_stats: BlockstreamStats
}

function isBTCAddress(addr: string): boolean {
  return addr.startsWith('bc1') || /^[13][a-zA-Z0-9]{25,34}$/.test(addr)
}

async function fetchBTCBalanceSat(address: string): Promise<number> {
  const res = await fetch(`https://blockstream.info/api/address/${address}`)
  if (!res.ok) throw new Error(`Blockstream fetch failed for ${address}: ${res.status}`)
  const data = await res.json() as BlockstreamAddress
  const confirmed =
    data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum
  const unconfirmed =
    data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum
  return confirmed + unconfirmed
}

async function fetchBTCPrice(): Promise<number> {
  try {
    const res = await fetch('https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT')
    if (!res.ok) return 0
    const data = await res.json() as { code: string; data: Array<{ last: string }> }
    if (data.code !== '0') return 0
    return parseFloat(data.data[0]?.last ?? '0')
  } catch {
    return 0
  }
}

export async function fetchBitcoinHoldings(): Promise<HoldingRecord[]> {
  const cfg = getConfig<ZerionConfig>(STORAGE_KEYS.zerion)
  if (!cfg?.walletAddresses) return []

  const btcAddresses = cfg.walletAddresses
    .split(',')
    .map((a) => a.trim())
    .filter(isBTCAddress)

  if (btcAddresses.length === 0) return []

  const [btcPrice, ...balanceResults] = await Promise.all([
    fetchBTCPrice(),
    ...btcAddresses.map((addr) =>
      fetchBTCBalanceSat(addr)
        .then((sat) => ({ addr, sat, ok: true as const }))
        .catch(() => {
          return { addr, sat: 0, ok: false as const }
        }),
    ),
  ])

  if (btcPrice <= 0) {
    throw new Error('Bitcoin price fetch failed')
  }

  const failed = balanceResults.find((result) => !result.ok)
  if (failed) {
    throw new Error(`Bitcoin balance fetch failed for ${failed.addr}`)
  }

  const holdings: HoldingRecord[] = []

  for (const result of balanceResults) {
    if (!result.ok || result.sat === 0) continue
    const qty = result.sat / 1e8
    const marketValue = qty * btcPrice
    if (marketValue < 0.01) continue

    const short = `${result.addr.slice(0, 6)}...${result.addr.slice(-4)}`

    holdings.push({
      symbol: 'BTC',
      name: 'Bitcoin',
      qty,
      costBasis: 0,
      marketValue,
      unrealizedPL: 0,
      unrealizedPLPercent: 0,
      platform: 'bitcoin',
      type: 'crypto',
      lastUpdated: new Date().toISOString(),
      sourceWallet: short,
    })
  }

  return holdings
}
