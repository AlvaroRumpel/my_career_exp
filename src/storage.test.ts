import { describe, it, expect } from 'vitest'
import { saveCareer, loadCareer, exportCareer, importCareer, clearCareer, STORAGE_KEY } from './storage'
import { DEFAULT_CONFIG } from './engine/types'
import type { Career } from './engine/types'

const career: Career = {
  player: { name: 'X', position: 'C', heightCm: 210, team: 'DEN', startAge: 21 },
  initialAttributes: { closeShot: 70 }, initialBadges: { deadeye: 0 },
  attributes: { closeShot: { value: 70, xp: 10 } }, badges: { deadeye: { progress: 5 } },
  activeChallenges: [], seasons: [{ year: 2026, games: [] }],
  pendingInstructions: [], config: DEFAULT_CONFIG, targetOverrides: {},
}

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(), key: () => null, length: 0,
  } as Storage
}

describe('storage', () => {
  it('round-trips a career', () => {
    const s = memoryStorage()
    saveCareer(career, s)
    expect(loadCareer(s)).toEqual(career)
  })
  it('returns null when empty and after clear', () => {
    const s = memoryStorage()
    expect(loadCareer(s)).toBeNull()
    saveCareer(career, s); clearCareer(s)
    expect(loadCareer(s)).toBeNull()
  })
})

describe('export/import', () => {
  it('round-trips via JSON string', () => {
    expect(importCareer(exportCareer(career))).toEqual(career)
  })
  it('rejects garbage with a pt-BR message', () => {
    expect(() => importCareer('{"foo": 1}')).toThrow(/inválido/i)
    expect(() => importCareer('not json')).toThrow()
  })
})

describe('config merge for old saves', () => {
  it('loadCareer fills missing config fields from DEFAULT_CONFIG', () => {
    const store = memoryStorage()
    const legacy = { player: { name: 'X', position: 'PG', heightCm: 190, team: 'T', startAge: 20 },
      initialAttributes: {}, initialBadges: {}, attributes: {}, badges: {}, activeChallenges: [],
      seasons: [{ year: 2026, games: [] }], pendingInstructions: [], targetOverrides: {},
      config: { baseCost: 100, costGrowth: 1.12, ageMults: DEFAULT_CONFIG.ageMults, playoffsMult: 1.5, awayMult: 1.15, winMult: 1.1, goalBonusCap: 0.3 } }
    store.setItem(STORAGE_KEY, JSON.stringify(legacy))
    const c = loadCareer(store)!
    expect(c.config.offseasonBase).toBe(DEFAULT_CONFIG.offseasonBase)
    expect(c.config.offseasonShare).toBe(DEFAULT_CONFIG.offseasonShare)
    expect(c.config.baseCost).toBe(100)
  })
  it('importCareer does the same merge', () => {
    const json = JSON.stringify({ player: { name: 'X' }, seasons: [], attributes: {}, config: { baseCost: 120 } })
    const c = importCareer(json)
    expect(c.config.baseCost).toBe(120)
    expect(c.config.offseasonShare).toBe(DEFAULT_CONFIG.offseasonShare)
  })
  it('deep-merges ageMults so legacy partials keep default fields', () => {
    const store = memoryStorage()
    const legacy = { player: { name: 'X', position: 'PG', heightCm: 190, team: 'T', startAge: 20 },
      initialAttributes: {}, initialBadges: {}, attributes: {}, badges: {}, activeChallenges: [],
      seasons: [{ year: 2026, games: [] }], pendingInstructions: [], targetOverrides: {},
      config: { ageMults: { u21: 1.5 } as Career['config']['ageMults'] } }
    store.setItem(STORAGE_KEY, JSON.stringify(legacy))
    const c = loadCareer(store)!
    expect(c.config.ageMults.u21).toBe(1.5)
    expect(c.config.ageMults.prime).toBe(DEFAULT_CONFIG.ageMults.prime)
  })
})
