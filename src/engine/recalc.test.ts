import { describe, it, expect } from 'vitest'
import { processGame, recalcCareer, regressionInstructions, ageAt } from './recalc'
import { DEFAULT_CONFIG } from './types'
import { ATTRIBUTES } from './attributes'
import { BADGES } from './badges'
import type { Career, Game } from './types'

function freshCareer(startAge = 20): Career {
  const initialAttributes: Record<string, number> = {}
  for (const a of ATTRIBUTES) initialAttributes[a.id] = 68
  const initialBadges: Record<string, number> = {}
  for (const b of BADGES) initialBadges[b.id] = 0
  const career: Career = {
    player: { name: 'Rook', position: 'PG', heightCm: 190, team: 'ORL', startAge },
    initialAttributes, initialBadges,
    attributes: {}, badges: {}, activeChallenges: [], seasons: [{ year: 2026, games: [] }],
    pendingInstructions: [], config: DEFAULT_CONFIG, targetOverrides: {},
  }
  recalcCareer(career)
  return career
}

const game = (i: number): Game => ({
  id: `g${i}`,
  context: { opponent: 'CHI', home: i % 2 === 0, playoffs: false, win: i % 3 !== 0, date: `2026-11-${(i % 28) + 1}` },
  box: { min: 34, pts: 22, reb: 5, ast: 8, stl: 2, blk: 0, tov: 2, fgm: 8, fga: 16, tpm: 2, tpa: 6, ftm: 4, fta: 5, plusMinus: 6 },
  goals: [], goalsMet: [],
})

describe('ageAt', () => {
  it('adds season index to start age', () => {
    const c = freshCareer(20)
    expect(ageAt(c, 0)).toBe(20)
    expect(ageAt(c, 3)).toBe(23)
  })
})

describe('processGame', () => {
  it('accumulates XP and badge progress', () => {
    const c = freshCareer()
    const g = game(1)
    c.seasons[0].games.push(g)
    processGame(c, 0, g)
    const totalXp = Object.values(c.attributes).reduce((s, a) => s + a.xp + (a.value - 68) * 100, 0)
    expect(totalXp).toBeGreaterThan(0)
    expect(c.badges['dimer'].progress).toBeGreaterThan(0)
  })
})

describe('recalcCareer', () => {
  it('is deterministic: replay produces identical state', () => {
    const c = freshCareer()
    for (let i = 0; i < 15; i++) {
      const g = game(i)
      c.seasons[0].games.push(g)
      processGame(c, 0, g)
    }
    const snapshotAttrs = JSON.stringify(c.attributes)
    const snapshotBadges = JSON.stringify(c.badges)
    recalcCareer(c)
    expect(JSON.stringify(c.attributes)).toBe(snapshotAttrs)
    expect(JSON.stringify(c.badges)).toBe(snapshotBadges)
  })
  it('removing a game changes the result', () => {
    const c = freshCareer()
    for (let i = 0; i < 10; i++) {
      const g = game(i)
      c.seasons[0].games.push(g)
      processGame(c, 0, g)
    }
    const before = JSON.stringify(c.attributes)
    c.seasons[0].games.pop()
    recalcCareer(c)
    expect(JSON.stringify(c.attributes)).not.toBe(before)
  })
})

describe('regression', () => {
  it('no regression before 34', () => {
    const c = freshCareer(30)
    expect(regressionInstructions(c, 0)).toEqual([])
  })
  it('age 34 regresses 2 physical attributes, 38 regresses 4', () => {
    const c34 = freshCareer(34)
    const r34 = regressionInstructions(c34, 0)
    expect(r34.length).toBe(2)
    expect(r34.every(i => i.delta === -1)).toBe(true)
    const c38 = freshCareer(38)
    expect(regressionInstructions(c38, 0).length).toBe(4)
  })
})
