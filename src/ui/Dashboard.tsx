import { useState, type ChangeEvent } from 'react'
import { useCareer } from './CareerContext'
import { estimateOverall, ATTRIBUTES, attributesByCategory } from '../engine/attributes'
import { upgradeCost } from '../engine/progression'
import { BADGES, TIER_NAMES, TIER_THRESHOLDS, tierOf, progressForTier } from '../engine/badges'
import { recentAverages } from '../engine/goals'
import { createChallenge } from '../engine/challenges'
import { exportCareer, importCareer } from '../storage'
import { recalcCareer } from '../engine/recalc'
import type { Category } from '../engine/types'

const CATEGORY_LABELS: Record<Category, string> = {
  inside: 'Interior', mid: 'Mid-Range', three: 'Três', ft: 'Lance Livre',
  playmaking: 'Playmaking', rebounding: 'Rebote', defense: 'Defesa', physical: 'Físico',
}
const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

function AttrRow({ label, value, xp, cost }: { label: string; value: number; xp: number; cost: number }) {
  const pct = Math.min(100, Math.round((xp / cost) * 100))
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-40 truncate">{label}</span>
      <span className="w-8 text-right font-mono">{value}</span>
      <div className="h-2 flex-1 rounded bg-zinc-800">
        <div className="h-2 rounded bg-orange-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { career, update, create, reset } = useCareer()
  const [challengeBadge, setChallengeBadge] = useState(BADGES[0].id)

  if (!career) return null

  const { player, seasons } = career
  const age = player.startAge + seasons.length - 1
  const season = seasons[seasons.length - 1]
  const attrValues = Object.fromEntries(ATTRIBUTES.map(a => [a.id, career.attributes[a.id]?.value ?? 0]))
  const ovr = estimateOverall(attrValues, player.position)
  const avg = recentAverages(season.games, 999)

  function addChallenge() {
    update(c => { c.activeChallenges.push(createChallenge(challengeBadge)) })
  }

  function removeChallenge(idx: number) {
    update(c => { c.activeChallenges.splice(idx, 1) })
  }

  function newSeason() {
    if (!window.confirm('Iniciar nova temporada?')) return
    update(c => {
      const last = c.seasons[c.seasons.length - 1]
      c.seasons.push({ year: last.year + 1, games: [] })
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-zinc-800 p-4">
        <div>
          <h1 className="text-xl font-bold">{player.name}</h1>
          <p className="text-sm text-zinc-400">{player.position} · {player.team} · {age} anos</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-orange-500">{ovr} OVR</p>
          <p className="text-sm text-zinc-400">Temporada {season.year}</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Instruções pendentes</h2>
        {career.pendingInstructions.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma pendência.</p>
        ) : (
          <ul className="list-inside list-disc space-y-1 text-sm">
            {career.pendingInstructions.map(i => <li key={i.id}>{i.text}</li>)}
          </ul>
        )}
        <button className="btn" disabled={career.pendingInstructions.length === 0}
          onClick={() => update(c => { c.pendingInstructions = [] })}>
          Apliquei tudo no 2K
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Atributos</h2>
        {CATEGORIES.map(cat => (
          <div key={cat} className="space-y-1">
            <h3 className="text-sm font-semibold text-zinc-400">{CATEGORY_LABELS[cat]}</h3>
            {attributesByCategory(cat).map(a => {
              const state = career.attributes[a.id]
              return (
                <AttrRow key={a.id} label={a.label} value={state.value} xp={state.xp}
                  cost={upgradeCost(state.value, career.config)} />
              )
            })}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Badges</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {BADGES.map(b => {
            const progress = career.badges[b.id]?.progress ?? 0
            const tier = tierOf(progress)
            const base = progressForTier(tier)
            const maxed = tier >= TIER_THRESHOLDS.length
            const next = TIER_THRESHOLDS[tier]
            const pct = maxed ? 100 : Math.round(((progress - base) / (next - base)) * 100)
            return (
              <div key={b.id} className="rounded border border-zinc-800 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="truncate">{b.name}</span>
                  <span className="font-mono text-orange-500">{TIER_NAMES[tier]}</span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-zinc-800">
                  <div className="h-1.5 rounded bg-orange-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Desafios ativos</h2>
        {career.activeChallenges.map((ch, idx) => (
          <div key={`${ch.badgeId}-${idx}`} className="flex items-center justify-between gap-2 rounded border border-zinc-800 p-2 text-sm">
            <span>{ch.description} — sequência {ch.currentStreak}/{ch.streakLen}</span>
            <button className="btn" onClick={() => removeChallenge(idx)}>Remover</button>
          </div>
        ))}
        {career.activeChallenges.length < 2 && (
          <div className="flex items-center gap-2">
            <select className="input" value={challengeBadge} onChange={e => setChallengeBadge(e.target.value)}>
              {BADGES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button className="btn" onClick={addChallenge}>Criar desafio</button>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Médias da temporada</h2>
        {avg ? (
          <div className="grid grid-cols-5 gap-2 text-center text-sm">
            <div><p className="text-zinc-400">PPG</p><p className="font-mono">{avg.pts.toFixed(1)}</p></div>
            <div><p className="text-zinc-400">RPG</p><p className="font-mono">{avg.reb.toFixed(1)}</p></div>
            <div><p className="text-zinc-400">APG</p><p className="font-mono">{avg.ast.toFixed(1)}</p></div>
            <div><p className="text-zinc-400">FG%</p><p className="font-mono">{avg.fga > 0 ? (avg.fgm / avg.fga * 100).toFixed(1) : '0.0'}</p></div>
            <div><p className="text-zinc-400">3P%</p><p className="font-mono">{avg.tpa > 0 ? (avg.tpm / avg.tpa * 100).toFixed(1) : '0.0'}</p></div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Nenhum jogo registrado nesta temporada.</p>
        )}
      </section>

      <section className="space-y-2 border-t border-zinc-800 pt-4">
        <h2 className="font-semibold">Gestão</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={handleExport}>Exportar JSON</button>
          <label className="btn cursor-pointer">
            Importar JSON
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
          <button className="btn" onClick={newSeason}>Nova temporada</button>
          <button className="btn bg-red-700 hover:bg-red-600" onClick={deleteCareer}>Apagar carreira</button>
        </div>
      </section>
    </div>
  )
}
