import { describe, it, expect } from 'vitest'
import { createChallenge, updateChallenge } from './challenges'
import { TIER_THRESHOLDS, tierOf } from './badges'
import type { BadgeState, BoxScore } from './types'

const game = (over: Partial<BoxScore>): BoxScore => ({
  min: 34, pts: 20, reb: 5, ast: 5, stl: 1, blk: 1, tov: 2,
  fgm: 8, fga: 16, tpm: 2, tpa: 6, ftm: 2, fta: 3, plusMinus: 4, ...over,
})

describe('challenges', () => {
  it('creates a streak challenge with sensible fields', () => {
    const c = createChallenge('dimer')
    expect(c.badgeId).toBe('dimer')
    expect(c.streakLen).toBeGreaterThan(1)
    expect(c.perGame).toBeGreaterThan(0)
    expect(c.currentStreak).toBe(0)
    expect(c.description.length).toBeGreaterThan(0)
  })
  it('missing the target resets the streak', () => {
    const c = createChallenge('dimer')
    const badges: Record<string, BadgeState> = { dimer: { progress: 0 } }
    updateChallenge(c, badges, game({ ast: c.perGame }))
    expect(c.currentStreak).toBe(1)
    updateChallenge(c, badges, game({ ast: 0 }))
    expect(c.currentStreak).toBe(0)
  })
  it('completing the streak advances badge 50% toward next tier', () => {
    const c = createChallenge('dimer')
    const badges: Record<string, BadgeState> = { dimer: { progress: 0 } }
    let done = false
    for (let i = 0; i < c.streakLen; i++) done = updateChallenge(c, badges, game({ ast: c.perGame + 2 }))
    expect(done).toBe(true)
    const gap = TIER_THRESHOLDS[0] - 0
    expect(badges.dimer.progress).toBeCloseTo(gap * 0.5, 5)
    expect(tierOf(badges.dimer.progress)).toBe(0)
  })
})
