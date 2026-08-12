import { describe, it, expect } from 'vitest'
import { gameScore, qualityMultiplier, ageMultiplier, contextMultiplier } from './multipliers'
import { DEFAULT_CONFIG } from './types'
import type { BoxScore, GameContext } from './types'

const monster: BoxScore = { min: 38, pts: 42, reb: 10, ast: 8, stl: 3, blk: 2, tov: 2, fgm: 15, fga: 24, tpm: 6, tpa: 10, ftm: 6, fta: 7, plusMinus: 15 }
const bad: BoxScore = { min: 30, pts: 8, reb: 2, ast: 1, stl: 0, blk: 0, tov: 5, fgm: 3, fga: 15, tpm: 0, tpa: 6, ftm: 2, fta: 4, plusMinus: -12 }
const inefficient: BoxScore = { min: 38, pts: 30, reb: 4, ast: 2, stl: 0, blk: 0, tov: 4, fgm: 11, fga: 30, tpm: 2, tpa: 12, ftm: 6, fta: 8, plusMinus: -5 }

describe('gameScore', () => {
  it('monster game scores much higher than bad game', () => {
    expect(gameScore(monster)).toBeGreaterThan(gameScore(bad) + 20)
  })
})

describe('qualityMultiplier', () => {
  it('clamps between 0.3 and 1.5', () => {
    expect(qualityMultiplier(monster)).toBeLessThanOrEqual(1.5)
    expect(qualityMultiplier(bad)).toBeGreaterThanOrEqual(0.3)
  })
  it('monster game near max, bad game near min', () => {
    expect(qualityMultiplier(monster)).toBeGreaterThan(1.2)
    expect(qualityMultiplier(bad)).toBeLessThan(0.6)
  })
  it('volume without efficiency scores mediocre', () => {
    expect(qualityMultiplier(inefficient)).toBeLessThan(1.0)
  })
})

describe('ageMultiplier', () => {
  it('follows the approved age curve', () => {
    expect(ageMultiplier(19, DEFAULT_CONFIG)).toBe(1.3)
    expect(ageMultiplier(21, DEFAULT_CONFIG)).toBe(1.3)
    expect(ageMultiplier(22, DEFAULT_CONFIG)).toBe(1.0)
    expect(ageMultiplier(33, DEFAULT_CONFIG)).toBe(1.0)
    expect(ageMultiplier(34, DEFAULT_CONFIG)).toBe(0.5)
    expect(ageMultiplier(36, DEFAULT_CONFIG)).toBe(0.5)
    expect(ageMultiplier(37, DEFAULT_CONFIG)).toBe(0.3)
  })
})

describe('contextMultiplier', () => {
  const base: GameContext = { opponent: 'LAL', home: true, playoffs: false, win: false, date: '2026-01-01' }
  it('home regular loss = 1.0', () => {
    expect(contextMultiplier(base, DEFAULT_CONFIG)).toBe(1.0)
  })
  it('playoffs away win multiplies all three', () => {
    const v = contextMultiplier({ ...base, playoffs: true, home: false, win: true }, DEFAULT_CONFIG)
    expect(v).toBeCloseTo(1.5 * 1.15 * 1.1, 5)
  })
})
