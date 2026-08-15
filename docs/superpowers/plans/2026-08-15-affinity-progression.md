# Affinity Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** XP de categoria é distribuído entre todos os atributos da categoria por peso de afinidade (estilo × posição × altura); badges progridem pelo mesmo peso em vez de gates duros de posição.

**Architecture:** Novo módulo puro `src/engine/affinity.ts` calcula `attrWeight`/`badgeWeight` a partir de tabelas por estilo, posição e faixa de altura relativa. `progression.ts` troca alvo único por divisão ponderada normalizada; `badges.ts` troca `styleBadgeMult` + gates `big/guard` por `badgeWeight`. Dashboard mostra chip `×w`.

**Tech Stack:** TypeScript, Vitest, React 19, Tailwind. Testes: `npx vitest run <file>`.

**Spec:** `docs/superpowers/specs/2026-08-15-affinity-progression-design.md`

## Global Constraints

- Peso = `clamp(1 + s + p + h, 0.25, 2.5)`; s ∈ {+0.5, 0, −0.5}, p ∈ {+0.35, 0, −0.35}, h ∈ {+0.25, 0, −0.25}.
- Peso afeta **só a divisão** dentro da categoria (normalizado). XP total por categoria inalterado — `styleBalance.test.ts` deve continuar verde sem edição.
- Para badges o peso multiplica `units` direto.
- `targetOverrides` permanece em `Career` (compat de save) e não é lido.
- Comentários e textos de UI em português, código em inglês (padrão do repo).
- Sem novas dependências.

---

### Task 1: `affinity.ts` — tabelas, faixa de altura, `attrWeight`

**Files:**
- Create: `src/engine/affinity.ts`
- Modify: `src/engine/playStyles.ts` (adiciona `attrOverrides`, `contraBadges` a `PlayStyle`)
- Test: `src/engine/affinity.test.ts`

**Interfaces:**
- Consumes: `PLAY_STYLES`, `getStyle` de `playStyles.ts`; `ATTRIBUTES` de `attributes.ts`; `Category`, `Position` de `types.ts`.
- Produces:
  - `type Tag = 'buff' | 'normal' | 'contra'`
  - `type HeightBand = 'short' | 'mid' | 'tall'`
  - `heightBand(pos: Position, cm: number): HeightBand`
  - `attrWeight(attrId: string, styleId: string | undefined, pos: Position, cm: number): number`
  - `PlayStyle` ganha `attrOverrides?: Record<string, Tag>` e `contraBadges: string[]`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/engine/affinity.test.ts
import { describe, it, expect } from 'vitest'
import { heightBand, attrWeight } from './affinity'
import { ATTRIBUTES } from './attributes'

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
    expect(attrWeight('threePoint', 'sniper', 'PG', 185)).toBeCloseTo(2.1, 5)
    expect(attrWeight('postHook', 'sniper', 'PG', 185)).toBeCloseTo(0.25, 5) // clamp
    expect(attrWeight('standingDunk', 'slasher', 'PG', 196)).toBeCloseTo(1.15, 5)
    expect(attrWeight('threePoint', 'sniper', 'C', 213)).toBeCloseTo(0.9, 5)
    expect(attrWeight('postHook', 'poste', 'C', 213)).toBeCloseTo(2.1, 5)
  })
  it('balanced style + neutral position/height yields 1.0', () => {
    expect(attrWeight('midRange', 'balanced', 'SF', 200)).toBe(1.0)
    expect(attrWeight('midRange', undefined, 'SF', 200)).toBe(1.0)
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/affinity.test.ts`
Expected: FAIL — `Cannot find module './affinity'`

- [ ] **Step 3: Extend `PlayStyle` in `playStyles.ts`**

Replace the interface and add per-style overrides/contra lists (keep `catMults`/`focusBadges` values unchanged):

```ts
import type { Category } from './types'
import type { Tag } from './affinity'

export interface PlayStyle {
  id: string; name: string; reference: string
  catMults: Partial<Record<Category, number>>
  focusBadges: string[]
  attrOverrides?: Record<string, Tag>
  contraBadges: string[]
}

export const PLAY_STYLES: PlayStyle[] = [
  { id: 'balanced', name: 'Equilibrado', reference: '', catMults: {}, focusBadges: [], contraBadges: [] },
  { id: 'sniper', name: 'Sniper', reference: 'Stephen Curry',
    catMults: { three: 1.7, ft: 1.5, inside: 0.9, rebounding: 0.9 },
    focusBadges: ['deadeye', 'limitless-range', 'set-shot-specialist', 'mini-marksman'],
    contraBadges: ['posterizer', 'physical-finisher', 'post-powerhouse', 'hook-specialist', 'boxout-beast', 'rebound-chaser'] },
  { id: 'slasher', name: 'Slasher', reference: 'Ja Morant',
    catMults: { inside: 1.5, physical: 1.5, three: 0.8 },
    focusBadges: ['posterizer', 'physical-finisher', 'layup-mixmaster', 'aerial-wizard'],
    attrOverrides: { postHook: 'contra', postFade: 'contra', postControl: 'contra' },
    contraBadges: ['deadeye', 'limitless-range', 'set-shot-specialist', 'post-lockdown'] },
  { id: 'maestro', name: 'Maestro', reference: 'Chris Paul',
    catMults: { playmaking: 1.7, rebounding: 0.9, inside: 0.9 },
    focusBadges: ['dimer', 'versatile-visionary', 'bail-out', 'unpluckable'],
    contraBadges: ['boxout-beast', 'rebound-chaser', 'post-powerhouse', 'hook-specialist'] },
  { id: 'defensor', name: 'Defensor de Elite', reference: 'Kawhi Leonard',
    catMults: { defense: 1.8, mid: 1.2, three: 0.9 },
    focusBadges: ['glove', 'on-ball-menace', 'challenger', 'interceptor', 'pick-dodger'],
    contraBadges: ['limitless-range', 'post-up-poet', 'hook-specialist'] },
  { id: 'ancora', name: 'Âncora do Garrafão', reference: 'Rudy Gobert',
    catMults: { defense: 1.5, rebounding: 1.5, three: 0.7, playmaking: 0.7 },
    focusBadges: ['paint-patroller', 'boxout-beast', 'rebound-chaser', 'immovable-enforcer', 'pogo-stick'],
    attrOverrides: { perimeterD: 'normal', steal: 'normal' },
    contraBadges: ['deadeye', 'limitless-range', 'shifty-shooter', 'dimer', 'ankle-assassin'] },
  { id: 'poste', name: 'Gigante do Poste', reference: 'Joel Embiid',
    catMults: { inside: 1.5, three: 0.7, playmaking: 0.7 },
    focusBadges: ['post-powerhouse', 'hook-specialist', 'post-fade-phenom', 'paint-prodigy', 'post-up-poet'],
    attrOverrides: { drivingDunk: 'normal' },
    contraBadges: ['deadeye', 'limitless-range', 'ankle-assassin', 'handles-for-days'] },
  { id: 'criador', name: 'Criador de Jogadas', reference: 'Kevin Durant',
    catMults: { mid: 1.5, playmaking: 1.5, inside: 0.7, rebounding: 0.7 },
    focusBadges: ['shifty-shooter', 'ankle-assassin', 'strong-handle', 'handles-for-days'],
    contraBadges: ['post-powerhouse', 'hook-specialist', 'boxout-beast', 'rebound-chaser'] },
  { id: 'transicao', name: 'Motor de Transição', reference: 'Giannis Antetokounmpo',
    catMults: { physical: 1.5, inside: 1.5, mid: 0.7 },
    focusBadges: ['lightning-launch', 'break-starter', 'aerial-wizard', 'posterizer', 'rise-up'],
    attrOverrides: { postHook: 'contra', postFade: 'contra', postControl: 'contra' },
    contraBadges: ['set-shot-specialist', 'post-fade-phenom', 'post-up-poet'] },
]
```

Keep `byId`, `getStyle`, `styleCategoryMult` as they are. **Do not remove `styleBadgeMult` yet** (Task 3 does).

- [ ] **Step 4: Create `affinity.ts`**

```ts
// src/engine/affinity.ts
import type { Category, Position } from './types'
import { ATTRIBUTES } from './attributes'
import { getStyle } from './playStyles'

export type Tag = 'buff' | 'normal' | 'contra'
export type HeightBand = 'short' | 'mid' | 'tall'

export interface AxisAffinity {
  buffCats?: Category[]
  contraCats?: Category[]
  attrOverrides?: Record<string, Tag>
  badgeOverrides?: Record<string, Tag>
}

// deslocamentos por eixo (ver spec)
const STYLE_DELTA = 0.5
const POSITION_DELTA = 0.35
const HEIGHT_DELTA = 0.25
const MIN_W = 0.25
const MAX_W = 2.5

export const POSITION_AFFINITY: Record<Position, AxisAffinity> = {
  PG: { buffCats: ['playmaking', 'three'], contraCats: ['inside', 'rebounding'],
    attrOverrides: { steal: 'buff', perimeterD: 'buff', midRange: 'buff', block: 'contra', interiorD: 'contra' },
    badgeOverrides: { 'on-ball-menace': 'buff', 'pick-dodger': 'buff', 'post-lockdown': 'contra', 'paint-patroller': 'contra', 'brick-wall': 'contra' } },
  SG: { buffCats: ['three', 'mid'], contraCats: ['rebounding', 'inside'],
    attrOverrides: { perimeterD: 'buff', block: 'contra', layup: 'normal', drivingDunk: 'normal' },
    badgeOverrides: { 'on-ball-menace': 'buff', 'post-lockdown': 'contra', 'brick-wall': 'contra' } },
  SF: { buffCats: ['mid', 'physical'], contraCats: [],
    attrOverrides: { postHook: 'contra', standingDunk: 'contra' } },
  PF: { buffCats: ['inside', 'rebounding'], contraCats: ['three', 'playmaking'],
    attrOverrides: { midRange: 'normal', passIQ: 'normal' },
    badgeOverrides: { 'paint-patroller': 'buff', 'brick-wall': 'buff', 'on-ball-menace': 'contra' } },
  C: { buffCats: ['inside', 'rebounding', 'defense'], contraCats: ['three', 'playmaking'],
    attrOverrides: { perimeterD: 'contra', steal: 'contra', interiorD: 'buff', block: 'buff' },
    badgeOverrides: { 'paint-patroller': 'buff', 'post-lockdown': 'buff', 'brick-wall': 'buff', 'on-ball-menace': 'contra', 'pick-dodger': 'contra', 'ankle-assassin': 'contra' } },
}

// cm: < short → 'short'; > tall → 'tall'; senão 'mid'
export const HEIGHT_BANDS: Record<Position, { short: number; tall: number }> = {
  PG: { short: 185, tall: 195 },
  SG: { short: 190, tall: 200 },
  SF: { short: 196, tall: 206 },
  PF: { short: 201, tall: 211 },
  C:  { short: 206, tall: 216 },
}

const SHORT_BUFF_ATTRS = ['speed', 'agility', 'ballHandle', 'speedWithBall', 'perimeterD', 'steal']
const SHORT_CONTRA_ATTRS = ['standingDunk', 'postHook', 'postFade', 'postControl', 'block', 'interiorD', 'offRebound', 'defRebound']
const SHORT_BUFF_BADGES = ['shifty-shooter', 'ankle-assassin', 'handles-for-days', 'lightning-launch', 'on-ball-menace', 'pick-dodger', 'slippery-off-ball']
const SHORT_CONTRA_BADGES = ['post-fade-phenom', 'post-powerhouse', 'post-up-poet', 'post-lockdown', 'hook-specialist', 'paint-prodigy', 'rise-up', 'paint-patroller', 'boxout-beast', 'rebound-chaser', 'brick-wall', 'immovable-enforcer', 'pogo-stick']

const tagMap = (buff: string[], contra: string[]): Record<string, Tag> => ({
  ...Object.fromEntries(buff.map(id => [id, 'buff' as Tag])),
  ...Object.fromEntries(contra.map(id => [id, 'contra' as Tag])),
})

export const HEIGHT_AFFINITY: Record<HeightBand, AxisAffinity> = {
  short: { attrOverrides: tagMap(SHORT_BUFF_ATTRS, SHORT_CONTRA_ATTRS), badgeOverrides: tagMap(SHORT_BUFF_BADGES, SHORT_CONTRA_BADGES) },
  mid: {},
  tall: { attrOverrides: tagMap(SHORT_CONTRA_ATTRS, SHORT_BUFF_ATTRS), badgeOverrides: tagMap(SHORT_CONTRA_BADGES, SHORT_BUFF_BADGES) },
}

export function heightBand(pos: Position, cm: number): HeightBand {
  const b = HEIGHT_BANDS[pos]
  return cm < b.short ? 'short' : cm > b.tall ? 'tall' : 'mid'
}

const DELTA: Record<Tag, number> = { buff: 1, normal: 0, contra: -1 }
const clamp = (w: number) => Math.min(MAX_W, Math.max(MIN_W, w))

function axisTagForCategory(axis: AxisAffinity, cat: Category | null): Tag {
  if (cat && axis.buffCats?.includes(cat)) return 'buff'
  if (cat && axis.contraCats?.includes(cat)) return 'contra'
  return 'normal'
}

function styleTagForCategory(styleId: string | undefined, cat: Category | null): Tag {
  if (!cat) return 'normal'
  const m = getStyle(styleId).catMults[cat]
  return m === undefined || m === 1 ? 'normal' : m > 1 ? 'buff' : 'contra'
}

const attrCategory = new Map(ATTRIBUTES.map(a => [a.id, a.category]))

export function attrWeight(attrId: string, styleId: string | undefined, pos: Position, cm: number): number {
  const cat = attrCategory.get(attrId) ?? null
  const style = getStyle(styleId)
  const s = style.attrOverrides?.[attrId] ?? styleTagForCategory(styleId, cat)
  const posAxis = POSITION_AFFINITY[pos]
  const p = posAxis.attrOverrides?.[attrId] ?? axisTagForCategory(posAxis, cat)
  const hAxis = HEIGHT_AFFINITY[heightBand(pos, cm)]
  const h = hAxis.attrOverrides?.[attrId] ?? axisTagForCategory(hAxis, cat)
  return clamp(1 + DELTA[s] * STYLE_DELTA + DELTA[p] * POSITION_DELTA + DELTA[h] * HEIGHT_DELTA)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/engine/affinity.test.ts src/engine/playStyles.test.ts`
Expected: PASS (playStyles tests untouched; `styleBadgeMult` still exists)

Sanity on the calibrated cases: PG 185 → band `mid` (185 not < 185); sniper three buff (+0.5), PG three buff (+0.35), height mid (0) → 1.85? **No** — spec says 2.1. Check spec table: "PG 1.85 Sniper → Three = 2.1" assumes height short. `HEIGHT_BANDS.PG.short = 185` with `<` makes 185 mid. **Fix the test, not the table:** use `184` for the "short PG" cases in the test (`attrWeight('threePoint','sniper','PG',184)` and `postHook` case). Also fix the `heightBand` test accordingly (184 short, 185 mid — already so). Update Step 1 test literals to 184 before running.

- [ ] **Step 6: Commit**

```bash
git add src/engine/affinity.ts src/engine/affinity.test.ts src/engine/playStyles.ts
git commit -m "feat: módulo de afinidade — peso por atributo (estilo × posição × altura)"
```

---

### Task 2: `badgeWeight`

**Files:**
- Modify: `src/engine/affinity.ts`
- Test: `src/engine/affinity.test.ts`

**Interfaces:**
- Consumes: `BADGES` from `badges.ts` (each has `id`, `group`).
- Produces: `badgeWeight(badgeId: string, styleId: string | undefined, pos: Position, cm: number): number`

- [ ] **Step 1: Write the failing tests** (append to `affinity.test.ts`)

```ts
import { badgeWeight } from './affinity'
import { BADGES } from './badges'

describe('badgeWeight', () => {
  it('focus badge is buffed, contra badge is nerfed, others follow group category', () => {
    // sniper, SF 200 (neutral position for three? SF has no three tag; height mid)
    expect(badgeWeight('deadeye', 'sniper', 'SF', 200)).toBeCloseTo(1.5, 5)        // focus
    expect(badgeWeight('posterizer', 'sniper', 'SF', 200)).toBeCloseTo(0.5, 5)     // contra
    expect(badgeWeight('mini-marksman', 'sniper', 'SF', 200)).toBeCloseTo(1.5, 5)  // focus
    expect(badgeWeight('glove', 'sniper', 'SF', 200)).toBeCloseTo(1.0, 5)          // defense: sniper has no defense mult
    expect(badgeWeight('layup-mixmaster', 'sniper', 'SF', 200)).toBeCloseTo(0.5, 5) // inside group, sniper inside 0.9 → contra
  })
  it('position and height shape badges via group + overrides', () => {
    // PG 184: post-lockdown → position contra (override) + height contra (short) + balanced 0
    expect(badgeWeight('post-lockdown', 'balanced', 'PG', 184)).toBeCloseTo(1 - 0.35 - 0.25, 5)
    // C 217: paint-patroller → position buff (override) + height buff (tall)
    expect(badgeWeight('paint-patroller', 'balanced', 'C', 217)).toBeCloseTo(1 + 0.35 + 0.25, 5)
    // general group with no overrides stays 1
    expect(badgeWeight('pogo-stick', 'balanced', 'SF', 200)).toBe(1.0)
  })
  it('never leaves the clamp range', () => {
    for (const b of BADGES) {
      for (const style of ['balanced', 'sniper', 'slasher', 'maestro', 'defensor', 'ancora', 'poste', 'criador', 'transicao']) {
        for (const pos of ['PG', 'SG', 'SF', 'PF', 'C'] as const) {
          for (const cm of [170, 200, 225]) {
            const w = badgeWeight(b.id, style, pos, cm)
            expect(w).toBeGreaterThanOrEqual(0.25)
            expect(w).toBeLessThanOrEqual(2.5)
          }
        }
      }
    }
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/engine/affinity.test.ts`
Expected: FAIL — `badgeWeight` is not exported

- [ ] **Step 3: Implement** (append to `affinity.ts`)

```ts
import { BADGES } from './badges'

// group da badge → categoria de atributo equivalente (general não tem)
const GROUP_CATEGORY: Record<string, Category | null> = {
  inside: 'inside', outside: 'three', playmaking: 'playmaking',
  defense: 'defense', rebounding: 'rebounding', general: null,
}
const badgeGroup = new Map(BADGES.map(b => [b.id, b.group]))

export function badgeWeight(badgeId: string, styleId: string | undefined, pos: Position, cm: number): number {
  const cat = GROUP_CATEGORY[badgeGroup.get(badgeId) ?? 'general'] ?? null
  const style = getStyle(styleId)
  const s: Tag = style.focusBadges.includes(badgeId) ? 'buff'
    : style.contraBadges.includes(badgeId) ? 'contra'
    : styleTagForCategory(styleId, cat)
  const posAxis = POSITION_AFFINITY[pos]
  const p = posAxis.badgeOverrides?.[badgeId] ?? axisTagForCategory(posAxis, cat)
  const hAxis = HEIGHT_AFFINITY[heightBand(pos, cm)]
  const h = hAxis.badgeOverrides?.[badgeId] ?? axisTagForCategory(hAxis, cat)
  return clamp(1 + DELTA[s] * STYLE_DELTA + DELTA[p] * POSITION_DELTA + DELTA[h] * HEIGHT_DELTA)
}
```

Note: `badges.ts` will import `affinity.ts` in Task 3 and `affinity.ts` imports `BADGES` here → circular import. Avoid it: **do not import `BADGES`**. Instead pass the group through a lightweight map built lazily, or better — move `badgeWeight` to accept `group`:

```ts
export type BadgeGroup = 'inside' | 'outside' | 'playmaking' | 'defense' | 'rebounding' | 'general'
export function badgeWeight(badgeId: string, group: BadgeGroup, styleId: string | undefined, pos: Position, cm: number): number {
  const cat = GROUP_CATEGORY[group]
  // ... resto igual
}
```

Use **this** signature (with `group`) — update the tests in Step 1 to pass `b.group` / the literal group (`'outside'` for deadeye/mini-marksman, `'inside'` for posterizer/layup-mixmaster, `'defense'` for glove/post-lockdown/paint-patroller, `'general'` for pogo-stick). Remove the `BADGES` import from `affinity.ts`; keep it in the test file for the clamp sweep.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine/affinity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/affinity.ts src/engine/affinity.test.ts
git commit -m "feat: badgeWeight — peso de badge por estilo, posição e altura"
```

---

### Task 3: `badges.ts` — remove gates de posição, aplica `badgeWeight`, remove `styleBadgeMult`

**Files:**
- Modify: `src/engine/badges.ts`
- Modify: `src/engine/playStyles.ts` (remove `styleBadgeMult`)
- Modify: `src/engine/recalc.ts:29` (passa `heightCm`)
- Test: `src/engine/badges.test.ts`, `src/engine/playStyles.test.ts`, `src/engine/styleIntegration.test.ts`

**Interfaces:**
- Consumes: `badgeWeight(badgeId, group, styleId, pos, cm)` from Task 2.
- Produces: `applyBadgeProgress(badges, box, ctx, position, heightCm, gameId, styleId?)` — **new `heightCm: number` param inserted after `position`**.

- [ ] **Step 1: Update tests to the new contract**

`src/engine/badges.test.ts` — replace `applyBadgeProgress` calls: add `196` after position:

```ts
const instructions = applyBadgeProgress(badges, shooterGame, ctx, 'SG', 196, 'test')
// ...
applyBadgeProgress(badges, { ...shooterGame, ast: 9, reb: 11, stl: 2, blk: 2, tov: 2 }, ctx, 'SF', 200, `game${i}`)
```

Add new tests to `badges.test.ts`:

```ts
describe('position affects badges as weight, not gate', () => {
  const mk = () => Object.fromEntries(BADGES.map(b => [b.id, { progress: 0 }])) as Record<string, BadgeState>
  const bigGame: BoxScore = { min: 30, pts: 20, reb: 10, ast: 3, stl: 1, blk: 3, tov: 1, fgm: 8, fga: 12, tpm: 0, tpa: 0, ftm: 4, fta: 6, plusMinus: 8 }
  it('PG still progresses Post Lockdown, slower than a C', () => {
    const pg = mk(); const c = mk()
    applyBadgeProgress(pg, bigGame, ctx, 'PG', 184, 'g')
    applyBadgeProgress(c, bigGame, ctx, 'C', 217, 'g')
    expect(pg['post-lockdown'].progress).toBeGreaterThan(0)
    expect(c['post-lockdown'].progress).toBeGreaterThan(pg['post-lockdown'].progress * 2)
  })
  it('C still progresses Ankle Assassin, slower than a PG', () => {
    const pg = mk(); const c = mk()
    applyBadgeProgress(pg, { ...bigGame, ast: 7 }, ctx, 'PG', 184, 'g')
    applyBadgeProgress(c, { ...bigGame, ast: 7 }, ctx, 'C', 217, 'g')
    expect(c['ankle-assassin'].progress).toBeGreaterThan(0)
    expect(pg['ankle-assassin'].progress).toBeGreaterThan(c['ankle-assassin'].progress)
  })
})
```

`src/engine/playStyles.test.ts` — remove `styleBadgeMult` from the import and delete the three `styleBadgeMult` assertions (lines 38–40).

`src/engine/styleIntegration.test.ts` — update the badge test:

```ts
describe('style affinity in applyBadgeProgress', () => {
  it('focus badge progresses faster, unrelated badge unchanged', () => {
    const mk = () => Object.fromEntries(BADGES.map(b => [b.id, { progress: 0 }])) as Record<string, BadgeState>
    const base = mk(); const sniper = mk()
    applyBadgeProgress(base, box, ctx, 'SG', 196, 'g1', 'balanced')
    applyBadgeProgress(sniper, box, ctx, 'SG', 196, 'g1', 'sniper')
    expect(sniper['deadeye'].progress).toBeGreaterThan(base['deadeye'].progress)
    expect(sniper['dimer'].progress).toBeCloseTo(base['dimer'].progress, 5)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/engine/badges.test.ts src/engine/playStyles.test.ts src/engine/styleIntegration.test.ts`
Expected: FAIL (type errors on extra arg / missing export)

- [ ] **Step 3: Rewrite `badges.ts`**

Replace the imports, helpers, `BADGES` list and `applyBadgeProgress`:

```ts
import type { BoxScore, GameContext, Position, BadgeState, Instruction } from './types'
import { badgeWeight, type BadgeGroup } from './affinity'

export const TIER_NAMES = ['—', 'Bronze', 'Prata', 'Ouro', 'HOF', 'Lenda']
export const TIER_THRESHOLDS = [10, 30, 80, 200, 400]

export interface BadgeDef {
  id: string; name: string
  group: BadgeGroup
  units: (box: BoxScore, ctx: GameContext) => number
}

// helpers
const played = (b: BoxScore, mins = 15) => b.min >= mins
const twoPm = (b: BoxScore) => b.fgm - b.tpm
const tpPct = (b: BoxScore) => (b.tpa > 0 ? b.tpm / b.tpa : 0)
// proxy: presença em quadra — progresso lento; posição/altura agora entram como peso (affinity.ts)
const proxy = (cond: boolean) => (cond ? 0.5 : 0)
// trickle: piso universal (0.05/jogo ≈ 200 jogos para Bronze com peso 1)
const trickle = (cond: boolean) => (cond ? 0.05 : 0)

export const BADGES: BadgeDef[] = [
  // ---- Inside (11)
  { id: 'aerial-wizard', name: 'Aerial Wizard', group: 'inside', units: b => (twoPm(b) >= 5 ? 1 : 0) + trickle(played(b)) },
  { id: 'float-game', name: 'Float Game', group: 'inside', units: b => proxy(played(b)) + (twoPm(b) >= 4 ? 0.5 : 0) },
  { id: 'hook-specialist', name: 'Hook Specialist', group: 'inside', units: b => proxy(played(b)) + (twoPm(b) >= 5 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'layup-mixmaster', name: 'Layup Mixmaster', group: 'inside', units: b => (twoPm(b) >= 6 ? 1 : 0) + proxy(played(b)) },
  { id: 'paint-prodigy', name: 'Paint Prodigy', group: 'inside', units: b => (twoPm(b) >= 5 ? 1 : 0) + proxy(played(b)) + trickle(played(b)) },
  { id: 'physical-finisher', name: 'Physical Finisher', group: 'inside', units: b => (b.fta >= 6 ? 1 : 0) + (twoPm(b) >= 5 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'post-fade-phenom', name: 'Post Fade Phenom', group: 'inside', units: b => proxy(played(b)) + (b.pts >= 20 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'post-powerhouse', name: 'Post Powerhouse', group: 'inside', units: b => proxy(played(b)) + (twoPm(b) >= 6 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'post-up-poet', name: 'Post-Up Poet', group: 'inside', units: b => proxy(played(b)) + (b.ast >= 3 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'posterizer', name: 'Posterizer', group: 'inside', units: b => (twoPm(b) >= 7 ? 1 : 0) + proxy(played(b, 20)) },
  { id: 'rise-up', name: 'Rise Up', group: 'inside', units: b => (twoPm(b) >= 5 ? 1 : 0) + proxy(played(b)) + trickle(played(b)) },
  // ---- Outside (5)
  { id: 'deadeye', name: 'Deadeye', group: 'outside', units: b => (b.tpa >= 4 && tpPct(b) >= 0.4 ? b.tpm : 0) },
  { id: 'limitless-range', name: 'Limitless Range', group: 'outside', units: b => (b.tpm >= 4 ? b.tpm - 3 : 0) },
  { id: 'mini-marksman', name: 'Mini Marksman', group: 'outside', units: b => (b.tpm >= 3 ? 1 : 0) + proxy(played(b)) + trickle(played(b)) },
  { id: 'set-shot-specialist', name: 'Set Shot Specialist', group: 'outside', units: b => (b.tpa >= 5 && tpPct(b) >= 0.35 ? 1 : 0) + proxy(played(b)) },
  { id: 'shifty-shooter', name: 'Shifty Shooter', group: 'outside', units: b => (b.tpm >= 4 ? 1 : 0) + proxy(played(b)) + trickle(played(b)) },
  // ---- Playmaking (9)
  { id: 'ankle-assassin', name: 'Ankle Assassin', group: 'playmaking', units: b => proxy(played(b)) + (b.ast >= 6 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'bail-out', name: 'Bail Out', group: 'playmaking', units: b => (b.ast >= 5 && b.tov <= 2 ? 1 : 0) + proxy(played(b)) },
  { id: 'break-starter', name: 'Break Starter', group: 'playmaking', units: b => (b.reb >= 6 && b.ast >= 4 ? 1 : 0) + proxy(played(b)) },
  { id: 'dimer', name: 'Dimer', group: 'playmaking', units: b => (b.ast >= 8 && (b.tov === 0 || b.ast / b.tov >= 2.5) ? 2 : b.ast >= 6 ? 1 : 0) },
  { id: 'handles-for-days', name: 'Handles for Days', group: 'playmaking', units: b => proxy(played(b, 25)) + (b.ast >= 5 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'lightning-launch', name: 'Lightning Launch', group: 'playmaking', units: b => proxy(played(b)) + (twoPm(b) >= 4 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'strong-handle', name: 'Strong Handle', group: 'playmaking', units: b => (b.tov <= 1 && b.min >= 25 ? 1 : 0) + proxy(played(b)) },
  { id: 'unpluckable', name: 'Unpluckable', group: 'playmaking', units: b => (b.tov === 0 && b.min >= 20 ? 2 : b.tov <= 2 && b.min >= 25 ? 1 : 0) },
  { id: 'versatile-visionary', name: 'Versatile Visionary', group: 'playmaking', units: b => (b.ast >= 7 ? 1 : 0) + proxy(played(b)) },
  // ---- Defense (10)
  { id: 'challenger', name: 'Challenger', group: 'defense', units: (b, c) => (c.win && b.plusMinus >= 5 ? 1 : 0) + proxy(played(b)) },
  { id: 'glove', name: 'Glove', group: 'defense', units: b => b.stl },
  { id: 'high-flying-denier', name: 'High-Flying Denier', group: 'defense', units: b => b.blk },
  { id: 'immovable-enforcer', name: 'Immovable Enforcer', group: 'defense', units: b => proxy(played(b)) + (b.blk >= 1 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'interceptor', name: 'Interceptor', group: 'defense', units: b => (b.stl >= 2 ? b.stl : 0) + proxy(played(b)) },
  { id: 'off-ball-pest', name: 'Off-Ball Pest', group: 'defense', units: b => proxy(played(b, 20)) + (b.stl >= 1 ? 0.5 : 0) },
  { id: 'on-ball-menace', name: 'On-Ball Menace', group: 'defense', units: b => proxy(played(b, 20)) + (b.stl >= 2 ? 1 : 0) + trickle(played(b)) },
  { id: 'paint-patroller', name: 'Paint Patroller', group: 'defense', units: b => b.blk * 0.75 + proxy(played(b)) + trickle(played(b)) },
  { id: 'pick-dodger', name: 'Pick Dodger', group: 'defense', units: b => proxy(played(b, 20)) + (b.plusMinus >= 8 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'post-lockdown', name: 'Post Lockdown', group: 'defense', units: b => proxy(played(b)) + (b.blk >= 2 ? 1 : 0) + trickle(played(b)) },
  // ---- Rebounding (2)
  { id: 'boxout-beast', name: 'Boxout Beast', group: 'rebounding', units: b => (b.reb >= 8 ? 1.5 : b.reb >= 5 ? 0.5 : 0) },
  { id: 'rebound-chaser', name: 'Rebound Chaser', group: 'rebounding', units: b => (b.reb >= 10 ? 2 : b.reb >= 7 ? 1 : 0) },
  // ---- General offense + all-around (3)
  { id: 'brick-wall', name: 'Brick Wall', group: 'general', units: b => proxy(played(b, 20)) + (b.plusMinus >= 5 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'slippery-off-ball', name: 'Slippery Off-Ball', group: 'general', units: b => proxy(played(b, 20)) + (b.tpm >= 3 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'pogo-stick', name: 'Pogo Stick', group: 'general', units: b => ((b.blk + b.reb >= 8) ? 1 : 0) + proxy(played(b, 20)) },
]

export function tierOf(progress: number): number { /* unchanged */ }
export function progressForTier(tier: number): number { /* unchanged */ }

export function applyBadgeProgress(
  badges: Record<string, BadgeState>, box: BoxScore, ctx: GameContext,
  position: Position, heightCm: number, gameId: string, styleId: string = 'balanced',
): Instruction[] {
  const instructions: Instruction[] = []
  let n = 0 // local counter, resets per call -> deterministic ids across replays
  for (const def of BADGES) {
    const state = badges[def.id]
    if (!state) continue
    const before = tierOf(state.progress)
    state.progress += def.units(box, ctx) * badgeWeight(def.id, def.group, styleId, position, heightCm)
    const after = tierOf(state.progress)
    if (after > before) {
      instructions.push({
        id: `badge-${gameId}-${n++}`, type: 'badge',
        text: `Suba ${def.name} para ${TIER_NAMES[after]} no 2K`,
        badge: def.id, tier: after,
      })
    }
  }
  return instructions
}
```

(`paint-patroller` was `big ? blk : blk*0.5`; midpoint `0.75` since position now enters via weight.)

Remove `styleBadgeMult` from `playStyles.ts`.

Update `recalc.ts:29`:

```ts
const badgeInstr = applyBadgeProgress(career.badges, game.box, game.context, career.player.position, career.player.heightCm, game.id, styleId)
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine/`
Expected: PASS for badges, playStyles, styleIntegration, recalc, challenges. (`challenges.ts` — check it doesn't call `applyBadgeProgress`; `grep -n applyBadgeProgress src` should only list `recalc.ts`, `badges.ts`, tests.)

- [ ] **Step 5: Commit**

```bash
git add src/engine/badges.ts src/engine/playStyles.ts src/engine/recalc.ts src/engine/badges.test.ts src/engine/playStyles.test.ts src/engine/styleIntegration.test.ts
git commit -m "feat: badges progridem por peso de afinidade em vez de gate de posição"
```

---

### Task 4: `progression.ts` — distribuição ponderada, remove `pickTarget`

**Files:**
- Modify: `src/engine/progression.ts`
- Test: `src/engine/progression.test.ts`

**Interfaces:**
- Consumes: `attrWeight(attrId, styleId, pos, cm)` from Task 1.
- Produces: `applyGameXp(career, box, ctx, age, goalBonus, gameId, styleId?)` — same signature; `pickTarget` **removed** from exports.

- [ ] **Step 1: Update tests**

In `src/engine/progression.test.ts`:
- Remove `pickTarget` from import; delete the `describe('pickTarget')` block.
- In the two tests that used `const target = pickTarget(career, 'three')`, replace with `const target = 'threePoint'` (three has one attribute → gets 100% share).
- Append:

```ts
describe('weighted distribution within a category', () => {
  it('splits category XP across all attributes proportionally to affinity weight', () => {
    const career = makeCareer() // SG 196, balanced
    const r = applyGameXp(career, goodGame, ctxLoss, 22, {}, 'test', 'balanced')
    const ids = ['passAccuracy', 'ballHandle', 'speedWithBall', 'passIQ', 'passVision']
    const gained = ids.map(id => career.attributes[id].xp + (career.attributes[id].value - 70) * upgradeCost(70, DEFAULT_CONFIG))
    const sum = gained.reduce((s, v) => s + v, 0)
    expect(sum).toBeCloseTo(r.xpByCategory.playmaking, 3)
    // SG balanced 196: playmaking is normal for SG, height mid → all weights 1 → equal shares
    for (const g of gained) expect(g).toBeCloseTo(sum / 5, 3)
  })
  it('buffed attribute gets a bigger share than contra attribute', () => {
    const career = makeCareer()
    career.player = { ...career.player, position: 'PG', heightCm: 184 }
    applyGameXp(career, goodGame, ctxLoss, 22, {}, 'test', 'slasher')
    // inside: slasher buffs inside (layup) but overrides post attrs to contra; PG short → post also contra
    expect(career.attributes['layup'].xp).toBeGreaterThan(career.attributes['postHook'].xp * 2)
  })
  it('attributes at 99 receive nothing', () => {
    const career = makeCareer()
    career.attributes['passIQ'].value = 99
    applyGameXp(career, goodGame, ctxLoss, 22, {}, 'test')
    expect(career.attributes['passIQ'].xp).toBe(0)
    expect(career.attributes['passIQ'].value).toBe(99)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/engine/progression.test.ts`
Expected: FAIL (`pickTarget` still exported → old tests deleted, new distribution tests fail: only one attribute got XP)

- [ ] **Step 3: Rewrite `applyGameXp`**

```ts
import type { BoxScore, Career, Category, EngineConfig, GameContext, Instruction } from './types'
import { attributesByCategory, ATTRIBUTES } from './attributes'
import { categoryXp } from './categoryXp'
import { qualityMultiplier, ageMultiplier, contextMultiplier } from './multipliers'
import { styleCategoryMult } from './playStyles'
import { attrWeight } from './affinity'

export function upgradeCost(value: number, cfg: EngineConfig): number {
  return Math.round(cfg.baseCost * Math.pow(cfg.costGrowth, value - 70))
}

export interface GameXpResult {
  xpByCategory: Record<Category, number>
  instructions: Instruction[]
}

export function applyGameXp(
  career: Career, box: BoxScore, ctx: GameContext, age: number,
  goalBonus: Partial<Record<Category, number>>, gameId: string,
  styleId: string = 'balanced',
): GameXpResult {
  const cfg = career.config
  const { position, heightCm } = career.player
  const mult = qualityMultiplier(box) * ageMultiplier(age, cfg) * contextMultiplier(ctx, cfg)
  const raw = categoryXp(box, position)
  const xpByCategory = {} as Record<Category, number>
  const instructions: Instruction[] = []
  let n = 0 // local counter, resets per call -> deterministic ids across replays

  for (const cat of Object.keys(raw) as Category[]) {
    const gameXp = raw[cat] * mult * styleCategoryMult(styleId, cat)
    const bonus = Math.min(goalBonus[cat] ?? 0, gameXp * cfg.goalBonusCap)
    const total = gameXp + bonus
    xpByCategory[cat] = total
    if (total <= 0) continue

    // divisão ponderada por afinidade entre os atributos <99 da categoria (peso só altera a fatia)
    const defs = attributesByCategory(cat).filter(d => career.attributes[d.id].value < 99)
    if (defs.length === 0) continue
    const weights = defs.map(d => attrWeight(d.id, styleId, position, heightCm))
    const wsum = weights.reduce((s, w) => s + w, 0)

    defs.forEach((d, i) => {
      const attr = career.attributes[d.id]
      attr.xp += total * weights[i] / wsum
      // loop resolve múltiplos +1 num jogo grande
      while (attr.value < 99 && attr.xp >= upgradeCost(attr.value, cfg)) {
        attr.xp -= upgradeCost(attr.value, cfg)
        attr.value += 1
        instructions.push({
          id: `instr-${gameId}-${n++}`, type: 'attribute',
          text: `+1 ${d.label} (${attr.value - 1} → ${attr.value})`,
          attribute: d.id, delta: 1,
        })
      }
      if (attr.value >= 99) attr.xp = 0
    })
  }
  return { xpByCategory, instructions }
}
```

`ATTRIBUTES` import becomes unused → remove it.

- [ ] **Step 4: Run full engine suite**

Run: `npx vitest run src/engine/`
Expected: PASS. Watch `styleBalance.test.ts` and `calibration.test.ts` — they must pass **without edits** (category totals unchanged). If `styleIntegration` "sum" test fails, its `sum()` uses `(value-70)*100` which is only exact for the first +1; it asserts `not.toBe` so it should still hold.

- [ ] **Step 5: Run whole suite + typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: PASS, no type errors. (`derive.ts` is category-level; untouched.)

- [ ] **Step 6: Commit**

```bash
git add src/engine/progression.ts src/engine/progression.test.ts
git commit -m "feat: XP de categoria distribuído por peso de afinidade entre atributos"
```

---

### Task 5: Replay de save real

**Files:**
- Create: `src/engine/fixtures/pg-save.json` (trimmed copy of a real save: `player`, `initialAttributes`, `initialBadges`, `config`, `targetOverrides`, `activeChallenges: []`, `seasons` with ~10 played games)
- Test: `src/engine/recalc.test.ts` (append)

**Interfaces:** consumes `recalcCareer(career)` from `recalc.ts`.

- [ ] **Step 1: Build the fixture**

Take `player`, `initialAttributes`, `initialBadges` from the user's uploaded save (PG, 196 cm, Bulls) and the first 10 games of season 2027 (all have `min > 0`). Set `attributes: {}`, `badges: {}`, `pendingInstructions: []`, `activeChallenges: []`, `config: DEFAULT_CONFIG` values, `targetOverrides: {}`, `seasons[0].playStyle: 'maestro'`. Save as `src/engine/fixtures/pg-save.json`.

- [ ] **Step 2: Write test**

```ts
import fixture from './fixtures/pg-save.json'
import type { Career } from './types'
import { ATTRIBUTES } from './attributes'
import { BADGES } from './badges'

describe('replay of a real PG save under affinity rules', () => {
  it('recalculates without throwing, all attributes >= initial, post badges > 0', () => {
    const career = structuredClone(fixture) as unknown as Career
    recalcCareer(career)
    for (const a of ATTRIBUTES) {
      expect(career.attributes[a.id].value).toBeGreaterThanOrEqual(career.initialAttributes[a.id])
    }
    for (const b of BADGES) expect(career.badges[b.id].progress).toBeGreaterThan(0)
    // vários atributos da mesma categoria devem ter andado (não só o mais fraco)
    const moved = ['passAccuracy', 'ballHandle', 'speedWithBall', 'passVision']
      .filter(id => career.attributes[id].xp > 0 || career.attributes[id].value > career.initialAttributes[id])
    expect(moved.length).toBeGreaterThanOrEqual(3)
  })
})
```

`tsconfig` must allow JSON imports: check `resolveJsonModule` in `tsconfig.app.json`; add `"resolveJsonModule": true` if missing.

- [ ] **Step 3: Run**

Run: `npx vitest run src/engine/recalc.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/engine/fixtures/pg-save.json src/engine/recalc.test.ts tsconfig.app.json
git commit -m "test: replay de save real de PG sob regras de afinidade"
```

---

### Task 6: UI — chip `×w` em atributos e badges

**Files:**
- Modify: `src/ui/Dashboard.tsx` (`AttrRow` at lines 24–35, attribute list ~line 205, badge card ~line 240)

**Interfaces:** consumes `attrWeight`, `badgeWeight` from `affinity.ts`.

- [ ] **Step 1: Add a `WeightChip` component and wire it**

Add near `AttrRow`:

```tsx
import { attrWeight, badgeWeight } from '../engine/affinity'

function WeightChip({ w }: { w: number }) {
  if (Math.abs(w - 1) < 0.001) return null
  const cls = w >= 1.5 ? 'text-orange-400' : w > 1 ? 'text-orange-700' : w <= 0.5 ? 'text-red-800' : 'text-stone-500'
  return <span className={`font-display text-[10px] tracking-[.06em] ${cls}`}>×{w.toFixed(w >= 1 ? 1 : 2)}</span>
}
```

`AttrRow` gets a `weight: number` prop; render `<WeightChip w={weight} />` after the value span:

```tsx
function AttrRow({ label, value, xp, cost, weight }: { label: string; value: number; xp: number; cost: number; weight: number }) {
  const pct = Math.min(100, Math.round((xp / cost) * 100))
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-40 truncate">{label}</span>
      <span className="stat w-8 text-right">{value}</span>
      <span className="w-9"><WeightChip w={weight} /></span>
      <div className="h-1.5 flex-1 bg-[#171412]">
        <div className="h-1.5 bg-gradient-to-r from-orange-700 to-orange-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
```

Caller (inside `attributesByCategory(cat).map`):

```tsx
<AttrRow key={a.id} label={a.label} value={state.value} xp={state.xp}
  cost={upgradeCost(state.value, career.config)}
  weight={attrWeight(a.id, season.playStyle, player.position, player.heightCm)} />
```

Badge card header — after the tier label span, inside the same flex row:

```tsx
<div className="flex items-center gap-1.5">
  <WeightChip w={badgeWeight(b.id, b.group, season.playStyle, player.position, player.heightCm)} />
  <span className={`font-display text-[10px] tracking-[.12em] uppercase ${ts.label}`}>
    {tier === 0 ? 'Sem tier' : TIER_NAMES[tier]}
  </span>
</div>
```

Update the legend text under the category bars: `Laranja = foco do estilo {style.name} · ×w = afinidade (estilo·posição·altura)`.

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc -b && npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: Visual check**

Run: `npm run dev`, open Painel → "Abrir lista". Expect chips on non-neutral rows (e.g. PG: Ball Handle `×1.4`, Post Hook `×0.25`); badge cards show chip left of tier.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Dashboard.tsx
git commit -m "feat: chip de peso de afinidade em atributos e badges"
```

---

## Self-review

- **Spec coverage:** afinidade module (T1–T2), distribuição (T4), badges sem gate + peso (T3), recalc passa altura (T3), UI chip (T6), compat de save/replay (T5), `targetOverrides` ignorado (T4 remove `pickTarget`, campo fica no tipo). `styleBalance` intocado (T4 step 4 verifica).
- **Placeholders:** nenhum; tabelas completas; `tierOf`/`progressForTier` marcados "unchanged" porque já existem no arquivo — executor mantém o corpo atual.
- **Type consistency:** `badgeWeight(badgeId, group, styleId, pos, cm)` usado igual em T2 impl, T3 badges.ts, T6 UI. `applyBadgeProgress(badges, box, ctx, position, heightCm, gameId, styleId?)` igual em T3 impl/tests/recalc. `attrWeight(attrId, styleId, pos, cm)` igual em T1/T4/T6.
- **Nota T1 step 5:** spec usa "PG 1.85" como exemplo de baixo; com `<185` a faixa short começa em 184. Testes usam 184. Se preferir 185 short, mude `HEIGHT_BANDS.PG.short` para 186 — decisão de calibração, não de código.
