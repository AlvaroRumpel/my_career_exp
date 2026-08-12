import { useCareer } from './CareerContext'
import { generateGoals } from '../engine/goals'

export default function PreGame() {
  const { career, update } = useCareer()
  if (!career) return null
  const season = career.seasons[career.seasons.length - 1]
  const seq = career.seasons.reduce((s, x) => s + x.games.length, 0)

  function roll(home: boolean, playoffs: boolean) {
    update(c => {
      c.nextGoals = generateGoals(season.games, { opponent: '', home, playoffs, win: false, date: '' }, seq)
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Pré-jogo</h1>
      <div className="flex gap-2">
        <button className="btn" onClick={() => roll(true, false)}>Jogo em casa</button>
        <button className="btn" onClick={() => roll(false, false)}>Jogo fora</button>
        <button className="btn" onClick={() => roll(true, true)}>Playoffs</button>
      </div>
      {career.nextGoals && (
        <ul className="space-y-2">
          {career.nextGoals.map(g => (
            <li key={g.id} className="rounded border border-zinc-800 p-3">{g.description}
              <span className="ml-2 text-xs text-zinc-500">+XP {g.category}</span></li>
          ))}
        </ul>
      )}
    </div>
  )
}
