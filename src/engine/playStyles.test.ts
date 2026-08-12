import { describe, it, expect } from 'vitest'
import { PLAY_STYLES, getStyle, styleCategoryMult, styleBadgeMult } from './playStyles'
import { BADGES } from './badges'

describe('play style catalog', () => {
  it('has 9 styles with unique ids, balanced first', () => {
    expect(PLAY_STYLES.length).toBe(9)
    expect(new Set(PLAY_STYLES.map(s => s.id)).size).toBe(9)
    expect(PLAY_STYLES[0].id).toBe('balanced')
  })
  it('balanced has no deviations', () => {
    const b = getStyle('balanced')
    expect(Object.keys(b.catMults).length).toBe(0)
    expect(b.focusBadges.length).toBe(0)
  })
  it('every catMult deviation is a focus (1, 1.5] or a penalty [0.7, 1)', () => {
    for (const s of PLAY_STYLES) {
      for (const v of Object.values(s.catMults)) {
        const focus = v > 1 && v <= 1.5
        const penalty = v >= 0.7 && v < 1
        expect(focus || penalty, `${s.id}: ${v}`).toBe(true)
      }
    }
  })
  it('every focusBadge id exists in the badge catalog', () => {
    const ids = new Set(BADGES.map(b => b.id))
    for (const s of PLAY_STYLES) for (const fb of s.focusBadges) expect(ids.has(fb), `${s.id}:${fb}`).toBe(true)
  })
  it('every non-balanced style has a reference player', () => {
    for (const s of PLAY_STYLES.slice(1)) expect(s.reference.length).toBeGreaterThan(0)
  })
  it('helpers resolve mults with balanced fallback', () => {
    expect(styleCategoryMult('sniper', 'three')).toBe(1.5)
    expect(styleCategoryMult('sniper', 'inside')).toBe(0.7)
    expect(styleCategoryMult('sniper', 'defense')).toBe(1.0)
    expect(styleCategoryMult(undefined, 'three')).toBe(1.0)
    expect(styleCategoryMult('unknown-id', 'three')).toBe(1.0)
    expect(styleBadgeMult('sniper', 'deadeye')).toBe(1.5)
    expect(styleBadgeMult('sniper', 'dimer')).toBe(1.0)
    expect(styleBadgeMult(undefined, 'deadeye')).toBe(1.0)
  })
})
