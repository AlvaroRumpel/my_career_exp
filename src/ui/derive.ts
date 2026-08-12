import type { Career, Category, Game } from '../engine/types'
import { ATTRIBUTES, attributesByCategory, estimateOverall } from '../engine/attributes'
import { ageMultiplier, contextMultiplier, qualityMultiplier } from '../engine/multipliers'
import { categoryXp } from '../engine/categoryXp'
import { styleCategoryMult } from '../engine/playStyles'
import { goalBonus } from '../engine/goals'

export const CATEGORY_LABELS: Record<Category, string> = {
  inside: 'Interior', mid: 'Mid-Range', three: 'Três', ft: 'Lance Livre',
  playmaking: 'Playmaking', rebounding: 'Rebote', defense: 'Defesa', physical: 'Físico',
}

export const CATEGORY_ABBR: Record<Category, string> = {
  three: '3PT', mid: 'MID', inside: 'INT', ft: 'LL',
  playmaking: 'PLY', rebounding: 'REB', defense: 'DEF', physical: 'FIS',
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

function currentOvr(career: Career): number {
  const values = Object.fromEntries(ATTRIBUTES.map(a => [a.id, career.attributes[a.id]?.value ?? 0]))
  return estimateOverall(values, career.player.position)
}

export function categoryAverages(career: Career): Record<Category, number> {
  const out = {} as Record<Category, number>
  for (const cat of CATEGORIES) {
    const defs = attributesByCategory(cat)
    const sum = defs.reduce((s, d) => s + (career.attributes[d.id]?.value ?? 0), 0)
    out[cat] = Math.round(sum / defs.length)
  }
  return out
}

// baseline = OVR no início da temporada atual (último ovrAfter da temporada anterior,
// ou o OVR estimado do snapshot inicial)
export function seasonOvrDelta(career: Career): number {
  const prev = career.seasons[career.seasons.length - 2]
  const prevOvr = prev?.games.filter(g => typeof g.ovrAfter === 'number').at(-1)?.ovrAfter
  const baseline = prevOvr ?? estimateOverall(career.initialAttributes, career.player.position)
  return currentOvr(career) - baseline
}

export interface XpBreakdown { total: number; byCategory: [Category, number][] }

// espelha a matemática de applyGameXp sem mutar nada — só para exibição
export function gameXpBreakdown(career: Career, game: Game, seasonIndex: number): XpBreakdown {
  if (!game.box || game.box.min <= 0) return { total: 0, byCategory: [] }
  const cfg = career.config
  const age = career.player.startAge + seasonIndex
  const styleId = career.seasons[seasonIndex]?.playStyle ?? 'balanced'
  const mult = qualityMultiplier(game.box) * ageMultiplier(age, cfg) * contextMultiplier(game.context, cfg)
  const raw = categoryXp(game.box, career.player.position)
  const bonus = goalBonus(game.goals, game.goalsMet)
  const byCategory: [Category, number][] = []
  for (const cat of CATEGORIES) {
    const gameXp = raw[cat] * mult * styleCategoryMult(styleId, cat)
    const total = gameXp + Math.min(bonus[cat] ?? 0, gameXp * cfg.goalBonusCap)
    if (total > 0) byCategory.push([cat, total])
  }
  byCategory.sort((a, b) => b[1] - a[1])
  return { total: Math.round(byCategory.reduce((s, [, v]) => s + v, 0)), byCategory }
}

export function preGameMultiplier(career: Career, home: boolean, playoffs: boolean): number {
  const age = career.player.startAge + career.seasons.length - 1
  return ageMultiplier(age, career.config)
    * contextMultiplier({ opponent: '', home, playoffs, win: false, date: '' }, career.config)
}
