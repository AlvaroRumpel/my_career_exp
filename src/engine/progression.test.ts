import { describe, it, expect } from 'vitest'
import { upgradeCost, applyGameXp, distributeCategoryXp } from './progression'
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
const ctxLoss: GameContext = { opponent: 'MIA', home: true, playoffs: false, win: false, date: '2026-01-10' }

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

describe('applyGameXp', () => {
  it('accumulates XP and emits +1 instruction when threshold crossed', () => {
    const career = makeCareer()
    // força quase-limiar em three
    const target = 'threePoint'
    career.attributes[target].xp = upgradeCost(70, DEFAULT_CONFIG) - 1
    const result = applyGameXp(career, goodGame, ctxLoss, 22, {}, 'test')
    const plusOne = result.instructions.find(i => i.attribute === target && i.delta === 1)
    expect(plusOne).toBeDefined()
    expect(career.attributes[target].value).toBe(71)
  })
  it('age 37 gains far less XP than age 22', () => {
    const young = makeCareer(); const old = makeCareer()
    const ry = applyGameXp(young, goodGame, ctx, 22, {}, 'test')
    const ro = applyGameXp(old, goodGame, ctx, 37, {}, 'test')
    expect(ro.xpByCategory.three).toBeLessThan(ry.xpByCategory.three * 0.4)
  })
  it('goal bonus is capped at 30% of game XP', () => {
    const career = makeCareer()
    const r = applyGameXp(career, goodGame, ctx, 22, { three: 999999 }, 'test')
    const noBonus = applyGameXp(makeCareer(), goodGame, ctx, 22, {}, 'test')
    expect(r.xpByCategory.three).toBeLessThanOrEqual(noBonus.xpByCategory.three * 1.31)
  })
  it('cascades multiple upgrades when XP exceeds multiple thresholds in one game', () => {
    const career = makeCareer()
    const target = 'threePoint'
    // Pre-populate with 3× base cost so loop will cascade through multiple upgrades
    career.attributes[target].xp = upgradeCost(70, DEFAULT_CONFIG) * 3
    const result = applyGameXp(career, goodGame, ctx, 22, {}, 'test')
    const threeInstructions = result.instructions.filter(i => i.attribute === target && i.delta === 1)
    // Multiple +1 instructions should be emitted for cascading upgrades
    expect(threeInstructions.length).toBeGreaterThan(1)
    // Value should increase by more than 1
    expect(career.attributes[target].value).toBeGreaterThan(71)
  })
})

describe('weighted distribution within a category', () => {
  it('splits category XP across all attributes proportionally to affinity weight', () => {
    const career = makeCareer() // SG 196, balanced
    const r = applyGameXp(career, goodGame, ctxLoss, 22, {}, 'test', 'balanced')
    const ids = ['passAccuracy', 'ballHandle', 'speedWithBall', 'passIQ', 'passVision']
    const gained = ids.map(id => career.attributes[id].xp + (career.attributes[id].value - 70) * upgradeCost(70, DEFAULT_CONFIG))
    const sum = gained.reduce((s, v) => s + v, 0)
    expect(sum).toBeCloseTo(r.xpByCategory.playmaking, 3)
    // SG balanced 196: playmaking is normal for SG, height mid → all weights 1 → equal shares
    for (const g of gained) expect(g).toBeCloseTo(sum / 5, 3)
  })
  it('buffed attribute gets a bigger share than contra attribute', () => {
    const career = makeCareer()
    career.player = { ...career.player, position: 'PG', heightCm: 184 }
    applyGameXp(career, goodGame, ctxLoss, 22, {}, 'test', 'slasher')
    // inside: slasher buffs inside (layup) but overrides post attrs to contra; PG short → post also contra
    expect(career.attributes['layup'].xp).toBeGreaterThan(career.attributes['postHook'].xp * 2)
  })
  it('attributes at 99 receive nothing', () => {
    const career = makeCareer()
    career.attributes['passIQ'].value = 99
    applyGameXp(career, goodGame, ctxLoss, 22, {}, 'test')
    expect(career.attributes['passIQ'].xp).toBe(0)
    expect(career.attributes['passIQ'].value).toBe(99)
  })
})

describe('distributeCategoryXp', () => {
  it('delivers exactly xp across the category and emits +1s with the given prefix', () => {
    const career = makeCareer()
    const counter = { n: 0 }
    const before = ['midRange', 'shotIQ', 'offConsistency'].map(id => career.attributes[id].xp)
    // 400 (not the brief's 250) so each equal-weight attr clears the 100-cost level-up threshold
    const instr = distributeCategoryXp(career, 'mid', 400, 'balanced', 'offseason-2026', counter, 'Off-season 2026: ')
    const gained = ['midRange', 'shotIQ', 'offConsistency']
      .map((id, i) => career.attributes[id].xp - before[i] + (career.attributes[id].value - 70) * upgradeCost(70, DEFAULT_CONFIG))
    expect(gained.reduce((s, v) => s + v, 0)).toBeCloseTo(400, 3)
    expect(instr.length).toBeGreaterThan(0)
    expect(instr[0].id).toBe('offseason-2026-0')
    expect(instr[0].text.startsWith('Off-season 2026: +1 ')).toBe(true)
    expect(counter.n).toBe(instr.length)
  })
})
