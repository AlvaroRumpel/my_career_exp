import type { BoxScore, Career, Category, EngineConfig, GameContext, Instruction } from './types'
import { attributesByCategory } from './attributes'
import { categoryXp } from './categoryXp'
import { qualityMultiplier, ageMultiplier, contextMultiplier } from './multipliers'
import { styleCategoryMult } from './playStyles'
import { attrWeight } from './affinity'

export function upgradeCost(value: number, cfg: EngineConfig): number {
  return Math.round(cfg.baseCost * Math.pow(cfg.costGrowth, value - 70))
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
  const { position, heightCm } = career.player
  const mult = qualityMultiplier(box) * ageMultiplier(age, cfg) * contextMultiplier(ctx, cfg)
  const raw = categoryXp(box, position)
  const xpByCategory = {} as Record<Category, number>
  const instructions: Instruction[] = []
  let n = 0 // local counter, resets per call -> deterministic ids across replays

  for (const cat of Object.keys(raw) as Category[]) {
    const gameXp = raw[cat] * mult * styleCategoryMult(styleId, cat)
    const bonus = Math.min(goalBonus[cat] ?? 0, gameXp * cfg.goalBonusCap)
    const total = gameXp + bonus
    xpByCategory[cat] = total
    if (total <= 0) continue

    // divisão ponderada por afinidade entre os atributos <99 da categoria (peso só altera a fatia)
    const defs = attributesByCategory(cat).filter(d => career.attributes[d.id].value < 99)
    if (defs.length === 0) continue
    const weights = defs.map(d => attrWeight(d.id, styleId, position, heightCm))
    const wsum = weights.reduce((s, w) => s + w, 0)

    defs.forEach((d, i) => {
      const attr = career.attributes[d.id]
      attr.xp += total * weights[i] / wsum
      // loop resolve múltiplos +1 num jogo grande
      while (attr.value < 99 && attr.xp >= upgradeCost(attr.value, cfg)) {
        attr.xp -= upgradeCost(attr.value, cfg)
        attr.value += 1
        instructions.push({
          id: `instr-${gameId}-${n++}`, type: 'attribute',
          text: `+1 ${d.label} (${attr.value - 1} → ${attr.value})`,
          attribute: d.id, delta: 1,
        })
      }
      if (attr.value >= 99) attr.xp = 0
    })
  }
  return { xpByCategory, instructions }
}
