import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'
import { useAllHoldings } from '../../hooks/useAllHoldings'

export function AppShell() {
  const { isFetching, refetch } = useAllHoldings()
  return (
    <div className="min-h-screen bg-surface text-primary font-body">
      <NavBar onRefresh={() => void refetch()} isFetching={isFetching} />
      <main className="max-w-screen-xl mx-auto px-4 md:px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
