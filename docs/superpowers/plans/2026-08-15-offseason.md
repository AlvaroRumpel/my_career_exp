# Off-season Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao fechar uma temporada, o jogador escolhe foco primário/secundário e recebe um pacote de XP de off-season (base por idade + 20% do XP da temporada), distribuído 50% espalhado / 35% primário / 15% secundário via afinidade, mais um empurrão em todas as badges; tudo replayável em `recalcCareer`.

**Architecture:** `Season.offseason` grava a escolha na temporada fechada. `offseason.ts` (novo) calcula e aplica o pacote usando `distributeCategoryXp` extraída de `progression.ts` e `badgeWeight`. `recalcCareer` acumula XP por temporada e aplica o pacote antes da regressão ao virar de temporada. Dashboard troca o `confirm` de "Nova temporada" por painel de Off-season que grava a escolha e chama `recalcCareer`.

**Tech Stack:** TypeScript, Vitest, React 19, Tailwind. Testes: `npx vitest run <file>`.

**Spec:** `docs/superpowers/specs/2026-08-15-offseason-design.md`

## Global Constraints

- `total = cfg.offseasonBase × ageMultiplier(idade da temporada fechada, cfg) + cfg.offseasonShare × Σ seasonXp`. Defaults: `offseasonBase: 450`, `offseasonShare: 0.20`.
- Split por categoria: `total×0.5/8` para todas + `total×0.35` primário + `total×0.15` secundário. Se `primary === secondary`: primário recebe `0.5` (0.35+0.15), sem secundário.
- Distribuição dentro da categoria = mesma de `applyGameXp` (peso `attrWeight`, normalizado, só atributos <99, loop de +1, reset em 99).
- Badges: `progress += 3 × 0.55 × badgeWeight(id, group, styleId, pos, cm)`; tier-up gera instrução.
- Ids determinísticos: atributos `offseason-${year}-${n}`, badges `offseason-${year}-badge-${n}` (contadores locais). Texto prefixado `Off-season ${year}: `.
- Ordem no replay ao entrar em season `si>0`: `applyOffseason(si-1)` **antes** de `regressionInstructions(si)`.
- Sem `season.offseason` → nada acontece (retro-compat). `config` antigo → merge com `DEFAULT_CONFIG` no load/import.
- `styleBalance.test.ts` e `calibration.test.ts` (rookie +4..+6 sem off-season) continuam passando sem edição — só *adicionar* casos.
- Textos de UI em português; sem novas dependências.

---

### Task 1: Tipos + config + merge no storage

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/storage.ts`
- Test: `src/storage.test.ts`

**Interfaces:**
- Produces: `OffseasonChoice { primary: Category; secondary: Category }`; `Season.offseason?: OffseasonChoice`; `EngineConfig.offseasonBase: number; offseasonShare: number`; `DEFAULT_CONFIG.offseasonBase = 450`, `.offseasonShare = 0.2`. `loadCareer`/`importCareer` retornam `config` mesclado com `DEFAULT_CONFIG`.

- [ ] **Step 1: Failing test** (append to `src/storage.test.ts`; look at the file's existing helper for a fake `Storage` and reuse it)

```ts
import { DEFAULT_CONFIG } from './engine/types'

describe('config merge for old saves', () => {
  it('loadCareer fills missing config fields from DEFAULT_CONFIG', () => {
    const store = makeStorage() // reuse the file's existing fake-storage helper name; if none exists, create a Map-backed one
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
})
```

- [ ] **Step 2: Run** `npx vitest run src/storage.test.ts` → FAIL (`offseasonBase` undefined / type error).

- [ ] **Step 3: Implement**

`types.ts`:
```ts
export interface OffseasonChoice { primary: Category; secondary: Category }
export interface Season { year: number; games: Game[]; playStyle?: string; offseason?: OffseasonChoice }
export interface EngineConfig {
  baseCost: number; costGrowth: number
  ageMults: { u21: number; prime: number; decline: number; late: number }
  playoffsMult: number; awayMult: number; winMult: number; goalBonusCap: number
  offseasonBase: number; offseasonShare: number
}
export const DEFAULT_CONFIG: EngineConfig = {
  baseCost: 100, costGrowth: 1.12,
  ageMults: { u21: 1.3, prime: 1.0, decline: 0.5, late: 0.3 },
  playoffsMult: 1.5, awayMult: 1.15, winMult: 1.1, goalBonusCap: 0.3,
  offseasonBase: 450, offseasonShare: 0.2,
}
```

`storage.ts`:
```ts
import { DEFAULT_CONFIG } from './engine/types'
import type { Career } from './engine/types'

// saves antigos podem não ter campos novos de config
function withDefaults(c: Career): Career {
  return { ...c, config: { ...DEFAULT_CONFIG, ...(c.config ?? {}) } }
}

export function loadCareer(storage: Storage = localStorage): Career | null {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return null
  try { return withDefaults(JSON.parse(raw) as Career) } catch { return null }
}
// importCareer: return withDefaults(c) at the end
```

- [ ] **Step 4:** `npx vitest run src/storage.test.ts && npx tsc -b` → PASS. (`tsc` may flag test files/`CreatePlayer.tsx` building `config: DEFAULT_CONFIG` — those already use the constant, fine.)

- [ ] **Step 5: Commit** `feat: tipos de off-season e merge de config em saves antigos`

---

### Task 2: Extrair `distributeCategoryXp` de `applyGameXp`

**Files:**
- Modify: `src/engine/progression.ts`
- Test: `src/engine/progression.test.ts`

**Interfaces:**
- Produces:
```ts
export function distributeCategoryXp(
  career: Career, cat: Category, xp: number, styleId: string,
  idPrefix: string, counter: { n: number }, textPrefix = '',
): Instruction[]
```
Distribui `xp` entre atributos <99 da categoria por `attrWeight` normalizado; loop de +1; `attr.xp = 0` ao chegar em 99; instruções `${idPrefix}-${counter.n++}` com texto `${textPrefix}+1 ${label} (a → b)`. `applyGameXp` chama com `idPrefix = \`instr-${gameId}\``, `counter` compartilhado entre categorias, `textPrefix = ''` — ids/textos **idênticos** aos atuais.

- [ ] **Step 1: Failing test** (append)

```ts
import { distributeCategoryXp } from './progression'

describe('distributeCategoryXp', () => {
  it('delivers exactly xp across the category and emits +1s with the given prefix', () => {
    const career = makeCareer()
    const counter = { n: 0 }
    const before = ['midRange', 'shotIQ', 'offConsistency'].map(id => career.attributes[id].xp)
    const instr = distributeCategoryXp(career, 'mid', 250, 'balanced', 'offseason-2026', counter, 'Off-season 2026: ')
    const gained = ['midRange', 'shotIQ', 'offConsistency']
      .map((id, i) => career.attributes[id].xp - before[i] + (career.attributes[id].value - 70) * upgradeCost(70, DEFAULT_CONFIG))
    expect(gained.reduce((s, v) => s + v, 0)).toBeCloseTo(250, 3)
    expect(instr.length).toBeGreaterThan(0)
    expect(instr[0].id).toBe('offseason-2026-0')
    expect(instr[0].text.startsWith('Off-season 2026: +1 ')).toBe(true)
    expect(counter.n).toBe(instr.length)
  })
})
```

- [ ] **Step 2: Run** → FAIL (not exported).

- [ ] **Step 3: Implement** — move the `defs.forEach` block out of `applyGameXp`:

```ts
export function distributeCategoryXp(
  career: Career, cat: Category, xp: number, styleId: string,
  idPrefix: string, counter: { n: number }, textPrefix = '',
): Instruction[] {
  const cfg = career.config
  const { position, heightCm } = career.player
  const instructions: Instruction[] = []
  if (xp <= 0) return instructions
  const defs = attributesByCategory(cat).filter(d => career.attributes[d.id].value < 99)
  if (defs.length === 0) return instructions
  const weights = defs.map(d => attrWeight(d.id, styleId, position, heightCm))
  const wsum = weights.reduce((s, w) => s + w, 0)
  defs.forEach((d, i) => {
    const attr = career.attributes[d.id]
    attr.xp += xp * weights[i] / wsum
    while (attr.value < 99 && attr.xp >= upgradeCost(attr.value, cfg)) {
      attr.xp -= upgradeCost(attr.value, cfg)
      attr.value += 1
      instructions.push({
        id: `${idPrefix}-${counter.n++}`, type: 'attribute',
        text: `${textPrefix}+1 ${d.label} (${attr.value - 1} → ${attr.value})`,
        attribute: d.id, delta: 1,
      })
    }
    if (attr.value >= 99) attr.xp = 0
  })
  return instructions
}
```
`applyGameXp` body per category becomes:
```ts
const counter = { n: 0 }   // before the loop
...
xpByCategory[cat] = total
if (total <= 0) continue
instructions.push(...distributeCategoryXp(career, cat, total, styleId, `instr-${gameId}`, counter))
```

- [ ] **Step 4:** `npx vitest run src/engine/` → PASS (all existing progression/replay tests unchanged; ids identical because counter is shared across categories exactly like `n` was).

- [ ] **Step 5: Commit** `refactor: extrai distributeCategoryXp de applyGameXp`

---

### Task 3: `offseason.ts` — `offseasonTotal` + `applyOffseason`

**Files:**
- Create: `src/engine/offseason.ts`
- Test: `src/engine/offseason.test.ts`

**Interfaces:**
- Consumes: `distributeCategoryXp` (Task 2), `badgeWeight` (`affinity.ts`), `ageMultiplier` (`multipliers.ts`), `ageAt` (`recalc.ts` — **do not import from recalc.ts**, circular; compute `career.player.startAge + seasonIndex` inline), `BADGES`, `tierOf`, `TIER_NAMES`.
- Produces:
```ts
export const OFFSEASON_SPREAD = 0.5
export const OFFSEASON_PRIMARY = 0.35
export const OFFSEASON_SECONDARY = 0.15
export const OFFSEASON_BADGE_UNITS = 3 * 0.55
export const CATEGORY_LIST: Category[] = ['inside','mid','three','ft','playmaking','rebounding','defense','physical']
export function offseasonTotal(cfg: EngineConfig, age: number, seasonXp: number): number
export function offseasonCategoryXp(total: number, choice: OffseasonChoice): Record<Category, number>
export function applyOffseason(career: Career, seasonIndex: number, seasonXpByCategory: Partial<Record<Category, number>>): Instruction[]
```

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { offseasonTotal, offseasonCategoryXp, applyOffseason, CATEGORY_LIST } from './offseason'
import { DEFAULT_CONFIG } from './types'
import type { Career } from './types'
import { ATTRIBUTES } from './attributes'
import { BADGES } from './badges'
import { recalcCareer } from './recalc'

function makeCareer(startAge = 20): Career {
  const initialAttributes: Record<string, number> = {}
  for (const a of ATTRIBUTES) initialAttributes[a.id] = 70
  const initialBadges: Record<string, number> = {}
  for (const b of BADGES) initialBadges[b.id] = 0
  const c: Career = {
    player: { name: 'T', position: 'SG', heightCm: 196, team: 'X', startAge },
    initialAttributes, initialBadges, attributes: {}, badges: {}, activeChallenges: [],
    seasons: [{ year: 2026, games: [], playStyle: 'balanced' }],
    pendingInstructions: [], config: DEFAULT_CONFIG, targetOverrides: {},
  }
  recalcCareer(c)
  return c
}

describe('offseasonTotal', () => {
  it('scales with age curve and season xp', () => {
    expect(offseasonTotal(DEFAULT_CONFIG, 20, 0)).toBeCloseTo(450 * 1.3, 5)
    expect(offseasonTotal(DEFAULT_CONFIG, 30, 1000)).toBeCloseTo(450 + 200, 5)
    expect(offseasonTotal(DEFAULT_CONFIG, 37, 1000)).toBeCloseTo(450 * 0.3 + 200, 5)
    expect(offseasonTotal(DEFAULT_CONFIG, 20, 1000)).toBeGreaterThan(offseasonTotal(DEFAULT_CONFIG, 30, 1000))
  })
})

describe('offseasonCategoryXp', () => {
  it('splits 50% spread + 35% primary + 15% secondary and sums to total', () => {
    const x = offseasonCategoryXp(800, { primary: 'three', secondary: 'mid' })
    const sum = CATEGORY_LIST.reduce((s, c) => s + x[c], 0)
    expect(sum).toBeCloseTo(800, 6)
    expect(x.three).toBeCloseTo(800 * (0.5 / 8 + 0.35), 6)
    expect(x.mid).toBeCloseTo(800 * (0.5 / 8 + 0.15), 6)
    expect(x.defense).toBeCloseTo(800 * 0.5 / 8, 6)
  })
  it('primary === secondary gives primary the full 50%', () => {
    const x = offseasonCategoryXp(800, { primary: 'three', secondary: 'three' })
    expect(x.three).toBeCloseTo(800 * (0.5 / 8 + 0.5), 6)
  })
})

describe('applyOffseason', () => {
  it('returns [] and mutates nothing when season has no offseason choice', () => {
    const c = makeCareer()
    const snap = JSON.stringify(c.attributes) + JSON.stringify(c.badges)
    expect(applyOffseason(c, 0, {})).toEqual([])
    expect(JSON.stringify(c.attributes) + JSON.stringify(c.badges)).toBe(snap)
  })
  it('focus on three raises threePoint more than focus on defense', () => {
    const a = makeCareer(); a.seasons[0].offseason = { primary: 'three', secondary: 'mid' }
    const b = makeCareer(); b.seasons[0].offseason = { primary: 'defense', secondary: 'mid' }
    applyOffseason(a, 0, { three: 500 }); applyOffseason(b, 0, { three: 500 })
    const gain = (c: Career) => c.attributes.threePoint.xp + (c.attributes.threePoint.value - 70) * 100
    expect(gain(a)).toBeGreaterThan(gain(b) * 2)
  })
  it('all badges progress and ids are prefixed by year', () => {
    const c = makeCareer(); c.seasons[0].offseason = { primary: 'three', secondary: 'mid' }
    const instr = applyOffseason(c, 0, { three: 500 })
    for (const b of BADGES) expect(c.badges[b.id].progress).toBeGreaterThan(0)
    for (const i of instr) expect(i.id.startsWith('offseason-2026-')).toBe(true)
    expect(new Set(instr.map(i => i.id)).size).toBe(instr.length)
    expect(instr.some(i => i.type === 'attribute')).toBe(true)
    for (const i of instr) expect(i.text.startsWith('Off-season 2026: ')).toBe(true)
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/engine/offseason.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/engine/offseason.ts
import type { Career, Category, EngineConfig, Instruction, OffseasonChoice } from './types'
import { ageMultiplier } from './multipliers'
import { distributeCategoryXp } from './progression'
import { BADGES, tierOf, TIER_NAMES } from './badges'
import { badgeWeight } from './affinity'

export const OFFSEASON_SPREAD = 0.5
export const OFFSEASON_PRIMARY = 0.35
export const OFFSEASON_SECONDARY = 0.15
// empurrão universal ≈ 3 jogos de proxy(0.5)+trickle(0.05), escalado por afinidade
export const OFFSEASON_BADGE_UNITS = 3 * 0.55
export const CATEGORY_LIST: Category[] = ['inside', 'mid', 'three', 'ft', 'playmaking', 'rebounding', 'defense', 'physical']

export function offseasonTotal(cfg: EngineConfig, age: number, seasonXp: number): number {
  return cfg.offseasonBase * ageMultiplier(age, cfg) + cfg.offseasonShare * seasonXp
}

export function offseasonCategoryXp(total: number, choice: OffseasonChoice): Record<Category, number> {
  const out = {} as Record<Category, number>
  const spread = total * OFFSEASON_SPREAD / CATEGORY_LIST.length
  for (const c of CATEGORY_LIST) out[c] = spread
  if (choice.primary === choice.secondary) {
    out[choice.primary] += total * (OFFSEASON_PRIMARY + OFFSEASON_SECONDARY)
  } else {
    out[choice.primary] += total * OFFSEASON_PRIMARY
    out[choice.secondary] += total * OFFSEASON_SECONDARY
  }
  return out
}

export function applyOffseason(
  career: Career, seasonIndex: number, seasonXpByCategory: Partial<Record<Category, number>>,
): Instruction[] {
  const season = career.seasons[seasonIndex]
  if (!season?.offseason) return []
  const age = career.player.startAge + seasonIndex
  const styleId = season.playStyle ?? 'balanced'
  const seasonXp = Object.values(seasonXpByCategory).reduce((s, v) => s + (v ?? 0), 0)
  const total = offseasonTotal(career.config, age, seasonXp)
  const perCat = offseasonCategoryXp(total, season.offseason)
  const prefix = `Off-season ${season.year}: `
  const counter = { n: 0 }
  const instructions: Instruction[] = []
  for (const cat of CATEGORY_LIST) {
    instructions.push(...distributeCategoryXp(career, cat, perCat[cat], styleId, `offseason-${season.year}`, counter, prefix))
  }
  const { position, heightCm } = career.player
  let bn = 0
  for (const def of BADGES) {
    const state = career.badges[def.id]
    if (!state) continue
    const before = tierOf(state.progress)
    state.progress += OFFSEASON_BADGE_UNITS * badgeWeight(def.id, def.group, styleId, position, heightCm)
    const after = tierOf(state.progress)
    if (after > before) {
      instructions.push({
        id: `offseason-${season.year}-badge-${bn++}`, type: 'badge',
        text: `${prefix}Suba ${def.name} para ${TIER_NAMES[after]} no 2K`,
        badge: def.id, tier: after,
      })
    }
  }
  return instructions
}
```

- [ ] **Step 4:** `npx vitest run src/engine/offseason.test.ts` → PASS. Then `npx vitest run` + `npx tsc -b`.

- [ ] **Step 5: Commit** `feat: motor de off-season — pacote por idade+temporada, focos, badges`

---

### Task 4: `recalc.ts` — acumular XP da temporada e aplicar off-season no replay

**Files:**
- Modify: `src/engine/recalc.ts`
- Test: `src/engine/recalc.test.ts`, `src/engine/calibration.test.ts`

**Interfaces:**
- `processGame(career, seasonIndex, game, globalGameIndex, seasonXp?: Partial<Record<Category, number>>)` — **novo 5º parâmetro opcional**; quando passado, soma `xpResult.xpByCategory` nele. Retorno inalterado (`Instruction[]`). Callers existentes (`PostGame.tsx`, testes) não mudam.
- `recalcCareer`: por temporada mantém `seasonXp`; ao entrar em `si>0`, `applyOffseason(career, si-1, seasonXpPrev)` antes de `regressionInstructions(career, si)`.

- [ ] **Step 1: Failing tests** (append to `recalc.test.ts`)

```ts
import { applyOffseason } from './offseason'  // only if needed for typing; main assertions below use recalcCareer

describe('offseason in replay', () => {
  it('season with offseason choice yields offseason instructions before regression on the next season', () => {
    const c = makeCareer34() // build a career: startAge 34, season 0 with 3 played games and offseason {primary:'three', secondary:'mid'}, season 1 empty
    recalcCareer(c)
    const ids = c.pendingInstructions.map(i => i.id)
    const firstOff = ids.findIndex(i => i.startsWith('offseason-'))
    const firstReg = ids.findIndex(i => i.startsWith('regress-1-'))
    expect(firstOff).toBeGreaterThanOrEqual(0)
    expect(firstReg).toBeGreaterThan(firstOff)
  })
  it('season without offseason choice yields no offseason instructions', () => {
    const c = makeCareer34(); delete c.seasons[0].offseason
    recalcCareer(c)
    expect(c.pendingInstructions.some(i => i.id.startsWith('offseason-'))).toBe(false)
  })
  it('replay is idempotent with offseason', () => {
    const c = makeCareer34()
    recalcCareer(c); const a = JSON.stringify([c.attributes, c.badges, c.pendingInstructions.map(i => i.id)])
    recalcCareer(c); const b = JSON.stringify([c.attributes, c.badges, c.pendingInstructions.map(i => i.id)])
    expect(a).toBe(b)
  })
})
```
Write `makeCareer34()` in the test file using the same shape as the file's existing career factory (copy its `player`/`initialAttributes` builder), `startAge: 34`, `seasons: [{ year: 2026, games: [g1,g2,g3], playStyle: 'balanced', offseason: { primary: 'three', secondary: 'mid' } }, { year: 2027, games: [] }]` where `g1..g3` are played games (reuse the file's box factory; `min` ≥ 20).

Also append to `calibration.test.ts`:
```ts
it('rookie season + offseason (three/mid focus) adds +1 to +2 OVR on top of the season', () => {
  const c = makeCareer(20, 68)
  runSeason(c, 0, 82)
  const afterSeason = estimateOverall(Object.fromEntries(Object.entries(c.attributes).map(([k, v]) => [k, v.value])), 'SG')
  c.seasons[0].offseason = { primary: 'three', secondary: 'mid' }
  c.seasons.push({ year: 2027, games: [] })
  recalcCareer(c)
  const afterOff = estimateOverall(Object.fromEntries(Object.entries(c.attributes).map(([k, v]) => [k, v.value])), 'SG')
  expect(afterOff - afterSeason).toBeGreaterThanOrEqual(1)
  expect(afterOff - afterSeason).toBeLessThanOrEqual(2)
})
```
If this lands outside [1,2], the calibration knob is `DEFAULT_CONFIG.offseasonBase` (Task 1). Adjust **the constant** (and Task 3's `offseasonTotal` test literals that hardcode 450) — record the value chosen in the report. Do not widen the assertion beyond [1,3].

- [ ] **Step 2: Run** `npx vitest run src/engine/recalc.test.ts src/engine/calibration.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// recalc.ts
import { applyOffseason } from './offseason'
import type { Career, Category, Game, Instruction } from './types'

export function processGame(
  career: Career, seasonIndex: number, game: Game, globalGameIndex: number,
  seasonXp?: Partial<Record<Category, number>>,
): Instruction[] {
  ...
  const xpResult = applyGameXp(career, game.box, game.context, age, bonus, game.id, styleId)
  if (seasonXp) for (const [cat, v] of Object.entries(xpResult.xpByCategory)) seasonXp[cat as Category] = (seasonXp[cat as Category] ?? 0) + v
  ...
}

export function recalcCareer(career: Career): void {
  ...
  let globalGameIndex = 0
  let prevSeasonXp: Partial<Record<Category, number>> = {}
  career.seasons.forEach((season, si) => {
    if (si > 0) {
      // off-season da temporada anterior (se o usuário fechou com foco), depois regressão física
      career.pendingInstructions.push(...applyOffseason(career, si - 1, prevSeasonXp))
      career.pendingInstructions.push(...regressionInstructions(career, si))
    }
    const seasonXp: Partial<Record<Category, number>> = {}
    for (const g of season.games) {
      processGame(career, si, g, globalGameIndex, seasonXp)
      if (g.box && g.box.min > 0) globalGameIndex++
    }
    prevSeasonXp = seasonXp
  })
  ...
}
```

- [ ] **Step 4:** `npx vitest run src/engine/` → PASS (incl. `styleBalance`, existing calibration). Then full suite + `tsc -b`.

- [ ] **Step 5: Commit** `feat: replay aplica off-season antes da regressão ao virar temporada`

---

### Task 5: UI — painel Off-season no Dashboard

**Files:**
- Modify: `src/ui/Dashboard.tsx` (`newSeason` at ~76–89; "Gestão" block at ~332–356; pending-instructions block at ~153–175)

**Interfaces:**
- Consumes: `offseasonTotal` (`offseason.ts`), `recalcCareer` (`recalc.ts`), `gameXpBreakdown`, `seasonOvrDelta`, `CATEGORY_LABELS`, `CATEGORIES` (`derive.ts`), `PLAY_STYLES`/`getStyle`.

- [ ] **Step 1: State + derived values** (top of component, next to `nextStyle`):

```tsx
const [primary, setPrimary] = useState<Category>('three')
const [secondary, setSecondary] = useState<Category>('mid')
...
const playedGames = season.games.filter(g => g.box && g.box.min > 0)
const wins = playedGames.filter(g => g.context.win).length
const seasonXpTotal = playedGames.reduce((s, g) => s + gameXpBreakdown(career, g, seasons.length - 1).total, 0)
const offTotal = Math.round(offseasonTotal(career.config, age, seasonXpTotal))
const canClose = playedGames.length > 0 && primary !== secondary
```

- [ ] **Step 2: Replace `newSeason`**

```tsx
function closeSeason() {
  const style = nextStyle ?? career!.playStyle ?? 'balanced'
  const withPackage = playedGames.length > 0
  const msg = withPackage
    ? `Fechar ${season.year}: foco ${CATEGORY_LABELS[primary]} + ${CATEGORY_LABELS[secondary]}, pacote ≈ ${offTotal} XP. Próxima temporada com ${getStyle(style).name}. Continuar?`
    : `Iniciar nova temporada com estilo ${getStyle(style).name}? (sem jogos, sem pacote de off-season)`
  if (!window.confirm(msg)) return
  update(c => {
    const last = c.seasons[c.seasons.length - 1]
    if (withPackage) last.offseason = { primary, secondary }
    c.seasons.push({ year: last.year + 1, games: [], playStyle: style })
    c.playStyle = style
    c.nextGoals = null; c.pendingContext = null; c.lastResult = null
    recalcCareer(c)  // reaplica tudo: off-season + regressão viram pendingInstructions
  })
}
```
Remove the old `regressionInstructions` push (recalc does it) and its import if unused.

- [ ] **Step 3: Panel JSX** — replace the "Nova temporada" button in the Gestão grid with a new block **above** the grid:

```tsx
{/* Off-season */}
<div className="flex flex-col gap-2.5 border-t border-hud-line pt-4">
  <span className="hud-label">Off-season</span>
  <div className="grid grid-cols-4 gap-px border border-hud-line bg-hud-line text-center">
    {[['JOGOS', String(playedGames.length)], ['W–L', `${wins}–${playedGames.length - wins}`],
      ['OVR Δ', (delta >= 0 ? '+' : '') + delta], ['XP', String(Math.round(seasonXpTotal))]].map(([l, v]) => (
      <div key={l} className="flex flex-col items-center gap-1 bg-hud-panel px-1 py-2">
        <span className="stat text-lg leading-none">{v}</span>
        <span className="font-display text-[9px] tracking-[.1em] text-hud-mut">{l}</span>
      </div>
    ))}
  </div>
  <div className="grid grid-cols-2 gap-2">
    <select className="input text-sm" value={primary} onChange={e => setPrimary(e.target.value as Category)} title="Foco primário (35%)">
      {CATEGORIES.map(c => <option key={c} value={c}>1º {CATEGORY_LABELS[c]}</option>)}
    </select>
    <select className="input text-sm" value={secondary} onChange={e => setSecondary(e.target.value as Category)} title="Foco secundário (15%)">
      {CATEGORIES.map(c => <option key={c} value={c}>2º {CATEGORY_LABELS[c]}</option>)}
    </select>
  </div>
  {primary === secondary && <span className="text-xs text-red-400">Escolha dois focos diferentes.</span>}
  <select className="input text-sm" value={nextStyle ?? (career.playStyle ?? 'balanced')}
    onChange={e => setNextStyle(e.target.value)} title="Estilo da próxima temporada">
    {PLAY_STYLES.map(s => <option key={s.id} value={s.id}>{s.reference ? `${s.name} — ${s.reference}` : s.name}</option>)}
  </select>
  <div className="flex items-center justify-between">
    <span className="font-display text-[10px] tracking-[.1em] text-hud-mut uppercase">
      Pacote ≈ {offTotal} XP · 50% geral / 35% 1º / 15% 2º
    </span>
    <button className="border border-orange-500/40 px-3 py-2 text-sm font-semibold text-orange-300 disabled:opacity-40"
      disabled={!canClose && playedGames.length > 0} onClick={closeSeason}>
      {playedGames.length > 0 ? 'Fechar temporada' : 'Nova temporada'}
    </button>
  </div>
</div>
```
Move the existing style `<select>` out of the Gestão block (it now lives here) and drop the old "Nova temporada" button from the grid (grid keeps Exportar / Importar / Apagar — make it `grid-cols-3` or keep 2 cols with 3 items).

- [ ] **Step 4: Banner** — inside the pending-instructions block, after the list, when `career.pendingInstructions.some(i => i.id.startsWith('offseason-'))`:

```tsx
<div className="border-l-2 border-orange-500 bg-orange-950/30 px-3 py-2 text-xs text-orange-200">
  Aplique no editor de roster do 2K e ajuste <b>Potential = OVR</b> para o 2K não progredir sozinho.
</div>
```

- [ ] **Step 5: Verify** `npx tsc -b && npm run lint && npm run build && npx vitest run` — clean.

- [ ] **Step 6: Commit** `feat: painel de off-season — focos, resumo, fechar temporada com pacote`

---

### Task 6: Fixture de replay com off-season

**Files:**
- Modify: `src/engine/fixtures/pg-save.json` (add `offseason` to the season + a second empty season)
- Modify: `src/engine/recalc.test.ts` (extend the real-save test)

- [ ] **Step 1:** In `pg-save.json`, add `"offseason": { "primary": "playmaking", "secondary": "mid" }` to `seasons[0]` and append `{ "year": 2028, "games": [], "playStyle": "maestro" }` to `seasons`.
- [ ] **Step 2:** Extend the "replay of a real PG save" test: after `recalcCareer`, `expect(career.pendingInstructions.some(i => i.id.startsWith('offseason-2027-'))).toBe(true)` and `expect(career.pendingInstructions.filter(i => i.id.startsWith('offseason-2027-') && i.type === 'attribute').length).toBeGreaterThanOrEqual(2)`.
- [ ] **Step 3:** `npx vitest run src/engine/recalc.test.ts` → PASS; full suite green.
- [ ] **Step 4: Commit** `test: fixture real com off-season no replay`

---

## Self-review

- **Spec coverage:** tipos/config/merge (T1); extração de distribuição (T2); motor off-season com split, badges, ids, prefixo (T3); replay com acumulador + ordem offseason→regressão + retro-compat + calibração (T4); UI painel + banner + confirm (T5); fixture (T6).
- **Placeholders:** `makeCareer34()` e `makeStorage()` remetem a helpers existentes nos arquivos de teste — executor copia o padrão local; sem TBD.
- **Type consistency:** `distributeCategoryXp(career, cat, xp, styleId, idPrefix, counter, textPrefix?)` igual em T2/T3; `applyOffseason(career, seasonIndex, seasonXpByCategory)` igual em T3/T4; `processGame(..., seasonXp?)` 5º param opcional em T4, callers antigos intactos; `offseasonTotal(cfg, age, seasonXp)` igual em T3/T5.
