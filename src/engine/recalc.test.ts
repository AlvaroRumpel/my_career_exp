import { describe, it, expect } from 'vitest'
import { processGame, recalcCareer, regressionInstructions, ageAt, playedGameCount } from './recalc'
import { createChallenge } from './challenges'
import { DEFAULT_CONFIG } from './types'
import { ATTRIBUTES } from './attributes'
import { BADGES } from './badges'
import type { Career, Game } from './types'
import fixture from './fixtures/pg-save.json'

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
    processGame(c, 0, g, 0)
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
      processGame(c, 0, g, i)
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
      processGame(c, 0, g, i)
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

describe('replay equivalence (FIX A-D)', () => {
  it('live play (with a DNP and an active challenge) matches recalcCareer exactly, and applied instructions stay filtered', () => {
    const c = freshCareer(34)
    // limitless-range needs tpm >= 5; game() always has tpm: 2, so this challenge accrues
    // progress but never completes/renews — keeps the test focused on FIX D scoping rather
    // than the (separately correct) startGameIndex mutation that happens on renewal
    c.activeChallenges.push(createChallenge('limitless-range', playedGameCount(c)))

    for (let i = 0; i < 5; i++) {
      const g: Game = i === 2
        ? { // DNP: doesn't advance the played-game index, doesn't break the challenge streak
            id: `g${i}`,
            context: { opponent: 'CHI', home: true, playoffs: false, win: true, date: `2026-11-${i + 1}` },
            box: { min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, plusMinus: 0 },
            goals: [], goalsMet: [],
          }
        : game(i)
      const globalGameIndex = playedGameCount(c)
      c.seasons[0].games.push(g)
      processGame(c, 0, g, globalGameIndex)
    }

    const snapshotAttrs = JSON.stringify(c.attributes)
    const snapshotBadges = JSON.stringify(c.badges)
    const livePendingIds = c.pendingInstructions.map(i => i.id).sort()
    expect(livePendingIds.length).toBeGreaterThan(2) // sanity: there's something to mark applied

    // mark 2 as already applied in the 2K editor before the replay happens
    const appliedIds = c.pendingInstructions.slice(0, 2).map(i => i.id)
    c.appliedInstructionIds = appliedIds.slice()

    recalcCareer(c)

    expect(JSON.stringify(c.attributes)).toBe(snapshotAttrs)
    expect(JSON.stringify(c.badges)).toBe(snapshotBadges)
    const replayIds = c.pendingInstructions.map(i => i.id).sort()
    expect(replayIds).toEqual(livePendingIds.filter(id => !appliedIds.includes(id)).sort())
    for (const id of appliedIds) expect(c.pendingInstructions.some(i => i.id === id)).toBe(false)
  })

  it('a 36-year-old (2 seasons from startAge 35) gets regression instructions on replay', () => {
    const c = freshCareer(35)
    c.seasons.push({ year: c.seasons[0].year + 1, games: [] })
    recalcCareer(c)
    expect(c.pendingInstructions.some(i => i.id.startsWith('regress-1-'))).toBe(true)
  })
})

function makeCareer34(): Career {
  const initialAttributes: Record<string, number> = {}
  for (const a of ATTRIBUTES) initialAttributes[a.id] = 68
  const initialBadges: Record<string, number> = {}
  for (const b of BADGES) initialBadges[b.id] = 0
  const career: Career = {
    player: { name: 'Rook', position: 'PG', heightCm: 190, team: 'ORL', startAge: 34 },
    initialAttributes, initialBadges,
    attributes: {}, badges: {}, activeChallenges: [],
    seasons: [
      { year: 2026, games: [game(1), game(2), game(3)], playStyle: 'balanced', offseason: { primary: 'three', secondary: 'mid' } },
      { year: 2027, games: [] },
    ],
    pendingInstructions: [], config: DEFAULT_CONFIG, targetOverrides: {},
  }
  return career
}

describe('offseason in replay', () => {
  it('season with offseason choice yields offseason instructions before regression on the next season', () => {
    const c = makeCareer34()
    recalcCareer(c)
    const ids = c.pendingInstructions.map(i => i.id)
    const firstOff = ids.findIndex(i => i.startsWith('offseason-'))
    const firstReg = ids.findIndex(i => i.startsWith('regress-1-'))
    expect(firstOff).toBeGreaterThanOrEqual(0)
    expect(firstReg).toBeGreaterThan(firstOff)
  })
  it('season without offseason choice yields no offseason instructions', () => {
    const c = makeCareer34()
    delete c.seasons[0].offseason
    recalcCareer(c)
    expect(c.pendingInstructions.some(i => i.id.startsWith('offseason-'))).toBe(false)
  })
  it('replay is idempotent with offseason', () => {
    const c = makeCareer34()
    recalcCareer(c)
    const a = JSON.stringify([c.attributes, c.badges, c.pendingInstructions.map(i => i.id)])
    recalcCareer(c)
    const b = JSON.stringify([c.attributes, c.badges, c.pendingInstructions.map(i => i.id)])
    expect(a).toBe(b)
  })
})

describe('replay of a real PG save under affinity rules', () => {
  it('recalculates without throwing, all attributes >= initial, post badges > 0', () => {
    const career = structuredClone(fixture) as unknown as Career
    recalcCareer(career)
    for (const a of ATTRIBUTES) {
      expect(career.attributes[a.id].value).toBeGreaterThanOrEqual(career.initialAttributes[a.id])
    }
    expect(BADGES.filter(b => career.badges[b.id].progress > 0).length).toBeGreaterThanOrEqual(30)
    // vários atributos da mesma categoria devem ter andado (não só o mais fraco)
    const moved = ['passAccuracy', 'ballHandle', 'speedWithBall', 'passVision']
      .filter(id => career.attributes[id].xp > 0 || career.attributes[id].value > career.initialAttributes[id])
    expect(moved.length).toBeGreaterThanOrEqual(3)
    expect(career.pendingInstructions.some(i => i.id.startsWith('offseason-2027-'))).toBe(true)
    expect(career.pendingInstructions.filter(i => i.id.startsWith('offseason-2027-') && i.type === 'attribute').length).toBeGreaterThanOrEqual(2)
  })
})

describe('completed challenge bonus survives replay', () => {
  it('badge bonus earned by finishing a challenge is identical after recalcCareer', () => {
    const c = freshCareer(22)
    // game() has ast: 8 -> dimer (8+ ast x3) completes on the 3rd game
    c.activeChallenges.push(createChallenge('dimer', 0))
    for (let i = 0; i < 4; i++) {
      const g = game(i)
      c.seasons[0].games.push(g)
      processGame(c, 0, g, i)
    }
    const live = c.badges.dimer.progress
    expect(c.completedChallenges?.length).toBe(1)
    expect(c.completedChallenges?.[0]).toEqual({ badgeId: 'dimer', gameIndex: 2 })
    recalcCareer(c)
    expect(c.badges.dimer.progress).toBeCloseTo(live, 6)
    // replaying again does not double-apply
    recalcCareer(c)
    expect(c.badges.dimer.progress).toBeCloseTo(live, 6)
  })
})
