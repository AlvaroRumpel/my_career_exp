import { NavLink, Outlet, useLocation } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Painel' },
  { to: '/pregame', label: 'Pré' },
  { to: '/postgame', label: 'Pós' },
  { to: '/history', label: 'Hist' },
]

const TITLES: Record<string, string> = {
  '/': 'Career HUD',
  '/pregame': 'Pré-jogo',
  '/postgame': 'Pós-jogo',
  '/history': 'Histórico',
  '/new': 'Criar jogador',
}

export default function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="page-grid mx-auto flex min-h-screen max-w-[430px] flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-orange-500/20 bg-hud-bg/90 px-4 py-3.5 backdrop-blur">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rotate-45 bg-orange-500 shadow-[0_0_10px_#f97316]" />
          <span className="font-display text-[15px] font-bold uppercase tracking-[.14em]">
            {TITLES[pathname] ?? 'Career HUD'}
          </span>
        </span>
        <span className="font-display text-[11px] tracking-[.16em] text-orange-400">2K25</span>
      </header>
      <main className="flex-1 p-4"><Outlet /></main>
      <nav className="sticky bottom-0 z-10 flex gap-1.5 border-t border-orange-500/20 bg-hud-bg/90 px-3 pb-3.5 pt-2.5 backdrop-blur">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) =>
              `flex-1 py-2.5 text-center font-display text-[11px] font-bold uppercase tracking-[.1em] ${
                isActive
                  ? 'border border-orange-500/55 bg-orange-500/15 text-orange-300'
                  : 'border border-hud-line text-hud-mut2'}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
