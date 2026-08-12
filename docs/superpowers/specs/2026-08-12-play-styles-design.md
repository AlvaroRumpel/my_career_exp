# Estilos de Jogo (Play Styles) — Design Spec

Data: 2026-08-12
Status: aprovado em brainstorming

## Objetivo

Adicionar estilos de jogo ao NBA 2K25 Career Companion: o usuário escolhe um estilo que enviesa a curva de evolução — categorias-foco evoluem mais rápido, categorias fora do estilo mais devagar, nada é excluído. Badges do estilo aceleram.

## Decisões

- **Intensidade moderada**: foco ×1.5 | neutro ×1.0 | lento ×0.7 (XP de categoria).
- **Badges**: badges-foco do estilo progridem ×1.5; demais ×1.0 (sem penalidade).
- **Escolha na criação + troca por temporada**: estilo definido ao criar o jogador; pode mudar ao iniciar nova temporada. Sem troca no meio da temporada.
- **Estilo gravado por temporada** (`Season.playStyle`) — recálculo usa o estilo vigente na temporada de cada jogo; trocar estilo nunca corrompe replay.
- **Default Equilibrado**: sem viés (tudo ×1.0). Carreiras existentes sem o campo = Equilibrado.
- **Alvo dentro da categoria não muda**: continua o atributo mais baixo; o estilo altera só a velocidade do fluxo de XP por categoria.

## Os 9 estilos

UI mostra **um** jogador de referência por estilo.

| id | Nome | Referência | Foco ×1.5 | Lento ×0.7 | Badges-foco ×1.5 |
|---|---|---|---|---|---|
| `balanced` | Equilibrado | — | — | — | — |
| `sniper` | Sniper | Stephen Curry | three, ft | inside, rebounding | deadeye, limitless-range, set-shot-specialist, mini-marksman |
| `slasher` | Slasher | Ja Morant | inside, physical | three | posterizer, physical-finisher, layup-mixmaster, aerial-wizard |
| `maestro` | Maestro | Chris Paul | playmaking | rebounding, inside | dimer, versatile-visionary, bail-out, unpluckable |
| `defensor` | Defensor de Elite | Kawhi Leonard | defense | three | glove, on-ball-menace, challenger, interceptor, pick-dodger |
| `ancora` | Âncora do Garrafão | Rudy Gobert | defense, rebounding | three, playmaking | paint-patroller, boxout-beast, rebound-chaser, immovable-enforcer, pogo-stick |
| `poste` | Gigante do Poste | Joel Embiid | inside | three, playmaking | post-powerhouse, hook-specialist, post-fade-phenom, paint-prodigy, post-up-poet |
| `criador` | Criador de Jogadas | Kevin Durant | mid, playmaking | inside, rebounding | shifty-shooter, ankle-assassin, strong-handle, handles-for-days |
| `transicao` | Motor de Transição | Giannis Antetokounmpo | physical, inside | mid | lightning-launch, break-starter, aerial-wizard, posterizer, rise-up |

## Mecânica

- Novo módulo `src/engine/playStyles.ts`: catálogo `PLAY_STYLES` (id, nome, jogador de referência, catMults parciais, badge ids foco) + helpers `styleCategoryMult(styleId, cat)` e `styleBadgeMult(styleId, badgeId)`.
- `applyGameXp`: XP da categoria × multiplicador do estilo (entra na cadeia qualidade × idade × contexto × estilo). Recebe o styleId da temporada do jogo.
- `applyBadgeProgress`: unidades da badge × multiplicador do estilo.
- `processGame`/`recalcCareer`: threading do `season.playStyle ?? 'balanced'` para as duas funções acima.

## Dados

- `Season.playStyle?: string` (id do estilo; ausente = `balanced`).
- `Career.playStyle?: string` — estilo "atual" para UI e para pré-preencher a próxima temporada.

## UI

- **Criar jogador**: select de estilo com nome + jogador de referência (ex: "Sniper — Stephen Curry"); grava em `career.playStyle` e na primeira `Season.playStyle`.
- **Painel**: cabeçalho mostra o estilo atual. Botão "Nova temporada": pergunta (confirm/select) se mantém ou troca o estilo; grava na nova temporada e em `career.playStyle`.
- pt-BR em toda a UI.

## Testes

- Categoria-foco rende ~1.5× o XP da neutra para o mesmo box score; lenta ~0.7×.
- Badge-foco progride ×1.5.
- Replay determinístico com troca de estilo entre temporadas (temporada 1 sniper, temporada 2 ancora) reproduz atributos/badges idênticos.
- Carreira sem `playStyle` (import antigo) = comportamento atual inalterado (balanced).
- Calibração existente (`calibration.test.ts`) continua passando (usa balanced).

## Fora de escopo

- Troca de estilo no meio da temporada.
- Penalidade de badges fora do estilo.
- Estilos híbridos/custom.
