import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCareer } from './CareerContext'
import { validateBoxScore } from '../engine/validation'
import { processGame, playedGameCount } from '../engine/recalc'
import { CATEGORY_LABELS, gameXpBreakdown } from './derive'
import type { BoxScore, Game, GameContext } from '../engine/types'

const ZERO_BOX: BoxScore = {
  min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0,
  fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, plusMinus: 0,
}

const MAIN_FIELDS: { key: keyof BoxScore; label: string }[] = [
  { key: 'min', label: 'MIN' }, { key: 'pts', label: 'PTS' }, { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' }, { key: 'stl', label: 'STL' }, { key: 'blk', label: 'BLK' },
  { key: 'tov', label: 'TO' }, { key: 'plusMinus', label: '+/-' },
]

const SHOT_GROUPS: { label: string; made: keyof BoxScore; att: keyof BoxScore; hot?: boolean }[] = [
  { label: 'FG', made: 'fgm', att: 'fga' },
  { label: '3PT', made: 'tpm', att: 'tpa', hot: true },
  { label: 'LL', made: 'ftm', att: 'fta' },
]

export default function PostGame() {
  const { career, update } = useCareer()
  const nav = useNavigate()
  const [opponent, setOpponent] = useState('')
  const [win, setWin] = useState(true)
  const [dnp, setDnp] = useState(false)
  const [boxInput, setBoxInput] = useState<BoxScore>(ZERO_BOX)
  const [errors, setErrors] = useState<string[]>([])

  if (!career) return null

  const pending = career.pendingContext
  const last = career.lastResult

  function submit() {
    if (!pending) return
    const context: GameContext = {
      opponent, home: pending.home, playoffs: pending.playoffs, win,
      date: new Date().toISOString().slice(0, 10),
    }
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
      // index = count of played games before this one (matches recalcCareer's replay order)
      const globalGameIndex = playedGameCount(c)
      season.games.push(game)
      const newInstructions = processGame(c, c.seasons.length - 1, game, globalGameIndex)
      c.nextGoals = null
      c.pendingContext = null
      c.lastResult = { gameId: game.id, instructions: newInstructions, goalsMet: game.goalsMet, goals: game.goals }
    })
    setOpponent('')
    setBoxInput(ZERO_BOX)
    setDnp(false)
  }

  function acknowledge() {
    update(c => { c.lastResult = null })
    nav('/')
  }

  function setBox(key: keyof BoxScore, v: string) {
    setBoxInput(prev => ({ ...prev, [key]: +v || 0 }))
  }

  // --- Resultado do jogo recém-registrado (até dar o ack); jogo em andamento tem prioridade
  if (last && !pending) {
    const lastSeasonIdx = career.seasons.length - 1
    const lastGame = career.seasons[lastSeasonIdx].games.find(g => g.id === last.gameId)
    const breakdown = lastGame ? gameXpBreakdown(career, lastGame, lastSeasonIdx) : null
    const maxCat = breakdown?.byCategory[0]?.[1] ?? 0
    return (
      <div className="flex flex-col gap-4">
        {last.goals.length > 0 && (
          <div className="flex flex-col gap-3 border border-green-400/30 p-4 clip-corner-lg"
            style={{ background: 'linear-gradient(150deg, rgba(20,83,45,.28), #0c0b0a 62%)' }}>
            <div className="flex items-center gap-2">
              <span className="h-[7px] w-[7px] rotate-45 bg-green-400 animate-[hudPulse_2.4s_ease-in-out_infinite]" />
              <span className="hud-title text-[15px]">Resultado</span>
              <span className="ml-auto font-display text-[11px] tracking-[.1em] text-green-300">
                {last.goalsMet.length} / {last.goals.length} metas
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {last.goals.map(g => {
                const met = last.goalsMet.includes(g.id)
                return (
                  <div key={g.id} className={`flex items-center gap-2.5 bg-hud-bg/60 px-3 py-2.5 border-l-2 ${
                    met ? 'border-green-400' : 'border-stone-700 opacity-70'}`}>
                    <span className={`font-display text-sm font-bold ${met ? 'text-green-400' : 'text-stone-500'}`}>
                      {met ? '✓' : '✕'}
                    </span>
                    <span className={`flex-1 text-sm ${met ? '' : 'text-stone-400'}`}>{g.description}</span>
                    <span className={`font-display text-[11px] tracking-[.08em] uppercase ${met ? 'text-green-300' : 'text-stone-500'}`}>
                      {met ? `+XP ${CATEGORY_LABELS[g.category]}` : 'Sem bônus'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {breakdown && breakdown.total > 0 && (
          <div className="hud-panel flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="hud-title">XP do jogo</span>
              <span className="stat text-[15px] text-orange-400">+{breakdown.total}</span>
            </div>
            <div className="flex flex-col gap-2">
              {breakdown.byCategory.map(([cat, xp], i) => (
                <div key={cat} className="flex items-center gap-2.5">
                  <span className="w-[84px] truncate text-[13px] font-medium">{CATEGORY_LABELS[cat]}</span>
                  <div className="h-[7px] flex-1 bg-[#171412]">
                    <div className={`h-[7px] ${i === 0
                      ? 'bg-gradient-to-r from-orange-700 to-orange-400'
                      : 'bg-gradient-to-r from-stone-600 to-stone-400'}`}
                      style={{ width: `${Math.round((xp / maxCat) * 100)}%` }} />
                  </div>
                  <span className={`w-11 text-right font-display text-xs ${i === 0 ? 'text-orange-300' : 'text-stone-400'}`}>
                    +{Math.round(xp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {last.instructions.length > 0 ? (
          <div className="flex flex-col gap-2.5 border border-amber-400/40 p-4 clip-corner-lg"
            style={{ background: 'linear-gradient(150deg, rgba(120,53,15,.42), #0c0b0a 65%)' }}>
            <span className="hud-title text-sm">Faça isso no 2K</span>
            {last.instructions.map(i => (
              <div key={i.id}
                className={`bg-hud-bg/60 border-l-2 px-3 py-2.5 text-sm font-medium ${i.type === 'badge' ? 'border-slate-300' : 'border-amber-400'}`}>
                {i.text}
              </div>
            ))}
          </div>
        ) : (
          <div className="hud-panel py-3 text-sm text-hud-mut2">
            Jogo registrado. Nenhum upgrade liberado desta vez.
          </div>
        )}

        <button className="btn-cta" onClick={acknowledge}>Ver no painel</button>
      </div>
    )
  }

  // --- Sem jogo em andamento
  if (!pending) {
    return (
      <div className="flex flex-col gap-4">
        <div className="hud-panel flex flex-col gap-2 py-6 text-center">
          <span className="hud-title text-[15px]">Nenhum jogo em andamento</span>
          <p className="text-sm text-hud-mut2">Prepare a partida no Pré-jogo para liberar o registro.</p>
        </div>
        <Link to="/pregame" className="btn-cta">Ir para o Pré-jogo</Link>
      </div>
    )
  }

  // --- Jogo em andamento: formulário
  return (
    <div className="flex flex-col gap-4">

      {/* A partida */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="hud-label">A partida</span>
          <span className="flex items-center gap-1.5 font-display text-[10px] tracking-[.12em] text-orange-300 uppercase">
            <span className="h-[6px] w-[6px] rotate-45 bg-orange-400 animate-[hudPulse_2.4s_ease-in-out_infinite]" />
            {pending.home ? 'Casa' : 'Fora'}{pending.playoffs ? ' · Playoffs' : ''}
          </span>
        </div>
        <div className="hud-panel flex flex-col gap-3 p-3.5">
          <label className="flex flex-col gap-0.5">
            <span className="font-display text-[10px] tracking-[.12em] text-hud-mut uppercase">Adversário</span>
            <input className="w-full min-w-0 border-b border-hud-line2 bg-transparent pb-1 font-display text-xl font-bold uppercase tracking-[.04em] outline-none"
              value={opponent} onChange={e => setOpponent(e.target.value)} />
          </label>
          <div className="flex gap-1.5">
            <button onClick={() => setWin(true)}
              className={`flex-1 border py-2 font-display text-[11px] font-bold uppercase tracking-[.08em] ${
                win ? 'border-green-400/45 bg-green-400/10 text-green-400' : 'border-hud-line text-hud-mut2'}`}>Vitória</button>
            <button onClick={() => setWin(false)}
              className={`flex-1 border py-2 font-display text-[11px] font-bold uppercase tracking-[.08em] ${
                !win ? 'border-red-400/45 bg-red-400/10 text-red-400' : 'border-hud-line text-hud-mut2'}`}>Derrota</button>
            <button className={`hud-chip flex-1 text-[11px] ${dnp ? 'hud-chip-active font-bold' : ''}`}
              onClick={() => setDnp(v => !v)}>Não joguei</button>
          </div>
        </div>
      </div>

      {/* Box score */}
      {!dnp && (
        <div className="flex flex-col gap-2">
          <span className="hud-label">Box score</span>
          <div className="grid grid-cols-4 gap-1.5">
            {MAIN_FIELDS.map(f => (
              <label key={f.key} className="flex flex-col items-center gap-0.5 border border-hud-line2 bg-hud-panel2 px-1 py-2">
                <span className="font-display text-[9px] tracking-[.14em] text-hud-mut">{f.label}</span>
                <input className="stat w-full min-w-0 bg-transparent text-center text-2xl outline-none" type="number"
                  value={boxInput[f.key]} onChange={e => setBox(f.key, e.target.value)} />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {SHOT_GROUPS.map(g => {
              const made = boxInput[g.made], att = boxInput[g.att]
              const pct = att > 0 ? Math.round((made / att) * 100) : 0
              return (
                <div key={g.label}
                  className={`flex flex-col items-center gap-1 border px-1 py-2.5 ${
                    g.hot ? 'border-orange-500/50 bg-orange-500/10' : 'border-hud-line2 bg-hud-panel2'}`}>
                  <span className={`font-display text-[9px] tracking-[.14em] ${g.hot ? 'text-orange-300' : 'text-hud-mut'}`}>{g.label}</span>
                  <div className={`stat flex items-center text-xl ${g.hot ? 'text-orange-400' : ''}`}>
                    <input className="w-9 min-w-0 bg-transparent text-right outline-none" type="number"
                      value={made} onChange={e => setBox(g.made, e.target.value)} />
                    <span className="px-0.5 text-stone-600">/</span>
                    <input className="w-9 min-w-0 bg-transparent outline-none" type="number"
                      value={att} onChange={e => setBox(g.att, e.target.value)} />
                  </div>
                  <span className={`font-display text-[10px] ${g.hot ? 'text-orange-300' : 'text-stone-400'}`}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <ul className="list-inside list-disc space-y-1 text-sm text-red-400">
          {errors.map(e => <li key={e}>{e}</li>)}
        </ul>
      )}

      <button className="btn-cta shadow-[0_8px_26px_rgba(249,115,22,.22)]" onClick={submit}>Registrar jogo</button>
    </div>
  )
}
