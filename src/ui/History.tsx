import { useCareer } from './CareerContext'
import { recalcCareer } from '../engine/recalc'
import { recentAverages } from '../engine/goals'
import type { Game } from '../engine/types'

function OvrChart({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const min = Math.min(...points) - 2, max = Math.max(...points) + 2
  const coords = points.map((p, i) =>
    `${(i / (points.length - 1)) * 300},${100 - ((p - min) / (max - min)) * 100}`).join(' ')
  const areaPoints = `0,100 ${coords} 300,100`
  return (
    <svg viewBox="0 0 300 100" className="h-32 w-full">
      <polygon points={areaPoints} fill="#f97316" fillOpacity="0.1" stroke="none" />
      <polyline points={coords} fill="none" stroke="#f97316" strokeWidth="2" />
    </svg>
  )
}

function isDnp(g: Game): boolean {
  return !g.box || g.box.min <= 0
}

export default function History() {
  const { career, update } = useCareer()
  if (!career) return null

  const ovrPoints = career.seasons
    .flatMap(s => s.games)
    .filter(g => typeof g.ovrAfter === 'number')
    .map(g => g.ovrAfter!)

  function deleteGame(seasonIdx: number, gameIdx: number) {
    if (!window.confirm('Excluir este jogo? Isso recalcula toda a carreira.')) return
    update(c => {
      c.seasons[seasonIdx].games.splice(gameIdx, 1)
      recalcCareer(c)
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">Histórico</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Evolução do OVR</h2>
        {ovrPoints.length >= 2 ? (
          <OvrChart points={ovrPoints} />
        ) : (
          <p className="text-sm text-zinc-500">Jogos insuficientes para o gráfico.</p>
        )}
      </section>

      {career.seasons.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma temporada registrada.</p>
      ) : (
        [...career.seasons]
          .map((season, idx) => ({ season, idx }))
          .reverse()
          .map(({ season, idx }) => {
            const avg = recentAverages(season.games, 999)
            const wins = season.games.filter(g => g.context.win).length
            const losses = season.games.length - wins
            return (
              <section key={season.year} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">Temporada {season.year}</h2>
                  <span className="stat text-sm text-zinc-400">{wins}-{losses}</span>
                </div>

                {avg ? (
                  <div className="grid grid-cols-5 gap-2 text-center text-sm">
                    <div><p className="text-zinc-400">PPG</p><p className="stat text-lg">{avg.pts.toFixed(1)}</p></div>
                    <div><p className="text-zinc-400">RPG</p><p className="stat text-lg">{avg.reb.toFixed(1)}</p></div>
                    <div><p className="text-zinc-400">APG</p><p className="stat text-lg">{avg.ast.toFixed(1)}</p></div>
                    <div><p className="text-zinc-400">FG%</p><p className="stat text-lg">{avg.fga > 0 ? (avg.fgm / avg.fga * 100).toFixed(1) : '0.0'}</p></div>
                    <div><p className="text-zinc-400">3P%</p><p className="stat text-lg">{avg.tpa > 0 ? (avg.tpm / avg.tpa * 100).toFixed(1) : '0.0'}</p></div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">Nenhum jogo com minutos nesta temporada.</p>
                )}

                {season.games.length === 0 ? (
                  <p className="text-sm text-zinc-500">Nenhum jogo registrado.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-zinc-400">
                        <tr>
                          <th className="pr-2 font-normal">Data</th>
                          <th className="pr-2 font-normal">Adversário</th>
                          <th className="pr-2 font-normal">Local</th>
                          <th className="pr-2 font-normal">W/L</th>
                          <th className="pr-2 font-normal">Box</th>
                          <th className="pr-2 font-normal">Metas</th>
                          <th className="font-normal"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {season.games.map((g, gi) => (
                          <tr key={g.id} className="border-t border-zinc-800 odd:bg-zinc-900/50">
                            <td className="stat py-1 pr-2">{g.context.date}</td>
                            <td className="pr-2">{g.context.opponent}</td>
                            <td className="pr-2">{g.context.home ? 'Casa' : 'Fora'}</td>
                            <td className={`stat pr-2 ${g.context.win ? 'text-green-400' : 'text-red-400'}`}>{g.context.win ? 'W' : 'L'}</td>
                            <td className="stat pr-2">
                              {isDnp(g) ? 'DNP' : `${g.box!.pts} pts ${g.box!.reb} reb ${g.box!.ast} ast`}
                            </td>
                            <td className="stat pr-2">
                              {g.goals.length > 0 ? `${g.goalsMet.length}/${g.goals.length}` : '—'}
                            </td>
                            <td>
                              <button className="btn" onClick={() => deleteGame(idx, gi)}>Excluir</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })
      )}
    </div>
  )
}
