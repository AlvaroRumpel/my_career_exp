import type { Career, Category, Game, Instruction } from './types'
import { ATTRIBUTES, PHYSICAL_REGRESSION_ORDER, estimateOverall } from './attributes'
import { BADGES, applyBadgeProgress, progressForTier } from './badges'
import { applyGameXp } from './progression'
import { updateChallenge, createChallenge, applyChallengeBonus } from './challenges'
import { goalMet, goalBonus } from './goals'
import { applyOffseason } from './offseason'

export function ageAt(career: Career, seasonIndex: number): number {
  return career.player.startAge + seasonIndex
}

// FIX D: global index counts only played games (box present, min > 0), in career order.
// DNP games are skipped entirely by processGame below and never advance the index, so a
// challenge's startGameIndex and the live/replay globalGameIndex stay comparable.
export function playedGameCount(career: Career): number {
  return career.seasons.reduce((sum, s) => sum + s.games.filter(g => g.box && g.box.min > 0).length, 0)
}

export function processGame(
  career: Career, seasonIndex: number, game: Game, globalGameIndex: number,
  seasonXp?: Partial<Record<Category, number>>,
): Instruction[] {
  if (!game.box || game.box.min <= 0) return []
  const age = ageAt(career, seasonIndex)
  const styleId = career.seasons[seasonIndex].playStyle ?? 'balanced'
  // metas
  game.goalsMet = game.goals.filter(g => goalMet(g, game.box!, game.context)).map(g => g.id)
  const bonus = goalBonus(game.goals, game.goalsMet)
  // XP de atributos
  const xpResult = applyGameXp(career, game.box, game.context, age, bonus, game.id, styleId)
  if (seasonXp) for (const [cat, v] of Object.entries(xpResult.xpByCategory)) seasonXp[cat as Category] = (seasonXp[cat as Category] ?? 0) + v
  // badges passivas
  const badgeInstr = applyBadgeProgress(career.badges, game.box, game.context, career.player.position, career.player.heightCm, game.id, styleId)
  // desafios ativos (completados são renovados pra mesma badge); desafios criados após este
  // jogo (startGameIndex > globalGameIndex) ainda não valem para o histórico sendo processado
  for (const ch of career.activeChallenges) {
    if (ch.startGameIndex > globalGameIndex) continue
    const done = updateChallenge(ch, game.box)
    if (done) {
      const list = (career.completedChallenges ??= [])
      if (!list.some(x => x.badgeId === ch.badgeId && x.gameIndex === globalGameIndex)) {
        list.push({ badgeId: ch.badgeId, gameIndex: globalGameIndex })
      }
      Object.assign(ch, createChallenge(ch.badgeId, globalGameIndex + 1))
    }
  }
  // bônus de desafios concluídos neste jogo (registro sobrevive ao replay; ver types.completedChallenges)
  for (const done of career.completedChallenges ?? []) {
    if (done.gameIndex === globalGameIndex) applyChallengeBonus(career.badges, done.badgeId)
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
  let globalGameIndex = 0
  let prevSeasonXp: Partial<Record<Category, number>> = {}
  career.seasons.forEach((season, si) => {
    if (si > 0) {
      // off-season da temporada anterior (se o usuário fechou com foco), depois regressão física
      career.pendingInstructions.push(...applyOffseason(career, si - 1, prevSeasonXp))
      career.pendingInstructions.push(...regressionInstructions(career, si))
    }
    const seasonXp: Partial<Record<Category, number>> = {}
    for (const g of season.games) {
      processGame(career, si, g, globalGameIndex, seasonXp)
      if (g.box && g.box.min > 0) globalGameIndex++
    }
    prevSeasonXp = seasonXp
  })
  // FIX B: already-applied instructions stay hidden across a replay (delete/import/etc.)
  const applied = new Set(career.appliedInstructionIds ?? [])
  career.pendingInstructions = career.pendingInstructions.filter(i => !applied.has(i.id))
}
