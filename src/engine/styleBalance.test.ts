import { describe, expect, it } from 'vitest'
import { categoryXp } from './categoryXp'
import { PLAY_STYLES, styleCategoryMult } from './playStyles'
import type { BoxScore, Category, Position } from './types'

// Boxes de referência por arquétipo (spec 2026-08-12-style-balance-design.md)
const GUARD_BOX: BoxScore = {
  min: 30, pts: 18, reb: 4, ast: 4, stl: 1, blk: 0.5, tov: 2,
  fgm: 7, fga: 15, tpm: 2, tpa: 6, ftm: 2, fta: 3, plusMinus: 0,
}
const BIG_BOX: BoxScore = {
  min: 30, pts: 16, reb: 9, ast: 2, stl: 0.5, blk: 1.5, tov: 2,
  fgm: 7, fga: 12, tpm: 0, tpa: 1, ftm: 2, fta: 4, plusMinus: 0,
}

const REFERENCE: Record<string, { box: BoxScore; position: Position }> = {
  balanced: { box: GUARD_BOX, position: 'SG' },
  sniper: { box: GUARD_BOX, position: 'SG' },
  slasher: { box: GUARD_BOX, position: 'SG' },
  maestro: { box: GUARD_BOX, position: 'SG' },
  defensor: { box: GUARD_BOX, position: 'SG' },
  criador: { box: GUARD_BOX, position: 'SG' },
  ancora: { box: BIG_BOX, position: 'C' },
  poste: { box: BIG_BOX, position: 'C' },
  transicao: { box: BIG_BOX, position: 'C' },
}

function netMultiplier(styleId: string): number {
  const ref = REFERENCE[styleId]
  const raw = categoryXp(ref.box, ref.position)
  let base = 0, styled = 0
  for (const cat of Object.keys(raw) as Category[]) {
    base += raw[cat]
    styled += raw[cat] * styleCategoryMult(styleId, cat)
  }
  return styled / base
}

describe('style balance', () => {
  it('covers every style with a reference box', () => {
    for (const s of PLAY_STYLES) expect(REFERENCE[s.id], s.id).toBeDefined()
  })
  it('balanced is the neutral baseline', () => {
    expect(netMultiplier('balanced')).toBe(1)
  })
  // equalizado por cima: todo estilo é um upgrade parecido sobre o Equilibrado
  it.each(PLAY_STYLES.slice(1).map(s => [s.id]))('%s nets +8%% to +18%% over balanced', id => {
    const net = netMultiplier(id)
    expect(net, `${id} net=${net.toFixed(3)}`).toBeGreaterThanOrEqual(1.08)
    expect(net, `${id} net=${net.toFixed(3)}`).toBeLessThanOrEqual(1.18)
  })
})
