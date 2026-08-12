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
