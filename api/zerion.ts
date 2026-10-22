// Vercel Serverless Proxy — forwards Zerion API requests server-side
// Bypasses CORS restriction that blocks direct browser requests to api.zerion.io
// Called by frontend as: POST /api/zerion with address and encoded credential.
// The proxy builds the Zerion-compatible HTTP Basic Authorization header.

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — allow requests from any origin (this is our own proxy)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = typeof req.body === 'string'
    ? JSON.parse(req.body) as unknown
    : req.body as unknown
  const address = isRequestBody(body) ? body.address : undefined
  const credential = isRequestBody(body) ? body.credential : undefined

  if (!address) {
    return res.status(400).json({ error: 'Missing wallet address' })
  }
  if (!credential) {
    return res.status(400).json({ error: 'Missing Zerion credential' })
  }

  // no_filter: wallet tokens plus DeFi protocol positions (deposits, loans, staking)
  const url  = `https://api.zerion.io/v1/wallets/${address}/positions/?filter[positions]=no_filter&currency=usd&filter[trash]=only_non_trash&sort=-value`

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Basic ${credential}`,
        Accept: 'application/json',
      },
    })
    const data = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch (err) {
    return res.status(502).json({ error: 'Upstream Zerion request failed', detail: String(err) })
  }
}

function isRequestBody(value: unknown): value is {
  address?: string
  credential?: string
} {
  return typeof value === 'object' && value !== null
}
