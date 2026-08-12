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
