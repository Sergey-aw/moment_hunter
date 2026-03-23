import { Trophy, UserRound, WavesLadder } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'
import { useAuthSession } from '../hooks/useAuthSession'
import { supabase } from '../lib/supabase'

const navItems = [
  { to: '/', label: 'Matches', icon: WavesLadder },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

export function AppShell() {
  const { session } = useAuthSession()

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-8">
        <header className="mb-6 rounded-2xl border border-slate-700/60 bg-slate-900/60 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase text-emerald-300">Live Prediction Arena</p>
              <h1 className="mt-1 text-xl font-semibold">Moment Hunter</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="max-w-48 truncate text-xs text-slate-300 sm:text-sm">{session?.user.email}</span>
              <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
                Sign out
              </Button>
            </div>
          </div>

          <nav className="mt-4 hidden gap-2 lg:flex">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition',
                      isActive ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </header>

        <Outlet />
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-20 rounded-xl border border-slate-700/80 bg-slate-900/90 p-2 shadow-xl backdrop-blur lg:hidden">
        <div className="grid grid-cols-3 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs transition',
                    isActive ? 'bg-emerald-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </main>
  )
}
