import { describe, it, expect } from 'vitest'
import { BADGES, tierOf, progressForTier, applyBadgeProgress, TIER_THRESHOLDS } from './badges'
import type { BoxScore, GameContext, BadgeState } from './types'

const ctx: GameContext = { opponent: 'NYK', home: true, playoffs: false, win: true, date: '2026-01-15' }
const shooterGame: BoxScore = { min: 36, pts: 33, reb: 4, ast: 3, stl: 1, blk: 0, tov: 2, fgm: 11, fga: 20, tpm: 7, tpa: 12, ftm: 4, fta: 4, plusMinus: 12 }

describe('badge catalog', () => {
  it('has exactly 40 unique badges', () => {
    expect(BADGES.length).toBe(40)
    expect(new Set(BADGES.map(b => b.id)).size).toBe(40)
  })
  it('group counts match NBA 2K25', () => {
    const count = (g: string) => BADGES.filter(b => b.group === g).length
    expect(count('inside')).toBe(11)
    expect(count('outside')).toBe(5)
    expect(count('playmaking')).toBe(9)
    expect(count('defense')).toBe(10)
    expect(count('rebounding')).toBe(2)
    expect(count('general')).toBe(3) // Brick Wall, Slippery Off-Ball, Pogo Stick
  })
})

describe('tiers', () => {
  it('maps progress to tier', () => {
    expect(tierOf(0)).toBe(0)
    expect(tierOf(TIER_THRESHOLDS[0])).toBe(1)
    expect(tierOf(TIER_THRESHOLDS[4])).toBe(5)
  })
  it('progressForTier is inverse floor of tierOf', () => {
    for (let t = 1; t <= 5; t++) expect(tierOf(progressForTier(t))).toBe(t)
  })
})

describe('applyBadgeProgress', () => {
  it('hot 3PT game advances Deadeye and emits tier-up instruction at threshold', () => {
    const badges: Record<string, BadgeState> = {}
    for (const b of BADGES) badges[b.id] = { progress: 0 }
    badges['deadeye'].progress = TIER_THRESHOLDS[0] - 1
    const instructions = applyBadgeProgress(badges, shooterGame, ctx, 'SG')
    expect(badges['deadeye'].progress).toBeGreaterThanOrEqual(TIER_THRESHOLDS[0])
    expect(instructions.some(i => i.badge === 'deadeye' && i.tier === 1)).toBe(true)
  })
  it('every badge accrues some progress over a plausible season sample', () => {
    const badges: Record<string, BadgeState> = {}
    for (const b of BADGES) badges[b.id] = { progress: 0 }
    // 20 jogos variados devem tocar todas as badges (proxies incluídas)
    for (let i = 0; i < 20; i++) {
      applyBadgeProgress(badges, { ...shooterGame, ast: 9, reb: 11, stl: 2, blk: 2, tov: 2 }, ctx, 'SF')
    }
    for (const b of BADGES) {
      expect(badges[b.id].progress, b.id).toBeGreaterThan(0)
    }
  })
})
