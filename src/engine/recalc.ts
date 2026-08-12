import type { Career, Game, Instruction } from './types'
import { ATTRIBUTES, PHYSICAL_REGRESSION_ORDER, estimateOverall } from './attributes'
import { BADGES, applyBadgeProgress, progressForTier } from './badges'
import { applyGameXp } from './progression'
import { updateChallenge, createChallenge } from './challenges'
import { goalMet, goalBonus } from './goals'

export function ageAt(career: Career, seasonIndex: number): number {
  return career.player.startAge + seasonIndex
}

export function processGame(career: Career, seasonIndex: number, game: Game): Instruction[] {
  if (!game.box || game.box.min <= 0) return []
  const age = ageAt(career, seasonIndex)
  // metas
  game.goalsMet = game.goals.filter(g => goalMet(g, game.box!, game.context)).map(g => g.id)
  const bonus = goalBonus(game.goals, game.goalsMet)
  // XP de atributos
  const xpResult = applyGameXp(career, game.box, game.context, age, bonus)
  // badges passivas
  const badgeInstr = applyBadgeProgress(career.badges, game.box, game.context, career.player.position)
  // desafios ativos (completados são renovados pra mesma badge)
  for (const ch of career.activeChallenges) {
    const done = updateChallenge(ch, career.badges, game.box)
    if (done) Object.assign(ch, createChallenge(ch.badgeId))
  }
  const instructions = [...xpResult.instructions, ...badgeInstr]
  career.pendingInstructions.push(...instructions)
  const values = Object.fromEntries(ATTRIBUTES.map(a => [a.id, career.attributes[a.id].value]))
  game.ovrAfter = estimateOverall(values, career.player.position)
  return instructions
}

const REGRESSION_COUNT = (age: number) => (age >= 38 ? 4 : age >= 36 ? 3 : age >= 34 ? 2 : 0)

export function regressionInstructions(career: Career, seasonIndex: number): Instruction[] {
  const age = ageAt(career, seasonIndex)
  const count = REGRESSION_COUNT(age)
  const instructions: Instruction[] = []
  for (const attrId of PHYSICAL_REGRESSION_ORDER.slice(0, count)) {
    const attr = career.attributes[attrId]
    if (!attr || attr.value <= 25) continue
    attr.value -= 1
    const label = ATTRIBUTES.find(a => a.id === attrId)?.label ?? attrId
    instructions.push({
      id: `regress-${seasonIndex}-${attrId}`, type: 'attribute',
      text: `-1 ${label} (regressão, idade ${age})`, attribute: attrId, delta: -1,
    })
  }
  return instructions
}

export function recalcCareer(career: Career): void {
  // reset ao snapshot inicial
  career.attributes = {}
  for (const a of ATTRIBUTES) {
    career.attributes[a.id] = { value: career.initialAttributes[a.id] ?? 60, xp: 0 }
  }
  career.badges = {}
  for (const b of BADGES) {
    career.badges[b.id] = { progress: progressForTier(career.initialBadges[b.id] ?? 0) }
  }
  career.pendingInstructions = []
  for (const ch of career.activeChallenges) { ch.currentStreak = 0 }
  career.seasons.forEach((season, si) => {
    if (si > 0) {
      const regress = regressionInstructions(career, si)
      career.pendingInstructions.push(...regress)
    }
    for (const g of season.games) processGame(career, si, g)
  })
}
