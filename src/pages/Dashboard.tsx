// Kinetic Ledger: Main Dashboard
//
// Asymmetric grid:
//   Left  (65%): Total Assets hero → Performance chart → Holdings table
//   Right (35%): Allocation pies → [News auto-opens as overlay]
//
// All depth via tonal layering. No box shadows. No traditional borders.
// Black space is intentional — it signals precision.

import { useAllHoldings } from '../hooks/useAllHoldings'
import { useAppStore } from '../store/useAppStore'
import { TotalAssetsCard } from '../components/dashboard/TotalAssetsCard'
import { AllocationCharts } from '../components/dashboard/AllocationCharts'
import { PerformanceChart } from '../components/dashboard/PerformanceChart'
import { TableControls } from '../components/dashboard/TableControls'
import { HoldingsTable } from '../components/dashboard/HoldingsTable'
import { NewsPanel } from '../components/dashboard/NewsPanel'

export function Dashboard() {
  const { holdings, isLoading, isFetching, snapshotRevision } = useAllHoldings()
  const futuWarning = useAppStore((s) => s.futuWarning)
  const isFirstLoad  = isLoading && holdings.length === 0

  return (
    <div className="space-y-0">

      {/* ── Warning banner ── */}
      {futuWarning && (
        <div
          className="mb-6 px-5 py-3 bg-cl font-body text-label-sm text-on-s blade-left"
          style={{ borderLeftColor: '#ea6767', borderLeftWidth: '2px' }}
        >
          {futuWarning}
        </div>
      )}

      {/* ── Background sync indicator ── */}
      {!isFirstLoad && isFetching && (
        <div className="mb-4 flex items-center gap-2 font-body text-label-sm text-muted">
          <span className="w-1.5 h-1.5 bg-gain animate-pulse" />
          Syncing data…
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ASYMMETRIC GRID — 65 / 35
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-[65fr_35fr] gap-x-0">

        {/* ── LEFT COLUMN (65%) ──────────────────────────────── */}
        <div className="xl:pr-16 space-y-12">

          {/* Hero: Total Assets */}
          <section>
            <TotalAssetsCard holdings={holdings} isLoading={isFirstLoad} />
          </section>

          {/* Performance chart — sits in cl block */}
          <section className="bg-cl px-4 md:px-6 py-5">
            <PerformanceChart snapshotRevision={snapshotRevision} />
          </section>

          {/* Holdings table section */}
          <section className="space-y-0">
            {/* Section header */}
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="font-body text-label-sm text-muted uppercase tracking-[0.12em] mb-1">
                  Positions
                </p>
                <h2 className="font-display font-bold text-display-sm text-primary leading-none">
                  Holdings
                </h2>
              </div>
            </div>

            <TableControls />
            <HoldingsTable holdings={holdings} isLoading={isFirstLoad} />
          </section>
        </div>

        {/* ── RIGHT COLUMN (35%) — Allocation ──────────────── */}
        <div className="hidden xl:block xl:pl-8 xl:border-l" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>

          {/* Sticky allocation section */}
          <div className="sticky top-20 space-y-2">
            <div className="mb-8">
              <p className="font-body text-label-sm text-muted uppercase tracking-[0.12em] mb-1">
                Allocation
              </p>
              <h2 className="font-display font-bold text-display-sm text-primary leading-none">
                Distribution
              </h2>
            </div>

            {isFirstLoad ? (
              <div className="space-y-4">
                <div className="skeleton h-40 w-full" />
                <div className="skeleton h-40 w-full" />
                <div className="skeleton h-40 w-full" />
              </div>
            ) : (
              <AllocationCharts holdings={holdings} />
            )}

            {/* Stat summary */}
            {!isFirstLoad && holdings.length > 0 && (
              <div className="mt-8 space-y-px">
                {[
                  {
                    label: 'Positions',
                    value: holdings.length.toString(),
                  },
                  {
                    label: 'Platforms',
                    value: [...new Set(holdings.map((h) => h.platform))].length.toString(),
                  },
                  {
                    label: 'Avg PnL',
                    value: `${(
                      holdings.reduce((s, h) => s + h.unrealizedPLPercent, 0) / holdings.length
                    ).toFixed(2)}%`,
                    color: (() => {
                      const avg = holdings.reduce((s, h) => s + h.unrealizedPLPercent, 0) / holdings.length
                      return avg >= 0 ? 'text-gain' : 'text-loss'
                    })(),
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-3 bg-cl"
                  >
                    <span className="font-body text-label-sm text-muted uppercase tracking-[0.06em]">
                      {stat.label}
                    </span>
                    <span className={`font-body font-semibold text-label-lg tabular-nums ${stat.color ?? 'text-primary'}`}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* News drawer overlay */}
      <NewsPanel />
    </div>
  )
}
