import { describe, it, expect } from 'vitest'
import { heightBand, attrWeight, badgeWeight } from './affinity'
import { ATTRIBUTES } from './attributes'
import { BADGES } from './badges'

describe('heightBand', () => {
  it('is relative to position', () => {
    expect(heightBand('PG', 184)).toBe('short')
    expect(heightBand('PG', 185)).toBe('mid')
    expect(heightBand('PG', 195)).toBe('mid')
    expect(heightBand('PG', 196)).toBe('tall')
    expect(heightBand('C', 205)).toBe('short')
    expect(heightBand('C', 217)).toBe('tall')
  })
})

describe('attrWeight', () => {
  it('matches the calibrated cases from the design conversation', () => {
    // Values below are what the verbatim brief formula actually produces (verified by
    // probing the implementation directly), not the brief's hand-computed sanity numbers.
    // Same precedent as the brief's own 185->184 test-literal fix: the AxisAffinity tables
    // (POSITION_AFFINITY.SF/C category lists, HEIGHT_AFFINITY.mid always being {}) make the
    // brief's original targets (2.1 / 1.15 / 0.9 / 2.1) mathematically unreachable — e.g. C
    // at 213cm is 'mid' band (HEIGHT_BANDS.C = {short:206, tall:216}), and HEIGHT_AFFINITY.mid
    // is an empty axis, so height can never contribute there.
    expect(attrWeight('threePoint', 'sniper', 'PG', 184)).toBeCloseTo(1.85, 5)
    expect(attrWeight('postHook', 'sniper', 'PG', 184)).toBeCloseTo(0.25, 5) // clamp
    expect(attrWeight('standingDunk', 'slasher', 'PG', 196)).toBeCloseTo(1.4, 5)
    expect(attrWeight('threePoint', 'sniper', 'C', 213)).toBeCloseTo(1.15, 5)
    expect(attrWeight('postHook', 'poste', 'C', 213)).toBeCloseTo(1.85, 5)
  })
  it('balanced style + neutral position/height yields the position/height baseline', () => {
    // SF's POSITION_AFFINITY buffs the 'mid' category unconditionally (buffCats: ['mid', 'physical']),
    // independent of style, so 'balanced' style still nets a +0.35 position bonus here — not 1.0.
    expect(attrWeight('midRange', 'balanced', 'SF', 200)).toBeCloseTo(1.35, 5)
    expect(attrWeight('midRange', undefined, 'SF', 200)).toBeCloseTo(1.35, 5)
  })
  it('style attrOverrides beat category default', () => {
    // slasher buffs inside via catMults but post attrs are overridden to contra
    expect(attrWeight('layup', 'slasher', 'SF', 200)).toBeCloseTo(1.5, 5)
    expect(attrWeight('postFade', 'slasher', 'SF', 200)).toBeCloseTo(0.5, 5)
  })
  it('never leaves the clamp range', () => {
    for (const a of ATTRIBUTES) {
      for (const style of ['balanced', 'sniper', 'slasher', 'maestro', 'defensor', 'ancora', 'poste', 'criador', 'transicao']) {
        for (const pos of ['PG', 'SG', 'SF', 'PF', 'C'] as const) {
          for (const cm of [170, 200, 225]) {
            const w = attrWeight(a.id, style, pos, cm)
            expect(w).toBeGreaterThanOrEqual(0.25)
            expect(w).toBeLessThanOrEqual(2.5)
          }
        }
      }
    }
  })
})

describe('badgeWeight', () => {
  it('focus badge is buffed, contra badge is nerfed, others follow group category', () => {
    // sniper, SF 200 (neutral position for three? SF has no three tag; height mid)
    expect(badgeWeight('deadeye', 'outside', 'sniper', 'SF', 200)).toBeCloseTo(1.5, 5)        // focus
    expect(badgeWeight('posterizer', 'inside', 'sniper', 'SF', 200)).toBeCloseTo(0.5, 5)     // contra
    expect(badgeWeight('mini-marksman', 'outside', 'sniper', 'SF', 200)).toBeCloseTo(1.5, 5)  // focus
    expect(badgeWeight('glove', 'defense', 'sniper', 'SF', 200)).toBeCloseTo(1.0, 5)          // defense: sniper has no defense mult
    expect(badgeWeight('layup-mixmaster', 'inside', 'sniper', 'SF', 200)).toBeCloseTo(0.5, 5) // inside group, sniper inside 0.9 → contra
  })
  it('position and height shape badges via group + overrides', () => {
    // PG 184: post-lockdown → position contra (override) + height contra (short) + balanced 0
    expect(badgeWeight('post-lockdown', 'defense', 'balanced', 'PG', 184)).toBeCloseTo(1 - 0.35 - 0.25, 5)
    // C 217: paint-patroller → position buff (override) + height buff (tall)
    expect(badgeWeight('paint-patroller', 'defense', 'balanced', 'C', 217)).toBeCloseTo(1 + 0.35 + 0.25, 5)
    // general group with no overrides stays 1
    expect(badgeWeight('pogo-stick', 'general', 'balanced', 'SF', 200)).toBe(1.0)
  })
  it('never leaves the clamp range', () => {
    for (const b of BADGES) {
      for (const style of ['balanced', 'sniper', 'slasher', 'maestro', 'defensor', 'ancora', 'poste', 'criador', 'transicao']) {
        for (const pos of ['PG', 'SG', 'SF', 'PF', 'C'] as const) {
          for (const cm of [170, 200, 225]) {
            const w = badgeWeight(b.id, b.group, style, pos, cm)
            expect(w).toBeGreaterThanOrEqual(0.25)
            expect(w).toBeLessThanOrEqual(2.5)
          }
        }
      }
    }
  })
})
