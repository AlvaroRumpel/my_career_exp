import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCareer } from './CareerContext'
import { validateBoxScore } from '../engine/validation'
import { processGame } from '../engine/recalc'
import type { BoxScore, Game, GameContext } from '../engine/types'

const ZERO_BOX: BoxScore = {
  min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0,
  fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, plusMinus: 0,
}

const BOX_FIELDS: { key: keyof BoxScore; label: string }[] = [
  { key: 'min', label: 'MIN' }, { key: 'pts', label: 'PTS' }, { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' }, { key: 'stl', label: 'STL' }, { key: 'blk', label: 'BLK' },
  { key: 'tov', label: 'TO' }, { key: 'fgm', label: 'FGM' }, { key: 'fga', label: 'FGA' },
  { key: 'tpm', label: '3PM' }, { key: 'tpa', label: '3PA' }, { key: 'ftm', label: 'FTM' },
  { key: 'fta', label: 'FTA' }, { key: 'plusMinus', label: '+/-' },
]

export default function PostGame() {
  const { career, update } = useCareer()
  const [opponent, setOpponent] = useState('')
  const [home, setHome] = useState(true)
  const [playoffs, setPlayoffs] = useState(false)
  const [win, setWin] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dnp, setDnp] = useState(false)
  const [boxInput, setBoxInput] = useState<BoxScore>(ZERO_BOX)
  const [errors, setErrors] = useState<string[]>([])

  if (!career) return null

  function submit() {
    const context: GameContext = { opponent, home, playoffs, win, date }
    const box: BoxScore = dnp ? ZERO_BOX : boxInput
    const validationErrors = validateBoxScore(box)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors([])
    update(c => {
      const season = c.seasons[c.seasons.length - 1]
      const game: Game = {
        id: `game-${Date.now()}`, context, box,
        goals: c.nextGoals ?? [], goalsMet: [],
      }
      season.games.push(game)
      const newInstructions = processGame(c, c.seasons.length - 1, game)
      c.nextGoals = null
      c.lastResult = { gameId: game.id, instructions: newInstructions, goalsMet: game.goalsMet, goals: game.goals }
    })
    setOpponent('')
    setBoxInput(ZERO_BOX)
    setDnp(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">Pós-jogo</h1>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col text-sm">Adversário
          <input className="input" value={opponent} onChange={e => setOpponent(e.target.value)} /></label>
        <label className="flex flex-col text-sm">Local
          <select className="input" value={home ? 'home' : 'away'} onChange={e => setHome(e.target.value === 'home')}>
            <option value="home">Casa</option>
            <option value="away">Fora</option>
          </select></label>
        <label className="flex flex-col text-sm">Resultado
          <select className="input" value={win ? 'w' : 'l'} onChange={e => setWin(e.target.value === 'w')}>
            <option value="w">Vitória</option>
            <option value="l">Derrota</option>
          </select></label>
        <label className="flex flex-col text-sm">Data
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={playoffs} onChange={e => setPlayoffs(e.target.checked)} />
          Playoffs
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={dnp} onChange={e => setDnp(e.target.checked)} />
          Não joguei (DNP)
        </label>
      </div>

      {!dnp && (
        <div className="grid grid-cols-4 gap-2 md:grid-cols-7">
          {BOX_FIELDS.map(f => (
            <label key={f.key} className="flex flex-col text-sm">{f.label}
              <input className="input stat" type="number" value={boxInput[f.key]}
                onChange={e => setBoxInput({ ...boxInput, [f.key]: +e.target.value })} />
            </label>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <ul className="list-inside list-disc space-y-1 text-sm text-red-500">
          {errors.map(e => <li key={e}>{e}</li>)}
        </ul>
      )}

      <button className="btn bg-orange-600 text-white hover:bg-orange-500" onClick={submit}>Registrar jogo</button>

      {career.lastResult && (
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Resultado</h2>
          {career.lastResult.goals.length > 0 && (
            <ul className="space-y-1 text-sm">
              {career.lastResult.goals.map(g => {
                const met = career.lastResult!.goalsMet.includes(g.id)
                return (
                  <li key={g.id} className={met ? 'text-green-400' : 'text-zinc-500'}>
                    {met ? '✓' : '✗'} {g.description}
                  </li>
                )
              })}
            </ul>
          )}
          {career.lastResult.instructions.length > 0 && (
            <div className="rounded-lg border border-orange-800 bg-orange-950/40 p-3">
              <h3 className="text-sm font-semibold text-orange-300">Instruções para o 2K</h3>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {career.lastResult.instructions.map(i => <li key={i.id}>{i.text}</li>)}
              </ul>
            </div>
          )}
          <Link to="/" className="btn inline-block">Ir para o Painel</Link>
        </section>
      )}
    </div>
  )
}
