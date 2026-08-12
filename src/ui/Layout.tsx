import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Painel' },
  { to: '/pregame', label: 'Pré-jogo' },
  { to: '/postgame', label: 'Pós-jogo' },
  { to: '/history', label: 'Histórico' },
]

export default function Layout() {
  return (
    <div className="min-h-screen text-zinc-100">
      <nav className="sticky top-0 z-10 flex items-center gap-1 border-b border-zinc-800 bg-zinc-950/90 px-4 py-2 backdrop-blur">
        <span className="mr-3 flex items-center gap-2 whitespace-nowrap font-['Barlow_Condensed'] text-lg font-extrabold uppercase tracking-wide text-zinc-100">
          <span className="inline-block h-3 w-3 rounded-sm bg-orange-500" />
          Career Tracker
        </span>
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) =>
              `rounded px-3 py-1.5 text-sm ${isActive ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <main className="mx-auto max-w-3xl p-4"><Outlet /></main>
    </div>
  )
}
