import { describe, it, expect } from 'vitest'
import { saveCareer, loadCareer, exportCareer, importCareer, clearCareer } from './storage'
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
