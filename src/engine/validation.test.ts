import { describe, it, expect } from 'vitest'
import { validateBoxScore } from './validation'
import type { BoxScore } from './types'

const valid: BoxScore = {
  min: 34, pts: 25, reb: 6, ast: 7, stl: 2, blk: 1, tov: 3,
  fgm: 9, fga: 18, tpm: 3, tpa: 8, ftm: 4, fta: 5, plusMinus: 8,
}

describe('validateBoxScore', () => {
  it('accepts a valid box score', () => {
    expect(validateBoxScore(valid)).toEqual([])
  })
  it('rejects FGM > FGA', () => {
    expect(validateBoxScore({ ...valid, fgm: 19 })).not.toEqual([])
  })
  it('rejects 3PM > FGM', () => {
    expect(validateBoxScore({ ...valid, tpm: 10, tpa: 12 })).not.toEqual([])
  })
  it('rejects 3PA > FGA', () => {
    expect(validateBoxScore({ ...valid, tpa: 19 })).not.toEqual([])
  })
  it('rejects FTM > FTA', () => {
    expect(validateBoxScore({ ...valid, ftm: 6 })).not.toEqual([])
  })
  it('rejects wrong points total', () => {
    expect(validateBoxScore({ ...valid, pts: 24 })).not.toEqual([])
  })
  it('rejects negatives and minutes > 48+OT bounds', () => {
    expect(validateBoxScore({ ...valid, reb: -1 })).not.toEqual([])
    expect(validateBoxScore({ ...valid, min: 70 })).not.toEqual([])
  })
})
