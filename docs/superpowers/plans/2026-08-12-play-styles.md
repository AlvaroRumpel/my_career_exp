# Play Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estilos de jogo que enviesam a curva de evolução (categorias-foco ×1.5, lentas ×0.7, badges-foco ×1.5), escolhidos na criação e trocáveis a cada temporada, com replay determinístico por temporada.

**Architecture:** Novo módulo puro `src/engine/playStyles.ts` (catálogo + helpers). `applyGameXp`/`applyBadgeProgress` ganham parâmetro `styleId` (default `'balanced'` — retrocompatível). `processGame` deriva o estilo de `career.seasons[seasonIndex].playStyle`, então recálculo e caminho vivo ficam idênticos sem mudança no PostGame.

**Tech Stack:** o existente — Vite + React + TS + Tailwind v4 + Vitest. Sem dependências novas.

## Global Constraints

- Multiplicadores: foco ×1.5 | neutro ×1.0 | lento ×0.7 (categorias); badges-foco ×1.5, demais ×1.0 (sem penalidade).
- Estilo por temporada: `Season.playStyle?: string`; ausente = `'balanced'`. `Career.playStyle?: string` = estilo atual (UI + pré-preencher próxima temporada).
- 9 estilos com ids exatos: balanced, sniper, slasher, maestro, defensor, ancora, poste, criador, transicao (tabela do spec, 1 jogador de referência cada).
- Carreira/import antigo sem `playStyle` = comportamento atual inalterado; `calibration.test.ts` continua passando sem edição.
- Engine puro (sem React/localStorage); UI pt-BR; gates por task: `npx tsc -p tsconfig.app.json --noEmit` limpo (noUnusedLocals ON), `npx vitest run` verde, `npm run build` verde.
- Commits convencionais.

---

### Task 1: Catálogo de estilos (engine)

**Files:**
- Create: `src/engine/playStyles.ts`
- Test: `src/engine/playStyles.test.ts`

**Interfaces:**
- Consumes: `Category` de `./types`; ids de badges de `./badges` (validação em teste).
- Produces:
```ts
export interface PlayStyle {
  id: string; name: string; reference: string   // reference: 1 jogador, '' para balanced
  catMults: Partial<Record<Category, number>>    // só desvios de 1.0
  focusBadges: string[]                          // ids de badges ×1.5
}
export const PLAY_STYLES: PlayStyle[]            // 9 estilos, balanced primeiro
export function getStyle(id?: string | null): PlayStyle          // fallback balanced
export function styleCategoryMult(id: string | undefined, cat: Category): number
export function styleBadgeMult(id: string | undefined, badgeId: string): number
```

- [ ] **Step 1: Escrever teste**

`src/engine/playStyles.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { PLAY_STYLES, getStyle, styleCategoryMult, styleBadgeMult } from './playStyles'
import { BADGES } from './badges'

describe('play style catalog', () => {
  it('has 9 styles with unique ids, balanced first', () => {
    expect(PLAY_STYLES.length).toBe(9)
    expect(new Set(PLAY_STYLES.map(s => s.id)).size).toBe(9)
    expect(PLAY_STYLES[0].id).toBe('balanced')
  })
  it('balanced has no deviations', () => {
    const b = getStyle('balanced')
    expect(Object.keys(b.catMults).length).toBe(0)
    expect(b.focusBadges.length).toBe(0)
  })
  it('every catMult deviation is 1.5 or 0.7', () => {
    for (const s of PLAY_STYLES) {
      for (const v of Object.values(s.catMults)) expect([1.5, 0.7]).toContain(v)
    }
  })
  it('every focusBadge id exists in the badge catalog', () => {
    const ids = new Set(BADGES.map(b => b.id))
    for (const s of PLAY_STYLES) for (const fb of s.focusBadges) expect(ids.has(fb), `${s.id}:${fb}`).toBe(true)
  })
  it('every non-balanced style has a reference player', () => {
    for (const s of PLAY_STYLES.slice(1)) expect(s.reference.length).toBeGreaterThan(0)
  })
  it('helpers resolve mults with balanced fallback', () => {
    expect(styleCategoryMult('sniper', 'three')).toBe(1.5)
    expect(styleCategoryMult('sniper', 'inside')).toBe(0.7)
    expect(styleCategoryMult('sniper', 'defense')).toBe(1.0)
    expect(styleCategoryMult(undefined, 'three')).toBe(1.0)
    expect(styleCategoryMult('unknown-id', 'three')).toBe(1.0)
    expect(styleBadgeMult('sniper', 'deadeye')).toBe(1.5)
    expect(styleBadgeMult('sniper', 'dimer')).toBe(1.0)
    expect(styleBadgeMult(undefined, 'deadeye')).toBe(1.0)
  })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/engine/playStyles.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`src/engine/playStyles.ts`:
```ts
import type { Category } from './types'

export interface PlayStyle {
  id: string; name: string; reference: string
  catMults: Partial<Record<Category, number>>
  focusBadges: string[]
}

const F = 1.5, S = 0.7

export const PLAY_STYLES: PlayStyle[] = [
  { id: 'balanced', name: 'Equilibrado', reference: '', catMults: {}, focusBadges: [] },
  { id: 'sniper', name: 'Sniper', reference: 'Stephen Curry',
    catMults: { three: F, ft: F, inside: S, rebounding: S },
    focusBadges: ['deadeye', 'limitless-range', 'set-shot-specialist', 'mini-marksman'] },
  { id: 'slasher', name: 'Slasher', reference: 'Ja Morant',
    catMults: { inside: F, physical: F, three: S },
    focusBadges: ['posterizer', 'physical-finisher', 'layup-mixmaster', 'aerial-wizard'] },
  { id: 'maestro', name: 'Maestro', reference: 'Chris Paul',
    catMults: { playmaking: F, rebounding: S, inside: S },
    focusBadges: ['dimer', 'versatile-visionary', 'bail-out', 'unpluckable'] },
  { id: 'defensor', name: 'Defensor de Elite', reference: 'Kawhi Leonard',
    catMults: { defense: F, three: S },
    focusBadges: ['glove', 'on-ball-menace', 'challenger', 'interceptor', 'pick-dodger'] },
  { id: 'ancora', name: 'Âncora do Garrafão', reference: 'Rudy Gobert',
    catMults: { defense: F, rebounding: F, three: S, playmaking: S },
    focusBadges: ['paint-patroller', 'boxout-beast', 'rebound-chaser', 'immovable-enforcer', 'pogo-stick'] },
  { id: 'poste', name: 'Gigante do Poste', reference: 'Joel Embiid',
    catMults: { inside: F, three: S, playmaking: S },
    focusBadges: ['post-powerhouse', 'hook-specialist', 'post-fade-phenom', 'paint-prodigy', 'post-up-poet'] },
  { id: 'criador', name: 'Criador de Jogadas', reference: 'Kevin Durant',
    catMults: { mid: F, playmaking: F, inside: S, rebounding: S },
    focusBadges: ['shifty-shooter', 'ankle-assassin', 'strong-handle', 'handles-for-days'] },
  { id: 'transicao', name: 'Motor de Transição', reference: 'Giannis Antetokounmpo',
    catMults: { physical: F, inside: F, mid: S },
    focusBadges: ['lightning-launch', 'break-starter', 'aerial-wizard', 'posterizer', 'rise-up'] },
]

const byId = new Map(PLAY_STYLES.map(s => [s.id, s]))

export function getStyle(id?: string | null): PlayStyle {
  return (id && byId.get(id)) || PLAY_STYLES[0]
}

export function styleCategoryMult(id: string | undefined, cat: Category): number {
  return getStyle(id).catMults[cat] ?? 1.0
}

export function styleBadgeMult(id: string | undefined, badgeId: string): number {
  return getStyle(id).focusBadges.includes(badgeId) ? 1.5 : 1.0
}
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run src/engine/playStyles.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Gates + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit` e `npx vitest run` — tudo verde.
```bash
git add src/engine/playStyles.ts src/engine/playStyles.test.ts
git commit -m "feat: play style catalog with category and badge multipliers"
```

---

### Task 2: Threading do estilo no motor

**Files:**
- Modify: `src/engine/types.ts` (Season.playStyle, Career.playStyle)
- Modify: `src/engine/progression.ts` (applyGameXp ganha styleId)
- Modify: `src/engine/badges.ts` (applyBadgeProgress ganha styleId)
- Modify: `src/engine/recalc.ts` (processGame deriva estilo da temporada)
- Test: `src/engine/styleIntegration.test.ts`

**Interfaces:**
- Consumes: `styleCategoryMult`, `styleBadgeMult` de `./playStyles` (Task 1).
- Produces (assinaturas novas — retrocompatíveis por default):
```ts
// progression.ts — último parâmetro novo, default 'balanced'
export function applyGameXp(
  career: Career, box: BoxScore, ctx: GameContext, age: number,
  goalBonus: Partial<Record<Category, number>>, gameId: string,
  styleId: string = 'balanced',
): GameXpResult
// badges.ts — idem
export function applyBadgeProgress(
  badges: Record<string, BadgeState>, box: BoxScore, ctx: GameContext,
  position: Position, gameId: string, styleId: string = 'balanced',
): Instruction[]
// types.ts
interface Season { year: number; games: Game[]; playStyle?: string }
interface Career { ...; playStyle?: string }
// recalc.ts processGame: assinatura INALTERADA — deriva internamente:
//   const styleId = career.seasons[seasonIndex].playStyle ?? 'balanced'
```

- [ ] **Step 1: Escrever teste**

`src/engine/styleIntegration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { applyGameXp } from './progression'
import { applyBadgeProgress } from './badges'
import { processGame, recalcCareer } from './recalc'
import { DEFAULT_CONFIG } from './types'
import { ATTRIBUTES } from './attributes'
import { BADGES } from './badges'
import type { BoxScore, Career, Game, GameContext, BadgeState } from './types'

const ctx: GameContext = { opponent: 'LAL', home: true, playoffs: false, win: false, date: '2026-01-01' }
const box: BoxScore = { min: 34, pts: 27, reb: 6, ast: 6, stl: 2, blk: 1, tov: 2, fgm: 9, fga: 17, tpm: 5, tpa: 9, ftm: 4, fta: 5, plusMinus: 6 }

function makeCareer(playStyle?: string): Career {
  const attributes: Career['attributes'] = {}
  for (const a of ATTRIBUTES) attributes[a.id] = { value: 70, xp: 0 }
  const initialAttributes: Record<string, number> = {}
  for (const a of ATTRIBUTES) initialAttributes[a.id] = 70
  const initialBadges: Record<string, number> = {}
  for (const b of BADGES) initialBadges[b.id] = 0
  return {
    player: { name: 'T', position: 'SG', heightCm: 196, team: 'BOS', startAge: 22 },
    initialAttributes, initialBadges, attributes, badges: {}, activeChallenges: [],
    seasons: [{ year: 2026, games: [], playStyle }],
    pendingInstructions: [], appliedInstructionIds: [], config: DEFAULT_CONFIG,
    targetOverrides: {}, playStyle,
  }
}

describe('style multipliers in applyGameXp', () => {
  it('focus category earns 1.5x, slow 0.7x, neutral 1.0x vs balanced', () => {
    const base = applyGameXp(makeCareer(), box, ctx, 22, {}, 'g1', 'balanced')
    const sniper = applyGameXp(makeCareer(), box, ctx, 22, {}, 'g1', 'sniper')
    expect(sniper.xpByCategory.three).toBeCloseTo(base.xpByCategory.three * 1.5, 5)
    expect(sniper.xpByCategory.inside).toBeCloseTo(base.xpByCategory.inside * 0.7, 5)
    expect(sniper.xpByCategory.defense).toBeCloseTo(base.xpByCategory.defense, 5)
  })
  it('omitting styleId behaves as balanced (backward compat)', () => {
    const implicit = applyGameXp(makeCareer(), box, ctx, 22, {}, 'g1')
    const explicit = applyGameXp(makeCareer(), box, ctx, 22, {}, 'g1', 'balanced')
    expect(implicit.xpByCategory).toEqual(explicit.xpByCategory)
  })
})

describe('style multipliers in applyBadgeProgress', () => {
  it('focus badge progresses 1.5x', () => {
    const mk = () => Object.fromEntries(BADGES.map(b => [b.id, { progress: 0 }])) as Record<string, BadgeState>
    const base = mk(); const sniper = mk()
    applyBadgeProgress(base, box, ctx, 'SG', 'g1', 'balanced')
    applyBadgeProgress(sniper, box, ctx, 'SG', 'g1', 'sniper')
    expect(sniper['deadeye'].progress).toBeCloseTo(base['deadeye'].progress * 1.5, 5)
    expect(sniper['dimer'].progress).toBeCloseTo(base['dimer'].progress, 5)
  })
})

describe('processGame derives style from the season', () => {
  const game = (i: number): Game => ({
    id: `g${i}`, context: ctx, box, goals: [], goalsMet: [],
  })
  it('season with sniper style boosts three XP vs balanced season', () => {
    const cSniper = makeCareer('sniper'); const cBase = makeCareer()
    const g1 = game(1); const g2 = game(2)
    cSniper.seasons[0].games.push(g1); cBase.seasons[0].games.push(g2)
    processGame(cSniper, 0, g1, 0); processGame(cBase, 0, g2, 0)
    const sum = (c: Career) => Object.values(c.attributes).reduce((s, a) => s + a.xp + (a.value - 70) * 100, 0)
    expect(sum(cSniper)).not.toBe(sum(cBase))
    expect(cSniper.badges['deadeye'].progress).toBeGreaterThan(cBase.badges['deadeye'].progress)
  })
  it('replay with style switch across seasons is deterministic', () => {
    const c = makeCareer('sniper')
    for (let i = 0; i < 6; i++) { const g = game(i); c.seasons[0].games.push(g); processGame(c, 0, g, i) }
    c.seasons.push({ year: 2027, games: [], playStyle: 'ancora' })
    for (let i = 6; i < 12; i++) { const g = game(i); c.seasons[1].games.push(g); processGame(c, 1, g, i) }
    const attrs = JSON.stringify(c.attributes); const badges = JSON.stringify(c.badges)
    recalcCareer(c)
    expect(JSON.stringify(c.attributes)).toBe(attrs)
    expect(JSON.stringify(c.badges)).toBe(badges)
  })
})
```

Nota: o teste de replay ignora as instruções de regressão da temporada 2 (idade 23, sem regressão) — compara só attributes/badges, como os testes existentes.

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/engine/styleIntegration.test.ts`
Expected: FAIL (styleId não existe nas assinaturas).

- [ ] **Step 3: Implementar**

`src/engine/types.ts`: adicionar `playStyle?: string` em `Season` e em `Career`.

`src/engine/progression.ts`:
- Import: `import { styleCategoryMult } from './playStyles'`
- Assinatura: acrescentar `styleId: string = 'balanced'` como último parâmetro.
- Na linha `const gameXp = raw[cat] * mult` → `const gameXp = raw[cat] * mult * styleCategoryMult(styleId, cat)`.

`src/engine/badges.ts`:
- Import: `import { styleBadgeMult } from './playStyles'` (atenção a import circular: playStyles NÃO importa badges — só o teste importa ambos; ok).
- Assinatura: acrescentar `styleId: string = 'balanced'`.
- Na linha `state.progress += def.units(box, ctx, position)` → `state.progress += def.units(box, ctx, position) * styleBadgeMult(styleId, def.id)`.

`src/engine/recalc.ts` — em `processGame`, antes das chamadas:
```ts
const styleId = career.seasons[seasonIndex].playStyle ?? 'balanced'
```
e passar `styleId` como último argumento de `applyGameXp(...)` e `applyBadgeProgress(...)`. Assinatura de `processGame` inalterada.

- [ ] **Step 4: Rodar suíte inteira — deve passar**

Run: `npx vitest run`
Expected: todos os testes verdes (66+), incluindo `calibration.test.ts` sem edição (usa balanced por default).

- [ ] **Step 5: Gates + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit` limpo, `npm run build` verde.
```bash
git add src/engine
git commit -m "feat: thread play style multipliers through XP and badge progress"
```

---

### Task 3: UI — escolha e troca de estilo

**Files:**
- Modify: `src/ui/CreatePlayer.tsx` (select de estilo na criação)
- Modify: `src/ui/Dashboard.tsx` (estilo atual no cabeçalho; troca na nova temporada)

**Interfaces:**
- Consumes: `PLAY_STYLES`, `getStyle` de `../engine/playStyles`; `useCareer` de `./CareerContext`.
- Produces: `career.playStyle` e `Season.playStyle` gravados; sem API nova.

- [ ] **Step 1: CreatePlayer**

Em `src/ui/CreatePlayer.tsx`:
- Import: `import { PLAY_STYLES } from '../engine/playStyles'`
- Estado novo: `const [playStyle, setPlayStyle] = useState('balanced')`
- No grid de dados básicos, adicionar (após "Ano da temporada"):
```tsx
<label className="flex flex-col text-sm">Estilo de jogo
  <select className="input" value={playStyle} onChange={e => setPlayStyle(e.target.value)}>
    {PLAY_STYLES.map(s => (
      <option key={s.id} value={s.id}>{s.reference ? `${s.name} — ${s.reference}` : s.name}</option>
    ))}
  </select></label>
```
- Em `submit()`: `seasons: [{ year, games: [], playStyle }]` e `playStyle` no objeto `Career` (campo top-level).

- [ ] **Step 2: Dashboard**

Em `src/ui/Dashboard.tsx`:
- Import: `import { PLAY_STYLES, getStyle } from '../engine/playStyles'`
- Cabeçalho: junto de posição/time/idade, exibir `Estilo: {getStyle(career.playStyle).name}`.
- Estado novo: `const [nextStyle, setNextStyle] = useState<string | null>(null)` — na seção Gestão, ao lado do botão "Nova temporada", select:
```tsx
<select className="input" value={nextStyle ?? (career.playStyle ?? 'balanced')}
  onChange={e => setNextStyle(e.target.value)} title="Estilo da próxima temporada">
  {PLAY_STYLES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
</select>
```
- `newSeason()`: dentro do `update`, além do que já faz:
```ts
const style = nextStyle ?? c.playStyle ?? 'balanced'
c.seasons[c.seasons.length - 1].playStyle = style   // após o push, o último é a temporada nova
c.playStyle = style
```
(confirm text: `Iniciar nova temporada com estilo ${getStyle(nextStyle ?? career.playStyle).name}?`)

- [ ] **Step 3: Gates**

Run: `npx tsc -p tsconfig.app.json --noEmit` limpo; `npx vitest run` verde; `npm run build` verde.

- [ ] **Step 4: Smoke manual (browser)**

`npm run dev`: criar jogador com estilo Sniper → Painel mostra "Estilo: Sniper"; registrar jogo com 5+ bolas de 3 → XP de Três visivelmente maior; Nova temporada trocando pra Âncora → cabeçalho atualiza; excluir um jogo → recálculo mantém números coerentes. (Executor pode usar Playwright do webapp-testing ou reportar smoke pendente pro controller.)

- [ ] **Step 5: Commit**

```bash
git add src/ui
git commit -m "feat: play style selection on create and season rollover"
```

---

### Task 4: Deploy

**Files:** nenhum novo.

- [ ] **Step 1:** `npm run build` — verde.
- [ ] **Step 2:** `npx wrangler pages deploy dist --project-name nba2k25-career --branch master`
- [ ] **Step 3:** Smoke em produção: criar/verificar select de estilo na tela de criação.

---

## Self-Review (executado na escrita do plano)

1. **Cobertura do spec:** catálogo 9 estilos com referência única (T1), multiplicadores 1.5/1.0/0.7 categorias + badges 1.5 sem penalidade (T1, T2), estilo por temporada + replay determinístico com troca (T2), retrocompat balanced/import antigo (T2 teste), calibração intacta (T2 Step 4), UI criação + cabeçalho + troca na nova temporada com 1 jogador de referência (T3), deploy (T4). ✔
2. **Placeholders:** nenhum. ✔
3. **Consistência de tipos:** styleId último parâmetro com default em applyGameXp/applyBadgeProgress; processGame inalterado; ids dos estilos idênticos entre T1/T2/T3; focusBadges validados contra BADGES por teste. ✔
