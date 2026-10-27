// Spec: F2.5, T13 — orchestrates all 4 platform fetches via Promise.allSettled
// Updates Zustand platformStatus per result; saves JSONL snapshot on success.

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { fetchSchwabHoldings } from '../services/schwab'
import { fetchOKXHoldings } from '../services/okx'
import { fetchZerionHoldings } from '../services/zerion'
import { fetchFutuHoldings, FUTU_NOT_CONFIGURED } from '../services/futu'
import { fetchBitcoinHoldings } from '../services/bitcoin'
import { saveSnapshot } from '../utils/snapshot'
import { loadCachedHoldings, saveCachedHoldings } from '../utils/holdingsCache'
import { mergeAliasHoldings } from '../utils/mergeAliasHoldings'
import { filterSmallHoldings } from '../utils/filterSmallHoldings'
import { useAppStore } from '../store/useAppStore'
import { REFRESH_INTERVAL_MS } from '../config/constants'
import type { HoldingRecord, Platform } from '../types/holdings'

interface FetchResult {
  holdings: HoldingRecord[]
  platformErrors: Partial<Record<Platform, string>>
  futuWarning: string | null
  canSaveSnapshot: boolean
}

async function fetchAllHoldings(): Promise<FetchResult> {
  const [schwabResult, okxResult, zerionResult, futuResult, bitcoinResult] = await Promise.allSettled([
    fetchSchwabHoldings(),
    fetchOKXHoldings(),
    fetchZerionHoldings(),
    fetchFutuHoldings(),
    fetchBitcoinHoldings(),
  ])

  const holdings: HoldingRecord[] = []
  const platformErrors: Partial<Record<Platform, string>> = {}
  let futuWarning: string | null = null
  let canSaveSnapshot = true

  const collect = (
    platform: Platform,
    result: PromiseSettledResult<HoldingRecord[]>,
  ) => {
    if (result.status === 'fulfilled') {
      holdings.push(...result.value)
      saveCachedHoldings(platform, result.value)
      return
    }

    platformErrors[platform] = result.reason instanceof Error
      ? result.reason.message
      : String(result.reason)
    const cached = loadCachedHoldings(platform)
    if (cached) {
      holdings.push(...cached)
    } else {
      canSaveSnapshot = false
    }
  }

  collect('schwab', schwabResult)
  collect('okx', okxResult)
  collect('zerion', zerionResult)

  if (futuResult.status === 'fulfilled') {
    futuWarning = futuResult.value.warning
    const fetchFailure = futuWarning !== null
      && !futuWarning.startsWith(FUTU_NOT_CONFIGURED)
      ? futuWarning
      : null

    if (fetchFailure) {
      platformErrors.futu = fetchFailure
      const cached = loadCachedHoldings('futu')
      if (cached) {
        holdings.push(...cached)
      } else {
        canSaveSnapshot = false
      }
    } else {
      holdings.push(...futuResult.value.holdings)
      saveCachedHoldings('futu', futuResult.value.holdings)
    }
  } else {
    collect('futu', futuResult)
  }

  collect('bitcoin', bitcoinResult)

  return {
    holdings: filterSmallHoldings(mergeAliasHoldings(holdings)),
    platformErrors,
    futuWarning,
    canSaveSnapshot,
  }
}

export function useAllHoldings() {
  const setPlatformStatus = useAppStore((s) => s.setPlatformStatus)
  const setFutuWarning = useAppStore((s) => s.setFutuWarning)
  const [snapshotRevision, setSnapshotRevision] = useState(0)

  // Set all platforms to loading before fetch
  const query = useQuery<FetchResult>({
    queryKey: ['holdings'],
    queryFn: fetchAllHoldings,
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: REFRESH_INTERVAL_MS,
    retry: 2,
  })

  useEffect(() => {
    if (query.isFetching) {
      const platforms: Platform[] = ['schwab', 'okx', 'zerion', 'futu', 'bitcoin']
      platforms.forEach((p) => setPlatformStatus(p, { status: 'loading', errorMessage: null }))
    }
  }, [query.isFetching, setPlatformStatus])

  useEffect(() => {
    if (!query.data) return
    const now = new Date().toISOString()
    const { platformErrors, futuWarning } = query.data
    const platforms: Platform[] = ['schwab', 'okx', 'zerion', 'futu', 'bitcoin']

    platforms.forEach((p) => {
      if (platformErrors[p]) {
        setPlatformStatus(p, { status: 'error', errorMessage: platformErrors[p]! })
      } else {
        setPlatformStatus(p, { status: 'success', lastUpdated: now, errorMessage: null })
      }
    })

    setFutuWarning(futuWarning)

    // Save daily snapshot
    const total = query.data.holdings.reduce((sum, h) => sum + h.marketValue, 0)
    if (total > 0 && query.data.canSaveSnapshot) {
      saveSnapshot(total)
      setSnapshotRevision((revision) => revision + 1)
    }
  }, [query.data, setPlatformStatus, setFutuWarning])

  return {
    holdings: query.data?.holdings ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
    dataUpdatedAt: query.dataUpdatedAt,
    snapshotRevision,
  }
}
