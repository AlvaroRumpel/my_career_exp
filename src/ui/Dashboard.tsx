import { useState, type ChangeEvent } from 'react'
import { useCareer } from './CareerContext'
import { estimateOverall, ATTRIBUTES, attributesByCategory } from '../engine/attributes'
import { upgradeCost } from '../engine/progression'
import { BADGES, TIER_NAMES, TIER_THRESHOLDS, tierOf, progressForTier } from '../engine/badges'
import { recentAverages } from '../engine/goals'
import { createChallenge } from '../engine/challenges'
import { exportCareer, importCareer } from '../storage'
import { recalcCareer, playedGameCount } from '../engine/recalc'
import { offseasonTotal } from '../engine/offseason'
import { PLAY_STYLES, getStyle, styleCategoryMult } from '../engine/playStyles'
import { attrWeight, badgeWeight } from '../engine/affinity'
import { CATEGORIES, CATEGORY_LABELS, CATEGORY_ABBR, categoryAverages, seasonOvrDelta, gameXpBreakdown } from './derive'
import type { Category } from '../engine/types'

const TIER_STYLE: Record<number, { border: string; label: string; seg: string; grad: boolean }> = {
  0: { border: 'border-hud-line', label: 'text-stone-600', seg: '', grad: false },
  1: { border: 'border-bronze/40', label: 'text-bronze-light', seg: 'bg-bronze', grad: true },
  2: { border: 'border-slate-300/40', label: 'text-slate-200', seg: 'bg-slate-300', grad: true },
  3: { border: 'border-yellow-400/40', label: 'text-yellow-300', seg: 'bg-yellow-400', grad: true },
  4: { border: 'border-red-400/40', label: 'text-red-300', seg: 'bg-red-400', grad: true },
  5: { border: 'border-purple-400/40', label: 'text-purple-300', seg: 'bg-purple-400', grad: true },
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function WeightChip({ w }: { w: number }) {
  if (Math.abs(w - 1) < 0.001) return null
  const cls = w >= 1.5 ? 'text-orange-400' : w > 1 ? 'text-orange-700' : w <= 0.5 ? 'text-red-800' : 'text-stone-500'
  return <span className={`font-display text-[10px] tracking-[.06em] ${cls}`}>×{w.toFixed(2)}</span>
}

function AttrRow({ label, value, xp, cost, weight }: { label: string; value: number; xp: number; cost: number; weight: number }) {
  const pct = Math.min(100, Math.round((xp / cost) * 100))
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-40 truncate">{label}</span>
      <span className="stat w-8 text-right">{value}</span>
      <span className="w-9"><WeightChip w={weight} /></span>
      <div className="h-1.5 flex-1 bg-[#171412]">
        <div className="h-1.5 bg-gradient-to-r from-orange-700 to-orange-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { career, update, create, reset } = useCareer()
  const [challengeBadge, setChallengeBadge] = useState(BADGES[0].id)
  const [nextStyle, setNextStyle] = useState<string | null>(null)
  const [showAttrs, setShowAttrs] = useState(false)
  const [showAllBadges, setShowAllBadges] = useState(false)
  const [primary, setPrimary] = useState<Category>('three')
  const [secondary, setSecondary] = useState<Category>('mid')

  if (!career) return null

  const { player, seasons } = career
  const age = player.startAge + seasons.length - 1
  const season = seasons[seasons.length - 1]
  const playedGames = season.games.filter(g => g.box && g.box.min > 0)
  const wins = playedGames.filter(g => g.context.win).length
  const seasonXpTotal = playedGames.reduce((s, g) => s + gameXpBreakdown(career, g, seasons.length - 1).total, 0)
  const offTotal = Math.round(offseasonTotal(career.config, age, seasonXpTotal))
  const attrValues = Object.fromEntries(ATTRIBUTES.map(a => [a.id, career.attributes[a.id]?.value ?? 0]))
  const ovr = estimateOverall(attrValues, player.position)
  const delta = seasonOvrDelta(career)
  const avg = recentAverages(season.games, 999)
  const catAvg = categoryAverages(career)
  const style = getStyle(career.playStyle)
  const activeBadgeCount = BADGES.filter(b => tierOf(career.badges[b.id]?.progress ?? 0) > 0).length
  const sortedBadges = [...BADGES].sort((a, b) =>
    tierOf(career.badges[b.id]?.progress ?? 0) - tierOf(career.badges[a.id]?.progress ?? 0))
  const visibleBadges = showAllBadges ? BADGES : sortedBadges.slice(0, 4)

  function addChallenge() {
    update(c => { c.activeChallenges.push(createChallenge(challengeBadge, playedGameCount(c))) })
  }

  function removeChallenge(idx: number) {
    update(c => { c.activeChallenges.splice(idx, 1) })
  }

  function closeSeason() {
    const style = nextStyle ?? career!.playStyle ?? 'balanced'
    const withPackage = playedGames.length > 0
    const msg = withPackage
      ? `Fechar ${season.year}: foco ${CATEGORY_LABELS[primary]} + ${CATEGORY_LABELS[secondary]}, pacote ≈ ${offTotal} XP. Próxima temporada com ${getStyle(style).name}. Continuar?`
      : `Iniciar nova temporada com estilo ${getStyle(style).name}? (sem jogos, sem pacote de off-season)`
    if (!window.confirm(msg)) return
    update(c => {
      const last = c.seasons[c.seasons.length - 1]
      if (withPackage) last.offseason = { primary, secondary }
      c.seasons.push({ year: last.year + 1, games: [], playStyle: style })
      c.playStyle = style
      c.nextGoals = null; c.pendingContext = null; c.lastResult = null
      recalcCareer(c)  // reaplica tudo: off-season + regressão viram pendingInstructions
    })
  }

  function deleteCareer() {
    if (!window.confirm('Apagar carreira? Isso não pode ser desfeito.')) return
    reset()
  }

  function handleExport() {
    const blob = new Blob([exportCareer(career!)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${player.name || 'carreira'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const c = importCareer(String(reader.result))
        recalcCareer(c)
        create(c)
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Falha ao importar arquivo')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-col gap-3.5">

      {/* Hero */}
      <div className="hud-panel-hot">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="font-display text-[10px] tracking-[.2em] text-orange-400 uppercase">
              {player.position} · {player.team} · {player.heightCm} CM
            </div>
            <div className="font-display text-[29px] leading-none font-bold uppercase">{player.name}</div>
            <div className="mt-1 flex gap-1.5">
              <span className="hud-chip hud-chip-active px-2 py-1 text-[11px]">{style.name}</span>
              <span className="hud-chip px-2 py-1 text-[11px]">{age} anos</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="hud-label tracking-[.18em]">Overall</div>
            <div className="stat text-[58px] leading-[.95] text-orange-400 drop-shadow-[0_0_24px_rgba(249,115,22,.55)]">{ovr}</div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className={`font-display text-[13px] font-bold ${delta > 0 ? 'text-green-400' : 'text-hud-mut'}`}>
                {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${-delta}` : '—'}
              </span>
              <span className="font-display text-[9px] tracking-[.12em] text-hud-mut">NA TEMP. {season.year}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrades liberados */}
      {career.pendingInstructions.length > 0 ? (
        <div className="flex flex-col gap-3 border border-amber-400/40 p-4 clip-corner-lg"
          style={{ background: 'linear-gradient(150deg, rgba(120,53,15,.42), #0c0b0a 65%)' }}>
          <div className="flex items-center gap-2">
            <span className="h-[7px] w-[7px] rotate-45 bg-amber-400 animate-[hudPulse_2.4s_ease-in-out_infinite]" />
            <span className="hud-title text-[15px]">Upgrades liberados</span>
            <span className="ml-auto font-display text-[11px] tracking-[.1em] text-amber-200">
              {pad2(career.pendingInstructions.length)}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {career.pendingInstructions.map(i => (
              <div key={i.id}
                className={`bg-hud-bg/60 border-l-2 px-3 py-2.5 text-sm font-medium ${i.type === 'badge' ? 'border-slate-300' : 'border-amber-400'}`}>
                {i.text}
              </div>
            ))}
          </div>
          {career.pendingInstructions.some(i => i.id.startsWith('offseason-')) && (
            <div className="border-l-2 border-orange-500 bg-orange-950/30 px-3 py-2 text-xs text-orange-200">
              Aplique no editor de roster do 2K e ajuste <b>Potential = OVR</b> para o 2K não progredir sozinho.
            </div>
          )}
          <button className="btn-cta" onClick={() => update(c => {
            c.appliedInstructionIds = [...(c.appliedInstructionIds ?? []), ...c.pendingInstructions.map(i => i.id)]
            c.pendingInstructions = []
          })}>
            Apliquei tudo no 2K
          </button>
        </div>
      ) : (
        <div className="hud-panel py-3 text-sm text-hud-mut2">Nenhuma pendência para aplicar no 2K.</div>
      )}

      {/* Atributos */}
      <div className="hud-panel flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="hud-title">Atributos</span>
          <span className="hud-label tracking-[.12em]">{ATTRIBUTES.length} em {CATEGORIES.length} categorias</span>
        </div>
        <div className="flex items-end gap-1.5">
          {CATEGORIES.map(cat => {
            const focused = styleCategoryMult(career.playStyle, cat) > 1
            return (
              <div key={cat} className="flex flex-1 flex-col items-center gap-1.5">
                <span className={`font-display text-[13px] font-bold ${focused ? 'text-orange-400' : 'text-stone-400'}`}>{catAvg[cat]}</span>
                <div className="flex h-[76px] w-full flex-col justify-end bg-[#171412]">
                  <div className={focused
                    ? 'bg-gradient-to-b from-orange-300 to-orange-700'
                    : 'bg-gradient-to-b from-stone-600 to-stone-800'}
                    style={{ height: `${catAvg[cat]}%` }} />
                </div>
                <span className="font-display text-[9px] tracking-[.06em] text-hud-mut">{CATEGORY_ABBR[cat]}</span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between border-t border-hud-line pt-2.5">
          <span className="font-display text-[10px] tracking-[.1em] text-orange-700 uppercase">
            Laranja = foco do estilo {style.name} · ×w = afinidade (estilo·posição·altura)
          </span>
          <button className="text-sm font-medium text-stone-400" onClick={() => setShowAttrs(v => !v)}>
            {showAttrs ? 'Fechar lista' : 'Abrir lista'}
          </button>
        </div>
        {showAttrs && (
          <div className="flex flex-col gap-3 border-t border-hud-line pt-3">
            {CATEGORIES.map(cat => {
              const defs = attributesByCategory(cat)
              const ws = defs.map(d => attrWeight(d.id, season.playStyle, player.position, player.heightCm))
              const wsum = ws.reduce((s, w) => s + w, 0)
              return (
                <div key={cat} className="flex flex-col gap-1">
                  <span className="hud-label">{CATEGORY_LABELS[cat]}</span>
                  {defs.map((a, i) => {
                    const state = career.attributes[a.id]
                    // fatia relativa aos irmãos da categoria, não o peso bruto (categoria de 1 atributo sempre daria 100%)
                    return (
                      <AttrRow key={a.id} label={a.label} value={state.value} xp={state.xp}
                        cost={upgradeCost(state.value, career.config)}
                        weight={ws[i] * defs.length / wsum} />
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-baseline justify-between px-0.5">
        <span className="hud-title">Badges</span>
        <span className="hud-label tracking-[.12em]">{pad2(activeBadgeCount)} / {BADGES.length} ativas</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {visibleBadges.map(b => {
          const progress = career.badges[b.id]?.progress ?? 0
          const tier = tierOf(progress)
          const base = progressForTier(tier)
          const maxed = tier >= TIER_THRESHOLDS.length
          const next = TIER_THRESHOLDS[tier]
          const pct = maxed ? 100 : Math.round(((progress - base) / (next - base)) * 100)
          const ts = TIER_STYLE[tier]
          const onSegs = maxed ? 5 : Math.min(4, Math.floor(pct / 20))
          return (
            <div key={b.id} className={`flex flex-col gap-2 border p-3 clip-corner ${ts.border}`}
              style={ts.grad ? { background: 'linear-gradient(150deg, rgba(120,113,108,.08), #0d0c0b 70%)' } : { background: '#0d0c0b' }}>
              <div className="flex items-center justify-between gap-1">
                <span className={`truncate text-[13px] font-semibold ${tier === 0 ? 'text-stone-400' : ''}`}>{b.name}</span>
                <div className="flex items-center gap-1.5">
                  <WeightChip w={badgeWeight(b.id, b.group, season.playStyle, player.position, player.heightCm)} />
                  <span className={`font-display text-[10px] tracking-[.12em] uppercase ${ts.label}`}>
                    {tier === 0 ? 'Sem tier' : TIER_NAMES[tier]}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className={`h-[5px] flex-1 ${i < onSegs && ts.seg ? ts.seg : 'bg-stone-900'}`} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <button className="btn-ghost text-stone-400" onClick={() => setShowAllBadges(v => !v)}>
        {showAllBadges ? 'Mostrar menos' : 'Ver todas as badges'}
      </button>

      {/* Desafios */}
      <div className="hud-panel flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="hud-title">Desafio ativo</span>
          {career.activeChallenges.length > 0 && (
            <span className="stat text-sm text-orange-400">
              {pad2(career.activeChallenges[0].currentStreak)} / {pad2(career.activeChallenges[0].streakLen)}
            </span>
          )}
        </div>
        {career.activeChallenges.length === 0 && (
          <p className="text-sm text-hud-mut2">Nenhum desafio ativo.</p>
        )}
        {career.activeChallenges.map((ch, idx) => (
          <div key={`${ch.badgeId}-${idx}`} className="flex flex-col gap-2">
            <p className="text-sm leading-snug">{ch.description}</p>
            <div className="flex gap-1.5">
              {Array.from({ length: ch.streakLen }, (_, i) => (
                <div key={i} className={`h-1.5 flex-1 ${i < ch.currentStreak ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,.5)]' : 'bg-stone-900'}`} />
              ))}
            </div>
            <button className="btn-ghost self-start px-4 py-1.5 text-stone-400" onClick={() => removeChallenge(idx)}>Remover</button>
          </div>
        ))}
        {career.activeChallenges.length < 2 && (
          <div className="flex gap-2 border-t border-hud-line pt-3">
            <select className="input flex-1 text-sm" value={challengeBadge} onChange={e => setChallengeBadge(e.target.value)}>
              {BADGES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button className="border border-orange-500/40 px-3 py-2 text-sm font-semibold text-orange-300" onClick={addChallenge}>
              Novo desafio
            </button>
          </div>
        )}
      </div>

      {/* Médias */}
      {avg ? (
        <div className="grid grid-cols-5 gap-px border border-hud-line bg-hud-line">
          {[
            ['PPG', avg.pts.toFixed(1), false],
            ['RPG', avg.reb.toFixed(1), false],
            ['APG', avg.ast.toFixed(1), false],
            ['FG', avg.fga > 0 ? `${(avg.fgm / avg.fga * 100).toFixed(0)}%` : '0%', false],
            ['3P', avg.tpa > 0 ? `${(avg.tpm / avg.tpa * 100).toFixed(0)}%` : '0%', true],
          ].map(([label, value, hot]) => (
            <div key={label as string} className="flex flex-col items-center gap-1 bg-hud-panel px-1 py-3">
              <span className={`stat text-xl leading-none ${hot ? 'text-orange-400' : ''}`}>{value}</span>
              <span className="font-display text-[9px] tracking-[.1em] text-hud-mut">{label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="hud-panel py-3 text-sm text-hud-mut2">Nenhum jogo registrado nesta temporada.</div>
      )}

      {/* Off-season */}
      <div className="flex flex-col gap-2.5 border-t border-hud-line pt-4">
        <span className="hud-label">Off-season</span>
        <div className="grid grid-cols-4 gap-px border border-hud-line bg-hud-line text-center">
          {[['JOGOS', String(playedGames.length)], ['W–L', `${wins}–${playedGames.length - wins}`],
            ['OVR Δ', (delta >= 0 ? '+' : '') + delta], ['XP', String(Math.round(seasonXpTotal))]].map(([l, v]) => (
            <div key={l} className="flex flex-col items-center gap-1 bg-hud-panel px-1 py-2">
              <span className="stat text-lg leading-none">{v}</span>
              <span className="font-display text-[9px] tracking-[.1em] text-hud-mut">{l}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="input text-sm" value={primary} onChange={e => setPrimary(e.target.value as Category)} title="Foco primário (35%)">
            {CATEGORIES.map(c => <option key={c} value={c}>1º {CATEGORY_LABELS[c]}</option>)}
          </select>
          <select className="input text-sm" value={secondary} onChange={e => setSecondary(e.target.value as Category)} title="Foco secundário (15%)">
            {CATEGORIES.map(c => <option key={c} value={c}>2º {CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        {primary === secondary && <span className="text-xs text-red-400">Escolha dois focos diferentes.</span>}
        <select className="input text-sm" value={nextStyle ?? (career.playStyle ?? 'balanced')}
          onChange={e => setNextStyle(e.target.value)} title="Estilo da próxima temporada (não afeta o pacote)">
          {PLAY_STYLES.map(s => <option key={s.id} value={s.id}>{s.reference ? `${s.name} — ${s.reference}` : s.name}</option>)}
        </select>
        <span className="font-display text-[9px] tracking-[.1em] text-hud-mut uppercase">Estilo vale a partir da próxima temporada</span>
        <div className="flex items-center justify-between">
          <span className="font-display text-[10px] tracking-[.1em] text-hud-mut uppercase">
            {playedGames.length > 0 ? `Pacote ≈ ${offTotal} XP · 50% geral / 35% 1º / 15% 2º` : 'Sem jogos nesta temporada — sem pacote'}
          </span>
          <button className="border border-orange-500/40 px-3 py-2 text-sm font-semibold text-orange-300 disabled:opacity-40"
            disabled={playedGames.length > 0 && primary === secondary} onClick={closeSeason}>
            {playedGames.length > 0 ? 'Fechar temporada' : 'Nova temporada'}
          </button>
        </div>
      </div>

      {/* Gestão */}
      <div className="flex flex-col gap-2.5 border-t border-hud-line pt-4">
        <span className="hud-label">Gestão da carreira</span>
        <div className="grid grid-cols-3 gap-2">
          <button className="btn-ghost" onClick={handleExport}>Exportar JSON</button>
          <label className="btn-ghost cursor-pointer">
            Importar JSON
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
          <button className="border border-red-400/35 px-3 py-2 text-sm font-medium text-red-400" onClick={deleteCareer}>
            Apagar carreira
          </button>
        </div>
      </div>
    </div>
  )
}
