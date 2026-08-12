# Balanceamento de Estilos de Jogo — Design

Data: 2026-08-12. Origem: usuário notou que estilos com 2 focos "gordos" (Slasher, Criador) rendem XP total bem maior que estilos de 1 foco (Maestro, Defensor).

## Problema

Categorias rendem XP bruto muito diferente (mid/inside/playmaking >> defense/ft). Com F=1.5/S=0.7 uniformes, o XP líquido por jogo varia de −2% (Poste) a +11% (Criador) vs Equilibrado — medido com box de referência. Além disso os cards do Criar Jogador só mostram os focos (×1.5), escondendo as penalidades (×0.7).

## Decisões (aprovadas)

- **Rebalancear**: ajustar catMults por estilo para XP líquido ≈ 0% (tolerância ±2.5%) contra box de referência do arquétipo. Identidade mantém (focos continuam sendo os mesmos); velocidade total iguala.
- **Mostrar penalidades** nos cards de estilo do Criar Jogador (chips dimmed).

## Método

Boxes de referência:
- **Guard** (SG): 30min, 18pts, 4reb, 4ast, 1stl, 0.5blk, 2tov, 7/15 FG, 2/6 3PT, 2/3 LL — estilos: sniper, slasher, maestro, defensor, criador.
- **Big** (C): 30min, 16pts, 9reb, 2ast, 0.5stl, 1.5blk, 2tov, 7/12 FG, 0/1 3PT, 2/4 LL — estilos: ancora, poste, transicao.

Métrica: `net = Σ categoryXp×mult / Σ categoryXp`, exigido `0.975 ≤ net ≤ 1.025`. Teste `styleBalance.test.ts` trava isso pra sempre.

## Novos catMults

| Estilo | Focos | Penalidades |
|---|---|---|
| sniper | three 1.5, ft 1.5 | inside .7, rebounding .7 (inalterado) |
| slasher | inside 1.5, physical 1.5 | three .7, **mid .7 (novo)** |
| maestro | playmaking 1.5 | rebounding .7, inside .7 (inalterado) |
| defensor | defense 1.5 | three .7 (inalterado) |
| ancora | defense 1.5, **rebounding 1.3** | **inside .8**, mid .7, playmaking .7, ft .7, three .7 |
| poste | **inside 1.25** | mid .7, playmaking .7, physical .7, three .7 |
| criador | **mid 1.4, playmaking 1.4** | inside .7, rebounding .7, defense .7, physical .7 |
| transicao | physical 1.5, **inside 1.2** | mid .7, playmaking .7, defense .7, ft .7 |

Focos de bigs em inside/rebounding caem abaixo de 1.5 porque essas categorias dominam o box de um pivô (inside ≈ 33% do XP) — 1.5 ali valia +14~17% líquido.

- `playStyles.test.ts`: regra "1.5 ou 0.7" vira "foco ∈ (1, 1.5], penalidade ∈ [0.7, 1)".
- Saves existentes: nada muda de estrutura; recalc reaplica os novos mults no replay (histórico re-pontuado — aceito, é o comportamento padrão do recalc).
- UI: chips de penalidade nos cards (cinza, "×0.7"), focos seguem laranja.
