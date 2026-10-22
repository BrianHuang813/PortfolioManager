// Zerion positions — routes through /api/zerion Vercel proxy to avoid CORS
// API key is encoded for Zerion Basic Auth and sent to our proxy in a JSON body.

import { getConfig } from '../utils/storage'
import { normalizeZerion, type ZerionPosition } from '../utils/normalize'
import { STORAGE_KEYS } from '../config/constants'
import type { HoldingRecord } from '../types/holdings'

interface ZerionConfig {
  apiKey: string
  walletAddresses: string
  aaveAppBalance?: string  // USD, entered manually from the Aave App
}

interface ZerionResponse {
  data: ZerionPosition[]
}

async function fetchWalletPositions(
  address: string,
  apiKey: string,
): Promise<ZerionPosition[]> {
  // Always use the server-side proxy — avoids CORS regardless of environment
  const credential = btoa(`${apiKey}:`)

  const res = await fetch('/api/zerion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address, credential }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(
      `Zerion fetch failed for ${address}: ${res.status}${detail ? ` ${detail}` : ''}`,
    )
  }
  const data = await res.json() as ZerionResponse
  return data.data ?? []
}

// Aave App savings — entered manually because the app's Stable Vault leaves no
// token in the user's smart account for Zerion to read
function aaveAppHolding(balance: string | undefined): HoldingRecord[] {
  const value = parseFloat(balance ?? '')
  if (!(value > 0)) return []
  return [{
    symbol: 'USD',
    name: 'Aave App',
    qty: value,
    costBasis: 0,
    marketValue: value,
    unrealizedPL: 0,
    unrealizedPLPercent: 0,
    platform: 'zerion',
    type: 'crypto',
    lastUpdated: new Date().toISOString(),
  }]
}

export async function fetchZerionHoldings(): Promise<HoldingRecord[]> {
  const cfg = getConfig<ZerionConfig>(STORAGE_KEYS.zerion)
  if (!cfg) return []
  const aaveApp = aaveAppHolding(cfg.aaveAppBalance)
  if (!cfg.apiKey || !cfg.walletAddresses) return aaveApp
  const apiKey = cfg.apiKey.trim()
  if (!apiKey) return aaveApp

  const addresses = cfg.walletAddresses
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
    // Zerion only supports EVM addresses (0x...) — skip Bitcoin/Solana native addresses
    .filter((a) => {
      if (!a.startsWith('0x')) {
        console.log(`[Zerion] skipping non-EVM address: ${a.slice(0, 12)}…`)
        return false
      }
      return true
    })

  if (addresses.length === 0) return aaveApp

  // Fetch sequentially to avoid hitting Zerion rate limits (429)
  const results: PromiseSettledResult<ZerionPosition[]>[] = []
  for (let i = 0; i < addresses.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 600)) // 600ms between requests
    results.push(await Promise.resolve().then(() =>
      fetchWalletPositions(addresses[i]!, apiKey)
        .then((v) => ({ status: 'fulfilled' as const, value: v }))
        .catch((e) => ({ status: 'rejected' as const, reason: e })),
    ))
  }

  const failed = results.find((result) => result.status === 'rejected')
  if (failed?.status === 'rejected') {
    throw failed.reason instanceof Error
      ? failed.reason
      : new Error(String(failed.reason))
  }

  const holdings: HoldingRecord[] = []
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      result.value
        .filter((p) => !p.attributes.flags.is_spam)
        .filter((p) => Math.abs(p.attributes.value ?? 0) > 0.01)
        .forEach((p) => holdings.push(normalizeZerion(p, addresses[i]!)))
    }
  })

  return [...holdings, ...aaveApp]
}
