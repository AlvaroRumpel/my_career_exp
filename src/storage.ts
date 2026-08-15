import { DEFAULT_CONFIG } from './engine/types'
import type { Career } from './engine/types'

export const STORAGE_KEY = 'nba2k25-career'

// saves antigos podem não ter campos novos de config
function withDefaults(c: Career): Career {
  const cfg = c.config ?? {} as Partial<Career['config']>
  return { ...c, config: { ...DEFAULT_CONFIG, ...cfg, ageMults: { ...DEFAULT_CONFIG.ageMults, ...(cfg.ageMults ?? {}) } } }
}

export function saveCareer(career: Career, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(career))
}

export function loadCareer(storage: Storage = localStorage): Career | null {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return null
  try { return withDefaults(JSON.parse(raw) as Career) } catch { return null }
}

export function clearCareer(storage: Storage = localStorage): void {
  storage.removeItem(STORAGE_KEY)
}

export function exportCareer(career: Career): string {
  return JSON.stringify(career, null, 2)
}

export function importCareer(json: string): Career {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error('Arquivo não é JSON válido') }
  const c = parsed as Career
  if (!c || typeof c !== 'object' || !c.player?.name || !c.seasons || !c.attributes) {
    throw new Error('JSON inválido: não parece um arquivo de carreira exportado')
  }
  return withDefaults(c)
}
