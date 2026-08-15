import { describe, expect, it } from 'vitest'
import { recalcCareer } from '../engine/recalc'
import { ATTRIBUTES } from '../engine/attributes'
import { BADGES } from '../engine/badges'
import { DEFAULT_CONFIG } from '../engine/types'
import { styleCategoryMult } from '../engine/playStyles'
import type { BoxScore, Career, Game } from '../engine/types'
import { categoryAverages, gameXpBreakdown, preGameMultiplier, seasonOvrDelta } from './derive'

function makeCareer(playStyle = 'sniper'): Career {
  const c: Career = {
    player: { name: 'T', position: 'SG', heightCm: 196, team: 'GSW', startAge: 20 },
    initialAttributes: Object.fromEntries(ATTRIBUTES.map(a => [a.id, 70])),
    initialBadges: Object.fromEntries(BADGES.map(b => [b.id, 0])),
    attributes: {}, badges: {}, activeChallenges: [],
    seasons: [{ year: 2026, games: [], playStyle }], playStyle,
    pendingInstructions: [], appliedInstructionIds: [], config: DEFAULT_CONFIG, targetOverrides: {},
  }
  recalcCareer(c)
  return c
}

const BOX: BoxScore = {
  min: 34, pts: 28, reb: 4, ast: 4, stl: 1, blk: 0, tov: 2,
  fgm: 10, fga: 18, tpm: 6, tpa: 11, ftm: 2, fta: 2, plusMinus: 10,
}

function makeGame(): Game {
  return {
    id: 'g1', box: BOX, goals: [], goalsMet: [],
    context: { opponent: 'MIA', home: true, playoffs: false, win: true, date: '2026-08-12' },
  }
}

describe('categoryAverages', () => {
  it('averages attribute values per category', () => {
    const c = makeCareer()
    const avg = categoryAverages(c)
    for (const v of Object.values(avg)) expect(v).toBe(70)
  })
})

describe('seasonOvrDelta', () => {
  it('is 0 for a fresh career', () => {
    expect(seasonOvrDelta(makeCareer())).toBe(0)
  })
  it('uses last ovrAfter of previous season as baseline', () => {
    const c = makeCareer()
    c.seasons = [
      { year: 2025, games: [{ ...makeGame(), ovrAfter: 68 }] },
      { year: 2026, games: [], playStyle: 'sniper' },
    ]
    // current estimated OVR with all attrs 70 is 70
    expect(seasonOvrDelta(c)).toBe(2)
  })
})

describe('gameXpBreakdown', () => {
  it('total equals sum of categories and respects style multiplier', () => {
    const sniper = gameXpBreakdown(makeCareer('sniper'), makeGame(), 0)
    const balanced = gameXpBreakdown(makeCareer('balanced'), makeGame(), 0)
    const sum = sniper.byCategory.reduce((s, [, v]) => s + v, 0)
    expect(sniper.total).toBe(Math.round(sum))
    const three = (r: typeof sniper) => r.byCategory.find(([c]) => c === 'three')![1]
    expect(three(sniper) / three(balanced)).toBeCloseTo(styleCategoryMult('sniper', 'three'), 5)
    // sorted desc, no zero categories
    const vals = sniper.byCategory.map(([, v]) => v)
    expect([...vals].sort((a, b) => b - a)).toEqual(vals)
    expect(vals.every(v => v > 0)).toBe(true)
  })
})

describe('preGameMultiplier', () => {
  it('combines age and context without win bonus', () => {
    const c = makeCareer()
    expect(preGameMultiplier(c, true, false)).toBeCloseTo(1.3, 5)
    expect(preGameMultiplier(c, false, true)).toBeCloseTo(1.3 * 1.15 * 1.5, 5)
  })
})

import { groupInstructions } from './derive'
import type { Instruction } from '../engine/types'

describe('groupInstructions', () => {
  it('merges consecutive +1s of the same attribute into one range and keeps highest badge tier', () => {
    const instr: Instruction[] = [
      { id: 'a', type: 'attribute', text: '+1 Three-Point Shot (74 → 75)', attribute: 'threePoint', delta: 1 },
      { id: 'b', type: 'badge', text: 'Suba Deadeye para Bronze no 2K', badge: 'deadeye', tier: 1 },
      { id: 'c', type: 'attribute', text: '+1 Pass Vision (79 → 80)', attribute: 'passVision', delta: 1 },
      { id: 'd', type: 'attribute', text: 'Off-season 2027: +1 Three-Point Shot (75 → 76)', attribute: 'threePoint', delta: 1 },
      { id: 'e', type: 'badge', text: 'Suba Deadeye para Prata no 2K', badge: 'deadeye', tier: 2 },
      { id: 'f', type: 'attribute', text: '-1 Speed (regressão, idade 35)', attribute: 'speed', delta: -1 },
    ]
    const g = groupInstructions(instr)
    expect(g.map(x => x.text)).toEqual([
      '+2 Three-Point Shot (74 → 76)',
      'Suba Deadeye para Prata no 2K',
      '+1 Pass Vision (79 → 80)',
      '-1 Speed (regressão, idade 35)',
    ])
    expect(g[0].type).toBe('attribute')
    expect(g[1].type).toBe('badge')
  })
})
