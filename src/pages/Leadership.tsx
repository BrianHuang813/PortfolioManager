import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLeadership, leadershipBase } from '../services/leadership'
import type { LeadershipStock } from '../types/leadership'
import { LeadershipGuide } from '../components/leadership/LeadershipGuide'

const filters = ['All', 'Utility Screen', 'Established', 'Emerging', 'Resilient', 'Fading'] as const
type Filter = typeof filters[number]
const number = (value: number | null) => value == null ? '—' : value.toFixed(0)
const currency = (value: number | null) => value == null ? '—' : `$${value.toFixed(2)}`

export function Leadership() {
  const query = useQuery({ queryKey: ['leadership'], queryFn: fetchLeadership, staleTime: 300_000, retry: false })
  const [scope, setScope] = useState<'all' | 'nasdaq100'>('all')
  const [filter, setFilter] = useState<Filter>('All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [sort, setSort] = useState<'Annual_RS' | 'Utility_RS' | 'Annual_RS_Change_20D'>('Annual_RS')
  const [page, setPage] = useState(0)
  const rows = useMemo(() => {
    const matches = (row: LeadershipStock) => filter === 'All' || (filter === 'Utility Screen' ? row.Utility_Screen_Pass : row[`${filter}_Leader`] === true)
    return (query.data?.stocks ?? []).filter(row => (scope === 'all' || row.Nasdaq100 === true) && matches(row) && `${row.Ticker} ${row.Company ?? ''} ${row.Sector ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity) ||
        (b.Annual_RS_Change_20D ?? -Infinity) - (a.Annual_RS_Change_20D ?? -Infinity) ||
        (b.Annual_RS ?? -Infinity) - (a.Annual_RS ?? -Infinity) || a.Ticker.localeCompare(b.Ticker))
  }, [query.data, filter, search, sort, scope])
  const detail = query.data?.stocks.find(row => row.Ticker === selected)
  const market = query.data?.market
  const lastPage = Math.max(0, Math.ceil(rows.length / 50) - 1)
  const currentPage = Math.min(page, lastPage)

  return <div className="space-y-8">
    <div className="flex flex-wrap justify-between items-end gap-4">
      <div><p className="text-primary text-xs tracking-widest uppercase">Minervini · IBD-style RS</p>
        <h1 className="text-3xl font-display text-on-s mt-2">Leadership Engine</h1>
        <p className="text-muted mt-2 text-sm">年度強勢、修正期韌性與新興領導股觀察</p></div>
      <div className="flex gap-2">{([['all', 'S&P'], ['nasdaq100', 'Nasdaq-100']] as const).map(([value, label]) =>
        <button key={value} aria-pressed={scope === value} className={`px-4 py-2 ${scope === value ? 'bg-ch text-primary' : 'bg-cl text-muted'}`} onClick={() => { setScope(value); setPage(0) }}>{label}</button>)}</div>
      <button className="px-4 py-2 bg-ch text-primary disabled:opacity-40" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? '載入中…' : '更新資料'}</button>
    </div>
    {query.isLoading && <p role="status" className="text-muted">正在載入每日 Leadership 資料…</p>}
    {query.isError && <p role="alert" className="p-4 bg-cl text-muted">{query.error.message}</p>}
    {market && <>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['市場狀態', market.state], ['SPY 距高點', `${market.days_since_200d_high} 交易日`],
          ['Utility RS', market.utility_active ? `啟用 · ${market.utility_window} 日視窗` : '未啟用'],
          ['資料日期', market.date],
        ].map(([label, value]) => <div key={label} className="bg-cl p-4"><p className="text-muted text-xs">{label}</p><p className="text-on-s mt-2">{value}</p></div>)}
      </section>
      <p className="text-muted text-sm">股票 {query.data!.summary.universe_size.toLocaleString()} 檔 · 缺當期價格 {query.data!.summary.failed_tickers} 檔 · 品質標記 {query.data!.summary.data_quality_warnings} 檔。空值顯示「—」；首次執行尚無 RS 動能歷史。</p>
      <div className="flex flex-wrap gap-2">{filters.map(value => <button key={value} onClick={() => { setFilter(value); setPage(0); setSort(value === 'Utility Screen' || value === 'Emerging' ? 'Utility_RS' : 'Annual_RS') }} className={`px-3 py-2 text-sm ${filter === value ? 'bg-ch text-primary' : 'bg-cl text-muted'}`}>{value}</button>)}</div>
      {!market.utility_active && filter === 'Utility Screen' && <p className="text-muted">Utility Screen 目前未啟用：距市場高點須介於 10–200 個交易日。</p>}
      <div className="flex flex-wrap gap-4 items-center">
        <input aria-label="搜尋股票" placeholder="Ticker / 公司 / Sector" className="bg-cl p-2 text-on-s w-full sm:w-auto" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} />
        <label className="text-muted text-sm">排序 <select className="bg-cl p-2 text-on-s" value={sort} onChange={event => { setSort(event.target.value as typeof sort); setPage(0) }}><option value="Annual_RS">Annual RS</option><option value="Utility_RS">Utility RS</option><option value="Annual_RS_Change_20D">RS 20D Change</option></select></label>
        <a className="text-primary text-sm" href={`${leadershipBase}${filter === 'Utility Screen' ? 'utility_screen' : filter === 'Emerging' ? 'emerging_leaders' : 'leadership_stocks'}.csv`} download>下載 CSV</a>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-muted"><tr>{['Ticker', 'Price', 'Annual RS', 'Utility RS', 'Δ RS 20D', 'Trend', 'RS Line', '分類', '資料品質'].map(label => <th key={label} className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead><tbody className="text-on-s">{rows.slice(currentPage * 50, (currentPage + 1) * 50).map(row => <tr key={row.Ticker} className="border-t border-white/5">
        <td className="p-3"><button className="text-primary" onClick={() => setSelected(row.Ticker)}>{row.Ticker}</button><p className="text-muted text-xs">{row.Company}</p></td>
        <td className="p-3">{currency(row.Price)}</td><td className="p-3">{number(row.Annual_RS)}</td><td className="p-3">{number(row.Utility_RS)}</td><td className="p-3">{number(row.Annual_RS_Change_20D)}</td><td className="p-3">{row.Trend_Template_Score}/9</td><td className="p-3">{row.RS_Line_Leading_Price ? '領先價格' : row.RS_Line_New_High ? '新高' : '—'}</td>
        <td className="p-3">{(['Established', 'Emerging', 'Resilient', 'Fading'] as const).filter(label => row[`${label}_Leader`]).join(' · ') || '—'}</td><td className="p-3 text-muted text-xs">{row.data_quality_flag}</td>
      </tr>)}</tbody></table></div>
      {!rows.length && <p className="text-muted">目前沒有符合條件的股票。</p>}
      <div className="flex items-center gap-4 text-sm text-muted"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="disabled:opacity-30">上一頁</button><span>{currentPage + 1} / {lastPage + 1} · {rows.length} 檔</span><button disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)} className="disabled:opacity-30">下一頁</button></div>
    </>}
    {detail && <section className="bg-cl p-5"><div className="flex justify-between"><h2 className="text-primary">{detail.Ticker} · 原始指標與 Trend Template</h2><button className="text-muted" onClick={() => setSelected(null)}>關閉</button></div><dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">{Object.entries(detail).map(([key, value]) => <div key={key}><dt className="text-muted text-xs break-all">{key}</dt><dd className="text-on-s text-sm mt-1 break-all">{value == null ? '—' : String(value)}</dd></div>)}</dl></section>}
    <LeadershipGuide />
  </div>
}
