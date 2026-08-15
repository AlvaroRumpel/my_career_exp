import { describe, it, expect } from 'vitest'
import { offseasonTotal, offseasonCategoryXp, applyOffseason, CATEGORY_LIST } from './offseason'
import { DEFAULT_CONFIG } from './types'
import type { Career } from './types'
import { ATTRIBUTES } from './attributes'
import { BADGES } from './badges'
import { recalcCareer } from './recalc'

function makeCareer(startAge = 20): Career {
  const initialAttributes: Record<string, number> = {}
  for (const a of ATTRIBUTES) initialAttributes[a.id] = 70
  const initialBadges: Record<string, number> = {}
  for (const b of BADGES) initialBadges[b.id] = 0
  const c: Career = {
    player: { name: 'T', position: 'SG', heightCm: 196, team: 'X', startAge },
    initialAttributes, initialBadges, attributes: {}, badges: {}, activeChallenges: [],
    seasons: [{ year: 2026, games: [], playStyle: 'balanced' }],
    pendingInstructions: [], config: DEFAULT_CONFIG, targetOverrides: {},
  }
  recalcCareer(c)
  return c
}

describe('offseasonTotal', () => {
  it('scales with age curve and season xp', () => {
    expect(offseasonTotal(DEFAULT_CONFIG, 20, 0)).toBeCloseTo(450 * 1.3, 5)
    expect(offseasonTotal(DEFAULT_CONFIG, 30, 1000)).toBeCloseTo(450 + 200, 5)
    expect(offseasonTotal(DEFAULT_CONFIG, 37, 1000)).toBeCloseTo(450 * 0.3 + 200, 5)
    expect(offseasonTotal(DEFAULT_CONFIG, 20, 1000)).toBeGreaterThan(offseasonTotal(DEFAULT_CONFIG, 30, 1000))
  })
})

describe('offseasonCategoryXp', () => {
  it('splits 50% spread + 35% primary + 15% secondary and sums to total', () => {
    const x = offseasonCategoryXp(800, { primary: 'three', secondary: 'mid' })
    const sum = CATEGORY_LIST.reduce((s, c) => s + x[c], 0)
    expect(sum).toBeCloseTo(800, 6)
    expect(x.three).toBeCloseTo(800 * (0.5 / 8 + 0.35), 6)
    expect(x.mid).toBeCloseTo(800 * (0.5 / 8 + 0.15), 6)
    expect(x.defense).toBeCloseTo(800 * 0.5 / 8, 6)
  })
  it('primary === secondary gives primary the full 50%', () => {
    const x = offseasonCategoryXp(800, { primary: 'three', secondary: 'three' })
    expect(x.three).toBeCloseTo(800 * (0.5 / 8 + 0.5), 6)
  })
})

describe('applyOffseason', () => {
  it('returns [] and mutates nothing when season has no offseason choice', () => {
    const c = makeCareer()
    const snap = JSON.stringify(c.attributes) + JSON.stringify(c.badges)
    expect(applyOffseason(c, 0, {})).toEqual([])
    expect(JSON.stringify(c.attributes) + JSON.stringify(c.badges)).toBe(snap)
  })
  it('focus on three raises threePoint more than focus on defense', () => {
    const a = makeCareer(); a.seasons[0].offseason = { primary: 'three', secondary: 'mid' }
    const b = makeCareer(); b.seasons[0].offseason = { primary: 'defense', secondary: 'mid' }
    applyOffseason(a, 0, { three: 500 }); applyOffseason(b, 0, { three: 500 })
    const gain = (c: Career) => c.attributes.threePoint.xp + (c.attributes.threePoint.value - 70) * 100
    expect(gain(a)).toBeGreaterThan(gain(b) * 2)
  })
  it('all badges progress and ids are prefixed by year', () => {
    const c = makeCareer(); c.seasons[0].offseason = { primary: 'three', secondary: 'mid' }
    const instr = applyOffseason(c, 0, { three: 500 })
    for (const b of BADGES) expect(c.badges[b.id].progress).toBeGreaterThan(0)
    for (const i of instr) expect(i.id.startsWith('offseason-2026-')).toBe(true)
    expect(new Set(instr.map(i => i.id)).size).toBe(instr.length)
    expect(instr.some(i => i.type === 'attribute')).toBe(true)
    for (const i of instr) expect(i.text.startsWith('Off-season 2026: ')).toBe(true)
  })
})
