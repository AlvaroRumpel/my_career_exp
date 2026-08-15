import { describe, it, expect } from 'vitest'
import { applyGameXp } from './progression'
import { applyBadgeProgress } from './badges'
import { processGame, recalcCareer } from './recalc'
import { DEFAULT_CONFIG } from './types'
import { ATTRIBUTES } from './attributes'
import { BADGES } from './badges'
import type { BoxScore, Career, Game, GameContext, BadgeState } from './types'

const ctx: GameContext = { opponent: 'LAL', home: true, playoffs: false, win: false, date: '2026-01-01' }
const box: BoxScore = { min: 34, pts: 27, reb: 6, ast: 6, stl: 2, blk: 1, tov: 2, fgm: 9, fga: 17, tpm: 5, tpa: 9, ftm: 4, fta: 5, plusMinus: 6 }

function makeCareer(playStyle?: string): Career {
  const attributes: Career['attributes'] = {}
  for (const a of ATTRIBUTES) attributes[a.id] = { value: 70, xp: 0 }
  const initialAttributes: Record<string, number> = {}
  for (const a of ATTRIBUTES) initialAttributes[a.id] = 70
  const initialBadges: Record<string, number> = {}
  for (const b of BADGES) initialBadges[b.id] = 0
  const badges: Record<string, BadgeState> = Object.fromEntries(BADGES.map(b => [b.id, { progress: 0 }]))
  return {
    player: { name: 'T', position: 'SG', heightCm: 196, team: 'BOS', startAge: 22 },
    initialAttributes, initialBadges, attributes, badges, activeChallenges: [],
    seasons: [{ year: 2026, games: [], playStyle }],
    pendingInstructions: [], appliedInstructionIds: [], config: DEFAULT_CONFIG,
    targetOverrides: {}, playStyle,
  }
}

describe('style multipliers in applyGameXp', () => {
  it('focus category earns catMult, slow shrinks, neutral 1.0x vs balanced', () => {
    const base = applyGameXp(makeCareer(), box, ctx, 22, {}, 'g1', 'balanced')
    const sniper = applyGameXp(makeCareer(), box, ctx, 22, {}, 'g1', 'sniper')
    expect(sniper.xpByCategory.three).toBeCloseTo(base.xpByCategory.three * 1.7, 5)
    expect(sniper.xpByCategory.inside).toBeCloseTo(base.xpByCategory.inside * 0.9, 5)
    expect(sniper.xpByCategory.defense).toBeCloseTo(base.xpByCategory.defense, 5)
  })
  it('omitting styleId behaves as balanced (backward compat)', () => {
    const implicit = applyGameXp(makeCareer(), box, ctx, 22, {}, 'g1')
    const explicit = applyGameXp(makeCareer(), box, ctx, 22, {}, 'g1', 'balanced')
    expect(implicit.xpByCategory).toEqual(explicit.xpByCategory)
  })
})

describe('style affinity in applyBadgeProgress', () => {
  it('focus badge progresses faster, unrelated badge unchanged', () => {
    const mk = () => Object.fromEntries(BADGES.map(b => [b.id, { progress: 0 }])) as Record<string, BadgeState>
    const base = mk(); const sniper = mk()
    applyBadgeProgress(base, box, ctx, 'SG', 196, 'g1', 'balanced')
    applyBadgeProgress(sniper, box, ctx, 'SG', 196, 'g1', 'sniper')
    expect(sniper['deadeye'].progress).toBeGreaterThan(base['deadeye'].progress)
    expect(sniper['dimer'].progress).toBeCloseTo(base['dimer'].progress, 5)
  })
})

describe('processGame derives style from the season', () => {
  const game = (i: number): Game => ({
    id: `g${i}`, context: ctx, box, goals: [], goalsMet: [],
  })
  it('season with sniper style boosts three XP vs balanced season', () => {
    const cSniper = makeCareer('sniper'); const cBase = makeCareer()
    const g1 = game(1); const g2 = game(2)
    cSniper.seasons[0].games.push(g1); cBase.seasons[0].games.push(g2)
    processGame(cSniper, 0, g1, 0); processGame(cBase, 0, g2, 0)
    const sum = (c: Career) => Object.values(c.attributes).reduce((s, a) => s + a.xp + (a.value - 70) * 100, 0)
    expect(sum(cSniper)).not.toBe(sum(cBase))
    expect(cSniper.badges['deadeye'].progress).toBeGreaterThan(cBase.badges['deadeye'].progress)
  })
  it('replay with style switch across seasons is deterministic', () => {
    const c = makeCareer('sniper')
    for (let i = 0; i < 6; i++) { const g = game(i); c.seasons[0].games.push(g); processGame(c, 0, g, i) }
    c.seasons.push({ year: 2027, games: [], playStyle: 'ancora' })
    for (let i = 6; i < 12; i++) { const g = game(i); c.seasons[1].games.push(g); processGame(c, 1, g, i) }
    const attrs = JSON.stringify(c.attributes); const badges = JSON.stringify(c.badges)
    recalcCareer(c)
    expect(JSON.stringify(c.attributes)).toBe(attrs)
    expect(JSON.stringify(c.badges)).toBe(badges)
  })
})
