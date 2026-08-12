import { describe, it, expect } from 'vitest'
import { categoryXp } from './categoryXp'
import type { BoxScore } from './types'

const base: BoxScore = { min: 32, pts: 20, reb: 5, ast: 5, stl: 1, blk: 1, tov: 2, fgm: 7, fga: 14, tpm: 2, tpa: 5, ftm: 4, fta: 5, plusMinus: 5 }

describe('categoryXp', () => {
  it('hot 3PT night gives more three XP than cold night', () => {
    const hot = categoryXp({ ...base, tpm: 6, tpa: 10, fgm: 9, pts: 30 }, 'SG')
    const cold = categoryXp({ ...base, tpm: 1, tpa: 9, fgm: 6, pts: 15 }, 'SG')
    expect(hot.three).toBeGreaterThan(cold.three * 2)
  })
  it('big assist night with good ratio boosts playmaking', () => {
    const dime = categoryXp({ ...base, ast: 12, tov: 2 }, 'PG')
    const sloppy = categoryXp({ ...base, ast: 4, tov: 6 }, 'PG')
    expect(dime.playmaking).toBeGreaterThan(sloppy.playmaking * 2)
  })
  it('center gets more inside share of 2P makes than guard', () => {
    const asC = categoryXp(base, 'C')
    const asPG = categoryXp(base, 'PG')
    expect(asC.inside).toBeGreaterThan(asPG.inside)
    expect(asPG.mid).toBeGreaterThan(asC.mid)
  })
  it('defense XP rewards stocks and positive impact', () => {
    const lockdown = categoryXp({ ...base, stl: 4, blk: 3, plusMinus: 18 }, 'SF')
    expect(lockdown.defense).toBeGreaterThan(categoryXp(base, 'SF').defense)
  })
  it('physical XP is a slow trickle from minutes', () => {
    const xp = categoryXp(base, 'PG')
    expect(xp.physical).toBeGreaterThan(0)
    expect(xp.physical).toBeLessThan(xp.three + xp.mid + xp.inside)
  })
  it('zero-minute game yields zero XP everywhere', () => {
    const dnp = categoryXp({ min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, plusMinus: 0 }, 'PG')
    for (const v of Object.values(dnp)) expect(v).toBe(0)
  })
})
