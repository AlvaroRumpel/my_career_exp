import { useCareer } from './CareerContext'
import { recalcCareer } from '../engine/recalc'
import { recentAverages } from '../engine/goals'
import { seasonOvrDelta } from './derive'
import type { Game } from '../engine/types'

function OvrChart({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const min = Math.min(...points) - 2, max = Math.max(...points) + 2
  const coords = points.map((p, i) =>
    [(i / (points.length - 1)) * 300, 92 - ((p - min) / (max - min)) * 80] as const)
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `0,92 ${line} 300,92`
  const [lastX, lastY] = coords[coords.length - 1]
  return (
    <svg viewBox="0 0 300 96" preserveAspectRatio="none" className="h-24 w-full">
      <polygon points={area} fill="rgba(249,115,22,.14)" stroke="none" />
      <polyline points={line} fill="none" stroke="#f97316" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="4" fill="#fb923c" />
    </svg>
  )
}

function isDnp(g: Game): boolean {
  return !g.box || g.box.min <= 0
}

const ddmm = (iso: string) => (iso?.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso)

export default function History() {
  const { career, update } = useCareer()
  if (!career) return null

  const ovrPoints = career.seasons
    .flatMap(s => s.games)
    .filter(g => typeof g.ovrAfter === 'number')
    .map(g => g.ovrAfter!)
  const delta = seasonOvrDelta(career)

  function deleteGame(seasonIdx: number, gameIdx: number) {
    if (!window.confirm('Excluir este jogo? Isso recalcula toda a carreira.')) return
    update(c => {
      c.seasons[seasonIdx].games.splice(gameIdx, 1)
      recalcCareer(c)
    })
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Evolução do overall */}
      <div className="hud-panel-hot flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="hud-label tracking-[.18em]">Evolução do overall</span>
            <div className="flex items-baseline gap-2">
              <span className="stat text-[44px] leading-none text-orange-400 drop-shadow-[0_0_20px_rgba(249,115,22,.45)]">
                {ovrPoints.at(-1) ?? '—'}
              </span>
              {delta > 0 && <span className="font-display text-[13px] text-green-400">▲ {delta}</span>}
            </div>
          </div>
          <span className="text-right font-display text-[11px] leading-snug tracking-[.1em] text-hud-mut2">
            {ovrPoints.length} JOGOS{ovrPoints.length >= 2 && <><br />{ovrPoints[0]} → {ovrPoints.at(-1)}</>}
          </span>
        </div>
        {ovrPoints.length >= 2 ? (
          <>
            <OvrChart points={ovrPoints} />
            <div className="flex justify-between font-display text-[9px] tracking-[.1em] text-stone-600">
              <span>JOGO 01</span>
              <span>JOGO {String(Math.ceil(ovrPoints.length / 2)).padStart(2, '0')}</span>
              <span>JOGO {String(ovrPoints.length).padStart(2, '0')}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-hud-mut2">Jogos insuficientes para o gráfico.</p>
        )}
      </div>

      {career.seasons.length === 0 && (
        <p className="text-sm text-hud-mut2">Nenhuma temporada registrada.</p>
      )}

      {[...career.seasons]
        .map((season, idx) => ({ season, idx }))
        .reverse()
        .map(({ season, idx }) => {
          const avg = recentAverages(season.games, 999)
          const wins = season.games.filter(g => g.context.win).length
          const losses = season.games.length - wins
          return (
            <section key={season.year} className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between px-0.5">
                <span className="hud-title">Temporada {season.year}</span>
                <span className="stat text-sm text-stone-400">{wins}-{losses}</span>
              </div>

              {avg && (
                <div className="grid grid-cols-3 gap-px border border-hud-line bg-hud-line">
                  {[
                    ['PPG', avg.pts.toFixed(1), false],
                    ['RPG', avg.reb.toFixed(1), false],
                    ['APG', avg.ast.toFixed(1), false],
                    ['FG', avg.fga > 0 ? `${(avg.fgm / avg.fga * 100).toFixed(0)}%` : '0%', false],
                    ['3P', avg.tpa > 0 ? `${(avg.tpm / avg.tpa * 100).toFixed(0)}%` : '0%', true],
                    ['W-L', `${wins}-${losses}`, false],
                  ].map(([label, value, hot]) => (
                    <div key={label as string} className="flex flex-col items-center gap-1 bg-hud-panel px-1.5 py-3">
                      <span className={`stat text-[22px] leading-none ${hot ? 'text-orange-400' : ''}`}>{value}</span>
                      <span className="font-display text-[9px] tracking-[.12em] text-hud-mut">{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {season.games.length === 0 ? (
                <p className="text-sm text-hud-mut2">Nenhum jogo registrado.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {[...season.games].map((g, gi) => ({ g, gi })).reverse().map(({ g, gi }) => {
                    const dnp = isDnp(g)
                    return (
                      <div key={g.id}
                        className={`flex items-center gap-3 border p-3 ${
                          dnp ? 'border-stone-900 bg-hud-panel/60 opacity-60' : 'border-hud-line bg-hud-panel/85'}`}>
                        <div className="flex min-w-[46px] flex-col items-center gap-0.5">
                          <span className="max-w-[52px] truncate font-display text-[15px] font-bold uppercase">
                            {g.context.opponent || '—'}
                          </span>
                          <span className="font-display text-[9px] tracking-[.06em] text-hud-mut">{ddmm(g.context.date)}</span>
                        </div>
                        <div className="h-9 w-px bg-hud-line" />
                        {dnp ? (
                          <span className="flex-1 font-display text-[13px] tracking-[.1em] text-hud-mut2">NÃO JOGOU</span>
                        ) : (
                          <div className="flex flex-1 flex-col gap-1">
                            <span className="stat text-base">
                              {g.box!.pts} <span className="text-[11px] font-normal text-hud-mut2">PTS</span>
                              {' · '}{g.box!.reb} <span className="text-[11px] font-normal text-hud-mut2">REB</span>
                              {' · '}{g.box!.ast} <span className="text-[11px] font-normal text-hud-mut2">AST</span>
                            </span>
                            <div className="flex items-center gap-2">
                              {g.goals.length > 0 && (
                                <div className="flex gap-1">
                                  {g.goals.map(goal => (
                                    <div key={goal.id} className={`h-1 w-3.5 ${
                                      g.goalsMet.includes(goal.id) ? 'bg-orange-500' : 'bg-stone-900'}`} />
                                  ))}
                                </div>
                              )}
                              <span className={`font-display text-[10px] tracking-[.08em] uppercase ${
                                g.goals.length > 0 && g.goalsMet.length === g.goals.length ? 'text-orange-300' : 'text-hud-mut2'}`}>
                                {g.goals.length > 0 ? `${g.goalsMet.length}/${g.goals.length} metas · ` : ''}
                                {g.context.home ? 'Casa' : 'Fora'}{g.context.playoffs ? ' · PO' : ''}
                              </span>
                            </div>
                          </div>
                        )}
                        <span className={`border px-2.5 py-1 font-display text-[15px] font-bold ${
                          dnp ? 'border-hud-line text-stone-600'
                            : g.context.win ? 'border-green-400/35 text-green-400' : 'border-red-400/35 text-red-400'}`}>
                          {dnp ? '—' : g.context.win ? 'V' : 'D'}
                        </span>
                        <button className="font-display text-[10px] tracking-[.08em] text-stone-600 uppercase"
                          onClick={() => deleteGame(idx, gi)}>✕</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
    </div>
  )
}
