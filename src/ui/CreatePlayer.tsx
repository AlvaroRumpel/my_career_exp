import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCareer } from './CareerContext'
import { ATTRIBUTES } from '../engine/attributes'
import { BADGES, TIER_NAMES } from '../engine/badges'
import { DEFAULT_CONFIG } from '../engine/types'
import { recalcCareer } from '../engine/recalc'
import { PLAY_STYLES } from '../engine/playStyles'
import { CATEGORY_ABBR } from './derive'
import type { Career, Category, Position } from '../engine/types'

type QuickList = 'attrs' | 'badges'

const TIER_LETTERS = ['—', 'B', 'P', 'O', 'H', 'L']
const TIER_ACTIVE: Record<number, string> = {
  0: 'border-orange-500/50 bg-orange-500/15 text-orange-300',
  1: 'border-bronze/60 bg-bronze/20 text-bronze-light',
  2: 'border-slate-300/60 bg-slate-300/15 text-slate-200',
  3: 'border-yellow-400/60 bg-yellow-400/15 text-yellow-300',
  4: 'border-red-400/60 bg-red-400/15 text-red-300',
  5: 'border-purple-400/60 bg-purple-400/15 text-purple-300',
}

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
  const segTotal = 8
  const segOn = Math.round(((index + 1) / items.length) * segTotal)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="hud-panel-hot flex w-full max-w-md flex-col gap-4 text-center" onClick={e => e.stopPropagation()}>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[10px] tracking-[.14em] text-orange-300 uppercase">
            {list === 'attrs' ? 'Atributo' : 'Badge'} {index + 1} / {items.length}
          </span>
          <span className="hud-label tracking-[.1em]">
            {list === 'attrs' ? 'Enter avança' : 'Tecla 0-5 define o tier'}
          </span>
        </div>
        <p className="font-display text-2xl font-bold uppercase leading-tight">
          {'label' in item ? item.label : item.name}
        </p>
        <p className="text-sm text-stone-400">atual: <span className="stat text-hud-ink">{current}</span></p>
        {list === 'attrs' ? (
          <input ref={inputRef} value={draft} onKeyDown={keyDown} inputMode="numeric"
            onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
            placeholder={String(attrs[item.id])}
            className="stat mx-auto w-28 border-b-2 border-orange-500/60 bg-transparent px-2 text-center text-5xl text-orange-400 outline-none" />
        ) : (
          <div>
            <input ref={inputRef} value="" onKeyDown={keyDown} onChange={() => {}}
              className="absolute h-0 w-0 opacity-0" />
            <div className="flex flex-wrap justify-center gap-2">
              {TIER_NAMES.map((t, i) => (
                <button key={t} onClick={() => { onBadge(item.id, i); advance(1) }}
                  className={`border px-3 py-2 font-display text-xs font-bold ${
                    badgeTiers[item.id] === i ? TIER_ACTIVE[Math.max(i, 0)] : 'border-hud-line2 text-stone-500'}`}>
                  {i} · {t}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-1">
          {Array.from({ length: segTotal }, (_, i) => (
            <div key={i} className={`h-1 flex-1 ${i < segOn ? 'bg-orange-500' : 'bg-stone-900'}`} />
          ))}
        </div>
        <p className="hud-label tracking-[.1em]">← volta · Esc sai</p>
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

  if (career) return <p className="text-stone-400">Carreira ativa. Apague no Painel para criar outra.</p>

  function submit() {
    const c: Career = {
      player: { name, position, heightCm: Math.min(240, Math.max(150, heightCm || 198)), team, startAge },
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
    <div className="flex flex-col gap-5">

      {/* Identidade */}
      <div className="flex flex-col gap-2.5">
        <span className="hud-label">Identidade</span>
        <label className="flex flex-col gap-0.5 border border-hud-line2 bg-hud-panel2 px-3 py-2.5">
          <span className="font-display text-[9px] tracking-[.14em] text-hud-mut uppercase">Nome</span>
          <input className="bg-transparent font-display text-xl font-bold outline-none"
            value={name} onChange={e => setName(e.target.value)} />
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {([
            ['Time', team, (v: string) => setTeam(v), 'text'],
            ['CM', heightCm, (v: string) => setHeightCm(+v || 0), 'number'],
            ['Idade', startAge, (v: string) => setStartAge(+v || 0), 'number'],
            ['Ano', year, (v: string) => setYear(+v || 0), 'number'],
          ] as const).map(([label, value, set, type]) => (
            <label key={label} className="flex flex-col items-center gap-0.5 border border-hud-line2 bg-hud-panel2 px-1 py-2">
              <span className="font-display text-[9px] tracking-[.12em] text-hud-mut uppercase">{label}</span>
              <input className="stat w-full bg-transparent text-center text-lg outline-none" type={type}
                value={value} onChange={e => set(e.target.value)} />
            </label>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).map(p => (
            <button key={p} onClick={() => setPosition(p)}
              className={`hud-chip flex-1 ${position === p ? 'hud-chip-active font-bold' : ''}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Estilo de jogo */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="hud-label">Estilo de jogo</span>
          <span className="font-display text-[10px] tracking-[.1em] text-hud-mut2 uppercase">Define o XP das categorias</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PLAY_STYLES.map(s => {
            const active = playStyle === s.id
            return (
              <button key={s.id} onClick={() => setPlayStyle(s.id)}
                className={`flex w-[150px] flex-none flex-col items-start gap-1.5 border p-3 text-left clip-corner ${
                  active ? 'border-orange-500/55' : 'border-hud-line bg-hud-panel'}`}
                style={active ? { background: 'linear-gradient(150deg, rgba(120,53,15,.42), #0c0b0a 68%)' } : undefined}>
                <span className={`font-display text-[16px] font-bold uppercase tracking-[.06em] ${active ? 'text-orange-300' : 'text-stone-300'}`}>
                  {s.name}
                </span>
                <span className={`text-xs ${active ? 'text-stone-400' : 'text-hud-mut2'}`}>
                  {s.reference ? `ref. ${s.reference}` : 'sem foco'}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {Object.entries(s.catMults).sort(([, a], [, b]) => b - a).map(([cat, m]) => (
                    <span key={cat} className={`border px-1.5 py-0.5 font-display text-[9px] tracking-[.08em] ${
                      m > 1
                        ? active ? 'border-orange-500/40 text-orange-300' : 'border-hud-line2 text-stone-300'
                        : 'border-hud-line text-stone-600'}`}>
                      {CATEGORY_ABBR[cat as Category]} ×{m}
                    </span>
                  ))}
                </span>
              </button>
            )
          })}
        </div>
        <span className="font-display text-[10px] tracking-[.1em] text-stone-600 uppercase">
          {PLAY_STYLES.length} estilos disponíveis · arraste para ver
        </span>
      </div>

      {/* Atributos */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="hud-label">Atributos como estão no 2K</span>
          <button className="hud-chip hud-chip-active px-2.5 py-1.5 text-[10px] font-bold" onClick={() => setQuick('attrs')}>
            ⚡ Modo rápido
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {ATTRIBUTES.map(a => (
            <label key={a.id} className="flex items-center justify-between gap-2 border border-hud-line bg-hud-panel/70 px-3 py-2 text-sm">
              <span className="truncate text-stone-400">{a.label}</span>
              <input className="stat w-12 bg-transparent text-right text-lg outline-none" type="number" min={25} max={99}
                value={attrs[a.id]} onChange={e => setAttrs({ ...attrs, [a.id]: +e.target.value })} />
            </label>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="hud-label">Badges atuais</span>
          <button className="hud-chip hud-chip-active px-2.5 py-1.5 text-[10px] font-bold" onClick={() => setQuick('badges')}>
            ⚡ Modo rápido
          </button>
        </div>
        <div className="hud-panel flex flex-col gap-3 p-3.5">
          {BADGES.map((b, i) => (
            <div key={b.id} className="flex flex-col gap-3">
              {i > 0 && <div className="h-px bg-hud-line" />}
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{b.name}</span>
                <div className="flex gap-1">
                  {TIER_LETTERS.map((letter, tier) => (
                    <button key={tier} onClick={() => setBadgeTiers({ ...badgeTiers, [b.id]: tier })}
                      className={`flex h-[30px] w-[30px] items-center justify-center border font-display text-xs ${
                        badgeTiers[b.id] === tier
                          ? `font-bold ${TIER_ACTIVE[tier]}`
                          : 'border-hud-line2 font-semibold text-stone-600'}`}>
                      {letter}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <span className="font-display text-[10px] tracking-[.1em] text-stone-600 uppercase">
          {BADGES.length} badges · só as que você tem precisam de tier
        </span>
      </div>

      <button disabled={!valid} onClick={submit} className="btn-cta shadow-[0_8px_26px_rgba(249,115,22,.22)]">
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
