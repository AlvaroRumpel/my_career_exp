import { describe, it, expect } from 'vitest'
import { processGame } from './recalc'
import { recalcCareer } from './recalc'
import { estimateOverall } from './attributes'
import { ATTRIBUTES } from './attributes'
import { BADGES } from './badges'
import { DEFAULT_CONFIG } from './types'
import type { BoxScore, Career, Game } from './types'

function makeCareer(startAge: number, baseValue: number): Career {
  const initialAttributes: Record<string, number> = {}
  for (const a of ATTRIBUTES) initialAttributes[a.id] = baseValue
  const initialBadges: Record<string, number> = {}
  for (const b of BADGES) initialBadges[b.id] = 0
  const c: Career = {
    player: { name: 'Sim', position: 'SG', heightCm: 198, team: 'SAS', startAge },
    initialAttributes, initialBadges, attributes: {}, badges: {},
    activeChallenges: [], seasons: [{ year: 2026, games: [] }],
    pendingInstructions: [], config: DEFAULT_CONFIG, targetOverrides: {},
  }
  recalcCareer(c)
  return c
}

// rookie sólido: ~16/4/4, eficiência ok, variação determinística por índice
function rookieGame(i: number): Game {
  const hot = i % 5 === 0; const cold = i % 7 === 0
  const box: BoxScore = {
    min: 28 + (i % 8), pts: 0, reb: 3 + (i % 4), ast: 3 + (i % 3),
    stl: i % 2, blk: i % 3 === 0 ? 1 : 0, tov: 1 + (i % 3),
    fgm: cold ? 4 : hot ? 9 : 6, fga: cold ? 14 : 13,
    tpm: cold ? 0 : hot ? 4 : 1, tpa: 5, ftm: 2 + (i % 2), fta: 3 + (i % 2), plusMinus: hot ? 10 : cold ? -8 : 2,
  }
  box.pts = 2 * (box.fgm - box.tpm) + 3 * box.tpm + box.ftm
  return {
    id: `sim${i}`,
    context: { opponent: 'OPP', home: i % 2 === 0, playoffs: false, win: i % 2 === 0, date: `2026-11-${(i % 28) + 1}` },
    box, goals: [], goalsMet: [],
  }
}

function runSeason(career: Career, seasonIndex: number, games: number): void {
  for (let i = 0; i < games; i++) {
    const g = rookieGame(i + seasonIndex * 100)
    career.seasons[seasonIndex].games.push(g)
    processGame(career, seasonIndex, g, i)
  }
}

describe('calibration targets', () => {
  it('solid rookie season (82 games) gains +4 to +6 OVR', () => {
    const c = makeCareer(20, 68)
    const before = estimateOverall(Object.fromEntries(Object.entries(c.attributes).map(([k, v]) => [k, v.value])), 'SG')
    runSeason(c, 0, 82)
    const after = estimateOverall(Object.fromEntries(Object.entries(c.attributes).map(([k, v]) => [k, v.value])), 'SG')
    const gain = after - before
    expect(gain).toBeGreaterThanOrEqual(4)
    expect(gain).toBeLessThanOrEqual(6)
  })
  it('37-year-old gains at most +1 OVR on the same season', () => {
    const c = makeCareer(37, 80)
    const before = estimateOverall(Object.fromEntries(Object.entries(c.attributes).map(([k, v]) => [k, v.value])), 'SG')
    runSeason(c, 0, 82)
    const after = estimateOverall(Object.fromEntries(Object.entries(c.attributes).map(([k, v]) => [k, v.value])), 'SG')
    expect(after - before).toBeLessThanOrEqual(1)
  })
})
