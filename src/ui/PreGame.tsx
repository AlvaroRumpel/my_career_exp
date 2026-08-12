import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCareer } from './CareerContext'
import { generateGoals } from '../engine/goals'
import { getStyle, styleCategoryMult } from '../engine/playStyles'
import { ageMultiplier } from '../engine/multipliers'
import { CATEGORY_LABELS, preGameMultiplier } from './derive'
import type { Goal } from '../engine/types'

function goalValue(g: Goal): string {
  if (g.kind === 'fgPct' || g.kind === 'tpPct') return `${Math.round(g.target * 100)}%`
  if (g.kind === 'awayWin') return 'W'
  return `${g.target}+`
}

export default function PreGame() {
  const { career, update } = useCareer()
  const [home, setHome] = useState(true)
  const [playoffs, setPlayoffs] = useState(false)
  if (!career) return null
  const season = career.seasons[career.seasons.length - 1]
  const seq = career.seasons.reduce((s, x) => s + x.games.length, 0)
  const age = career.player.startAge + career.seasons.length - 1
  const style = getStyle(career.playStyle)
  const mult = preGameMultiplier(career, home, playoffs)
  const ageMult = ageMultiplier(age, career.config)
  const pending = career.pendingContext

  function roll() {
    update(c => {
      c.nextGoals = generateGoals(season.games, { opponent: '', home, playoffs, win: false, date: '' }, seq)
    })
  }

  function start() {
    update(c => {
      c.pendingContext = { home, playoffs }
      c.lastResult = null
    })
  }

  function cancelGame() {
    if (!window.confirm('Cancelar o jogo em andamento? As metas geradas serão descartadas.')) return
    update(c => {
      c.pendingContext = null
      c.nextGoals = null
    })
  }

  // --- Jogo em andamento
  if (pending) {
    return (
      <div className="flex flex-col gap-4">
        <div className="hud-panel-hot flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="h-[7px] w-[7px] rotate-45 bg-orange-400 animate-[hudPulse_2.4s_ease-in-out_infinite]" />
            <span className="hud-title text-[15px]">Jogo em andamento</span>
            <span className="ml-auto font-display text-[11px] tracking-[.1em] text-orange-300 uppercase">
              {pending.home ? 'Casa' : 'Fora'}{pending.playoffs ? ' · Playoffs' : ''}
            </span>
          </div>
          <p className="text-sm text-stone-400">Jogue a partida no 2K e registre o box score quando terminar.</p>
          {career.nextGoals && (
            <div className="flex flex-col gap-1.5">
              {career.nextGoals.map(g => (
                <div key={g.id} className="flex items-center gap-2.5 bg-hud-bg/60 border-l-2 border-orange-500 px-3 py-2.5">
                  <span className="flex-1 text-sm font-medium">{g.description}</span>
                  <span className="font-display text-[10px] tracking-[.1em] text-stone-400 uppercase">
                    {CATEGORY_LABELS[g.category]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2.5">
          <button className="btn-ghost flex-1" onClick={cancelGame}>Cancelar jogo</button>
          <Link to="/postgame" className="btn-cta flex-[1.3]">Ir pro registro</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      <p className="text-sm leading-relaxed text-stone-400">
        Defina o contexto antes de entrar na partida. Cada meta cumprida injeta XP bônus na
        categoria — até <span className="font-semibold text-orange-300">+30%</span> do XP do jogo.
      </p>

      {/* Contexto */}
      <div className="flex flex-col gap-2">
        <span className="hud-label">Contexto da partida</span>
        <div className="flex gap-1.5">
          <button className={`hud-chip flex-1 py-3 ${home ? 'hud-chip-active font-bold' : ''}`}
            onClick={() => setHome(true)}>Casa</button>
          <button className={`hud-chip flex-1 py-3 ${!home ? 'hud-chip-active font-bold' : ''}`}
            onClick={() => setHome(false)}>Fora ×{career.config.awayMult}</button>
          <button className={`hud-chip flex-1 py-3 ${playoffs ? 'hud-chip-active font-bold' : ''}`}
            onClick={() => setPlayoffs(v => !v)}>Playoffs ×{career.config.playoffsMult}</button>
        </div>
      </div>

      {/* Multiplicador estimado */}
      <div className="hud-panel flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="hud-label tracking-[.14em]">Multiplicador estimado</span>
          <span className="text-[13px] text-stone-400">
            Idade {age} (×{ageMult}) · {home ? 'Casa' : 'Fora'}{playoffs ? ' · Playoffs' : ''} · {style.name}
          </span>
        </div>
        <span className="stat text-[28px] text-orange-400 drop-shadow-[0_0_18px_rgba(249,115,22,.45)]">
          {+mult.toFixed(2)}<span className="text-[15px]">×</span>
        </span>
      </div>

      {/* Missões */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="h-[7px] w-[7px] rotate-45 bg-amber-400 animate-[hudPulse_2.4s_ease-in-out_infinite]" />
          <span className="hud-title text-[15px]">Missões do jogo</span>
        </span>
        {career.nextGoals && (
          <span className="font-display text-[11px] tracking-[.1em] text-amber-200">
            {String(career.nextGoals.length).padStart(2, '0')}
          </span>
        )}
      </div>

      {career.nextGoals ? (
        <div className="flex flex-col gap-2.5">
          {career.nextGoals.map(g => {
            const focused = styleCategoryMult(career.playStyle, g.category) > 1
            return (
              <div key={g.id} className="flex items-center gap-3 border border-orange-500/30 p-3.5 clip-corner"
                style={{ background: 'linear-gradient(150deg, rgba(120,53,15,.32), #0c0b0a 65%)' }}>
                <span className="stat min-w-[44px] text-[28px] leading-none text-orange-400">{goalValue(g)}</span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{g.description}</span>
                  <span className="font-display text-[10px] tracking-[.12em] text-stone-400 uppercase">
                    Bônus → {CATEGORY_LABELS[g.category]}{focused ? ` · foco ${style.name}` : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="hud-panel py-3 text-sm text-hud-mut2">Gere as metas para este jogo.</div>
      )}

      {/* Desafio em andamento */}
      {career.activeChallenges.length > 0 && (
        <div className="hud-panel flex flex-col gap-2">
          <span className="hud-label tracking-[.14em]">Desafio em andamento</span>
          {career.activeChallenges.map((ch, i) => (
            <p key={i} className="text-sm leading-snug">
              {ch.description} — sequência{' '}
              <span className="stat text-orange-300">{ch.currentStreak}/{ch.streakLen}</span>
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-2.5">
        <button className="btn-ghost flex-1" onClick={roll}>
          {career.nextGoals ? 'Gerar outras metas' : 'Gerar metas'}
        </button>
        {career.nextGoals && (
          <button onClick={start} className="btn-cta flex-[1.3]">Estou pronto</button>
        )}
      </div>
    </div>
  )
}
