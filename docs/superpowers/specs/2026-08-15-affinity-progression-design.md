# Afinidade de progressão: estilo × posição × altura

**Data:** 2026-08-15
**Status:** aprovado em conversa, aguardando implementação

## Problema

Hoje o XP de uma categoria cai inteiro no atributo de menor valor (`pickTarget`),
então só um atributo por categoria "anda" por vez e o painel parece travado.
Badges de posição oposta ficam presas no `trickle` (0.05/jogo) por gates duros
`big()`/`guard()` dentro de `units`. Altura é gravada e nunca usada.

## Decisões (Q&A da conversa)

1. **Distribuição**: XP da categoria é espalhado entre todos os atributos da categoria,
   proporcional a um peso de afinidade por atributo. (Não mais "mais fraco primeiro".)
2. **Combinação de eixos**: soma de deslocamentos + clamp.
   `peso = clamp(1 + estilo + posição + altura, 0.25, 2.5)`
   - estilo: buff +0.5 / contra −0.5
   - posição: buff +0.35 / contra −0.35
   - altura: buff +0.25 / contra −0.25
   - normal: 0
3. **Definição das tags**: por categoria como padrão + exceções por atributo (C).
   Altura é **relativa à posição** (faixa short/mid/tall por posição).
4. **Badges**: mesma fórmula. Tag padrão vem do `group` da badge; `focusBadges` = buff,
   nova lista `contraBadges` = contra. Gates `big()`/`guard()` saem do `units` e viram
   peso (posição/altura tagueiam por group).
5. **Escopo do peso**: **só divisão** dentro da categoria (normalizado). XP total por
   categoria não muda — `catMults` do estilo e a calibração de `styleBalance.test.ts`
   ficam intactos. Para badges o peso multiplica `units` direto (badge é unidade
   independente; substitui o ×1.5 atual de `styleBadgeMult`).
6. **UI**: chip `×w` ao lado de cada atributo e badge no Dashboard, cor por faixa
   (>1 verde/laranja, <1 cinza/vermelho).

## Fora de escopo

- Peso afetando XP total (opção B da Q5) — evoluir depois se afinidade parecer fraca.
- UI de `targetOverrides`. Campo fica no tipo (compat de save) mas passa a ser ignorado.

## Design

### `src/engine/affinity.ts` (novo)

```ts
export type Tag = 'buff' | 'normal' | 'contra'
export type HeightBand = 'short' | 'mid' | 'tall'

interface AxisAffinity {
  buffCats?: Category[]; contraCats?: Category[]
  attrOverrides?: Record<string, Tag>        // por attrId
  badgeOverrides?: Record<string, Tag>       // por badgeId (usa group como fallback)
}

export const POSITION_AFFINITY: Record<Position, AxisAffinity>
export const HEIGHT_BANDS: Record<Position, { short: number; tall: number }> // cm: <short → short, >tall → tall
export const HEIGHT_AFFINITY: Record<HeightBand, AxisAffinity>

export function heightBand(pos: Position, cm: number): HeightBand
export function attrWeight(attrId: string, styleId: string, pos: Position, cm: number): number
export function badgeWeight(badgeId: string, styleId: string, pos: Position, cm: number): number
```

Estilo (`PlayStyle`) ganha:
- `attrOverrides?: Record<string, Tag>` — exceções (ex.: Slasher: `postHook/postFade/postControl: 'contra'`).
- `contraBadges: string[]`.
- Tag padrão de atributo por estilo: `catMults[cat] > 1 → buff`, `< 1 → contra`, ausente → normal.
- Tag padrão de badge por estilo: `focusBadges` → buff, `contraBadges` → contra, senão tag da categoria correspondente ao `group` (`outside` → `three`; `general` → normal).

Tabelas iniciais (calibração é do dono do jogo; começar plausível, ajustar depois):

**POSITION_AFFINITY**
| Pos | buffCats | contraCats | attrOverrides |
|---|---|---|---|
| PG | playmaking, three | inside, rebounding | `steal: buff`, `perimeterD: buff`, `block: contra`, `interiorD: contra`, `midRange: buff` |
| SG | three, mid | rebounding, inside | `perimeterD: buff`, `block: contra`, `layup: normal`, `drivingDunk: normal` |
| SF | mid, physical | — | `postHook: contra`, `standingDunk: contra` |
| PF | inside, rebounding | three, playmaking | `midRange: normal`, `passIQ: normal` |
| C | inside, rebounding, defense | three, playmaking | `perimeterD: contra`, `steal: contra`, `interiorD: buff`, `block: buff` |

Badges por posição: usa `group` → categoria (`inside`→inside, `outside`→three, `playmaking`, `defense`, `rebounding`, `general`→normal) + `badgeOverrides` para casos como `on-ball-menace: buff` em PG/SG, `paint-patroller: buff` em PF/C, `post-lockdown: contra` em PG/SG.

**HEIGHT_BANDS** (cm)
| Pos | short (<) | tall (>) |
|---|---|---|
| PG | 185 | 195 |
| SG | 190 | 200 |
| SF | 196 | 206 |
| PF | 201 | 211 |
| C | 206 | 216 |

**HEIGHT_AFFINITY**
| Band | buff | contra |
|---|---|---|
| short | `speed, agility, ballHandle, speedWithBall, perimeterD, steal` | `standingDunk, postHook, postFade, postControl, block, interiorD, offRebound, defRebound` |
| mid | — | — |
| tall | inverso de short | inverso de short |

Badges por altura: short buff `shifty-shooter, ankle-assassin, handles-for-days, lightning-launch, on-ball-menace, pick-dodger, slippery-off-ball`; contra `post-*, hook-specialist, paint-prodigy, rise-up, paint-patroller, post-lockdown, boxout-beast, rebound-chaser, brick-wall, immovable-enforcer, pogo-stick`. Tall = inverso.

Peso final: `clamp(1 + s + p + h, 0.25, 2.5)`.

### `src/engine/progression.ts`

`applyGameXp`: para cada categoria com `total > 0`:
1. `defs = attributesByCategory(cat).filter(v < 99)`; se vazio, pula.
2. `w_i = attrWeight(id, styleId, pos, cm)`; `share_i = total × w_i / Σw`.
3. `attr.xp += share_i`; enquanto `attr.xp >= upgradeCost(attr.value)` e `value < 99`: desconta, `value += 1`, emite instrução `+1`.

`pickTarget` removido. `upgradeCost` mantido. Assinatura ganha `heightCm` (ou recebe `career.player` inteiro — já recebe `career`, então lê de lá).

### `src/engine/badges.ts`

- Remove helpers `big`, `guard` do `units`; onde eles eram condição composta (`played(b) && big(p)`), fica só `played(b)`. Onde eram gate de stat (`big(p) && twoPm(b) >= 5`), fica só a stat.
- `applyBadgeProgress` recebe `heightCm`; `state.progress += units × badgeWeight(...)`.
- `styleBadgeMult` removido de `playStyles.ts`.
- `trickle` mantido (é o piso universal); pode virar `0.05 × peso` naturalmente.

### `src/engine/recalc.ts`

Passa `career.player.heightCm` para `applyBadgeProgress`. `applyGameXp` já recebe `career`.

### UI (`Dashboard.tsx`)

Ao lado do valor de cada atributo e do tier de cada badge: chip `×{w.toFixed(2)}` (ou `×2.1` com 1 casa quando ≥1). Classe por faixa: `w >= 1.5` forte, `> 1` leve, `== 1` oculto ou neutro, `< 1` fraco. Estilo da temporada atual.

### Compat de save

Replay determinístico (`recalcCareer`) já reconstrói tudo do snapshot inicial → saves existentes recalculam sob regra nova ao carregar. `targetOverrides` continua no JSON, ignorado.

## Testes

- `affinity.test.ts`: `heightBand` limites; `attrWeight` para os 5 casos da conversa (PG 185 Sniper→threePoint = 2.1; PG 185 Sniper→postHook = 0.25; PG 196 Slasher→standingDunk = 1.15; C 213 Sniper→threePoint = 0.9; C 213 Poste→postHook = 2.1); clamp em ambos os extremos; `badgeWeight` focus/contra/group fallback.
- `progression.test.ts`: soma das fatias = total da categoria; atributo 99 recebe 0; múltiplos +1 num jogo grande; ordem de instruções determinística.
- `badges.test.ts`: PG progride badge de big com peso <1 mas >0; C progride Post Lockdown com peso >1; `styleBadgeMult` não existe mais.
- `styleBalance.test.ts` / `styleIntegration.test.ts`: continuam verdes (total por categoria intocado). Se `styleIntegration` assume alvo único, ajustar asserção para soma na categoria.
- `recalc.test.ts`: replay de save real (fixture) não lança e produz valores ≥ iniciais.
