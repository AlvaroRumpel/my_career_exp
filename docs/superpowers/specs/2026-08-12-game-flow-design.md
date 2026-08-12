# Fluxo de Jogo (Pré → Em andamento → Pós) — Design

Data: 2026-08-12. Origem: feedback do usuário sobre o redesign HUD em produção.

## Problema

1. Pós-jogo é livre: dá pra registrar jogo a qualquer momento, sem pré-jogo.
2. O card "Resultado" do jogo anterior fica pendurado pra sempre (mesmo com upgrades já aplicados), parecendo um jogo atual.
3. Campo de data é ruído — o registro acontece no dia do jogo.
4. Linha "A partida" estoura a viewport no celular (input + 4 chips numa linha só).

## Decisões (confirmadas pelo usuário)

- **Início explícito:** o botão "Estou pronto" no Pré-jogo inicia o jogo em andamento. Gerar/regerar metas NÃO inicia.
- **Contexto viaja:** casa/fora/playoffs escolhidos no Pré-jogo valem para o registro; o Pós-jogo não re-pergunta. Pós-jogo pede só adversário, V/D, DNP e box score.
- **Pós-jogo bloqueado** sem jogo em andamento: mostra aviso + link pro Pré-jogo. Sem registro avulso.
- **Data automática:** `new Date()` no momento do registro; campo removido.
- **Resultado com ack:** após registrar, o Pós-jogo mostra só o resultado (metas, XP do jogo, instruções). Botão "Ver no painel" limpa `lastResult` e navega. Resultado não reaparece depois.

## Estado

Novo campo opcional em `Career` (types.ts — mudança só de tipo, zero lógica de engine):

```ts
pendingContext?: { home: boolean; playoffs: boolean } | null
```

- Jogo em andamento ⟺ `pendingContext` setado. `nextGoals` continua guardando as metas.
- Carreiras salvas sem o campo: `undefined` = sem jogo em andamento. Sem migração.

## Fluxo por tela

**Pré-jogo**
- Sem jogo em andamento: como hoje (contexto + gerar metas + multiplicador). "Estou pronto" (habilitado com metas geradas) seta `pendingContext` e navega pro Pós-jogo.
- Com jogo em andamento: banner "Jogo em andamento" (contexto + metas atuais) + botões "Ir pro registro" e "Cancelar jogo" (limpa `pendingContext` e `nextGoals`, com confirm).

**Pós-jogo**
- `lastResult` setado → tela de resultado apenas + CTA "Ver no painel" (ack: limpa `lastResult`, navega `/`).
- Sem `pendingContext` → aviso "Nenhum jogo em andamento" + link Pré-jogo.
- Com `pendingContext` → formulário: adversário, V/D, DNP, box score; caption read-only do contexto (ex.: "CASA · PLAYOFFS"). Submit usa `pendingContext`, limpa `pendingContext` + `nextGoals`, seta `lastResult`.

**Painel**
- "Nova temporada" também limpa `pendingContext`.

## Mobile

- Linha da partida empilhada: adversário full-width; linha 2 = Casa/Fora + V/D; linha 3 = Playoffs + DNP.
- Inputs numéricos com `min-w-0` pra não forçar largura mínima intrínseca.

## Fora de escopo

- Editar jogo, editar contexto após "Estou pronto" (cancelar e recomeçar cobre), persistir V/D no pré-jogo.

## Testes

- Engine intocado (só tipo). Fluxo é UI + localStorage; verificação via walkthrough Playwright (bloqueio, início, herança de contexto, ack do resultado) + suite existente verde.
