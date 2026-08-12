# Balanceamento de Estilos de Jogo — Design

Data: 2026-08-12. Origem: usuário notou que estilos com 2 focos "gordos" (Slasher, Criador) rendem XP total bem maior que estilos de 1 foco (Maestro, Defensor).

## Problema

Categorias rendem XP bruto muito diferente (mid/inside/playmaking >> defense/ft). Com F=1.5/S=0.7 uniformes, o XP líquido por jogo varia de −2% (Poste) a +11% (Criador) vs Equilibrado — medido com box de referência. Além disso os cards do Criar Jogador só mostram os focos (×1.5), escondendo as penalidades (×0.7).

## Decisões (aprovadas)

- **Equalizar POR CIMA** (revisão do usuário: "não nerfar os bons, buffar os ruins"): todo estilo não-equilibrado rende **+8% a +18%** de XP líquido sobre o Equilibrado. Estilos fortes mantêm os mults originais; fracos foram buffados (sniper three 1.7, maestro play 1.7, defensor def 1.8 + mid 1.2, slasher three .8, penalidades suavizadas pra .9). Equilibrado segue 1.0 — é a base neutra sem foco.
- Efeito colateral aceito: carreira com estilo progride ~+9-17% acima da calibração (+4~6 OVR/temporada era com Equilibrado).
- **Mostrar penalidades** nos cards de estilo do Criar Jogador (chips dimmed).

## Método

Boxes de referência:
- **Guard** (SG): 30min, 18pts, 4reb, 4ast, 1stl, 0.5blk, 2tov, 7/15 FG, 2/6 3PT, 2/3 LL — estilos: sniper, slasher, maestro, defensor, criador.
- **Big** (C): 30min, 16pts, 9reb, 2ast, 0.5stl, 1.5blk, 2tov, 7/12 FG, 0/1 3PT, 2/4 LL — estilos: ancora, poste, transicao.

Métrica: `net = Σ categoryXp×mult / Σ categoryXp`, exigido `1.08 ≤ net ≤ 1.18` para estilos e `net == 1` para o Equilibrado. Teste `styleBalance.test.ts` trava isso pra sempre.

## catMults finais (equalizado por cima)

| Estilo | Focos | Penalidades | net |
|---|---|---|---|
| sniper | **three 1.7**, ft 1.5 | inside .9, rebounding .9 | +9.5% |
| slasher | inside 1.5, physical 1.5 | **three .8** | +8.9% |
| maestro | **playmaking 1.7** | rebounding .9, inside .9 | +9.3% |
| defensor | **defense 1.8, mid 1.2** | three .9 | +9.1% |
| ancora | defense 1.5, rebounding 1.5 | three .7, playmaking .7 (original) | +15.8% |
| poste | inside 1.5 | three .7, playmaking .7 (original) | +13.9% |
| criador | mid 1.5, playmaking 1.5 | inside .7, rebounding .7 (original) | +10.7% |
| transicao | physical 1.5, inside 1.5 | mid .7 (original) | +17.4% |

Defensor ganhou mid 1.2 (Kawhi mid-range) porque defense rende pouco XP bruto — só subir defense não alcança a faixa.

- `playStyles.test.ts`: regra "1.5 ou 0.7" vira "foco ∈ (1, 1.5], penalidade ∈ [0.7, 1)".
- Saves existentes: nada muda de estrutura; recalc reaplica os novos mults no replay (histórico re-pontuado — aceito, é o comportamento padrão do recalc).
- UI: chips de penalidade nos cards (cinza, "×0.7"), focos seguem laranja.
