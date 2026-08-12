import { describe, it, expect } from 'vitest'
import { recentAverages, generateGoals, goalMet, goalBonus } from './goals'
import type { BoxScore, Game, GameContext } from './types'

const ctx: GameContext = { opponent: 'DAL', home: false, playoffs: false, win: false, date: '2026-02-01' }
const box = (over: Partial<BoxScore>): BoxScore => ({
  min: 34, pts: 15, reb: 5, ast: 4, stl: 1, blk: 0, tov: 2,
  fgm: 6, fga: 13, tpm: 1, tpa: 4, ftm: 2, fta: 2, plusMinus: 0, ...over,
})
const playedGame = (i: number): Game => ({
  id: `g${i}`, context: { ...ctx, date: `2026-01-${10 + i}` }, box: box({}), goals: [], goalsMet: [],
})

describe('recentAverages', () => {
  it('returns null with no played games', () => {
    expect(recentAverages([])).toBeNull()
  })
  it('averages the box scores', () => {
    const avg = recentAverages([playedGame(1), playedGame(2)])
    expect(avg!.pts).toBeCloseTo(15)
  })
})

describe('generateGoals', () => {
  const history = [1, 2, 3, 4, 5].map(playedGame)
  it('generates 2-3 goals with targets above average', () => {
    const goals = generateGoals(history, ctx, 5)
    expect(goals.length).toBeGreaterThanOrEqual(2)
    expect(goals.length).toBeLessThanOrEqual(3)
    const ptsGoal = goals.find(g => g.kind === 'pts')
    if (ptsGoal) expect(ptsGoal.target).toBeGreaterThan(15)
  })
  it('rotates categories across consecutive seq values', () => {
    const cats = (s: number) => generateGoals(history, ctx, s).map(g => g.category).sort().join(',')
    expect(cats(5) === cats(6) && cats(6) === cats(7)).toBe(false)
  })
  it('is deterministic for the same seq', () => {
    expect(generateGoals(history, ctx, 5)).toEqual(generateGoals(history, ctx, 5))
  })
})

describe('goalMet + goalBonus', () => {
  it('checks pts goal and awards category bonus', () => {
    const goals = generateGoals([1, 2, 3].map(playedGame), ctx, 3)
    const big = box({ pts: 40, fgm: 15, fga: 22, tpm: 4, tpa: 8, ftm: 6, fta: 6, ast: 10, reb: 12, stl: 3, blk: 2 })
    const met = goals.filter(g => goalMet(g, big, { ...ctx, win: true })).map(g => g.id)
    expect(met.length).toBeGreaterThan(0)
    const bonus = goalBonus(goals, met)
    expect(Object.values(bonus).some(v => (v ?? 0) > 0)).toBe(true)
  })
})
