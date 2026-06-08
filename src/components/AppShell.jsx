import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Calculator, Moon, Sun, Trophy, UserRound } from 'lucide-react'
import { BRANCHES } from '../utils/semesterData'
import { useStore } from '../store/useStore'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/calculator', label: 'Calculator', icon: Calculator },
  { to: '/analysis', label: 'Results', icon: BarChart3 },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
]

export default function AppShell() {
  const branch = useStore((state) => state.branch)
  const setBranch = useStore((state) => state.setBranch)
  const theme = useStore((state) => state.theme)
  const setTheme = useStore((state) => state.setTheme)
  const { user } = useAuth()
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)

  useEffect(() => {
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <NavLink to="/calculator" className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-amber-400/35 bg-amber-400/15 font-mono font-bold text-amber-200">
              TG
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold text-white">TCET GradeCalc</p>
              <p className="truncate text-xs text-slate-400">CBCGS-HME 2023</p>
            </div>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <TopNavLink key={item.to} item={item} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className={`hidden sm:inline-flex status-pill ${user ? 'status-success' : 'status-muted'}`}>
              {user ? 'Signed in' : 'Guest'}
            </span>
            <select className="select-input h-10 w-28 py-0 text-sm" value={branch} onChange={(event) => setBranch(event.target.value)}>
              {BRANCHES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {offline && (
          <div className="mb-4 rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            You are offline. Changes are saved locally and will sync when connected.
          </div>
        )}
        <Outlet />
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-24 pt-4 text-sm text-slate-400 md:pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p>Unofficial TCET SGPA calculator based on CBCGS-HME 2023 grading rules. Not officially affiliated with TCET. v1.0.0</p>
          <div className="flex flex-wrap gap-3">
            <NavLink className="hover:text-white" to="/privacy">
              Privacy
            </NavLink>
            <NavLink className="hover:text-white" to="/disclaimer">
              Disclaimer
            </NavLink>
            <NavLink className="hover:text-white" to="/debug/subjects">
              Subject Debug
            </NavLink>
          </div>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/95 px-2 py-2 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-4 gap-1">
          {navItems.map((item) => (
            <BottomNavLink key={item.to} item={item} />
          ))}
        </div>
      </nav>
    </div>
  )
}

function TopNavLink({ item }) {
  const Icon = item.icon

  return (
    <NavLink
      className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
      to={item.to}
    >
      <Icon className="size-4" />
      {item.label}
    </NavLink>
  )
}

function BottomNavLink({ item }) {
  const Icon = item.icon

  return (
    <NavLink
      className={({ isActive }) => `bottom-nav-link ${isActive ? 'bottom-nav-link-active' : ''}`}
      to={item.to}
    >
      <Icon className="size-4" />
      <span>{item.label}</span>
    </NavLink>
  )
}
