import type { BadgeState, BoxScore, Challenge } from './types'
import { BADGES, TIER_THRESHOLDS, tierOf, progressForTier } from './badges'

// stat e alvo por badge; badges sem stat claro usam min (presença)
const CHALLENGE_SPECS: Record<string, { stat: Challenge['stat']; perGame: number; streakLen: number }> = {
  'deadeye': { stat: 'tpm', perGame: 4, streakLen: 3 },
  'limitless-range': { stat: 'tpm', perGame: 5, streakLen: 3 },
  'mini-marksman': { stat: 'tpm', perGame: 3, streakLen: 4 },
  'set-shot-specialist': { stat: 'tpm', perGame: 3, streakLen: 3 },
  'shifty-shooter': { stat: 'tpm', perGame: 4, streakLen: 3 },
  'dimer': { stat: 'ast', perGame: 8, streakLen: 3 },
  'bail-out': { stat: 'ast', perGame: 6, streakLen: 3 },
  'versatile-visionary': { stat: 'ast', perGame: 7, streakLen: 3 },
  'break-starter': { stat: 'ast', perGame: 5, streakLen: 4 },
  'glove': { stat: 'stl', perGame: 2, streakLen: 3 },
  'interceptor': { stat: 'stl', perGame: 3, streakLen: 2 },
  'on-ball-menace': { stat: 'stl', perGame: 2, streakLen: 3 },
  'high-flying-denier': { stat: 'blk', perGame: 2, streakLen: 3 },
  'paint-patroller': { stat: 'blk', perGame: 3, streakLen: 2 },
  'post-lockdown': { stat: 'blk', perGame: 2, streakLen: 3 },
  'rebound-chaser': { stat: 'reb', perGame: 10, streakLen: 3 },
  'boxout-beast': { stat: 'reb', perGame: 8, streakLen: 3 },
  'pogo-stick': { stat: 'blk', perGame: 2, streakLen: 3 },
  'posterizer': { stat: 'pts', perGame: 22, streakLen: 3 },
  'physical-finisher': { stat: 'pts', perGame: 20, streakLen: 3 },
  'paint-prodigy': { stat: 'pts', perGame: 18, streakLen: 3 },
}
const FALLBACK = { stat: 'pts' as const, perGame: 15, streakLen: 3 }

export function createChallenge(badgeId: string): Challenge {
  const spec = CHALLENGE_SPECS[badgeId] ?? FALLBACK
  const name = BADGES.find(b => b.id === badgeId)?.name ?? badgeId
  const statLabel: Record<Challenge['stat'], string> = {
    pts: 'pontos', ast: 'assistências', tpm: 'bolas de 3', reb: 'rebotes', stl: 'roubos', blk: 'tocos',
  }
  return {
    badgeId, stat: spec.stat, perGame: spec.perGame, streakLen: spec.streakLen, currentStreak: 0,
    description: `${name}: ${spec.perGame}+ ${statLabel[spec.stat]} por ${spec.streakLen} jogos seguidos`,
  }
}

export function updateChallenge(
  challenge: Challenge, badges: Record<string, BadgeState>, box: BoxScore,
): boolean {
  if (box.min <= 0) return false // DNP não quebra streak
  const value = box[challenge.stat]
  challenge.currentStreak = value >= challenge.perGame ? challenge.currentStreak + 1 : 0
  if (challenge.currentStreak < challenge.streakLen) return false
  const state = badges[challenge.badgeId]
  if (state) {
    const tier = tierOf(state.progress)
    const nextThreshold = tier >= 5 ? state.progress : TIER_THRESHOLDS[tier]
    const gap = Math.max(nextThreshold - state.progress, 0)
    state.progress += gap * 0.5
  }
  return true
}
