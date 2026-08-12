import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCareer } from './CareerContext'
import { ATTRIBUTES } from '../engine/attributes'
import { BADGES, TIER_NAMES } from '../engine/badges'
import { DEFAULT_CONFIG } from '../engine/types'
import { recalcCareer } from '../engine/recalc'
import { PLAY_STYLES } from '../engine/playStyles'
import type { Career, Position } from '../engine/types'

type QuickList = 'attrs' | 'badges'

function QuickEntry({ list, attrs, badgeTiers, onAttr, onBadge, onClose }: {
  list: QuickList
  attrs: Record<string, number>
  badgeTiers: Record<string, number>
  onAttr: (id: string, value: number) => void
  onBadge: (id: string, tier: number) => void
  onClose: () => void
}) {
  const items = list === 'attrs' ? ATTRIBUTES : BADGES
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const item = items[index]

  useEffect(() => {
    inputRef.current?.focus()
    setDraft('')
  }, [index])

  function advance(delta: number) {
    const next = index + delta
    if (next < 0) return
    if (next >= items.length) { onClose(); return }
    setIndex(next)
  }

  function commitAttr() {
    const v = parseInt(draft, 10)
    if (!Number.isNaN(v)) onAttr(item.id, Math.min(99, Math.max(25, v)))
    advance(1)
  }

  function keyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowLeft') { e.preventDefault(); advance(-1); return }
    if (list === 'attrs') {
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitAttr() }
    } else {
      if (e.key >= '0' && e.key <= '5') { e.preventDefault(); onBadge(item.id, +e.key); advance(1) }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); advance(1) }
    }
  }

  const current = list === 'attrs' ? attrs[item.id] : TIER_NAMES[badgeTiers[item.id]]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="card w-full max-w-md space-y-4 p-6 text-center" onClick={e => e.stopPropagation()}>
        <p className="text-sm text-zinc-500">
          {list === 'attrs' ? 'Atributo' : 'Badge'} {index + 1}/{items.length} — atual: <span className="stat text-zinc-300">{current}</span>
        </p>
        <p className="stat text-3xl text-orange-500">{'label' in item ? item.label : item.name}</p>
        {list === 'attrs' ? (
          <input ref={inputRef} value={draft} onKeyDown={keyDown} inputMode="numeric"
            onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
            placeholder={String(attrs[item.id])}
            className="input stat w-24 text-center text-2xl" />
        ) : (
          <div>
            <input ref={inputRef} value="" onKeyDown={keyDown} onChange={() => {}}
              className="absolute h-0 w-0 opacity-0" />
            <div className="flex flex-wrap justify-center gap-2">
              {TIER_NAMES.map((t, i) => (
                <button key={t} onClick={() => { onBadge(item.id, i); advance(1) }}
                  className={`btn ${badgeTiers[item.id] === i ? 'bg-orange-600 hover:bg-orange-500' : ''}`}>
                  {i} · {t}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-zinc-500">
          {list === 'attrs' ? 'Digite o valor e Enter avança' : 'Tecla 0-5 define o tier e avança'} · ← volta · Esc sai
        </p>
      </div>
    </div>
  )
}

export default function CreatePlayer() {
  const { career, create } = useCareer()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [position, setPosition] = useState<Position>('PG')
  const [team, setTeam] = useState('')
  const [heightCm, setHeightCm] = useState(198)
  const [startAge, setStartAge] = useState(20)
  const [year, setYear] = useState(2026)
  const [playStyle, setPlayStyle] = useState('balanced')
  const [attrs, setAttrs] = useState<Record<string, number>>(
    Object.fromEntries(ATTRIBUTES.map(a => [a.id, 70])),
  )
  const [badgeTiers, setBadgeTiers] = useState<Record<string, number>>(
    Object.fromEntries(BADGES.map(b => [b.id, 0])),
  )
  const [quick, setQuick] = useState<QuickList | null>(null)

  if (career) return <p className="text-zinc-400">Carreira ativa. Apague no Painel para criar outra.</p>

  function submit() {
    const c: Career = {
      player: { name, position, heightCm, team, startAge },
      initialAttributes: { ...attrs }, initialBadges: { ...badgeTiers },
      attributes: {}, badges: {}, activeChallenges: [],
      seasons: [{ year, games: [], playStyle }], playStyle,
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
        <label className="flex flex-col text-sm">Estilo de jogo
          <select className="input" value={playStyle} onChange={e => setPlayStyle(e.target.value)}>
            {PLAY_STYLES.map(s => (
              <option key={s.id} value={s.id}>{s.reference ? `${s.name} — ${s.reference}` : s.name}</option>
            ))}
          </select></label>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold uppercase tracking-wide text-zinc-300">Atributos atuais (como estão no 2K)</h2>
        <button className="btn" onClick={() => setQuick('attrs')}>⚡ Modo rápido</button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {ATTRIBUTES.map(a => (
          <label key={a.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{a.label}</span>
            <input className="input stat w-16" type="number" min={25} max={99} value={attrs[a.id]}
              onChange={e => setAttrs({ ...attrs, [a.id]: +e.target.value })} />
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold uppercase tracking-wide text-zinc-300">Badges atuais</h2>
        <button className="btn" onClick={() => setQuick('badges')}>⚡ Modo rápido</button>
      </div>
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

      {quick && (
        <QuickEntry list={quick} attrs={attrs} badgeTiers={badgeTiers}
          onAttr={(id, v) => setAttrs(prev => ({ ...prev, [id]: v }))}
          onBadge={(id, t) => setBadgeTiers(prev => ({ ...prev, [id]: t }))}
          onClose={() => setQuick(null)} />
      )}
    </div>
  )
}
