// Kinetic Ledger NavBar — cll background, stark contrast, no border bottom
// Depth via tonal difference: nav=#0e0e0e vs page=#131313

import { NavLink } from 'react-router-dom'
import { PlatformBadge } from './PlatformBadge'
import type { Platform } from '../../types/holdings'

const PLATFORMS: Platform[] = ['schwab', 'okx', 'zerion', 'futu']

interface NavBarProps {
  onRefresh: () => void
  isFetching: boolean
}

const NAV_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/leadership', label: 'Leadership' },
  { to: '/position-management', label: 'Positions' },
  { to: '/settings', label: 'Settings' },
]

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1 font-body text-label-md uppercase tracking-[0.06em] whitespace-nowrap ${
    isActive
      ? 'text-primary bg-ch'
      : 'text-muted hover:text-on-s hover:bg-cl'
  }`

export function NavBar({ onRefresh, isFetching }: NavBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-cll" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 flex items-center justify-between h-12">

        {/* Wordmark */}
        <div className="flex items-center gap-4 md:gap-8">
          <span className="font-display font-800 text-[0.9rem] tracking-[0.12em] uppercase text-primary">
            Ledger
          </span>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'} className={navLinkClass} style={{ transition: 'none' }}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: platform status + refresh */}
        <div className="flex items-center gap-5">
          <div className="hidden lg:flex items-center gap-4">
            {PLATFORMS.map((p) => (
              <PlatformBadge key={p} platform={p} />
            ))}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-1 bg-chh text-primary font-body text-label-md uppercase tracking-[0.06em] disabled:opacity-30 hover:bg-ch blade-left-gain"
            style={{ transition: 'none' }}
          >
            <svg
              className={`w-3 h-3 flex-shrink-0 ${isFetching ? 'animate-spin' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="square" strokeLinejoin="miter"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isFetching ? 'Syncing' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Phones: links move to their own horizontally scrollable row */}
      <nav className="md:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2">
        {NAV_LINKS.map(({ to, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className={navLinkClass} style={{ transition: 'none' }}>
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
