# Off-season: progressão entre temporadas

**Data:** 2026-08-15
**Status:** aprovado em conversa, aguardando implementação

## Problema

"Nova temporada" hoje só cria a season vazia, aplica regressão física (34+) e troca o
estilo. Não há ganho de off-season — o 2K real dá progressão de verão (treino, potencial,
idade). O usuário quer congelar a progressão automática do 2K (Potential = OVR no editor)
e seguir só o site, então o site precisa de um evento de off-season.

## Decisões (Q&A da conversa)

1. **Fonte do pacote**: mescla A+B+C —
   `total = offseasonBase × ageMult(idade da temporada fechada) + offseasonShare × Σ XP da temporada`.
2. **Focos**: 1 primário (35% do pacote) + 1 secundário (15%). Restante 50% espalhado
   igualmente pelas 8 categorias. Qualquer categoria pode ser foco (afinidade já pune).
3. **Retroativo**: não. Temporadas já viradas sem `offseason` não ganham nada.
4. **Onde**: painel de Off-season no Dashboard substitui o `confirm` de "Nova temporada".
   Registro em `Season.offseason` da temporada **fechada**; `recalcCareer` reaplica no replay.
5. Regressão física (34+) continua no mesmo evento, **depois** do pacote.

## Fora de escopo

- Retroativo para temporadas já viradas.
- Bloquear foco por afinidade contrária.
- Editar/desfazer um off-season já fechado.
- Lembrete de "Potential = OVR" é texto na UI, não lógica.

## Design

### Tipos (`types.ts`)

```ts
export interface OffseasonChoice { primary: Category; secondary: Category }
export interface Season { year: number; games: Game[]; playStyle?: string; offseason?: OffseasonChoice }
export interface EngineConfig { ...; offseasonBase: number; offseasonShare: number }
```

`DEFAULT_CONFIG`: `offseasonBase: 450` (≈ 10 jogos médios de XP bruto; recalibrar via
`calibration.test.ts`), `offseasonShare: 0.20`.

Saves antigos sem `offseasonBase`/`offseasonShare` em `config`: `loadCareer`/uso faz
`{ ...DEFAULT_CONFIG, ...career.config }` — verificar onde `config` é lido; se não houver
merge central, adicionar em `storage.loadCareer`.

### `progression.ts` — extrair distribuição

```ts
export function distributeCategoryXp(
  career: Career, cat: Category, xp: number, styleId: string, idPrefix: string, counter: { n: number },
): Instruction[]
```
Corpo = o `defs.forEach` atual de `applyGameXp` (peso `attrWeight`, normalizado, loop de +1,
reset em 99). `applyGameXp` passa a chamá-la. Ids `${idPrefix}-${counter.n++}`.

### `offseason.ts` (novo)

```ts
export const OFFSEASON_SPREAD = 0.5, OFFSEASON_PRIMARY = 0.35, OFFSEASON_SECONDARY = 0.15
export const OFFSEASON_BADGE_GAMES = 3 // empurrão ≈ 3 jogos de proxy+trickle

export function offseasonTotal(cfg: EngineConfig, age: number, seasonXp: number): number
  // cfg.offseasonBase * ageMultiplier(age, cfg) + cfg.offseasonShare * seasonXp

export function applyOffseason(
  career: Career, seasonIndex: number, seasonXpByCategory: Record<Category, number>,
): Instruction[]
```
`applyOffseason`:
- `season = career.seasons[seasonIndex]`; se `!season.offseason` → `[]`.
- `age = ageAt(career, seasonIndex)`; `styleId = season.playStyle ?? 'balanced'`.
- `total = offseasonTotal(cfg, age, Σ seasonXpByCategory)`.
- Por categoria: `xp = total × 0.5 / 8 + (cat === primary ? total × 0.35 : 0) + (cat === secondary ? total × 0.15 : 0)`.
  Se `primary === secondary` (defensivo), secundário conta como 0 e primário recebe 0.5.
- `distributeCategoryXp(career, cat, xp, styleId, \`offseason-${season.year}\`, counter)` — texto das instruções
  prefixado "Off-season {year}: " (passar prefixo de texto ou pós-processar `text`).
- Badges: para cada badge, `progress += OFFSEASON_BADGE_GAMES × 0.55 × badgeWeight(id, group, styleId, pos, cm)`;
  tier-up gera instrução `offseason-${year}-badge-${n}` "Off-season {year}: Suba X para Y no 2K".
- Retorna instruções (atributo primeiro, badges depois).

### `recalc.ts`

- `processGame` retorna também `xpByCategory` (ou aceita acumulador). Menor mudança:
  `processGame(...)` continua retornando `Instruction[]`; adicionar campo opcional
  `seasonXp?: Record<Category, number>` no 4º parâmetro? Melhor: novo retorno
  `{ instructions, xpByCategory }` **só** para uso interno — mas `processGame` é usado em
  testes/UI? Verificar callers; se só `recalc.ts` + testes, mudar retorno para objeto e ajustar
  callers.
- `recalcCareer`: por temporada, acumula `seasonXp` somando `xpByCategory` de cada jogo. Ao
  entrar em `si > 0`: **primeiro** `applyOffseason(career, si-1, seasonXp[si-1])`, **depois**
  `regressionInstructions(career, si)`. Ambos em `pendingInstructions`.
- Filtro por `appliedInstructionIds` já existente cobre as novas ids.

### UI (`Dashboard.tsx`)

Painel "Off-season" (aparece onde hoje fica o botão "Nova temporada"):
1. Resumo da temporada atual: jogos com box, W–L, OVR Δ (`seasonOvrDelta`), XP total
   (soma de `gameXpBreakdown(...).total` dos jogos — helper já existe em `derive.ts`).
2. Selects: foco primário (8 categorias, `CATEGORY_LABELS`), foco secundário (≠ primário —
   se igual, desabilita botão), estilo da próxima temporada (select já existe).
3. Preview: "Pacote estimado ≈ N XP" via `offseasonTotal(cfg, idade, xpTotal)`.
4. Botão "Fechar temporada" (habilitado se ≥1 jogo com `box.min > 0`; senão vira "Nova
   temporada" sem pacote, comportamento atual):
   ```ts
   update(c => {
     const last = c.seasons[c.seasons.length - 1]
     if (hasGames) last.offseason = { primary, secondary }
     c.seasons.push({ year: last.year + 1, games: [], playStyle: style })
     c.playStyle = style; c.nextGoals = null; c.pendingContext = null; c.lastResult = null
     recalcCareer(c)   // reaplica tudo; offseason + regressão entram em pendingInstructions
   })
   ```
5. Banner sob a lista de instruções pendentes quando houver ids `offseason-*`:
   "Aplique no editor de roster do 2K e ajuste **Potential = OVR** para o 2K não progredir sozinho."

Substitui o `confirm` atual por confirmação inline (botão duplo ou `confirm` com resumo do
pacote — manter `window.confirm` com texto "Fechar {year}: foco X + Y, ≈ N XP. Continuar?").

### Compat

- `recalcCareer` em saves sem `offseason` em nenhuma season → comportamento idêntico ao atual.
- `config` antigo sem campos novos → merge com `DEFAULT_CONFIG` no load.

## Testes

- `offseason.test.ts`:
  - `offseasonTotal`: 20 anos > 30 anos > 37 anos (mesmo seasonXp); seasonXp 0 → só base.
  - `applyOffseason` sem `offseason` → `[]`, sem mutação.
  - Split: soma de XP entregue por categoria = total (±1e-6); primária recebe `0.35 + 0.5/8`,
    secundária `0.15 + 0.5/8`, demais `0.5/8`.
  - Foco `three` faz `threePoint` ganhar mais XP que foco `defense` no mesmo career.
  - Badges: toda badge sobe > 0; ids únicas e prefixadas `offseason-{year}`.
- `progression.test.ts`: `distributeCategoryXp` extraída — os testes de distribuição existentes
  continuam passando via `applyGameXp`.
- `recalc.test.ts`:
  - Season 0 com `offseason` + season 1 vazia → `pendingInstructions` contém `offseason-*`
    antes de `regress-*` (quando idade 34+); replay duas vezes → estado idêntico.
  - Season 0 sem `offseason` → nenhuma id `offseason-*`.
- `calibration.test.ts`: rookie 82 jogos + off-season (foco three/mid) → ganho extra de +1 a +2
  OVR sobre a temporada; 37 anos → +0 a +1.
- Fixture `pg-save.json`: adicionar `offseason` na season e asserir que instruções aparecem.
