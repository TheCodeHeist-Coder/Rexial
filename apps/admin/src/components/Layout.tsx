import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BiBarChartAlt2, BiBroadcast, BiGridAlt, BiListUl, BiLogOut, BiMenu, BiUser } from 'react-icons/bi'
import { auth } from '../lib/api'

const NAV = [
  { to: '/', label: 'Overview', icon: BiGridAlt, end: true },
  { to: '/sessions', label: 'Sessions', icon: BiBroadcast },
  { to: '/quizzes', label: 'Quizzes', icon: BiListUl },
  { to: '/users', label: 'Users', icon: BiUser },
  { to: '/traffic', label: 'API traffic', icon: BiBarChartAlt2 },
]

export default function Layout() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const logout = () => {
    auth.clear()
    navigate('/login')
  }

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-white/8 text-ink' : 'text-ink-3 hover:bg-white/4 hover:text-ink-2'}`
          }
        >
          <Icon className="size-4.5" />
          {label}
        </NavLink>
      ))}
    </nav>
  )

  const brand = (
    <div className="flex items-center gap-2 px-3">
      <span className="grid size-7 place-items-center rounded-lg bg-accent text-sm font-bold text-white">R</span>
      <span className="font-semibold">Rexial</span>
      <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-3">Admin</span>
    </div>
  )

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-56 shrink-0 flex-col gap-6 border-r border-line bg-panel/50 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        {brand}
        <div className="flex-1 px-2">{nav}</div>
        <div className="px-2">
          <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-3 hover:bg-white/4 hover:text-ink-2">
            <BiLogOut className="size-4.5" /> Sign out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        {brand}
        <button onClick={() => setOpen((o) => !o)} aria-label="Menu" className="rounded-lg p-1.5 text-ink-2 hover:bg-white/5">
          <BiMenu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="border-b border-line bg-panel px-2 py-2 lg:hidden">
          {nav}
          <button onClick={logout} className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-3">
            <BiLogOut className="size-4.5" /> Sign out
          </button>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
