import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Leadership } from '../pages/Leadership'
import { fetchLeadership } from '../services/leadership'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Leadership daily data', () => {
  it('reports missing generated data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 404, ok: false }))
    await expect(fetchLeadership()).rejects.toThrow('尚無每日資料')
  })

  it('filters to Nasdaq-100 members without changing their market-wide RS', async () => {
    const stock = (Ticker: string, Nasdaq100: boolean) => ({ Ticker, Company: `${Ticker} Co`, Price: 100, Annual_RS: 90, Utility_RS: null, Annual_RS_Change_20D: null, Trend_Template_Score: 9, Established_Leader: false, Utility_Screen_Pass: false, Nasdaq100, data_quality_flag: 'OK' })
    const snapshot = {
      market: { date: '2026-10-01', state: 'NORMAL', days_since_200d_high: 5, utility_active: false, utility_window: null },
      summary: { universe_size: 2, failed_tickers: 0, data_quality_warnings: 0 },
      stocks: [stock('NDXA', true), stock('NYSEB', false)],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => snapshot }))
    render(<QueryClientProvider client={new QueryClient()}><Leadership /></QueryClientProvider>)
    expect(await screen.findByText('NYSEB')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nasdaq-100' }))
    expect(screen.getByText('NDXA')).toBeInTheDocument()
    expect(screen.queryByText('NYSEB')).not.toBeInTheDocument()
  })

  it('rejects SPA fallback HTML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => { throw new SyntaxError() } }))
    await expect(fetchLeadership()).rejects.toThrow('格式錯誤')
  })

  it('displays nulls and explains inactive Utility screening', async () => {
    const snapshot = {
      market: { date: '2026-10-01', state: 'NORMAL', days_since_200d_high: 5, utility_active: false, utility_window: null },
      summary: { universe_size: 1, failed_tickers: 0, data_quality_warnings: 0 },
      stocks: [{ Ticker: 'TEST', Company: 'Test Company', Price: 100, Annual_RS: 95, Utility_RS: null, Annual_RS_Change_20D: null, Trend_Template_Score: 9, Established_Leader: true, Utility_Screen_Pass: false, data_quality_flag: 'OK' }],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => snapshot }))
    render(<QueryClientProvider client={new QueryClient()}><Leadership /></QueryClientProvider>)
    expect(await screen.findByText('TEST')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    fireEvent.click(screen.getByText('Utility Screen'))
    expect(screen.getByText(/須介於 10–200/)).toBeInTheDocument()
    expect(screen.queryByText('TEST')).not.toBeInTheDocument()
  })
})
