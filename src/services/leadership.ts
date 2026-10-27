import type { LeadershipSnapshot } from '../types/leadership'

export const leadershipBase = `${import.meta.env.BASE_URL}leadership/`

export async function fetchLeadership(): Promise<LeadershipSnapshot> {
  const response = await fetch(`${leadershipBase}latest.json`, { cache: 'no-cache' })
  if (response.status === 404) throw new Error('尚無每日資料。請先執行 Leadership 管線並將結果隨網站部署。')
  if (!response.ok) throw new Error(`Leadership 資料載入失敗 (${response.status})`)
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('Leadership 資料格式錯誤，請重新產生每日結果。') }
  if (!payload || typeof payload !== 'object' || !('market' in payload) || !('stocks' in payload) || !('summary' in payload)) {
    throw new Error('Leadership 資料格式錯誤，請重新產生每日結果。')
  }
  const snapshot = payload as LeadershipSnapshot
  if (!snapshot.market?.date || !Array.isArray(snapshot.stocks) || !snapshot.summary) {
    throw new Error('Leadership 資料格式錯誤，請重新產生每日結果。')
  }
  return snapshot
}
