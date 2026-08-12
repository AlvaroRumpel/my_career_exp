import { describe, it, expect } from 'vitest'
import { ATTRIBUTES, attributesByCategory, estimateOverall, PHYSICAL_REGRESSION_ORDER } from './attributes'

describe('attribute catalog', () => {
  it('has 35 unique attributes', () => {
    expect(ATTRIBUTES.length).toBe(35)
    expect(new Set(ATTRIBUTES.map(a => a.id)).size).toBe(35)
  })
  it('every category has at least one attribute', () => {
    for (const cat of ['inside','mid','three','ft','playmaking','rebounding','defense','physical'] as const) {
      expect(attributesByCategory(cat).length).toBeGreaterThan(0)
    }
  })
  it('regression order only contains physical attributes', () => {
    const physIds = attributesByCategory('physical').map(a => a.id)
    for (const id of PHYSICAL_REGRESSION_ORDER) expect(physIds).toContain(id)
  })
  it('estimates overall as weighted mean in 25-99 range', () => {
    const flat: Record<string, number> = {}
    for (const a of ATTRIBUTES) flat[a.id] = 75
    expect(estimateOverall(flat, 'PG')).toBe(75)
  })
})
