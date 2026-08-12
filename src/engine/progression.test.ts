import { describe, it, expect } from 'vitest'
import { upgradeCost, pickTarget, applyGameXp } from './progression'
import { DEFAULT_CONFIG } from './types'
import type { Career, BoxScore, GameContext } from './types'
import { ATTRIBUTES } from './attributes'

function makeCareer(): Career {
  const attributes: Career['attributes'] = {}
  for (const a of ATTRIBUTES) attributes[a.id] = { value: 70, xp: 0 }
  return {
    player: { name: 'Test', position: 'SG', heightCm: 196, team: 'BOS', startAge: 20 },
    initialAttributes: {}, initialBadges: {},
    attributes, badges: {}, activeChallenges: [], seasons: [],
    pendingInstructions: [], config: DEFAULT_CONFIG, targetOverrides: {},
  }
}

const goodGame: BoxScore = { min: 36, pts: 28, reb: 5, ast: 6, stl: 2, blk: 1, tov: 2, fgm: 10, fga: 18, tpm: 4, tpa: 8, ftm: 4, fta: 5, plusMinus: 10 }
const ctx: GameContext = { opponent: 'MIA', home: true, playoffs: false, win: true, date: '2026-01-10' }

describe('upgradeCost', () => {
  it('grows exponentially with value', () => {
    const c70 = upgradeCost(70, DEFAULT_CONFIG)
    const c85 = upgradeCost(85, DEFAULT_CONFIG)
    const c95 = upgradeCost(95, DEFAULT_CONFIG)
    expect(c70).toBe(100)
    expect(c85).toBeGreaterThan(c70 * 4)
    expect(c95).toBeGreaterThan(c85 * 2)
  })
})

describe('pickTarget', () => {
  it('picks lowest-value attribute in category', () => {
    const career = makeCareer()
    career.attributes['threePoint'].value = 65
    expect(pickTarget(career, 'three')).toBe('threePoint')
  })
  it('respects user override', () => {
    const career = makeCareer()
    career.targetOverrides['playmaking'] = 'passIQ'
    expect(pickTarget(career, 'playmaking')).toBe('passIQ')
  })
})

describe('applyGameXp', () => {
  it('accumulates XP and emits +1 instruction when threshold crossed', () => {
    const career = makeCareer()
    // força quase-limiar em three
    const target = pickTarget(career, 'three')
    career.attributes[target].xp = upgradeCost(70, DEFAULT_CONFIG) - 1
    const result = applyGameXp(career, goodGame, ctx, 22, {})
    const plusOne = result.instructions.find(i => i.attribute === target && i.delta === 1)
    expect(plusOne).toBeDefined()
    expect(career.attributes[target].value).toBe(71)
  })
  it('age 37 gains far less XP than age 22', () => {
    const young = makeCareer(); const old = makeCareer()
    const ry = applyGameXp(young, goodGame, ctx, 22, {})
    const ro = applyGameXp(old, goodGame, ctx, 37, {})
    expect(ro.xpByCategory.three).toBeLessThan(ry.xpByCategory.three * 0.4)
  })
  it('goal bonus is capped at 30% of game XP', () => {
    const career = makeCareer()
    const r = applyGameXp(career, goodGame, ctx, 22, { three: 999999 })
    const noBonus = applyGameXp(makeCareer(), goodGame, ctx, 22, {})
    expect(r.xpByCategory.three).toBeLessThanOrEqual(noBonus.xpByCategory.three * 1.31)
  })
})
