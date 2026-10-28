// Kinetic Ledger: Hero total assets — display-lg Manrope, naked data, no card border

import { useMemo } from 'react'
import { loadSnapshots } from '../../utils/snapshot'
import { TrendIndicator } from '../ui/TrendIndicator'
import type { HoldingRecord } from '../../types/holdings'

interface Props {
  holdings: HoldingRecord[]
  isLoading: boolean
}

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})

export function TotalAssetsCard({ holdings, isLoading }: Props) {
  const total = useMemo(
    () => holdings.reduce((s, h) => s + h.marketValue, 0),
    [holdings],
  )

  const { todayDelta, todayPct, weekDelta, weekPct } = useMemo(() => {
    const snaps = loadSnapshots()
    const today = new Date().toISOString().slice(0, 10)

    const nearest = (daysAgo: number) => {
      const d = new Date()
      d.setDate(d.getDate() - daysAgo)
      const target = d.toISOString().slice(0, 10)
      return snaps.filter((s) => s.date <= target && s.date !== today).at(-1) ?? null
    }

    const prev1 = nearest(1)
    const prev7 = nearest(7)

    const todayDelta = prev1 ? total - prev1.totalValue : 0
    const todayPct   = prev1 && prev1.totalValue > 0 ? (todayDelta / prev1.totalValue) * 100 : null
    const weekDelta  = prev7 ? total - prev7.totalValue : 0
    const weekPct    = prev7 && prev7.totalValue > 0 ? (weekDelta / prev7.totalValue) * 100 : null

    return { todayDelta, todayPct, weekDelta, weekPct }
  }, [total])

  if (isLoading) {
    return (
      <div className="py-6 space-y-4">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-14 w-72" />
        <div className="flex gap-8">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-4 w-32" />
        </div>
      </div>
    )
  }

  // Split the formatted value at the decimal for typographic emphasis
  const [whole, decimal] = fmt.format(total).split('.')

  return (
    <div className="py-6 animate-data-up">
      {/* Label */}
      <p className="font-body text-label-sm text-muted uppercase tracking-[0.12em] mb-4">
        Total Portfolio Value
      </p>

      {/* Hero number */}
      <div className="flex items-end gap-2 mb-6">
        <span className="font-display text-display-md sm:text-display-lg text-primary tabular-nums leading-none">
          {whole}
        </span>
        <span className="font-display text-display-sm text-muted tabular-nums leading-none mb-1">
          .{decimal}
        </span>
      </div>

      {/* Delta row */}
      <div className="flex flex-wrap gap-8">
        <div>
          <p className="font-body text-label-sm text-muted uppercase tracking-[0.08em] mb-1">
            Today
          </p>
          {todayDelta !== 0 || todayPct !== null ? (
            <TrendIndicator value={todayDelta} percent={todayPct ?? undefined} size="md" />
          ) : (
            <span className="font-body text-label-lg text-muted">—</span>
          )}
        </div>
        <div className="blade-left pl-8" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="font-body text-label-sm text-muted uppercase tracking-[0.08em] mb-1">
            7 Days
          </p>
          {weekDelta !== 0 || weekPct !== null ? (
            <TrendIndicator value={weekDelta} percent={weekPct ?? undefined} size="md" />
          ) : (
            <span className="font-body text-label-lg text-muted">—</span>
          )}
        </div>
      </div>
    </div>
  )
}
