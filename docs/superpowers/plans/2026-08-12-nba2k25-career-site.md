# NBA 2K25 MyLeague Career Companion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site estático (Cloudflare Pages) que gerencia a carreira de 1 jogador criado no NBA 2K25 MyLeague: usuário digita box scores, motor de XP realista devolve instruções concretas de upgrade de atributos e badges.

**Architecture:** SPA React com motor de progressão puro (funções TS sem estado, 100% testável via Vitest) separado da UI. Estado inteiro num objeto `Career` em localStorage; edição/exclusão de jogo → recálculo total determinístico a partir do snapshot inicial.

**Tech Stack:** Vite + React 18 + TypeScript + Tailwind CSS v4 + react-router-dom + Vitest. Deploy: `wrangler pages deploy`.

## Global Constraints

- UI em português (pt-BR). Código/identificadores em inglês.
- Dados só em localStorage, chave `nba2k25-career`. Export/import JSON.
- Curva de idade (multiplicador XP): ≤21 → 1.3 | 22-33 → 1.0 | 34-36 → 0.5 | 37+ → 0.3. Regressão física a partir dos 34.
- Contexto: playoffs ×1.5 | fora de casa ×1.15 | vitória ×1.1. Bônus de metas ≤ 30% do XP do jogo.
- Calibração alvo: rookie sólido, 82 jogos → +4 a 6 OVR na temporada.
- Badges: exatamente as 40 do NBA 2K25, tiers Bronze/Prata/Ouro/HOF/Lenda.
- Motor (`src/engine/**`) não importa React nem toca localStorage — funções puras.
- Todo teste roda com `npx vitest run` (prefixar `rtk` no shell do usuário).
- Commits frequentes, mensagens convencionais (`feat:`, `test:`, `chore:`...).

---

### Task 1: Scaffold do projeto

**Files:**
- Create: projeto Vite na raiz `f:\_geral\Projetos\my_career_exp` (package.json, vite.config.ts, tsconfig, index.html, src/)
- Create: `src/index.css`, `src/main.tsx`, `src/App.tsx`

**Interfaces:**
- Produces: projeto compilável com `npm run build`, testes com `npx vitest run`, Tailwind v4 ativo, react-router instalado.

- [ ] **Step 1: Scaffold Vite + deps**

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install react-router-dom
npm install -D vitest @tailwindcss/vite tailwindcss
```

- [ ] **Step 2: Configurar Tailwind v4 + Vitest**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

`src/index.css` (substituir conteúdo):
```css
@import "tailwindcss";
```

`package.json` — adicionar script: `"test": "vitest run"`.

- [ ] **Step 3: App mínimo**

`src/App.tsx`:
```tsx
export default function App() {
  return <h1 className="text-2xl font-bold p-4">NBA 2K25 Career</h1>
}
```

- [ ] **Step 4: Verificar build e dev**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 5: .gitignore + commit**

Garantir `node_modules/` e `dist/` no `.gitignore` (o template do Vite já cria).

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind v4 + Vitest"
```

---

### Task 2: Tipos e catálogo de atributos

**Files:**
- Create: `src/engine/types.ts`
- Create: `src/engine/attributes.ts`
- Test: `src/engine/attributes.test.ts`

**Interfaces:**
- Produces (types.ts):
```ts
export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C'
export type Category =
  | 'inside' | 'mid' | 'three' | 'ft'
  | 'playmaking' | 'rebounding' | 'defense' | 'physical'
export interface BoxScore {
  min: number; pts: number; reb: number; ast: number; stl: number
  blk: number; tov: number; fgm: number; fga: number; tpm: number
  tpa: number; ftm: number; fta: number; plusMinus: number
}
export interface GameContext {
  opponent: string; home: boolean; playoffs: boolean; win: boolean; date: string
}
export type GoalKind = 'pts' | 'reb' | 'ast' | 'stocks' | 'fgPct' | 'tpPct' | 'awayWin'
export interface Goal { id: string; category: Category; kind: GoalKind; target: number; description: string }
export interface Game {
  id: string; context: GameContext; box: BoxScore | null
  goals: Goal[]; goalsMet: string[]
}
export interface Season { year: number; games: Game[] }
export interface AttributeState { value: number; xp: number }
export interface BadgeState { progress: number }
export interface Challenge {
  badgeId: string; stat: 'pts' | 'ast' | 'tpm' | 'reb' | 'stl' | 'blk'
  perGame: number; streakLen: number; currentStreak: number; description: string
}
export type InstructionType = 'attribute' | 'badge'
export interface Instruction {
  id: string; type: InstructionType; text: string
  attribute?: string; delta?: number; badge?: string; tier?: number
}
export interface EngineConfig {
  baseCost: number; costGrowth: number
  ageMults: { u21: number; prime: number; decline: number; late: number }
  playoffsMult: number; awayMult: number; winMult: number; goalBonusCap: number
}
export interface Player {
  name: string; position: Position; heightCm: number; team: string; startAge: number
}
export interface Career {
  player: Player
  initialAttributes: Record<string, number>
  initialBadges: Record<string, number>
  attributes: Record<string, AttributeState>
  badges: Record<string, BadgeState>
  activeChallenges: Challenge[]
  seasons: Season[]
  pendingInstructions: Instruction[]
  config: EngineConfig
  targetOverrides: Partial<Record<Category, string>>
}
export const DEFAULT_CONFIG: EngineConfig = {
  baseCost: 100, costGrowth: 1.12,
  ageMults: { u21: 1.3, prime: 1.0, decline: 0.5, late: 0.3 },
  playoffsMult: 1.5, awayMult: 1.15, winMult: 1.1, goalBonusCap: 0.3,
}
```
- Produces (attributes.ts):
```ts
export interface AttributeDef { id: string; label: string; category: Category }
export const ATTRIBUTES: AttributeDef[]           // 35 atributos do 2K25
export const attributesByCategory: (cat: Category) => AttributeDef[]
export const PHYSICAL_REGRESSION_ORDER: string[]  // ordem de regressão 34+
export const estimateOverall: (values: Record<string, number>, position: Position) => number
```

- [ ] **Step 1: Escrever teste**

`src/engine/attributes.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/engine/attributes.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar types.ts e attributes.ts**

`src/engine/types.ts`: exatamente o bloco de Interfaces acima.

`src/engine/attributes.ts`:
```ts
import type { Category, Position } from './types'

export interface AttributeDef { id: string; label: string; category: Category }

export const ATTRIBUTES: AttributeDef[] = [
  // Finishing / inside
  { id: 'closeShot', label: 'Close Shot', category: 'inside' },
  { id: 'layup', label: 'Layup', category: 'inside' },
  { id: 'standingDunk', label: 'Standing Dunk', category: 'inside' },
  { id: 'drivingDunk', label: 'Driving Dunk', category: 'inside' },
  { id: 'postHook', label: 'Post Hook', category: 'inside' },
  { id: 'postFade', label: 'Post Fade', category: 'inside' },
  { id: 'postControl', label: 'Post Control', category: 'inside' },
  { id: 'drawFoul', label: 'Draw Foul', category: 'inside' },
  // Shooting
  { id: 'midRange', label: 'Mid-Range Shot', category: 'mid' },
  { id: 'shotIQ', label: 'Shot IQ', category: 'mid' },
  { id: 'offConsistency', label: 'Offensive Consistency', category: 'mid' },
  { id: 'threePoint', label: 'Three-Point Shot', category: 'three' },
  { id: 'freeThrow', label: 'Free Throw', category: 'ft' },
  // Playmaking
  { id: 'passAccuracy', label: 'Pass Accuracy', category: 'playmaking' },
  { id: 'ballHandle', label: 'Ball Handle', category: 'playmaking' },
  { id: 'speedWithBall', label: 'Speed with Ball', category: 'playmaking' },
  { id: 'passIQ', label: 'Pass IQ', category: 'playmaking' },
  { id: 'passVision', label: 'Pass Vision', category: 'playmaking' },
  // Defense
  { id: 'interiorD', label: 'Interior Defense', category: 'defense' },
  { id: 'perimeterD', label: 'Perimeter Defense', category: 'defense' },
  { id: 'steal', label: 'Steal', category: 'defense' },
  { id: 'block', label: 'Block', category: 'defense' },
  { id: 'helpDefenseIQ', label: 'Help Defense IQ', category: 'defense' },
  { id: 'passPerception', label: 'Pass Perception', category: 'defense' },
  { id: 'defConsistency', label: 'Defensive Consistency', category: 'defense' },
  // Rebounding
  { id: 'offRebound', label: 'Offensive Rebound', category: 'rebounding' },
  { id: 'defRebound', label: 'Defensive Rebound', category: 'rebounding' },
  // Physical
  { id: 'speed', label: 'Speed', category: 'physical' },
  { id: 'agility', label: 'Agility', category: 'physical' },
  { id: 'strength', label: 'Strength', category: 'physical' },
  { id: 'vertical', label: 'Vertical', category: 'physical' },
  { id: 'stamina', label: 'Stamina', category: 'physical' },
  { id: 'hustle', label: 'Hustle', category: 'physical' },
  { id: 'durability', label: 'Overall Durability', category: 'physical' },
  { id: 'intangibles', label: 'Intangibles', category: 'physical' },
]

export function attributesByCategory(cat: Category): AttributeDef[] {
  return ATTRIBUTES.filter(a => a.category === cat)
}

export const PHYSICAL_REGRESSION_ORDER = ['speed', 'agility', 'vertical', 'stamina', 'strength']

// ponytail: média ponderada simples por posição, não a fórmula real de OVR do 2K
const POSITION_WEIGHTS: Record<Position, Partial<Record<Category, number>>> = {
  PG: { playmaking: 2, three: 1.5, mid: 1.2, defense: 1, physical: 1, inside: 0.8, ft: 0.8, rebounding: 0.5 },
  SG: { three: 2, mid: 1.5, playmaking: 1.2, defense: 1, physical: 1, inside: 0.9, ft: 0.8, rebounding: 0.5 },
  SF: { mid: 1.5, three: 1.3, inside: 1.2, defense: 1.2, physical: 1, playmaking: 0.9, ft: 0.8, rebounding: 0.8 },
  PF: { inside: 1.8, rebounding: 1.5, defense: 1.3, physical: 1.1, mid: 0.9, three: 0.7, playmaking: 0.6, ft: 0.7 },
  C:  { inside: 2, rebounding: 1.8, defense: 1.5, physical: 1.1, mid: 0.7, three: 0.5, playmaking: 0.5, ft: 0.6 },
}

export function estimateOverall(values: Record<string, number>, position: Position): number {
  const weights = POSITION_WEIGHTS[position]
  let sum = 0, wsum = 0
  for (const a of ATTRIBUTES) {
    const w = weights[a.category] ?? 1
    sum += (values[a.id] ?? 0) * w
    wsum += w
  }
  return Math.round(sum / wsum)
}
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run src/engine/attributes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine
git commit -m "feat: engine types and 2K25 attribute catalog"
```

---

### Task 3: Validação do box score

**Files:**
- Create: `src/engine/validation.ts`
- Test: `src/engine/validation.test.ts`

**Interfaces:**
- Consumes: `BoxScore` de `./types`.
- Produces: `export function validateBoxScore(box: BoxScore): string[]` — array de mensagens de erro em pt-BR; vazio = válido.

- [ ] **Step 1: Escrever teste**

`src/engine/validation.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validateBoxScore } from './validation'
import type { BoxScore } from './types'

const valid: BoxScore = {
  min: 34, pts: 25, reb: 6, ast: 7, stl: 2, blk: 1, tov: 3,
  fgm: 9, fga: 18, tpm: 3, tpa: 8, ftm: 4, fta: 5, plusMinus: 8,
}

describe('validateBoxScore', () => {
  it('accepts a valid box score', () => {
    expect(validateBoxScore(valid)).toEqual([])
  })
  it('rejects FGM > FGA', () => {
    expect(validateBoxScore({ ...valid, fgm: 19 })).not.toEqual([])
  })
  it('rejects 3PM > FGM', () => {
    expect(validateBoxScore({ ...valid, tpm: 10, tpa: 12 })).not.toEqual([])
  })
  it('rejects 3PA > FGA', () => {
    expect(validateBoxScore({ ...valid, tpa: 19 })).not.toEqual([])
  })
  it('rejects FTM > FTA', () => {
    expect(validateBoxScore({ ...valid, ftm: 6 })).not.toEqual([])
  })
  it('rejects wrong points total', () => {
    expect(validateBoxScore({ ...valid, pts: 24 })).not.toEqual([])
  })
  it('rejects negatives and minutes > 48+OT bounds', () => {
    expect(validateBoxScore({ ...valid, reb: -1 })).not.toEqual([])
    expect(validateBoxScore({ ...valid, min: 70 })).not.toEqual([])
  })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/engine/validation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/engine/validation.ts`:
```ts
import type { BoxScore } from './types'

export function validateBoxScore(box: BoxScore): string[] {
  const errors: string[] = []
  const nonNegative: (keyof BoxScore)[] = ['min','pts','reb','ast','stl','blk','tov','fgm','fga','tpm','tpa','ftm','fta']
  for (const k of nonNegative) {
    if (box[k] < 0 || !Number.isFinite(box[k])) errors.push(`${k} não pode ser negativo`)
  }
  if (box.min > 65) errors.push('Minutos acima do máximo possível (65)')
  if (box.fgm > box.fga) errors.push('FGM não pode ser maior que FGA')
  if (box.tpm > box.fgm) errors.push('3PM não pode ser maior que FGM')
  if (box.tpa > box.fga) errors.push('3PA não pode ser maior que FGA')
  if (box.tpm > box.tpa) errors.push('3PM não pode ser maior que 3PA')
  if (box.ftm > box.fta) errors.push('FTM não pode ser maior que FTA')
  const expectedPts = 2 * (box.fgm - box.tpm) + 3 * box.tpm + box.ftm
  if (box.pts !== expectedPts) errors.push(`Pontos inconsistentes: esperado ${expectedPts}`)
  return errors
}
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run src/engine/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/validation.ts src/engine/validation.test.ts
git commit -m "feat: box score validation"
```

---

### Task 4: Game Score e multiplicadores

**Files:**
- Create: `src/engine/multipliers.ts`
- Test: `src/engine/multipliers.test.ts`

**Interfaces:**
- Consumes: `BoxScore`, `GameContext`, `EngineConfig`, `DEFAULT_CONFIG`.
- Produces:
```ts
export function gameScore(box: BoxScore): number
export function qualityMultiplier(box: BoxScore): number          // clamp 0.3..1.5
export function ageMultiplier(age: number, cfg: EngineConfig): number
export function contextMultiplier(ctx: GameContext, cfg: EngineConfig): number
```

- [ ] **Step 1: Escrever teste**

`src/engine/multipliers.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { gameScore, qualityMultiplier, ageMultiplier, contextMultiplier } from './multipliers'
import { DEFAULT_CONFIG } from './types'
import type { BoxScore, GameContext } from './types'

const monster: BoxScore = { min: 38, pts: 42, reb: 10, ast: 8, stl: 3, blk: 2, tov: 2, fgm: 15, fga: 24, tpm: 6, tpa: 10, ftm: 6, fta: 7, plusMinus: 15 }
const bad: BoxScore = { min: 30, pts: 8, reb: 2, ast: 1, stl: 0, blk: 0, tov: 5, fgm: 3, fga: 15, tpm: 0, tpa: 6, ftm: 2, fta: 4, plusMinus: -12 }
const inefficient: BoxScore = { min: 38, pts: 30, reb: 4, ast: 2, stl: 0, blk: 0, tov: 4, fgm: 11, fga: 30, tpm: 2, tpa: 12, ftm: 6, fta: 8, plusMinus: -5 }

describe('gameScore', () => {
  it('monster game scores much higher than bad game', () => {
    expect(gameScore(monster)).toBeGreaterThan(gameScore(bad) + 20)
  })
})

describe('qualityMultiplier', () => {
  it('clamps between 0.3 and 1.5', () => {
    expect(qualityMultiplier(monster)).toBeLessThanOrEqual(1.5)
    expect(qualityMultiplier(bad)).toBeGreaterThanOrEqual(0.3)
  })
  it('monster game near max, bad game near min', () => {
    expect(qualityMultiplier(monster)).toBeGreaterThan(1.2)
    expect(qualityMultiplier(bad)).toBeLessThan(0.6)
  })
  it('volume without efficiency scores mediocre', () => {
    expect(qualityMultiplier(inefficient)).toBeLessThan(1.0)
  })
})

describe('ageMultiplier', () => {
  it('follows the approved age curve', () => {
    expect(ageMultiplier(19, DEFAULT_CONFIG)).toBe(1.3)
    expect(ageMultiplier(21, DEFAULT_CONFIG)).toBe(1.3)
    expect(ageMultiplier(22, DEFAULT_CONFIG)).toBe(1.0)
    expect(ageMultiplier(33, DEFAULT_CONFIG)).toBe(1.0)
    expect(ageMultiplier(34, DEFAULT_CONFIG)).toBe(0.5)
    expect(ageMultiplier(36, DEFAULT_CONFIG)).toBe(0.5)
    expect(ageMultiplier(37, DEFAULT_CONFIG)).toBe(0.3)
  })
})

describe('contextMultiplier', () => {
  const base: GameContext = { opponent: 'LAL', home: true, playoffs: false, win: false, date: '2026-01-01' }
  it('home regular loss = 1.0', () => {
    expect(contextMultiplier(base, DEFAULT_CONFIG)).toBe(1.0)
  })
  it('playoffs away win multiplies all three', () => {
    const v = contextMultiplier({ ...base, playoffs: true, home: false, win: true }, DEFAULT_CONFIG)
    expect(v).toBeCloseTo(1.5 * 1.15 * 1.1, 5)
  })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/engine/multipliers.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/engine/multipliers.ts`:
```ts
import type { BoxScore, GameContext, EngineConfig } from './types'

// Game Score estilo Hollinger adaptado ao nosso box score (sem PF/ORB separado)
export function gameScore(box: BoxScore): number {
  return (
    box.pts
    + 0.7 * box.ast
    + 0.5 * box.reb
    + box.stl
    + 0.7 * box.blk
    - box.tov
    - 0.7 * (box.fga - box.fgm)
    - 0.4 * (box.fta - box.ftm)
  )
}

export function qualityMultiplier(box: BoxScore): number {
  const per36 = gameScore(box) * 36 / Math.max(box.min, 8)
  const raw = 0.3 + per36 / 25
  return Math.min(1.5, Math.max(0.3, raw))
}

export function ageMultiplier(age: number, cfg: EngineConfig): number {
  if (age <= 21) return cfg.ageMults.u21
  if (age <= 33) return cfg.ageMults.prime
  if (age <= 36) return cfg.ageMults.decline
  return cfg.ageMults.late
}

export function contextMultiplier(ctx: GameContext, cfg: EngineConfig): number {
  let m = 1.0
  if (ctx.playoffs) m *= cfg.playoffsMult
  if (!ctx.home) m *= cfg.awayMult
  if (ctx.win) m *= cfg.winMult
  return m
}
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run src/engine/multipliers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/multipliers.ts src/engine/multipliers.test.ts
git commit -m "feat: game score and XP multipliers"
```

---

### Task 5: XP por categoria

**Files:**
- Create: `src/engine/categoryXp.ts`
- Test: `src/engine/categoryXp.test.ts`

**Interfaces:**
- Consumes: `BoxScore`, `Position`, `Category`.
- Produces:
```ts
// XP bruto por categoria (antes dos multiplicadores)
export function categoryXp(box: BoxScore, position: Position): Record<Category, number>
```

- [ ] **Step 1: Escrever teste**

`src/engine/categoryXp.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { categoryXp } from './categoryXp'
import type { BoxScore } from './types'

const base: BoxScore = { min: 32, pts: 20, reb: 5, ast: 5, stl: 1, blk: 1, tov: 2, fgm: 7, fga: 14, tpm: 2, tpa: 5, ftm: 4, fta: 5, plusMinus: 5 }

describe('categoryXp', () => {
  it('hot 3PT night gives more three XP than cold night', () => {
    const hot = categoryXp({ ...base, tpm: 6, tpa: 10, fgm: 9, pts: 30 }, 'SG')
    const cold = categoryXp({ ...base, tpm: 1, tpa: 9, fgm: 6, pts: 15 }, 'SG')
    expect(hot.three).toBeGreaterThan(cold.three * 2)
  })
  it('big assist night with good ratio boosts playmaking', () => {
    const dime = categoryXp({ ...base, ast: 12, tov: 2 }, 'PG')
    const sloppy = categoryXp({ ...base, ast: 4, tov: 6 }, 'PG')
    expect(dime.playmaking).toBeGreaterThan(sloppy.playmaking * 2)
  })
  it('center gets more inside share of 2P makes than guard', () => {
    const asC = categoryXp(base, 'C')
    const asPG = categoryXp(base, 'PG')
    expect(asC.inside).toBeGreaterThan(asPG.inside)
    expect(asPG.mid).toBeGreaterThan(asC.mid)
  })
  it('defense XP rewards stocks and positive impact', () => {
    const lockdown = categoryXp({ ...base, stl: 4, blk: 3, plusMinus: 18 }, 'SF')
    expect(lockdown.defense).toBeGreaterThan(categoryXp(base, 'SF').defense)
  })
  it('physical XP is a slow trickle from minutes', () => {
    const xp = categoryXp(base, 'PG')
    expect(xp.physical).toBeGreaterThan(0)
    expect(xp.physical).toBeLessThan(xp.three + xp.mid + xp.inside)
  })
  it('zero-minute game yields zero XP everywhere', () => {
    const dnp = categoryXp({ min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, plusMinus: 0 }, 'PG')
    for (const v of Object.values(dnp)) expect(v).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/engine/categoryXp.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/engine/categoryXp.ts`:
```ts
import type { BoxScore, Category, Position } from './types'

// fração dos 2P que conta como "inside" (resto vai pra mid)
const INSIDE_SHARE: Record<Position, number> = { PG: 0.4, SG: 0.4, SF: 0.5, PF: 0.7, C: 0.75 }

export function categoryXp(box: BoxScore, position: Position): Record<Category, number> {
  if (box.min <= 0) {
    return { inside: 0, mid: 0, three: 0, ft: 0, playmaking: 0, rebounding: 0, defense: 0, physical: 0 }
  }

  const twoPm = box.fgm - box.tpm
  const twoPa = box.fga - box.tpa
  const twoPct = twoPa > 0 ? twoPm / twoPa : 0
  const twoEff = twoPa >= 5 ? (twoPct >= 0.55 ? 1.4 : twoPct < 0.4 ? 0.6 : 1.0) : 1.0
  const twoXp = twoPm * 9 * twoEff
  const insideShare = INSIDE_SHARE[position]

  const tpPct = box.tpa > 0 ? box.tpm / box.tpa : 0
  const threeEff = box.tpa >= 4 ? (tpPct >= 0.4 ? 1.5 : tpPct < 0.25 ? 0.5 : 1.0) : 1.0

  const ftPct = box.fta > 0 ? box.ftm / box.fta : 0
  const ftEff = box.fta >= 4 ? (ftPct >= 0.8 ? 1.3 : ftPct < 0.6 ? 0.6 : 1.0) : 1.0

  const astRatio = box.tov > 0 ? box.ast / box.tov : box.ast
  const astEff = astRatio >= 2.5 ? 1.3 : astRatio < 1 ? 0.6 : 1.0

  return {
    inside: twoXp * insideShare,
    mid: twoXp * (1 - insideShare),
    three: box.tpm * 12 * threeEff,
    ft: box.ftm * 6 * ftEff,
    playmaking: box.ast * 8 * astEff,
    rebounding: box.reb * 6,
    defense: (box.stl + box.blk) * 10 + Math.max(box.plusMinus, 0) * 0.5,
    physical: box.min * 0.6,
  }
}
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run src/engine/categoryXp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/categoryXp.ts src/engine/categoryXp.test.ts
git commit -m "feat: raw category XP from box score"
```

---

### Task 6: Custo de upgrade, alvo por categoria e aplicação de XP

**Files:**
- Create: `src/engine/progression.ts`
- Test: `src/engine/progression.test.ts`

**Interfaces:**
- Consumes: `categoryXp`, multiplicadores, `attributesByCategory`, tipos.
- Produces:
```ts
export function upgradeCost(value: number, cfg: EngineConfig): number
// alvo automático: menor valor na categoria (respeita override do usuário)
export function pickTarget(career: Career, cat: Category): string
export interface GameXpResult {
  xpByCategory: Record<Category, number>
  instructions: Instruction[]          // "+1 <attr>" geradas neste jogo
}
// MUTA career.attributes (xp e value) e retorna resultado; box já validado
export function applyGameXp(
  career: Career, box: BoxScore, ctx: GameContext, age: number, goalBonus: Partial<Record<Category, number>>
): GameXpResult
```
Nota: o `value` em `career.attributes` reflete o estado que o jogador DEVE ter no 2K (instruções contam como aplicadas na contabilidade; a tela de pendências só rastreia o que falta digitar no jogo).

- [ ] **Step 1: Escrever teste**

`src/engine/progression.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { upgradeCost, pickTarget, applyGameXp } from './progression'
import { DEFAULT_CONFIG } from './types'
import type { Career, BoxScore, GameContext } from './types'
import { ATTRIBUTES } from './attributes'

function makeCareer(): Career {
  const attributes: Career['attributes'] = {}
  for (const a of ATTRIBUTES) attributes[a.id] = { value: 70, xp: 0 }
  return {
    player: { name: 'Test', position: 'SG', heightCm: 196, team: 'BOS', startAge: 20 },
    initialAttributes: {}, initialBadges: {},
    attributes, badges: {}, activeChallenges: [], seasons: [],
    pendingInstructions: [], config: DEFAULT_CONFIG, targetOverrides: {},
  }
}

const goodGame: BoxScore = { min: 36, pts: 28, reb: 5, ast: 6, stl: 2, blk: 1, tov: 2, fgm: 10, fga: 18, tpm: 4, tpa: 8, ftm: 4, fta: 5, plusMinus: 10 }
const ctx: GameContext = { opponent: 'MIA', home: true, playoffs: false, win: true, date: '2026-01-10' }

describe('upgradeCost', () => {
  it('grows exponentially with value', () => {
    const c70 = upgradeCost(70, DEFAULT_CONFIG)
    const c85 = upgradeCost(85, DEFAULT_CONFIG)
    const c95 = upgradeCost(95, DEFAULT_CONFIG)
    expect(c70).toBe(100)
    expect(c85).toBeGreaterThan(c70 * 4)
    expect(c95).toBeGreaterThan(c85 * 2)
  })
})

describe('pickTarget', () => {
  it('picks lowest-value attribute in category', () => {
    const career = makeCareer()
    career.attributes['threePoint'].value = 65
    expect(pickTarget(career, 'three')).toBe('threePoint')
  })
  it('respects user override', () => {
    const career = makeCareer()
    career.targetOverrides['playmaking'] = 'passIQ'
    expect(pickTarget(career, 'playmaking')).toBe('passIQ')
  })
})

describe('applyGameXp', () => {
  it('accumulates XP and emits +1 instruction when threshold crossed', () => {
    const career = makeCareer()
    // força quase-limiar em three
    const target = pickTarget(career, 'three')
    career.attributes[target].xp = upgradeCost(70, DEFAULT_CONFIG) - 1
    const result = applyGameXp(career, goodGame, ctx, 22, {})
    const plusOne = result.instructions.find(i => i.attribute === target && i.delta === 1)
    expect(plusOne).toBeDefined()
    expect(career.attributes[target].value).toBe(71)
  })
  it('age 37 gains far less XP than age 22', () => {
    const young = makeCareer(); const old = makeCareer()
    const ry = applyGameXp(young, goodGame, ctx, 22, {})
    const ro = applyGameXp(old, goodGame, ctx, 37, {})
    expect(ro.xpByCategory.three).toBeLessThan(ry.xpByCategory.three * 0.4)
  })
  it('goal bonus is capped at 30% of game XP', () => {
    const career = makeCareer()
    const r = applyGameXp(career, goodGame, ctx, 22, { three: 999999 })
    const noBonus = applyGameXp(makeCareer(), goodGame, ctx, 22, {})
    expect(r.xpByCategory.three).toBeLessThanOrEqual(noBonus.xpByCategory.three * 1.31)
  })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/engine/progression.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/engine/progression.ts`:
```ts
import type { BoxScore, Career, Category, EngineConfig, GameContext, Instruction } from './types'
import { attributesByCategory, ATTRIBUTES } from './attributes'
import { categoryXp } from './categoryXp'
import { qualityMultiplier, ageMultiplier, contextMultiplier } from './multipliers'

export function upgradeCost(value: number, cfg: EngineConfig): number {
  return Math.round(cfg.baseCost * Math.pow(cfg.costGrowth, value - 70))
}

export function pickTarget(career: Career, cat: Category): string {
  const override = career.targetOverrides[cat]
  const defs = attributesByCategory(cat)
  if (override && defs.some(d => d.id === override) && career.attributes[override].value < 99) return override
  const sorted = defs
    .filter(d => career.attributes[d.id].value < 99)
    .sort((a, b) => career.attributes[a.id].value - career.attributes[b.id].value)
  return sorted[0]?.id ?? defs[0].id
}

export interface GameXpResult {
  xpByCategory: Record<Category, number>
  instructions: Instruction[]
}

let instrSeq = 0
function nextInstrId(date: string): string {
  return `instr-${date}-${instrSeq++}`
}

export function applyGameXp(
  career: Career, box: BoxScore, ctx: GameContext, age: number,
  goalBonus: Partial<Record<Category, number>>,
): GameXpResult {
  const cfg = career.config
  const mult = qualityMultiplier(box) * ageMultiplier(age, cfg) * contextMultiplier(ctx, cfg)
  const raw = categoryXp(box, career.player.position)
  const xpByCategory = {} as Record<Category, number>
  const instructions: Instruction[] = []

  for (const cat of Object.keys(raw) as Category[]) {
    const gameXp = raw[cat] * mult
    const bonus = Math.min(goalBonus[cat] ?? 0, gameXp * cfg.goalBonusCap)
    const total = gameXp + bonus
    xpByCategory[cat] = total
    if (total <= 0) continue

    let remaining = total
    // aplica no alvo atual; se cruzar limiar, sobe e re-alveja
    while (remaining > 0) {
      const targetId = pickTarget(career, cat)
      const attr = career.attributes[targetId]
      if (attr.value >= 99) break
      attr.xp += remaining
      remaining = 0
      const cost = upgradeCost(attr.value, cfg)
      if (attr.xp >= cost) {
        attr.xp -= cost
        attr.value += 1
        const label = ATTRIBUTES.find(a => a.id === targetId)?.label ?? targetId
        instructions.push({
          id: nextInstrId(ctx.date), type: 'attribute',
          text: `+1 ${label} (${attr.value - 1} → ${attr.value})`,
          attribute: targetId, delta: 1,
        })
        // excesso continua no mesmo atributo (novo custo maior); loop resolve múltiplos +1
        remaining = 0
        if (attr.xp >= upgradeCost(attr.value, cfg)) {
          remaining = attr.xp
          attr.xp = 0
        }
      }
    }
  }
  return { xpByCategory, instructions }
}
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run src/engine/progression.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/progression.ts src/engine/progression.test.ts
git commit -m "feat: upgrade cost curve, target picking and XP application"
```

---

### Task 7: Catálogo de badges e progresso passivo

**Files:**
- Create: `src/engine/badges.ts`
- Test: `src/engine/badges.test.ts`

**Interfaces:**
- Consumes: `BoxScore`, `GameContext`, `Position`, `BadgeState`, `Instruction`.
- Produces:
```ts
export const TIER_NAMES: string[]        // ['—','Bronze','Prata','Ouro','HOF','Lenda']
export const TIER_THRESHOLDS: number[]   // [10, 30, 80, 200, 400] unidades acumuladas
export interface BadgeDef {
  id: string; name: string
  group: 'inside' | 'outside' | 'playmaking' | 'defense' | 'rebounding' | 'general'
  // unidades de progresso ganhas neste jogo (0 se nada relevante)
  units: (box: BoxScore, ctx: GameContext, position: Position) => number
}
export const BADGES: BadgeDef[]          // exatamente 40
export function tierOf(progress: number): number  // 0..5
export function progressForTier(tier: number): number
// MUTA badges; retorna instruções de subida de tier
export function applyBadgeProgress(
  badges: Record<string, BadgeState>, box: BoxScore, ctx: GameContext, position: Position
): Instruction[]
```

- [ ] **Step 1: Escrever teste**

`src/engine/badges.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { BADGES, tierOf, progressForTier, applyBadgeProgress, TIER_THRESHOLDS } from './badges'
import type { BoxScore, GameContext, BadgeState } from './types'

const ctx: GameContext = { opponent: 'NYK', home: true, playoffs: false, win: true, date: '2026-01-15' }
const shooterGame: BoxScore = { min: 36, pts: 33, reb: 4, ast: 3, stl: 1, blk: 0, tov: 2, fgm: 11, fga: 20, tpm: 7, tpa: 12, ftm: 4, fta: 4, plusMinus: 12 }

describe('badge catalog', () => {
  it('has exactly 40 unique badges', () => {
    expect(BADGES.length).toBe(40)
    expect(new Set(BADGES.map(b => b.id)).size).toBe(40)
  })
  it('group counts match NBA 2K25', () => {
    const count = (g: string) => BADGES.filter(b => b.group === g).length
    expect(count('inside')).toBe(11)
    expect(count('outside')).toBe(5)
    expect(count('playmaking')).toBe(9)
    expect(count('defense')).toBe(10)
    expect(count('rebounding')).toBe(2)
    expect(count('general')).toBe(3) // Brick Wall, Slippery Off-Ball, Pogo Stick
  })
})

describe('tiers', () => {
  it('maps progress to tier', () => {
    expect(tierOf(0)).toBe(0)
    expect(tierOf(TIER_THRESHOLDS[0])).toBe(1)
    expect(tierOf(TIER_THRESHOLDS[4])).toBe(5)
  })
  it('progressForTier is inverse floor of tierOf', () => {
    for (let t = 1; t <= 5; t++) expect(tierOf(progressForTier(t))).toBe(t)
  })
})

describe('applyBadgeProgress', () => {
  it('hot 3PT game advances Deadeye and emits tier-up instruction at threshold', () => {
    const badges: Record<string, BadgeState> = {}
    for (const b of BADGES) badges[b.id] = { progress: 0 }
    badges['deadeye'].progress = TIER_THRESHOLDS[0] - 1
    const instructions = applyBadgeProgress(badges, shooterGame, ctx, 'SG')
    expect(badges['deadeye'].progress).toBeGreaterThanOrEqual(TIER_THRESHOLDS[0])
    expect(instructions.some(i => i.badge === 'deadeye' && i.tier === 1)).toBe(true)
  })
  it('every badge accrues some progress over a plausible season sample', () => {
    const badges: Record<string, BadgeState> = {}
    for (const b of BADGES) badges[b.id] = { progress: 0 }
    // 20 jogos variados devem tocar todas as badges (proxies incluídas)
    for (let i = 0; i < 20; i++) {
      applyBadgeProgress(badges, { ...shooterGame, ast: 9, reb: 11, stl: 2, blk: 2, tov: 2 }, ctx, 'SF')
    }
    for (const b of BADGES) {
      expect(badges[b.id].progress, b.id).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/engine/badges.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar catálogo completo**

`src/engine/badges.ts` — as 40 badges do 2K25. Badges com sinal claro no box score usam regra direta; as demais usam proxy (minutos + posição + stat da categoria). Estrutura:

```ts
import type { BoxScore, GameContext, Position, BadgeState, Instruction } from './types'

export const TIER_NAMES = ['—', 'Bronze', 'Prata', 'Ouro', 'HOF', 'Lenda']
export const TIER_THRESHOLDS = [10, 30, 80, 200, 400]

export interface BadgeDef {
  id: string; name: string
  group: 'inside' | 'outside' | 'playmaking' | 'defense' | 'rebounding' | 'general'
  units: (box: BoxScore, ctx: GameContext, position: Position) => number
}

// helpers
const played = (b: BoxScore, mins = 15) => b.min >= mins
const big = (p: Position) => p === 'PF' || p === 'C'
const guard = (p: Position) => p === 'PG' || p === 'SG'
const twoPm = (b: BoxScore) => b.fgm - b.tpm
const tpPct = (b: BoxScore) => (b.tpa > 0 ? b.tpm / b.tpa : 0)
// proxy: presença em quadra na função certa — progresso lento
const proxy = (cond: boolean) => (cond ? 0.5 : 0)

export const BADGES: BadgeDef[] = [
  // ---- Inside (11)
  { id: 'aerial-wizard', name: 'Aerial Wizard', group: 'inside', units: b => (twoPm(b) >= 5 ? 1 : 0) },
  { id: 'float-game', name: 'Float Game', group: 'inside', units: (b, _c, p) => proxy(played(b) && guard(p)) + (twoPm(b) >= 4 ? 0.5 : 0) },
  { id: 'hook-specialist', name: 'Hook Specialist', group: 'inside', units: (b, _c, p) => proxy(played(b) && big(p)) + (big(p) && twoPm(b) >= 5 ? 0.5 : 0) },
  { id: 'layup-mixmaster', name: 'Layup Mixmaster', group: 'inside', units: b => (twoPm(b) >= 6 ? 1 : 0) + proxy(played(b)) },
  { id: 'paint-prodigy', name: 'Paint Prodigy', group: 'inside', units: (b, _c, p) => (big(p) && twoPm(b) >= 5 ? 1 : 0) + proxy(played(b) && big(p)) },
  { id: 'physical-finisher', name: 'Physical Finisher', group: 'inside', units: b => (b.fta >= 6 ? 1 : 0) + (twoPm(b) >= 5 ? 0.5 : 0) },
  { id: 'post-fade-phenom', name: 'Post Fade Phenom', group: 'inside', units: (b, _c, p) => proxy(played(b) && big(p)) + (big(p) && b.pts >= 20 ? 0.5 : 0) },
  { id: 'post-powerhouse', name: 'Post Powerhouse', group: 'inside', units: (b, _c, p) => proxy(played(b) && big(p)) + (big(p) && twoPm(b) >= 6 ? 0.5 : 0) },
  { id: 'post-up-poet', name: 'Post-Up Poet', group: 'inside', units: (b, _c, p) => proxy(played(b) && big(p)) + (big(p) && b.ast >= 3 ? 0.5 : 0) },
  { id: 'posterizer', name: 'Posterizer', group: 'inside', units: b => (twoPm(b) >= 7 ? 1 : 0) + proxy(played(b, 20)) },
  { id: 'rise-up', name: 'Rise Up', group: 'inside', units: (b, _c, p) => (big(p) && twoPm(b) >= 5 ? 1 : 0) + proxy(played(b) && big(p)) },
  // ---- Outside (5)
  { id: 'deadeye', name: 'Deadeye', group: 'outside', units: b => (b.tpa >= 4 && tpPct(b) >= 0.4 ? b.tpm : 0) },
  { id: 'limitless-range', name: 'Limitless Range', group: 'outside', units: b => (b.tpm >= 4 ? b.tpm - 3 : 0) },
  { id: 'mini-marksman', name: 'Mini Marksman', group: 'outside', units: (b, _c, p) => (guard(p) && b.tpm >= 3 ? 1 : 0) + proxy(played(b) && guard(p)) },
  { id: 'set-shot-specialist', name: 'Set Shot Specialist', group: 'outside', units: b => (b.tpa >= 5 && tpPct(b) >= 0.35 ? 1 : 0) + proxy(played(b)) },
  { id: 'shifty-shooter', name: 'Shifty Shooter', group: 'outside', units: (b, _c, p) => (guard(p) && b.tpm >= 4 ? 1 : 0) + proxy(played(b) && guard(p)) },
  // ---- Playmaking (9)
  { id: 'ankle-assassin', name: 'Ankle Assassin', group: 'playmaking', units: (b, _c, p) => proxy(played(b) && guard(p)) + (b.ast >= 6 ? 0.5 : 0) },
  { id: 'bail-out', name: 'Bail Out', group: 'playmaking', units: b => (b.ast >= 5 && b.tov <= 2 ? 1 : 0) + proxy(played(b)) },
  { id: 'break-starter', name: 'Break Starter', group: 'playmaking', units: b => (b.reb >= 6 && b.ast >= 4 ? 1 : 0) + proxy(played(b)) },
  { id: 'dimer', name: 'Dimer', group: 'playmaking', units: b => (b.ast >= 8 && (b.tov === 0 || b.ast / b.tov >= 2.5) ? 2 : b.ast >= 6 ? 1 : 0) },
  { id: 'handles-for-days', name: 'Handles for Days', group: 'playmaking', units: (b, _c, p) => proxy(played(b, 25) && guard(p)) + (b.ast >= 5 ? 0.5 : 0) },
  { id: 'lightning-launch', name: 'Lightning Launch', group: 'playmaking', units: (b, _c, p) => proxy(played(b) && guard(p)) + (twoPm(b) >= 4 && guard(p) ? 0.5 : 0) },
  { id: 'strong-handle', name: 'Strong Handle', group: 'playmaking', units: b => (b.tov <= 1 && b.min >= 25 ? 1 : 0) + proxy(played(b)) },
  { id: 'unpluckable', name: 'Unpluckable', group: 'playmaking', units: b => (b.tov === 0 && b.min >= 20 ? 2 : b.tov <= 2 && b.min >= 25 ? 1 : 0) },
  { id: 'versatile-visionary', name: 'Versatile Visionary', group: 'playmaking', units: b => (b.ast >= 7 ? 1 : 0) + proxy(played(b)) },
  // ---- Defense (10)
  { id: 'challenger', name: 'Challenger', group: 'defense', units: (b, c) => (c.win && b.plusMinus >= 5 ? 1 : 0) + proxy(played(b)) },
  { id: 'glove', name: 'Glove', group: 'defense', units: b => b.stl },
  { id: 'high-flying-denier', name: 'High-Flying Denier', group: 'defense', units: b => b.blk },
  { id: 'immovable-enforcer', name: 'Immovable Enforcer', group: 'defense', units: (b, _c, p) => proxy(played(b) && big(p)) + (b.blk >= 1 ? 0.5 : 0) },
  { id: 'interceptor', name: 'Interceptor', group: 'defense', units: b => (b.stl >= 2 ? b.stl : 0) + proxy(played(b)) },
  { id: 'off-ball-pest', name: 'Off-Ball Pest', group: 'defense', units: b => proxy(played(b, 20)) + (b.stl >= 1 ? 0.5 : 0) },
  { id: 'on-ball-menace', name: 'On-Ball Menace', group: 'defense', units: (b, _c, p) => proxy(played(b, 20) && guard(p)) + (b.stl >= 2 ? 1 : 0) },
  { id: 'paint-patroller', name: 'Paint Patroller', group: 'defense', units: (b, _c, p) => (big(p) ? b.blk : b.blk * 0.5) + proxy(played(b) && big(p)) },
  { id: 'pick-dodger', name: 'Pick Dodger', group: 'defense', units: (b, _c, p) => proxy(played(b, 20) && guard(p)) + (b.plusMinus >= 8 ? 0.5 : 0) },
  { id: 'post-lockdown', name: 'Post Lockdown', group: 'defense', units: (b, _c, p) => proxy(played(b) && big(p)) + (big(p) && b.blk >= 2 ? 1 : 0) },
  // ---- Rebounding (2)
  { id: 'boxout-beast', name: 'Boxout Beast', group: 'rebounding', units: b => (b.reb >= 8 ? 1.5 : b.reb >= 5 ? 0.5 : 0) },
  { id: 'rebound-chaser', name: 'Rebound Chaser', group: 'rebounding', units: b => (b.reb >= 10 ? 2 : b.reb >= 7 ? 1 : 0) },
  // ---- General offense + all-around (3)
  { id: 'brick-wall', name: 'Brick Wall', group: 'general', units: (b, _c, p) => proxy(played(b, 20) && big(p)) + (big(p) && b.plusMinus >= 5 ? 0.5 : 0) },
  { id: 'slippery-off-ball', name: 'Slippery Off-Ball', group: 'general', units: (b, _c, p) => proxy(played(b, 20) && !big(p)) + (b.tpm >= 3 ? 0.5 : 0) },
  { id: 'pogo-stick', name: 'Pogo Stick', group: 'general', units: b => ((b.blk + b.reb >= 8) ? 1 : 0) + proxy(played(b, 20)) },
]

export function tierOf(progress: number): number {
  let tier = 0
  for (const t of TIER_THRESHOLDS) if (progress >= t) tier++
  return tier
}

export function progressForTier(tier: number): number {
  return tier <= 0 ? 0 : TIER_THRESHOLDS[tier - 1]
}

let badgeInstrSeq = 0
export function applyBadgeProgress(
  badges: Record<string, BadgeState>, box: BoxScore, ctx: GameContext, position: Position,
): Instruction[] {
  const instructions: Instruction[] = []
  for (const def of BADGES) {
    const state = badges[def.id]
    if (!state) continue
    const before = tierOf(state.progress)
    state.progress += def.units(box, ctx, position)
    const after = tierOf(state.progress)
    if (after > before) {
      instructions.push({
        id: `badge-${ctx.date}-${badgeInstrSeq++}`, type: 'badge',
        text: `Suba ${def.name} para ${['—', 'Bronze', 'Prata', 'Ouro', 'HOF', 'Lenda'][after]} no 2K`,
        badge: def.id, tier: after,
      })
    }
  }
  return instructions
}
```

Nota: teste espera `general` com 3 (Brick Wall + Slippery Off-Ball + Pogo Stick — General Offense 2 + All-Around 1 agrupadas).

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run src/engine/badges.test.ts`
Expected: PASS. Se "every badge accrues progress" falhar em alguma badge, ajustar o proxy dela (afrouxar condição) até passar.

- [ ] **Step 5: Commit**

```bash
git add src/engine/badges.ts src/engine/badges.test.ts
git commit -m "feat: full 2K25 badge catalog with passive progress rules"
```

---

### Task 8: Desafios de badge

**Files:**
- Create: `src/engine/challenges.ts`
- Test: `src/engine/challenges.test.ts`

**Interfaces:**
- Consumes: `Challenge`, `BadgeState`, `BoxScore`, `BADGES`, `TIER_THRESHOLDS`, `tierOf`.
- Produces:
```ts
// gera desafio de streak pra badge escolhida (determinístico por badge)
export function createChallenge(badgeId: string): Challenge
// MUTA challenge.currentStreak e badges[badgeId].progress quando completa;
// retorna true se o desafio foi completado (deve ser removido/renovado)
export function updateChallenge(
  challenge: Challenge, badges: Record<string, BadgeState>, box: BoxScore
): boolean
```

- [ ] **Step 1: Escrever teste**

`src/engine/challenges.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createChallenge, updateChallenge } from './challenges'
import { TIER_THRESHOLDS, tierOf } from './badges'
import type { BadgeState, BoxScore } from './types'

const game = (over: Partial<BoxScore>): BoxScore => ({
  min: 34, pts: 20, reb: 5, ast: 5, stl: 1, blk: 1, tov: 2,
  fgm: 8, fga: 16, tpm: 2, tpa: 6, ftm: 2, fta: 3, plusMinus: 4, ...over,
})

describe('challenges', () => {
  it('creates a streak challenge with sensible fields', () => {
    const c = createChallenge('dimer')
    expect(c.badgeId).toBe('dimer')
    expect(c.streakLen).toBeGreaterThan(1)
    expect(c.perGame).toBeGreaterThan(0)
    expect(c.currentStreak).toBe(0)
    expect(c.description.length).toBeGreaterThan(0)
  })
  it('missing the target resets the streak', () => {
    const c = createChallenge('dimer')
    const badges: Record<string, BadgeState> = { dimer: { progress: 0 } }
    updateChallenge(c, badges, game({ ast: c.perGame }))
    expect(c.currentStreak).toBe(1)
    updateChallenge(c, badges, game({ ast: 0 }))
    expect(c.currentStreak).toBe(0)
  })
  it('completing the streak advances badge 50% toward next tier', () => {
    const c = createChallenge('dimer')
    const badges: Record<string, BadgeState> = { dimer: { progress: 0 } }
    let done = false
    for (let i = 0; i < c.streakLen; i++) done = updateChallenge(c, badges, game({ ast: c.perGame + 2 }))
    expect(done).toBe(true)
    const gap = TIER_THRESHOLDS[0] - 0
    expect(badges.dimer.progress).toBeCloseTo(gap * 0.5, 5)
    expect(tierOf(badges.dimer.progress)).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/engine/challenges.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/engine/challenges.ts`:
```ts
import type { BadgeState, BoxScore, Challenge } from './types'
import { BADGES, TIER_THRESHOLDS, tierOf, progressForTier } from './badges'

// stat e alvo por badge; badges sem stat claro usam min (presença)
const CHALLENGE_SPECS: Record<string, { stat: Challenge['stat']; perGame: number; streakLen: number }> = {
  'deadeye': { stat: 'tpm', perGame: 4, streakLen: 3 },
  'limitless-range': { stat: 'tpm', perGame: 5, streakLen: 3 },
  'mini-marksman': { stat: 'tpm', perGame: 3, streakLen: 4 },
  'set-shot-specialist': { stat: 'tpm', perGame: 3, streakLen: 3 },
  'shifty-shooter': { stat: 'tpm', perGame: 4, streakLen: 3 },
  'dimer': { stat: 'ast', perGame: 8, streakLen: 3 },
  'bail-out': { stat: 'ast', perGame: 6, streakLen: 3 },
  'versatile-visionary': { stat: 'ast', perGame: 7, streakLen: 3 },
  'break-starter': { stat: 'ast', perGame: 5, streakLen: 4 },
  'glove': { stat: 'stl', perGame: 2, streakLen: 3 },
  'interceptor': { stat: 'stl', perGame: 3, streakLen: 2 },
  'on-ball-menace': { stat: 'stl', perGame: 2, streakLen: 3 },
  'high-flying-denier': { stat: 'blk', perGame: 2, streakLen: 3 },
  'paint-patroller': { stat: 'blk', perGame: 3, streakLen: 2 },
  'post-lockdown': { stat: 'blk', perGame: 2, streakLen: 3 },
  'rebound-chaser': { stat: 'reb', perGame: 10, streakLen: 3 },
  'boxout-beast': { stat: 'reb', perGame: 8, streakLen: 3 },
  'pogo-stick': { stat: 'blk', perGame: 2, streakLen: 3 },
  'posterizer': { stat: 'pts', perGame: 22, streakLen: 3 },
  'physical-finisher': { stat: 'pts', perGame: 20, streakLen: 3 },
  'paint-prodigy': { stat: 'pts', perGame: 18, streakLen: 3 },
}
const FALLBACK = { stat: 'pts' as const, perGame: 15, streakLen: 3 }

export function createChallenge(badgeId: string): Challenge {
  const spec = CHALLENGE_SPECS[badgeId] ?? FALLBACK
  const name = BADGES.find(b => b.id === badgeId)?.name ?? badgeId
  const statLabel: Record<Challenge['stat'], string> = {
    pts: 'pontos', ast: 'assistências', tpm: 'bolas de 3', reb: 'rebotes', stl: 'roubos', blk: 'tocos',
  }
  return {
    badgeId, stat: spec.stat, perGame: spec.perGame, streakLen: spec.streakLen, currentStreak: 0,
    description: `${name}: ${spec.perGame}+ ${statLabel[spec.stat]} por ${spec.streakLen} jogos seguidos`,
  }
}

export function updateChallenge(
  challenge: Challenge, badges: Record<string, BadgeState>, box: BoxScore,
): boolean {
  if (box.min <= 0) return false // DNP não quebra streak
  const value = box[challenge.stat]
  challenge.currentStreak = value >= challenge.perGame ? challenge.currentStreak + 1 : 0
  if (challenge.currentStreak < challenge.streakLen) return false
  const state = badges[challenge.badgeId]
  if (state) {
    const tier = tierOf(state.progress)
    const nextThreshold = tier >= 5 ? state.progress : TIER_THRESHOLDS[tier]
    const gap = Math.max(nextThreshold - state.progress, 0)
    state.progress += gap * 0.5
  }
  return true
}
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run src/engine/challenges.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/challenges.ts src/engine/challenges.test.ts
git commit -m "feat: badge streak challenges"
```

---

### Task 9: Gerador de metas pré-jogo

**Files:**
- Create: `src/engine/goals.ts`
- Test: `src/engine/goals.test.ts`

**Interfaces:**
- Consumes: `Goal`, `GoalKind`, `BoxScore`, `GameContext`, `Category`, `Game`.
- Produces:
```ts
// médias dos últimos N jogos jogados (box != null, min > 0)
export function recentAverages(games: Game[], n?: number): BoxScore | null
// 2-3 metas acima da média; categorias não repetem 3 jogos seguidos
export function generateGoals(games: Game[], nextCtx: GameContext, seq: number): Goal[]
export function goalMet(goal: Goal, box: BoxScore, ctx: GameContext): boolean
// XP bônus por meta cumprida, por categoria (cap aplicado depois em applyGameXp)
export function goalBonus(goals: Goal[], met: string[]): Partial<Record<Category, number>>
```
`seq` = índice do jogo na carreira (pra rotação determinística de categorias — sem Math.random, recálculo reproduz tudo).

- [ ] **Step 1: Escrever teste**

`src/engine/goals.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { recentAverages, generateGoals, goalMet, goalBonus } from './goals'
import type { BoxScore, Game, GameContext } from './types'

const ctx: GameContext = { opponent: 'DAL', home: false, playoffs: false, win: false, date: '2026-02-01' }
const box = (over: Partial<BoxScore>): BoxScore => ({
  min: 34, pts: 15, reb: 5, ast: 4, stl: 1, blk: 0, tov: 2,
  fgm: 6, fga: 13, tpm: 1, tpa: 4, ftm: 2, fta: 2, plusMinus: 0, ...over,
})
const playedGame = (i: number): Game => ({
  id: `g${i}`, context: { ...ctx, date: `2026-01-${10 + i}` }, box: box({}), goals: [], goalsMet: [],
})

describe('recentAverages', () => {
  it('returns null with no played games', () => {
    expect(recentAverages([])).toBeNull()
  })
  it('averages the box scores', () => {
    const avg = recentAverages([playedGame(1), playedGame(2)])
    expect(avg!.pts).toBeCloseTo(15)
  })
})

describe('generateGoals', () => {
  const history = [1, 2, 3, 4, 5].map(playedGame)
  it('generates 2-3 goals with targets above average', () => {
    const goals = generateGoals(history, ctx, 5)
    expect(goals.length).toBeGreaterThanOrEqual(2)
    expect(goals.length).toBeLessThanOrEqual(3)
    const ptsGoal = goals.find(g => g.kind === 'pts')
    if (ptsGoal) expect(ptsGoal.target).toBeGreaterThan(15)
  })
  it('rotates categories across consecutive seq values', () => {
    const cats = (s: number) => generateGoals(history, ctx, s).map(g => g.category).sort().join(',')
    expect(cats(5) === cats(6) && cats(6) === cats(7)).toBe(false)
  })
  it('is deterministic for the same seq', () => {
    expect(generateGoals(history, ctx, 5)).toEqual(generateGoals(history, ctx, 5))
  })
})

describe('goalMet + goalBonus', () => {
  it('checks pts goal and awards category bonus', () => {
    const goals = generateGoals([1, 2, 3].map(playedGame), ctx, 3)
    const big = box({ pts: 40, fgm: 15, fga: 22, tpm: 4, tpa: 8, ftm: 6, fta: 6, ast: 10, reb: 12, stl: 3, blk: 2 })
    const met = goals.filter(g => goalMet(g, big, { ...ctx, win: true })).map(g => g.id)
    expect(met.length).toBeGreaterThan(0)
    const bonus = goalBonus(goals, met)
    expect(Object.values(bonus).some(v => (v ?? 0) > 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/engine/goals.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/engine/goals.ts`:
```ts
import type { BoxScore, Category, Game, GameContext, Goal } from './types'

const EMPTY: BoxScore = { min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, plusMinus: 0 }

export function recentAverages(games: Game[], n = 10): BoxScore | null {
  const played = games.filter(g => g.box && g.box.min > 0).slice(-n)
  if (played.length === 0) return null
  const sum = { ...EMPTY }
  for (const g of played) for (const k of Object.keys(sum) as (keyof BoxScore)[]) sum[k] += g.box![k]
  for (const k of Object.keys(sum) as (keyof BoxScore)[]) sum[k] = sum[k] / played.length
  return sum
}

interface GoalTemplate { kind: Goal['kind']; category: Category; make: (avg: BoxScore) => { target: number; description: string } }

const TEMPLATES: GoalTemplate[] = [
  { kind: 'pts', category: 'mid', make: a => { const t = Math.ceil(a.pts * 1.2) + 1; return { target: t, description: `Marque ${t}+ pontos` } } },
  { kind: 'ast', category: 'playmaking', make: a => { const t = Math.max(Math.ceil(a.ast * 1.25), 3); return { target: t, description: `Dê ${t}+ assistências` } } },
  { kind: 'reb', category: 'rebounding', make: a => { const t = Math.max(Math.ceil(a.reb * 1.25), 4); return { target: t, description: `Pegue ${t}+ rebotes` } } },
  { kind: 'stocks', category: 'defense', make: a => { const t = Math.max(Math.ceil((a.stl + a.blk) * 1.3), 2); return { target: t, description: `Some ${t}+ roubos+tocos` } } },
  { kind: 'fgPct', category: 'inside', make: () => ({ target: 0.5, description: 'Acerte 50%+ dos arremessos (mín. 8 tentativas)' }) },
  { kind: 'tpPct', category: 'three', make: () => ({ target: 0.4, description: 'Acerte 40%+ de 3 (mín. 4 tentativas)' }) },
  { kind: 'awayWin', category: 'defense', make: () => ({ target: 1, description: 'Vença fora de casa' }) },
]

const ROOKIE_AVG: BoxScore = { ...EMPTY, min: 24, pts: 10, reb: 4, ast: 3, stl: 1, blk: 0.5, tov: 2, fgm: 4, fga: 9, tpm: 1, tpa: 3, ftm: 1, fta: 2 }

export function generateGoals(games: Game[], nextCtx: GameContext, seq: number): Goal[] {
  const avg = recentAverages(games) ?? ROOKIE_AVG
  // rotação determinística: janela deslizante sobre os templates
  const pool = TEMPLATES.filter(t => t.kind !== 'awayWin' || !nextCtx.home)
  const count = 2 + (seq % 2) // alterna 2 e 3 metas
  const goals: Goal[] = []
  for (let i = 0; i < count; i++) {
    const t = pool[(seq + i * 2) % pool.length]
    if (goals.some(g => g.kind === t.kind)) continue
    const { target, description } = t.make(avg)
    goals.push({ id: `goal-${seq}-${t.kind}`, category: t.category, kind: t.kind, target, description })
  }
  return goals
}

export function goalMet(goal: Goal, box: BoxScore, ctx: GameContext): boolean {
  switch (goal.kind) {
    case 'pts': return box.pts >= goal.target
    case 'ast': return box.ast >= goal.target
    case 'reb': return box.reb >= goal.target
    case 'stocks': return box.stl + box.blk >= goal.target
    case 'fgPct': return box.fga >= 8 && box.fgm / box.fga >= goal.target
    case 'tpPct': return box.tpa >= 4 && box.tpm / box.tpa >= goal.target
    case 'awayWin': return !ctx.home && ctx.win
  }
}

const GOAL_XP = 40 // bruto; cap de 30% aplicado em applyGameXp

export function goalBonus(goals: Goal[], met: string[]): Partial<Record<Category, number>> {
  const bonus: Partial<Record<Category, number>> = {}
  for (const g of goals) {
    if (!met.includes(g.id)) continue
    bonus[g.category] = (bonus[g.category] ?? 0) + GOAL_XP
  }
  return bonus
}
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run src/engine/goals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/goals.ts src/engine/goals.test.ts
git commit -m "feat: deterministic pre-game goal generation"
```

---

### Task 10: Pipeline de recálculo + regressão de veterano

**Files:**
- Create: `src/engine/recalc.ts`
- Test: `src/engine/recalc.test.ts`

**Interfaces:**
- Consumes: tudo do engine (progression, badges, challenges, goals, validation).
- Produces:
```ts
// idade na temporada: player.startAge + índice da temporada
export function ageAt(career: Career, seasonIndex: number): number
// processa 1 jogo: metas cumpridas, XP, badges, desafios; MUTA career; retorna instruções novas
export function processGame(career: Career, seasonIndex: number, game: Game): Instruction[]
// instruções de regressão ao iniciar temporada com idade >= 34
export function regressionInstructions(career: Career, seasonIndex: number): Instruction[]
// reconstrói attributes/badges/pendingInstructions do zero a partir de
// initialAttributes/initialBadges reprocessando todos os jogos em ordem
export function recalcCareer(career: Career): void
```
Regras de regressão: idade 34-35 → -1 nos 2 primeiros de `PHYSICAL_REGRESSION_ORDER`; 36-37 → -1 nos 3 primeiros; 38+ → -1 nos 4 primeiros. Emitidas uma vez no início de cada temporada.

- [ ] **Step 1: Escrever teste**

`src/engine/recalc.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { processGame, recalcCareer, regressionInstructions, ageAt } from './recalc'
import { DEFAULT_CONFIG } from './types'
import { ATTRIBUTES } from './attributes'
import { BADGES } from './badges'
import type { Career, Game } from './types'

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
    processGame(c, 0, g)
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
      processGame(c, 0, g)
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
      processGame(c, 0, g)
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
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/engine/recalc.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/engine/recalc.ts`:
```ts
import type { Career, Game, Instruction } from './types'
import { ATTRIBUTES, PHYSICAL_REGRESSION_ORDER } from './attributes'
import { BADGES, applyBadgeProgress, progressForTier } from './badges'
import { applyGameXp } from './progression'
import { updateChallenge, createChallenge } from './challenges'
import { goalMet, goalBonus } from './goals'

export function ageAt(career: Career, seasonIndex: number): number {
  return career.player.startAge + seasonIndex
}

export function processGame(career: Career, seasonIndex: number, game: Game): Instruction[] {
  if (!game.box || game.box.min <= 0) return []
  const age = ageAt(career, seasonIndex)
  // metas
  game.goalsMet = game.goals.filter(g => goalMet(g, game.box!, game.context)).map(g => g.id)
  const bonus = goalBonus(game.goals, game.goalsMet)
  // XP de atributos
  const xpResult = applyGameXp(career, game.box, game.context, age, bonus)
  // badges passivas
  const badgeInstr = applyBadgeProgress(career.badges, game.box, game.context, career.player.position)
  // desafios ativos (completados são renovados pra mesma badge)
  for (const ch of career.activeChallenges) {
    const done = updateChallenge(ch, career.badges, game.box)
    if (done) Object.assign(ch, createChallenge(ch.badgeId))
  }
  const instructions = [...xpResult.instructions, ...badgeInstr]
  career.pendingInstructions.push(...instructions)
  return instructions
}

const REGRESSION_COUNT = (age: number) => (age >= 38 ? 4 : age >= 36 ? 3 : age >= 34 ? 2 : 0)

export function regressionInstructions(career: Career, seasonIndex: number): Instruction[] {
  const age = ageAt(career, seasonIndex)
  const count = REGRESSION_COUNT(age)
  const instructions: Instruction[] = []
  for (const attrId of PHYSICAL_REGRESSION_ORDER.slice(0, count)) {
    const attr = career.attributes[attrId]
    if (!attr || attr.value <= 25) continue
    attr.value -= 1
    const label = ATTRIBUTES.find(a => a.id === attrId)?.label ?? attrId
    instructions.push({
      id: `regress-${seasonIndex}-${attrId}`, type: 'attribute',
      text: `-1 ${label} (regressão, idade ${age})`, attribute: attrId, delta: -1,
    })
  }
  return instructions
}

export function recalcCareer(career: Career): void {
  // reset ao snapshot inicial
  career.attributes = {}
  for (const a of ATTRIBUTES) {
    career.attributes[a.id] = { value: career.initialAttributes[a.id] ?? 60, xp: 0 }
  }
  career.badges = {}
  for (const b of BADGES) {
    career.badges[b.id] = { progress: progressForTier(career.initialBadges[b.id] ?? 0) }
  }
  career.pendingInstructions = []
  for (const ch of career.activeChallenges) { ch.currentStreak = 0 }
  career.seasons.forEach((season, si) => {
    if (si > 0) {
      const regress = regressionInstructions(career, si)
      career.pendingInstructions.push(...regress)
    }
    for (const g of season.games) processGame(career, si, g)
  })
}
```

Nota: `recalcCareer` também é o inicializador — carreira nova = snapshot + zero jogos.

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run src/engine/recalc.test.ts`
Expected: PASS. Atenção: o teste de determinismo exige que `applyGameXp`/`applyBadgeProgress` não dependam de nada fora dos argumentos (IDs sequenciais podem diferir — comparar apenas attributes/badges, como o teste faz).

- [ ] **Step 5: Rodar suíte inteira**

Run: `npx vitest run`
Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/recalc.ts src/engine/recalc.test.ts
git commit -m "feat: career recalc pipeline and veteran regression"
```

---

### Task 11: Persistência (localStorage + export/import)

**Files:**
- Create: `src/storage.ts`
- Test: `src/storage.test.ts`

**Interfaces:**
- Consumes: `Career`.
- Produces:
```ts
export const STORAGE_KEY = 'nba2k25-career'
export function saveCareer(career: Career, storage?: Storage): void
export function loadCareer(storage?: Storage): Career | null
export function clearCareer(storage?: Storage): void
export function exportCareer(career: Career): string          // JSON pretty
export function importCareer(json: string): Career            // valida shape básico, throw com msg pt-BR
```

- [ ] **Step 1: Escrever teste**

`src/storage.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/storage.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/storage.ts`:
```ts
import type { Career } from './engine/types'

export const STORAGE_KEY = 'nba2k25-career'

export function saveCareer(career: Career, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(career))
}

export function loadCareer(storage: Storage = localStorage): Career | null {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as Career } catch { return null }
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
  return c
}
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run src/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage.ts src/storage.test.ts
git commit -m "feat: localStorage persistence and JSON export/import"
```

---

### Task 12: Calibração (simulação de temporada)

**Files:**
- Test: `src/engine/calibration.test.ts`
- Modify (se necessário): constantes em `src/engine/types.ts` (DEFAULT_CONFIG), `src/engine/categoryXp.ts` (pesos)

**Interfaces:**
- Consumes: `recalcCareer`, `processGame`, `estimateOverall`.
- Produces: constantes calibradas commitadas. Nenhuma API nova.

- [ ] **Step 1: Escrever teste de calibração**

`src/engine/calibration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { processGame, ageAt } from './recalc'
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
    processGame(career, seasonIndex, g)
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
```

- [ ] **Step 2: Rodar e calibrar**

Run: `npx vitest run src/engine/calibration.test.ts`

Se falhar (ganho fora de 4-6): ajustar SOMENTE `DEFAULT_CONFIG.baseCost` (subir se ganho > 6, descer se < 4) e/ou os fatores de `categoryXp` proporcionalmente. Repetir até passar. Não alterar os testes de alvo.

- [ ] **Step 3: Rodar suíte inteira**

Run: `npx vitest run`
Expected: todos PASS (se calibração mudou constantes usadas por outros testes, corrigir números esperados APENAS se o teste verificava valor exato de constante, nunca os alvos de calibração).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: season simulation calibration, tuned XP constants"
```

---

### Task 13: Shell da UI, contexto de estado e tela Criar Jogador

**Files:**
- Create: `src/ui/CareerContext.tsx`
- Create: `src/ui/Layout.tsx`
- Create: `src/ui/CreatePlayer.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: engine + storage completos.
- Produces:
```tsx
// CareerContext.tsx
export function CareerProvider({ children }: { children: ReactNode }): JSX.Element
export function useCareer(): {
  career: Career | null
  update: (fn: (c: Career) => void) => void   // muta cópia, salva no storage, re-renderiza
  create: (career: Career) => void
  reset: () => void
}
```
Rotas: `/` (dashboard, redireciona pra `/new` se não há carreira), `/new`, `/pregame`, `/postgame`, `/history`.

- [ ] **Step 1: Implementar CareerContext**

`src/ui/CareerContext.tsx`:
```tsx
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Career } from '../engine/types'
import { loadCareer, saveCareer, clearCareer } from '../storage'

interface Ctx {
  career: Career | null
  update: (fn: (c: Career) => void) => void
  create: (career: Career) => void
  reset: () => void
}

const CareerCtx = createContext<Ctx | null>(null)

export function CareerProvider({ children }: { children: ReactNode }) {
  const [career, setCareer] = useState<Career | null>(() => loadCareer())
  const persist = (c: Career | null) => { setCareer(c); if (c) saveCareer(c) }
  return (
    <CareerCtx.Provider value={{
      career,
      update: fn => {
        if (!career) return
        const copy = structuredClone(career)
        fn(copy)
        persist(copy)
      },
      create: c => persist(c),
      reset: () => { clearCareer(); setCareer(null) },
    }}>
      {children}
    </CareerCtx.Provider>
  )
}

export function useCareer(): Ctx {
  const ctx = useContext(CareerCtx)
  if (!ctx) throw new Error('useCareer fora do CareerProvider')
  return ctx
}
```

- [ ] **Step 2: Layout + rotas**

`src/ui/Layout.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Painel' },
  { to: '/pregame', label: 'Pré-jogo' },
  { to: '/postgame', label: 'Pós-jogo' },
  { to: '/history', label: 'Histórico' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="flex gap-1 border-b border-zinc-800 px-4 py-2">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) =>
              `rounded px-3 py-1.5 text-sm ${isActive ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <main className="mx-auto max-w-3xl p-4"><Outlet /></main>
    </div>
  )
}
```

`src/App.tsx`:
```tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { CareerProvider, useCareer } from './ui/CareerContext'
import Layout from './ui/Layout'
import CreatePlayer from './ui/CreatePlayer'
import Dashboard from './ui/Dashboard'
import PreGame from './ui/PreGame'
import PostGame from './ui/PostGame'
import History from './ui/History'

function Guard({ children }: { children: React.ReactNode }) {
  const { career } = useCareer()
  if (!career) return <Navigate to="/new" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <CareerProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/new" element={<CreatePlayer />} />
            <Route path="/" element={<Guard><Dashboard /></Guard>} />
            <Route path="/pregame" element={<Guard><PreGame /></Guard>} />
            <Route path="/postgame" element={<Guard><PostGame /></Guard>} />
            <Route path="/history" element={<Guard><History /></Guard>} />
          </Route>
        </Routes>
      </HashRouter>
    </CareerProvider>
  )
}
```
(Dashboard/PreGame/PostGame/History começam como stubs `export default () => <p>...</p>` em arquivos próprios — substituídos nas Tasks 14-16.)

HashRouter: evita config de SPA fallback no Pages. `src/main.tsx` segue o padrão do template Vite (StrictMode + createRoot).

- [ ] **Step 3: Tela Criar Jogador**

`src/ui/CreatePlayer.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCareer } from './CareerContext'
import { ATTRIBUTES } from '../engine/attributes'
import { BADGES, TIER_NAMES } from '../engine/badges'
import { DEFAULT_CONFIG } from '../engine/types'
import { recalcCareer } from '../engine/recalc'
import type { Career, Position } from '../engine/types'

export default function CreatePlayer() {
  const { career, create } = useCareer()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [position, setPosition] = useState<Position>('PG')
  const [team, setTeam] = useState('')
  const [heightCm, setHeightCm] = useState(198)
  const [startAge, setStartAge] = useState(20)
  const [year, setYear] = useState(2026)
  const [attrs, setAttrs] = useState<Record<string, number>>(
    Object.fromEntries(ATTRIBUTES.map(a => [a.id, 70])),
  )
  const [badgeTiers, setBadgeTiers] = useState<Record<string, number>>(
    Object.fromEntries(BADGES.map(b => [b.id, 0])),
  )

  if (career) return <p className="text-zinc-400">Carreira ativa. Apague no Painel para criar outra.</p>

  function submit() {
    const c: Career = {
      player: { name, position, heightCm, team, startAge },
      initialAttributes: { ...attrs }, initialBadges: { ...badgeTiers },
      attributes: {}, badges: {}, activeChallenges: [],
      seasons: [{ year, games: [] }],
      pendingInstructions: [], config: DEFAULT_CONFIG, targetOverrides: {},
    }
    recalcCareer(c)
    create(c)
    nav('/')
  }

  const valid = name.trim() && team.trim() && startAge >= 18 && startAge <= 40

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Criar jogador</h1>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col text-sm">Nome
          <input className="input" value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="flex flex-col text-sm">Time
          <input className="input" value={team} onChange={e => setTeam(e.target.value)} /></label>
        <label className="flex flex-col text-sm">Posição
          <select className="input" value={position} onChange={e => setPosition(e.target.value as Position)}>
            {['PG','SG','SF','PF','C'].map(p => <option key={p}>{p}</option>)}
          </select></label>
        <label className="flex flex-col text-sm">Altura (cm)
          <input className="input" type="number" value={heightCm} onChange={e => setHeightCm(+e.target.value)} /></label>
        <label className="flex flex-col text-sm">Idade
          <input className="input" type="number" value={startAge} onChange={e => setStartAge(+e.target.value)} /></label>
        <label className="flex flex-col text-sm">Ano da temporada
          <input className="input" type="number" value={year} onChange={e => setYear(+e.target.value)} /></label>
      </div>

      <h2 className="font-semibold">Atributos atuais (como estão no 2K)</h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {ATTRIBUTES.map(a => (
          <label key={a.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{a.label}</span>
            <input className="input w-16" type="number" min={25} max={99} value={attrs[a.id]}
              onChange={e => setAttrs({ ...attrs, [a.id]: +e.target.value })} />
          </label>
        ))}
      </div>

      <h2 className="font-semibold">Badges atuais</h2>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {BADGES.map(b => (
          <label key={b.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{b.name}</span>
            <select className="input w-28" value={badgeTiers[b.id]}
              onChange={e => setBadgeTiers({ ...badgeTiers, [b.id]: +e.target.value })}>
              {TIER_NAMES.map((t, i) => <option key={t} value={i}>{t}</option>)}
            </select>
          </label>
        ))}
      </div>

      <button disabled={!valid} onClick={submit}
        className="rounded bg-orange-600 px-4 py-2 font-semibold disabled:opacity-40">
        Começar carreira
      </button>
    </div>
  )
}
```

Adicionar em `src/index.css`:
```css
@import "tailwindcss";

@layer components {
  .input {
    @apply rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100;
  }
}
```

- [ ] **Step 4: Verificar build + smoke manual**

Run: `npm run build` — sem erros.
Run: `npm run dev` — abrir, criar jogador de teste, confirmar redirect pro painel (stub) e que recarregar a página mantém a carreira.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: UI shell, career context and create-player screen"
```

---

### Task 14: Dashboard

**Files:**
- Create/Replace: `src/ui/Dashboard.tsx`

**Interfaces:**
- Consumes: `useCareer`, `estimateOverall`, `ATTRIBUTES`, `attributesByCategory`, `upgradeCost`, `BADGES`, `TIER_NAMES`, `tierOf`, `recentAverages`, `createChallenge`, `exportCareer`, `importCareer`, `recalcCareer`.
- Produces: rota `/` completa.

- [ ] **Step 1: Implementar Dashboard**

`src/ui/Dashboard.tsx` — seções, todas lendo `career` do contexto:

1. **Cabeçalho**: nome, posição, time, idade atual (`player.startAge + seasons.length - 1`), OVR (`estimateOverall`), temporada atual.
2. **Instruções pendentes**: lista `career.pendingInstructions`; botão "Apliquei tudo no 2K" → `update(c => { c.pendingInstructions = [] })`.
3. **Atributos**: agrupados por categoria; cada linha = label, valor, barra de progresso `xp / upgradeCost(value, config)` (Tailwind: div com `w-[{pct}%]`).
4. **Badges**: grade com nome + tier atual (`TIER_NAMES[tierOf(progress)]`) + barra até próximo tier.
5. **Desafios ativos**: até 2; select de badge + botão criar (`createChallenge`), botão remover. `update(c => { c.activeChallenges = ... })`.
6. **Médias da temporada**: `recentAverages(currentSeason.games, 999)` → PPG/RPG/APG/FG%/3P%.
7. **Gestão**: botões Exportar JSON (download via `URL.createObjectURL(new Blob([exportCareer(career)]))`), Importar JSON (`<input type="file">` → `importCareer` → `recalcCareer` → `create`), Nova temporada (`update(c => c.seasons.push({ year: last.year + 1, games: [] }))` + confirmação), Apagar carreira (`reset()` + `window.confirm`).

Código completo esperado (~150 linhas). Exemplo da barra de atributo:

```tsx
function AttrRow({ id, label, value, xp, cost }: { id: string; label: string; value: number; xp: number; cost: number }) {
  const pct = Math.min(100, Math.round((xp / cost) * 100))
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-40 truncate">{label}</span>
      <span className="w-8 text-right font-mono">{value}</span>
      <div className="h-2 flex-1 rounded bg-zinc-800">
        <div className="h-2 rounded bg-orange-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

Run: `npm run dev` — criar carreira, conferir todas as 7 seções renderizando; exportar e reimportar o JSON; `npm run build` sem erros.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: dashboard with attributes, badges, pending instructions and management"
```

---

### Task 15: Pré-jogo e Pós-jogo

**Files:**
- Create/Replace: `src/ui/PreGame.tsx`, `src/ui/PostGame.tsx`

**Interfaces:**
- Consumes: `generateGoals`, `validateBoxScore`, `processGame`, `useCareer`.
- Produces: rotas `/pregame` e `/postgame`. Metas do pré-jogo persistidas em `career` (campo `nextGoals: Goal[] | null` — adicionar ao tipo `Career` com default `null` em criação/import).

- [ ] **Step 1: Adicionar `nextGoals` ao tipo**

Em `src/engine/types.ts`, adicionar a `Career`: `nextGoals?: Goal[] | null`. (Opcional → import de JSONs antigos segue válido.)

- [ ] **Step 2: PreGame**

`src/ui/PreGame.tsx`:
```tsx
import { useCareer } from './CareerContext'
import { generateGoals } from '../engine/goals'

export default function PreGame() {
  const { career, update } = useCareer()
  if (!career) return null
  const season = career.seasons[career.seasons.length - 1]
  const seq = career.seasons.reduce((s, x) => s + x.games.length, 0)

  function roll(home: boolean, playoffs: boolean) {
    update(c => {
      c.nextGoals = generateGoals(season.games, { opponent: '', home, playoffs, win: false, date: '' }, seq)
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Pré-jogo</h1>
      <div className="flex gap-2">
        <button className="btn" onClick={() => roll(true, false)}>Jogo em casa</button>
        <button className="btn" onClick={() => roll(false, false)}>Jogo fora</button>
        <button className="btn" onClick={() => roll(true, true)}>Playoffs</button>
      </div>
      {career.nextGoals && (
        <ul className="space-y-2">
          {career.nextGoals.map(g => (
            <li key={g.id} className="rounded border border-zinc-800 p-3">{g.description}
              <span className="ml-2 text-xs text-zinc-500">+XP {g.category}</span></li>
          ))}
        </ul>
      )}
    </div>
  )
}
```
Adicionar `.btn` em `index.css`: `@apply rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700;`

- [ ] **Step 3: PostGame**

`src/ui/PostGame.tsx` — formulário completo:
- Campos contexto: adversário (text), casa/fora (select), playoffs (checkbox), W/L (select), data (`<input type="date">`).
- Campos box score: MIN, PTS, REB, AST, STL, BLK, TO, FGM, FGA, 3PM, 3PA, FTM, FTA, +/- (inputs number em grid).
- Checkbox "Não joguei (DNP)" → salva `box` com zeros.
- Submit: monta `BoxScore`, roda `validateBoxScore`; erros → lista vermelha, não salva. Válido →
```tsx
update(c => {
  const season = c.seasons[c.seasons.length - 1]
  const game: Game = {
    id: `game-${Date.now()}`, context, box,
    goals: c.nextGoals ?? [], goalsMet: [],
  }
  season.games.push(game)
  const newInstructions = processGame(c, c.seasons.length - 1, game)
  c.nextGoals = null
  c.lastResult = { gameId: game.id, instructions: newInstructions, goalsMet: game.goalsMet, goals: game.goals }
})
```
- Adicionar a `Career` em types.ts: `lastResult?: { gameId: string; instructions: Instruction[]; goalsMet: string[]; goals: Goal[] } | null`.
- Abaixo do form, se `career.lastResult`: card "Resultado" — metas cumpridas (verde) / falhas (cinza), instruções novas geradas ("+1 Mid-Range Shot", "Suba Deadeye para Prata"), link pro Painel.

- [ ] **Step 4: Verificar fluxo completo**

Run: `npm run dev` — gerar metas no pré-jogo, registrar um jogo bom no pós-jogo, conferir: metas avaliadas, instruções aparecem no resultado e no painel, XP das barras mudou. Registrar box score inválido (PTS errado) → erro em pt-BR, nada salvo. `npm run build` ok.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: pre-game goals and post-game box score entry with results"
```

---

### Task 16: Histórico

**Files:**
- Create/Replace: `src/ui/History.tsx`

**Interfaces:**
- Consumes: `useCareer`, `recalcCareer`, `estimateOverall`.
- Produces: rota `/history` completa.

- [ ] **Step 1: Implementar**

`src/ui/History.tsx`:
- Por temporada (mais recente primeiro): título "Temporada {year}" + médias (PPG, RPG, APG, FG%, 3P%, W-L).
- Tabela de jogos: data, adversário, casa/fora, W/L, linha do box (`25 pts 6 reb 7 ast`), metas cumpridas (`2/3`).
- Botão excluir por jogo: `window.confirm` → `update(c => { season.games.splice(i, 1); recalcCareer(c) })`.
- Gráfico de evolução do OVR: SVG polyline simples — a cada 10 jogos da carreira, recalcular OVR replay parcial é caro; em vez disso, armazenar snapshot: adicionar a `Game` o campo opcional `ovrAfter?: number`, preenchido em `processGame` (`game.ovrAfter = estimateOverall(...)` no fim). Plotar `ovrAfter` de todos os jogos:
```tsx
function OvrChart({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const min = Math.min(...points) - 2, max = Math.max(...points) + 2
  const coords = points.map((p, i) =>
    `${(i / (points.length - 1)) * 300},${100 - ((p - min) / (max - min)) * 100}`).join(' ')
  return (
    <svg viewBox="0 0 300 100" className="h-32 w-full">
      <polyline points={coords} fill="none" stroke="#f97316" strokeWidth="2" />
    </svg>
  )
}
```
- `processGame` (Task 10) ganha uma linha no fim: `game.ovrAfter = estimateOverall(values, career.player.position)` — adicionar `ovrAfter?: number` a `Game` em types.ts.

- [ ] **Step 2: Verificar**

Run: `npm run dev` — registrar 3+ jogos, conferir tabela, médias, gráfico; excluir um jogo → números recalculam. `npx vitest run` (recalc continua determinístico — `ovrAfter` é reescrito no replay). `npm run build` ok.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: history screen with season stats, game log and OVR chart"
```

---

### Task 17: Passe visual (claude-design) — executar na sessão principal

**Files:**
- Modify: `src/ui/*.tsx`, `src/index.css`

**Interfaces:**
- Consumes: telas funcionais das Tasks 13-16.
- Produces: visual final. Sem mudança de comportamento — nenhuma alteração em `src/engine/**`.

- [ ] **Step 1:** Na sessão principal (MCP claude-design disponível), usar claude-design para gerar direção visual das 5 telas (tema dark esportivo, cor de destaque laranja/basquete, tipografia condensada pra números).
- [ ] **Step 2:** Aplicar o design gerado nos componentes (somente classes/markup; lógica intacta).
- [ ] **Step 3:** `npx vitest run` + `npm run build` — tudo verde.
- [ ] **Step 4:** Commit: `git commit -m "style: visual pass on all screens"`

---

### Task 18: Deploy no Cloudflare Pages

**Files:**
- Nenhum novo (usa `dist/`).

**Interfaces:**
- Consumes: build final.
- Produces: site publicado em `*.pages.dev`.

- [ ] **Step 1: Build final**

Run: `npm run build`
Expected: `dist/` gerado sem erros.

- [ ] **Step 2: Deploy**

```bash
npx wrangler pages project create nba2k25-career --production-branch master
npx wrangler pages deploy dist --project-name nba2k25-career
```
(Primeiro comando só na primeira vez; `wrangler` pede login no browser se necessário.)

- [ ] **Step 3: Smoke test em produção**

Abrir a URL `*.pages.dev` retornada: criar jogador, registrar jogo, recarregar página (dados persistem), export JSON funciona.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: production deploy to Cloudflare Pages"
```

---

## Self-Review (executado na escrita do plano)

1. **Cobertura do spec:** criação livre + cadastro (T13), box score completo + contexto (T15), motor XP com categorias/multiplicadores/curva de idade aprovada (T4-T6), custo exponencial + alvo de calibração (T6, T12), 40 badges com tiers até Lenda + passivo + desafios (T7, T8), metas pré-jogo com anti-farm (T9, cap em T6), regressão 34+ (T10), recálculo determinístico p/ editar/excluir (T10, T16), localStorage + export/import (T11), 5 telas (T13-T16), claude-design (T17), Pages (T18), DNP (T9 streak + T15 checkbox), virada de temporada (T14). ✔
2. **Placeholders:** nenhum TBD; único código resumido é o Dashboard (estrutura das 7 seções + componente exemplo) e PostGame (campos + submit em código) — comportamento totalmente especificado. ✔
3. **Consistência de tipos:** `Career.nextGoals`/`lastResult`/`Game.ovrAfter` adicionados como opcionais nas tasks que os introduzem (T15, T16); demais assinaturas verificadas entre tasks. ✔
