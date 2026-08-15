import type { Career, Category, EngineConfig, Instruction, OffseasonChoice } from './types'
import { ageMultiplier } from './multipliers'
import { distributeCategoryXp } from './progression'
import { BADGES, tierOf, TIER_NAMES } from './badges'
import { badgeWeight } from './affinity'

const OFFSEASON_SPREAD = 0.5
const OFFSEASON_PRIMARY = 0.35
const OFFSEASON_SECONDARY = 0.15
// empurrão universal ≈ 3 jogos de proxy(0.5)+trickle(0.05), escalado por afinidade
const OFFSEASON_BADGE_UNITS = 3 * 0.55
export const CATEGORY_LIST: Category[] = ['inside', 'mid', 'three', 'ft', 'playmaking', 'rebounding', 'defense', 'physical']

export function offseasonTotal(cfg: EngineConfig, age: number, seasonXp: number): number {
  return cfg.offseasonBase * ageMultiplier(age, cfg) + cfg.offseasonShare * seasonXp
}

export function offseasonCategoryXp(total: number, choice: OffseasonChoice): Record<Category, number> {
  const out = {} as Record<Category, number>
  const spread = total * OFFSEASON_SPREAD / CATEGORY_LIST.length
  for (const c of CATEGORY_LIST) out[c] = spread
  if (choice.primary === choice.secondary) {
    out[choice.primary] += total * (OFFSEASON_PRIMARY + OFFSEASON_SECONDARY)
  } else {
    out[choice.primary] += total * OFFSEASON_PRIMARY
    out[choice.secondary] += total * OFFSEASON_SECONDARY
  }
  return out
}

export function applyOffseason(
  career: Career, seasonIndex: number, seasonXpByCategory: Partial<Record<Category, number>>,
): Instruction[] {
  const season = career.seasons[seasonIndex]
  if (!season?.offseason) return []
  const age = career.player.startAge + seasonIndex
  const styleId = season.playStyle ?? 'balanced'
  const seasonXp = Object.values(seasonXpByCategory).reduce((s, v) => s + (v ?? 0), 0)
  const total = offseasonTotal(career.config, age, seasonXp)
  const perCat = offseasonCategoryXp(total, season.offseason)
  const prefix = `Off-season ${season.year}: `
  const counter = { n: 0 }
  const instructions: Instruction[] = []
  for (const cat of CATEGORY_LIST) {
    instructions.push(...distributeCategoryXp(career, cat, perCat[cat], styleId, `offseason-${season.year}`, counter, prefix))
  }
  const { position, heightCm } = career.player
  let bn = 0
  for (const def of BADGES) {
    const state = career.badges[def.id]
    if (!state) continue
    const before = tierOf(state.progress)
    state.progress += OFFSEASON_BADGE_UNITS * badgeWeight(def.id, def.group, styleId, position, heightCm)
    const after = tierOf(state.progress)
    if (after > before) {
      instructions.push({
        id: `offseason-${season.year}-badge-${bn++}`, type: 'badge',
        text: `${prefix}Suba ${def.name} para ${TIER_NAMES[after]} no 2K`,
        badge: def.id, tier: after,
      })
    }
  }
  return instructions
}
