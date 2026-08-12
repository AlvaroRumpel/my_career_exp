import type { BoxScore, Career, Category, EngineConfig, GameContext, Instruction } from './types'
import { attributesByCategory, ATTRIBUTES } from './attributes'
import { categoryXp } from './categoryXp'
import { qualityMultiplier, ageMultiplier, contextMultiplier } from './multipliers'
import { styleCategoryMult } from './playStyles'

export function upgradeCost(value: number, cfg: EngineConfig): number {
  return Math.round(cfg.baseCost * Math.pow(cfg.costGrowth, value - 70))
}

export function pickTarget(career: Career, cat: Category): string {
  const override = career.targetOverrides[cat]
  const defs = attributesByCategory(cat)
  if (override && defs.some(d => d.id === override) && career.attributes[override].value < 99) return override
  const sorted = defs
    .filter(d => career.attributes[d.id].value < 99)
    .sort((a, b) => career.attributes[a.id].value - career.attributes[b.id].value)
  return sorted[0]?.id ?? defs[0].id
}

export interface GameXpResult {
  xpByCategory: Record<Category, number>
  instructions: Instruction[]
}

export function applyGameXp(
  career: Career, box: BoxScore, ctx: GameContext, age: number,
  goalBonus: Partial<Record<Category, number>>, gameId: string,
  styleId: string = 'balanced',
): GameXpResult {
  const cfg = career.config
  const mult = qualityMultiplier(box) * ageMultiplier(age, cfg) * contextMultiplier(ctx, cfg)
  const raw = categoryXp(box, career.player.position)
  const xpByCategory = {} as Record<Category, number>
  const instructions: Instruction[] = []
  let n = 0 // local counter, resets per call -> deterministic ids across replays

  for (const cat of Object.keys(raw) as Category[]) {
    const gameXp = raw[cat] * mult * styleCategoryMult(styleId, cat)
    const bonus = Math.min(goalBonus[cat] ?? 0, gameXp * cfg.goalBonusCap)
    const total = gameXp + bonus
    xpByCategory[cat] = total
    if (total <= 0) continue

    let remaining = total
    // aplica no alvo atual; se cruzar limiar, sobe e re-alveja
    while (remaining > 0) {
      const targetId = pickTarget(career, cat)
      const attr = career.attributes[targetId]
      if (attr.value >= 99) break
      attr.xp += remaining
      remaining = 0
      const cost = upgradeCost(attr.value, cfg)
      if (attr.xp >= cost) {
        attr.xp -= cost
        attr.value += 1
        const label = ATTRIBUTES.find(a => a.id === targetId)?.label ?? targetId
        instructions.push({
          id: `instr-${gameId}-${n++}`, type: 'attribute',
          text: `+1 ${label} (${attr.value - 1} → ${attr.value})`,
          attribute: targetId, delta: 1,
        })
        // excesso continua no mesmo atributo (novo custo maior); loop resolve múltiplos +1
        remaining = 0
        if (attr.xp >= upgradeCost(attr.value, cfg)) {
          remaining = attr.xp
          attr.xp = 0
        }
      }
    }
  }
  return { xpByCategory, instructions }
}
