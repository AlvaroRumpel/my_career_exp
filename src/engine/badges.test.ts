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
    const instructions = applyBadgeProgress(badges, shooterGame, ctx, 'SG', 196, 'test')
    expect(badges['deadeye'].progress).toBeGreaterThanOrEqual(TIER_THRESHOLDS[0])
    expect(instructions.some(i => i.badge === 'deadeye' && i.tier === 1)).toBe(true)
  })
  it('every badge accrues some progress over a plausible season sample', () => {
    const badges: Record<string, BadgeState> = {}
    for (const b of BADGES) badges[b.id] = { progress: 0 }
    // 20 jogos variados devem tocar todas as badges (proxies incluídas)
    for (let i = 0; i < 20; i++) {
      applyBadgeProgress(badges, { ...shooterGame, ast: 9, reb: 11, stl: 2, blk: 2, tov: 2 }, ctx, 'SF', 200, `game${i}`)
    }
    for (const b of BADGES) {
      expect(badges[b.id].progress, b.id).toBeGreaterThan(0)
    }
  })
})

describe('position affects badges as weight, not gate', () => {
  const mk = () => Object.fromEntries(BADGES.map(b => [b.id, { progress: 0 }])) as Record<string, BadgeState>
  const bigGame: BoxScore = { min: 30, pts: 20, reb: 10, ast: 3, stl: 1, blk: 3, tov: 1, fgm: 8, fga: 12, tpm: 0, tpa: 0, ftm: 4, fta: 6, plusMinus: 8 }
  it('PG still progresses Post Lockdown, slower than a C', () => {
    const pg = mk(); const c = mk()
    applyBadgeProgress(pg, bigGame, ctx, 'PG', 184, 'g')
    applyBadgeProgress(c, bigGame, ctx, 'C', 217, 'g')
    expect(pg['post-lockdown'].progress).toBeGreaterThan(0)
    expect(c['post-lockdown'].progress).toBeGreaterThan(pg['post-lockdown'].progress * 2)
  })
  it('C still progresses Ankle Assassin, slower than a PG', () => {
    const pg = mk(); const c = mk()
    applyBadgeProgress(pg, { ...bigGame, ast: 7 }, ctx, 'PG', 184, 'g')
    applyBadgeProgress(c, { ...bigGame, ast: 7 }, ctx, 'C', 217, 'g')
    expect(c['ankle-assassin'].progress).toBeGreaterThan(0)
    expect(pg['ankle-assassin'].progress).toBeGreaterThan(c['ankle-assassin'].progress)
  })
})
