import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCareer } from './CareerContext'
import { ATTRIBUTES } from '../engine/attributes'
import { BADGES, TIER_NAMES } from '../engine/badges'
import { DEFAULT_CONFIG } from '../engine/types'
import { recalcCareer } from '../engine/recalc'
import type { Career, Position } from '../engine/types'

export default function CreatePlayer() {
  const { career, create } = useCareer()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [position, setPosition] = useState<Position>('PG')
  const [team, setTeam] = useState('')
  const [heightCm, setHeightCm] = useState(198)
  const [startAge, setStartAge] = useState(20)
  const [year, setYear] = useState(2026)
  const [attrs, setAttrs] = useState<Record<string, number>>(
    Object.fromEntries(ATTRIBUTES.map(a => [a.id, 70])),
  )
  const [badgeTiers, setBadgeTiers] = useState<Record<string, number>>(
    Object.fromEntries(BADGES.map(b => [b.id, 0])),
  )

  if (career) return <p className="text-zinc-400">Carreira ativa. Apague no Painel para criar outra.</p>

  function submit() {
    const c: Career = {
      player: { name, position, heightCm, team, startAge },
      initialAttributes: { ...attrs }, initialBadges: { ...badgeTiers },
      attributes: {}, badges: {}, activeChallenges: [],
      seasons: [{ year, games: [] }],
      pendingInstructions: [], appliedInstructionIds: [], config: DEFAULT_CONFIG, targetOverrides: {},
    }
    recalcCareer(c)
    create(c)
    nav('/')
  }

  const valid = name.trim() && team.trim() && startAge >= 18 && startAge <= 40

  return (
    <div className="space-y-6">
      <h1 className="page-title">Criar jogador</h1>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col text-sm">Nome
          <input className="input" value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="flex flex-col text-sm">Time
          <input className="input" value={team} onChange={e => setTeam(e.target.value)} /></label>
        <label className="flex flex-col text-sm">Posição
          <select className="input" value={position} onChange={e => setPosition(e.target.value as Position)}>
            {['PG','SG','SF','PF','C'].map(p => <option key={p}>{p}</option>)}
          </select></label>
        <label className="flex flex-col text-sm">Altura (cm)
          <input className="input" type="number" value={heightCm} onChange={e => setHeightCm(+e.target.value)} /></label>
        <label className="flex flex-col text-sm">Idade
          <input className="input" type="number" value={startAge} onChange={e => setStartAge(+e.target.value)} /></label>
        <label className="flex flex-col text-sm">Ano da temporada
          <input className="input" type="number" value={year} onChange={e => setYear(+e.target.value)} /></label>
      </div>

      <h2 className="font-semibold uppercase tracking-wide text-zinc-300">Atributos atuais (como estão no 2K)</h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {ATTRIBUTES.map(a => (
          <label key={a.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{a.label}</span>
            <input className="input stat w-16" type="number" min={25} max={99} value={attrs[a.id]}
              onChange={e => setAttrs({ ...attrs, [a.id]: +e.target.value })} />
          </label>
        ))}
      </div>

      <h2 className="font-semibold uppercase tracking-wide text-zinc-300">Badges atuais</h2>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {BADGES.map(b => (
          <label key={b.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{b.name}</span>
            <select className="input w-28" value={badgeTiers[b.id]}
              onChange={e => setBadgeTiers({ ...badgeTiers, [b.id]: +e.target.value })}>
              {TIER_NAMES.map((t, i) => <option key={t} value={i}>{t}</option>)}
            </select>
          </label>
        ))}
      </div>

      <button disabled={!valid} onClick={submit}
        className="rounded bg-orange-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-40">
        Começar carreira
      </button>
    </div>
  )
}
