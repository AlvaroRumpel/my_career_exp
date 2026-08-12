import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Painel' },
  { to: '/pregame', label: 'Pré-jogo' },
  { to: '/postgame', label: 'Pós-jogo' },
  { to: '/history', label: 'Histórico' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="flex gap-1 border-b border-zinc-800 px-4 py-2">
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
