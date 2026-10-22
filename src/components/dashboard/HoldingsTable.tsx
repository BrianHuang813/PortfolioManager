// Kinetic Ledger: holdings table
// No row dividers — alternating cl/cll tonal layers.
// Sort headers use blade-top on active. Naked data PnL.

import { useMemo, useCallback } from 'react'
import { useAppStore, type SortKey } from '../../store/useAppStore'
import { TABLE_PAGE_SIZE } from '../../config/constants'
import type { HoldingRecord, Platform } from '../../types/holdings'

interface Props { holdings: HoldingRecord[]; isLoading: boolean }

const fmtUSD = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2,
})
const fmtCompact = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
})

const COLS: Array<{ key: SortKey; label: string; right?: boolean }> = [
  { key: 'symbol',             label: 'Symbol' },
  { key: 'platform',           label: 'Platform' },
  { key: 'qty',                label: 'Qty',       right: true },
  { key: 'costBasis',          label: 'Avg Cost',  right: true },
  { key: 'marketValue',        label: 'Value',     right: true },
  { key: 'unrealizedPLPercent',label: 'PnL %',     right: true },
  { key: 'allocationPct',      label: 'Alloc %',   right: true },
]

function SkeletonRow() {
  return (
    <tr className="bg-cl">
      {COLS.map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-3 w-full" />
        </td>
      ))}
    </tr>
  )
}

export function HoldingsTable({ holdings, isLoading }: Props) {
  const { tableFilters, sortConfig, setSort, tablePage, setTablePage, setSelectedSymbol } =
    useAppStore((s) => ({
      tableFilters:     s.tableFilters,
      sortConfig:       s.sortConfig,
      setSort:          s.setSort,
      tablePage:        s.tablePage,
      setTablePage:     s.setTablePage,
      setSelectedSymbol: s.setSelectedSymbol,
    }))

  // Totals from full unfiltered holdings for allocation % calculation
  const typeTotals = useMemo(() => {
    const stock  = holdings.filter(h => h.type === 'stock').reduce((s, h) => s + h.marketValue, 0)
    const crypto = holdings.filter(h => h.type === 'crypto').reduce((s, h) => s + h.marketValue, 0)
    return { stock, crypto }
  }, [holdings])

  const allocPct = useCallback((h: HoldingRecord) => {
    const total = h.type === 'stock' ? typeTotals.stock : typeTotals.crypto
    return total > 0 ? (h.marketValue / total) * 100 : 0
  }, [typeTotals])

  const filtered = useMemo(() => {
    let rows = holdings.filter((h) => Math.abs(h.marketValue) >= 10)
    const q = tableFilters.search.toLowerCase()
    if (q) rows = rows.filter((h) =>
      h.symbol.toLowerCase().includes(q) || h.name.toLowerCase().includes(q))
    if (tableFilters.type !== 'all') rows = rows.filter((h) => h.type === tableFilters.type)
    if (tableFilters.platform !== 'all') rows = rows.filter((h) =>
      h.platforms ? h.platforms.includes(tableFilters.platform as Platform) : h.platform === tableFilters.platform)
    return rows
  }, [holdings, tableFilters])

  const sorted = useMemo(() => {
    const { key, direction } = sortConfig
    return [...filtered].sort((a, b) => {
      const av = key === 'allocationPct' ? allocPct(a) : (a as unknown as Record<string, unknown>)[key]
      const bv = key === 'allocationPct' ? allocPct(b) : (b as unknown as Record<string, unknown>)[key]
      if (typeof av === 'number' && typeof bv === 'number')
        return direction === 'asc' ? av - bv : bv - av
      return direction === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [filtered, sortConfig, allocPct])

  const totalPages = Math.ceil(sorted.length / TABLE_PAGE_SIZE)
  const page = Math.min(tablePage, Math.max(0, totalPages - 1))
  const rows = sorted.slice(page * TABLE_PAGE_SIZE, (page + 1) * TABLE_PAGE_SIZE)

  const handleClick = useCallback(
    (h: HoldingRecord) => setSelectedSymbol(h.symbol, h.type),
    [setSelectedSymbol],
  )

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-y-px">
          {/* Header */}
          <thead>
            <tr>
              {COLS.map((col) => {
                const active = sortConfig.key === col.key
                return (
                  <th
                    key={col.key}
                    onClick={() => setSort(col.key)}
                    className={`
                      px-4 py-2.5 font-body text-label-sm uppercase tracking-[0.08em] cursor-pointer select-none
                      ${col.right ? 'text-right' : 'text-left'}
                      ${active ? 'text-primary blade-top' : 'text-muted hover:text-on-s'}
                    `}
                    style={{
                      borderTop: active ? '1px solid #919191' : '1px solid transparent',
                      transition: 'none',
                    }}
                  >
                    {col.label}
                    {active && (
                      <span className="ml-1 text-[0.7em]">
                        {sortConfig.direction === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {isLoading && holdings.length === 0
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : rows.length === 0
              ? (
                <tr>
                  <td colSpan={COLS.length} className="px-4 py-10 text-center font-body text-label-md text-muted italic">
                    No holdings match current filters
                  </td>
                </tr>
              )
              : rows.map((h, i) => {
                const up = h.unrealizedPL >= 0
                const pnlColor = h.unrealizedPL === 0 ? 'text-muted' : up ? 'text-gain' : 'text-loss'
                const rowBg = i % 2 === 0 ? 'bg-cll' : 'bg-cl'

                return (
                  <tr
                    key={`${h.platform}-${h.symbol}-${i}`}
                    onClick={() => handleClick(h)}
                    className={`${rowBg} hover:bg-ch cursor-pointer group`}
                    style={{ transition: 'none' }}
                  >
                    {/* Symbol */}
                    <td className="px-4 py-3">
                      <div className="font-body font-semibold text-primary text-label-lg group-hover:text-gain" style={{ transition: 'none' }}>
                        {h.symbol}
                        {h.isDebt && (
                          <span className="ml-2 font-body text-label-sm text-loss uppercase tracking-[0.06em]">Loan</span>
                        )}
                      </div>
                      <div className="font-body text-label-sm text-muted truncate max-w-[10rem]">
                        {h.name}
                      </div>
                    </td>

                    {/* Platform */}
                    <td className="px-4 py-3">
                      <span className="font-body text-label-sm text-muted uppercase tracking-[0.06em]">
                        {(h.platforms ?? [h.platform]).join(', ')}
                      </span>
                    </td>

                    {/* Qty */}
                    <td className="px-4 py-3 text-right font-body text-label-md text-on-s tabular-nums">
                      {Math.abs(h.qty) < 1 ? h.qty.toFixed(4) : h.qty.toFixed(2)}
                    </td>

                    {/* Avg Cost */}
                    <td className="px-4 py-3 text-right font-body text-label-md text-muted tabular-nums">
                      {h.type === 'stock' && h.costBasis > 0 ? fmtUSD.format(h.costBasis) : '-'}
                    </td>

                    {/* Market Value */}
                    <td className={`px-4 py-3 text-right font-body font-semibold text-label-md tabular-nums ${h.isDebt ? 'text-loss' : 'text-primary'}`}>
                      {h.marketValue > 999_999 ? fmtCompact.format(h.marketValue) : fmtUSD.format(h.marketValue)}
                    </td>

                    {/* PnL % — naked data */}
                    <td className={`px-4 py-3 text-right font-body font-semibold text-label-md tabular-nums ${pnlColor}`}>
                      {up && h.unrealizedPL !== 0 ? '+' : ''}{h.unrealizedPLPercent.toFixed(2)}%
                    </td>

                    {/* Alloc % — share of total stock or crypto */}
                    <td className="px-4 py-3 text-right font-body text-label-md text-muted tabular-nums">
                      {allocPct(h).toFixed(1)}%
                    </td>
                  </tr>
                )
              })
            }
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 blade-top" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <span className="font-body text-label-sm text-muted">
            {sorted.length} positions · p{page + 1}/{totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTablePage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-1.5 font-body text-label-sm bg-chh text-primary disabled:opacity-20 hover:bg-ch"
              style={{ transition: 'none' }}
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setTablePage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-1.5 font-body text-label-sm bg-chh text-primary disabled:opacity-20 hover:bg-ch"
              style={{ transition: 'none' }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
