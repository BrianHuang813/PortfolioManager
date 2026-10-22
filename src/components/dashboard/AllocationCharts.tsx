// Kinetic Ledger: allocation pie — dark, no stroke, gain/loss palette

import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { HoldingRecord } from '../../types/holdings'

// Kinetic palette — stark, no pastels
const PALETTE = [
  '#4bdfa4', '#ea6767', '#FFFFFF', '#919191',
  '#2d8c68', '#9e3f3f', '#c8c8c8', '#555555',
  '#7fffd4', '#ff9999',
]

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
})

interface Props { holdings: HoldingRecord[] }

// Custom label outside the slice
const RADIAN = Math.PI / 180
function CustomLabel({ cx, cy, midAngle, outerRadius, name, percent }: {
  cx: number; cy: number; midAngle: number; outerRadius: number; name: string; percent: number
}) {
  if (percent < 0.06) return null
  const r = outerRadius + 20
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text
      x={x} y={y}
      fill="#919191"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      style={{ fontSize: 10, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.06em' }}
    >
      {name} {(percent * 100).toFixed(0)}%
    </text>
  )
}

export function AllocationCharts({ holdings }: Props) {
  const allocationBySymbol = (assetType?: HoldingRecord['type']) => {
    const t: Record<string, number> = {}
    holdings
      // Pies show what is held; borrowed amounts (negative) would break the slices
      .filter((h) => !h.isDebt && (!assetType || h.type === assetType))
      .forEach((h) => { t[h.symbol] = (t[h.symbol] ?? 0) + h.marketValue })
    const sorted = Object.entries(t).sort(([, a], [, b]) => b - a)
    const top = sorted.slice(0, 9).map(([name, value]) => ({ name, value }))
    const rest = sorted.slice(9).reduce((s, [, v]) => s + v, 0)
    if (rest > 0) top.push({ name: 'Other', value: rest })
    return top
  }

  const stockData = useMemo(() => allocationBySymbol('stock'), [holdings])
  const cryptoData = useMemo(() => allocationBySymbol('crypto'), [holdings])
  const totalData = useMemo(() => allocationBySymbol(), [holdings])

  if (holdings.length === 0) return null

  const tooltipStyle = {
    background: '#1b1b1b',
    border: 'none',
    borderLeft: '2px solid #4bdfa4',
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#e2e2e2',
    padding: '8px 12px',
  }

  const AllocationPie = ({ title, data }: { title: string; data: { name: string; value: number }[] }) => (
    <div>
      <p className="font-body text-label-sm text-muted uppercase tracking-[0.1em] mb-4">
        {title}
      </p>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={55} outerRadius={75}
              dataKey="value"
              strokeWidth={0}
              label={(p) => <CustomLabel {...p} />}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]!} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [USD.format(v), '']}
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#4bdfa4' }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[200px] items-center justify-center bg-cll font-body text-label-sm text-muted">
          No positions
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-8">
      <AllocationPie title="Stock Allocation" data={stockData} />
      <AllocationPie title="Crypto Allocation" data={cryptoData} />
      <AllocationPie title="All Asset Allocation" data={totalData} />
    </div>
  )
}
