# NBA 2K25 MyLeague Career Companion — Design Spec

Data: 2026-08-12
Status: aprovado em brainstorming

## Objetivo

Site pessoal que gerencia a carreira de um jogador criado no NBA 2K25 (modo MyLeague). O usuário joga as partidas no 2K, digita o box score no site, e o site — via motor de progressão realista — manda instruções concretas de evolução ("+1 Mid-Range", "Deadeye → Prata") para aplicar manualmente no editor de roster do 2K25.

## Decisões de produto

- **1 jogador ativo por vez** (pode arquivar e começar outro).
- **Criação livre no 2K**: usuário cria o jogador no jogo e cadastra atributos/badges atuais no site; o site controla a evolução dali em diante.
- **Entrada de dados**: box score completo + contexto (adversário, casa/fora, playoffs, W/L) após cada jogo.
- **Progressão realista**: lenta e gradual, ligada à performance real, com curva de idade e regressão de veterano.
- **Badges**: catálogo completo do NBA 2K25 (~40 badges, tiers Bronze → Prata → Ouro → HOF → Lenda), com progresso passivo + desafios ativos.
- **Metas pré-jogo** geradas pelo site, com XP bônus.
- **Dados no navegador** (localStorage) + export/import JSON como backup. Sem backend.

## Arquitetura & Stack

- Site estático puro, deploy no **Cloudflare Pages**. Sem backend, sem Functions.
- **Vite + React + TypeScript + Tailwind**. Sem UI libs pesadas.
- SPA com 5 rotas:
  1. **Criar jogador** — nome, posição, altura, idade/data de nascimento, time, atributos atuais do 2K, badges atuais.
  2. **Dashboard** — OVR estimado, atributos com barras de XP, badges, médias da temporada, instruções pendentes, próximas metas.
  3. **Pré-jogo** — 2-3 metas geradas para a próxima partida.
  4. **Pós-jogo** — formulário do box score + contexto → tela de resultado: XP ganho, metas cumpridas, instruções concretas.
  5. **Histórico** — lista de jogos, médias por temporada, gráfico de evolução do OVR.
- Design das telas: claude-design na fase de implementação.

## Motor de XP

Fluxo: box score → XP por categoria → acumula por atributo → cruzou limiar → instrução "+1 atributo".

### Categorias de XP

| Categoria | Fonte no box score | Alimenta atributos 2K |
|---|---|---|
| Interior | 2PM com boa eficiência | Close Shot, Layup, Driving Dunk, Post Control |
| Arremesso 3 | 3PM + 3P% | Three-Point Shot |
| Mid-Range | 2P% alto com volume | Mid-Range Shot |
| Lance livre | FTM + FT% | Free Throw |
| Playmaking | AST, razão AST/TO | Pass Accuracy, Ball Handle, Speed with Ball |
| Rebote | REB por minuto | Offensive/Defensive Rebound |
| Defesa | STL, BLK, +/-, vitória | Steal, Block, Perimeter/Interior Defense |
| Físico | minutos jogados (gotejamento lento) | Speed, Agility, Strength, Vertical, Stamina |

### Multiplicadores (XP do jogo × todos)

- **Qualidade**: Game Score estilo Hollinger normalizado por minutos. Jogo ruim ≈ 0.3x, jogo monstro ≈ 1.5x. Eficiência pesa mais que volume.
- **Idade**: ≤21 → 1.3x | 22-33 → 1.0x | 34-36 → 0.5x | 37+ → 0.3x.
- **Regressão física**: a partir dos 34, o site emite instruções periódicas de regressão ("-1 Speed", "-1 Vertical").
- **Contexto**: playoffs 1.5x | fora de casa 1.15x | vitória 1.1x.
- **Metas cumpridas**: XP bônus direto na categoria da meta (limitado a ~30% do XP do jogo).

### Custo do limiar

Custo para +1 cresce exponencialmente com o valor atual do atributo. Calibração alvo:

- Rookie sólido, temporada completa (~82 jogos): **+4 a 6 de OVR/temporada**.
- Estrela no pico: ~+3.
- Veterano 34+: quase nada, com regressões.

Constantes exatas calibradas na implementação com temporadas simuladas.

### Escolha do atributo dentro da categoria

O site escolhe (prioriza o mais barato/defasado), mas o usuário pode trocar na tela de resultado antes de aplicar no 2K.

## Badges

- **Catálogo completo do NBA 2K25** (lista oficial verificada via web na implementação). Tiers: Bronze, Prata, Ouro, HOF, Lenda.
- **Progresso passivo**: cada badge tem contadores ligados a stats (ex: Deadeye — 3PM em jogos com 40%+ de 3; Dimer — jogos com 8+ AST e AST/TO ≥ 2.5; Rebound Chaser — jogos com 10+ REB). Marcos por tier calibráveis por badge (ex: 25 → Bronze, 75 → Prata, 200 → Ouro, 500 → HOF).
- **Badges sem sinal no box score** (ex: Brick Wall, Post Lockdown): progridem por proxy — minutos + posição + XP da categoria relacionada.
- **Desafios ativos**: usuário escolhe até 2 badges para perseguir; site gera desafio específico (ex: "3 jogos seguidos com 5+ AST → acelera Dimer em 50% do marco"). Cumpriu → pula progresso; falhou → renova.
- Site emite instrução quando badge sobe de tier: "suba Deadeye para Prata no 2K".

## Metas pré-jogo

- 2-3 metas por jogo, baseadas no perfil e médias recentes — alcançáveis mas acima da média (média 15 pts → meta 18+).
- Tipos: pontuação, eficiência, playmaking, defesa, rebote, contexto ("vitória fora de casa").
- **Anti-farm**: metas não repetem categoria 3 jogos seguidos; XP de meta ≤ ~30% do XP do jogo.

## Modelo de dados (localStorage, objeto único)

```
career {
  player { nome, posição, altura, dataNascimento, time }
  attributes { [nome2K]: { valor, xpAtual, xpNecessário } }   // ~35 atributos do 2K25
  badges { [nomeBadge]: { tier, progresso, desafioAtivo? } }
  seasons [ { ano, jogos [ { data, adversário, casaFora, playoffs, resultado,
              boxScore, metasGeradas, metasCumpridas, xpGanho, instruções } ] } ]
  pendingInstructions [ "+1 Mid-Range", "Deadeye → Prata" ]
  config { multiplicadores, custos }   // calibragem editável
}
```

Export/import JSON do objeto inteiro.

## Edge cases

- **Validação do box score**: FGM ≤ FGA, 3PM ≤ FGM, 3PA ≤ FGA, FTM ≤ FTA, PTS = 2×(FGM−3PM) + 3×3PM + FTM. Erro bloqueado no formulário.
- **Instruções pendentes** acumulam até o usuário marcar "apliquei no 2K" — pode jogar várias partidas antes de editar o roster.
- **Virada de temporada**: botão "nova temporada" → idade +1, médias zeram, histórico preservado.
- **DNP**: jogo com 0 min, sem XP.
- **Editar/excluir jogo**: recálculo da carreira inteira desde o início (dados pequenos, instantâneo, evita inconsistência).

## Testes

- **Vitest no motor de XP**: jogo monstro, jogo ruim, curva de idade, custo crescente, regressão 34+, validação de box score, recálculo completo.
- UI sem testes automatizados (uso pessoal).

## Fora de escopo (YAGNI)

- Multi-usuário, auth, backend, sync entre dispositivos.
- Múltiplos jogadores em paralelo.
- Lesões, moral, contratos, simulação de liga.
- Integração automática com o 2K25 (não existe API; entrada é manual).
