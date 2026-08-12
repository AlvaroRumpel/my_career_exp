import type { BoxScore, GameContext, Position, BadgeState, Instruction } from './types'
import { styleBadgeMult } from './playStyles'

export const TIER_NAMES = ['—', 'Bronze', 'Prata', 'Ouro', 'HOF', 'Lenda']
export const TIER_THRESHOLDS = [10, 30, 80, 200, 400]

export interface BadgeDef {
  id: string; name: string
  group: 'inside' | 'outside' | 'playmaking' | 'defense' | 'rebounding' | 'general'
  units: (box: BoxScore, ctx: GameContext, position: Position) => number
}

// helpers
const played = (b: BoxScore, mins = 15) => b.min >= mins
const big = (p: Position) => p === 'PF' || p === 'C'
const guard = (p: Position) => p === 'PG' || p === 'SG'
const twoPm = (b: BoxScore) => b.fgm - b.tpm
const tpPct = (b: BoxScore) => (b.tpa > 0 ? b.tpm / b.tpa : 0)
// proxy: presença em quadra na função certa — progresso lento
const proxy = (cond: boolean) => (cond ? 0.5 : 0)
// trickle: universal passive progress for out-of-position badges (0.05/game ≈ 200 games for Bronze)
const trickle = (cond: boolean) => (cond ? 0.05 : 0)

export const BADGES: BadgeDef[] = [
  // ---- Inside (11)
  { id: 'aerial-wizard', name: 'Aerial Wizard', group: 'inside', units: b => (twoPm(b) >= 5 ? 1 : 0) + trickle(played(b)) },
  { id: 'float-game', name: 'Float Game', group: 'inside', units: (b, _c, p) => proxy(played(b) && guard(p)) + (twoPm(b) >= 4 ? 0.5 : 0) },
  { id: 'hook-specialist', name: 'Hook Specialist', group: 'inside', units: (b, _c, p) => proxy(played(b) && big(p)) + (big(p) && twoPm(b) >= 5 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'layup-mixmaster', name: 'Layup Mixmaster', group: 'inside', units: b => (twoPm(b) >= 6 ? 1 : 0) + proxy(played(b)) },
  { id: 'paint-prodigy', name: 'Paint Prodigy', group: 'inside', units: (b, _c, p) => (big(p) && twoPm(b) >= 5 ? 1 : 0) + proxy(played(b) && big(p)) + trickle(played(b)) },
  { id: 'physical-finisher', name: 'Physical Finisher', group: 'inside', units: b => (b.fta >= 6 ? 1 : 0) + (twoPm(b) >= 5 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'post-fade-phenom', name: 'Post Fade Phenom', group: 'inside', units: (b, _c, p) => proxy(played(b) && big(p)) + (big(p) && b.pts >= 20 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'post-powerhouse', name: 'Post Powerhouse', group: 'inside', units: (b, _c, p) => proxy(played(b) && big(p)) + (big(p) && twoPm(b) >= 6 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'post-up-poet', name: 'Post-Up Poet', group: 'inside', units: (b, _c, p) => proxy(played(b) && big(p)) + (big(p) && b.ast >= 3 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'posterizer', name: 'Posterizer', group: 'inside', units: b => (twoPm(b) >= 7 ? 1 : 0) + proxy(played(b, 20)) },
  { id: 'rise-up', name: 'Rise Up', group: 'inside', units: (b, _c, p) => (big(p) && twoPm(b) >= 5 ? 1 : 0) + proxy(played(b) && big(p)) + trickle(played(b)) },
  // ---- Outside (5)
  { id: 'deadeye', name: 'Deadeye', group: 'outside', units: b => (b.tpa >= 4 && tpPct(b) >= 0.4 ? b.tpm : 0) },
  { id: 'limitless-range', name: 'Limitless Range', group: 'outside', units: b => (b.tpm >= 4 ? b.tpm - 3 : 0) },
  { id: 'mini-marksman', name: 'Mini Marksman', group: 'outside', units: (b, _c, p) => (guard(p) && b.tpm >= 3 ? 1 : 0) + proxy(played(b) && guard(p)) + trickle(played(b)) },
  { id: 'set-shot-specialist', name: 'Set Shot Specialist', group: 'outside', units: b => (b.tpa >= 5 && tpPct(b) >= 0.35 ? 1 : 0) + proxy(played(b)) },
  { id: 'shifty-shooter', name: 'Shifty Shooter', group: 'outside', units: (b, _c, p) => (guard(p) && b.tpm >= 4 ? 1 : 0) + proxy(played(b) && guard(p)) + trickle(played(b)) },
  // ---- Playmaking (9)
  { id: 'ankle-assassin', name: 'Ankle Assassin', group: 'playmaking', units: (b, _c, p) => proxy(played(b) && guard(p)) + (b.ast >= 6 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'bail-out', name: 'Bail Out', group: 'playmaking', units: b => (b.ast >= 5 && b.tov <= 2 ? 1 : 0) + proxy(played(b)) },
  { id: 'break-starter', name: 'Break Starter', group: 'playmaking', units: b => (b.reb >= 6 && b.ast >= 4 ? 1 : 0) + proxy(played(b)) },
  { id: 'dimer', name: 'Dimer', group: 'playmaking', units: b => (b.ast >= 8 && (b.tov === 0 || b.ast / b.tov >= 2.5) ? 2 : b.ast >= 6 ? 1 : 0) },
  { id: 'handles-for-days', name: 'Handles for Days', group: 'playmaking', units: (b, _c, p) => proxy(played(b, 25) && guard(p)) + (b.ast >= 5 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'lightning-launch', name: 'Lightning Launch', group: 'playmaking', units: (b, _c, p) => proxy(played(b) && guard(p)) + (twoPm(b) >= 4 && guard(p) ? 0.5 : 0) + trickle(played(b)) },
  { id: 'strong-handle', name: 'Strong Handle', group: 'playmaking', units: b => (b.tov <= 1 && b.min >= 25 ? 1 : 0) + proxy(played(b)) },
  { id: 'unpluckable', name: 'Unpluckable', group: 'playmaking', units: b => (b.tov === 0 && b.min >= 20 ? 2 : b.tov <= 2 && b.min >= 25 ? 1 : 0) },
  { id: 'versatile-visionary', name: 'Versatile Visionary', group: 'playmaking', units: b => (b.ast >= 7 ? 1 : 0) + proxy(played(b)) },
  // ---- Defense (10)
  { id: 'challenger', name: 'Challenger', group: 'defense', units: (b, c) => (c.win && b.plusMinus >= 5 ? 1 : 0) + proxy(played(b)) },
  { id: 'glove', name: 'Glove', group: 'defense', units: b => b.stl },
  { id: 'high-flying-denier', name: 'High-Flying Denier', group: 'defense', units: b => b.blk },
  { id: 'immovable-enforcer', name: 'Immovable Enforcer', group: 'defense', units: (b, _c, p) => proxy(played(b) && big(p)) + (b.blk >= 1 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'interceptor', name: 'Interceptor', group: 'defense', units: b => (b.stl >= 2 ? b.stl : 0) + proxy(played(b)) },
  { id: 'off-ball-pest', name: 'Off-Ball Pest', group: 'defense', units: b => proxy(played(b, 20)) + (b.stl >= 1 ? 0.5 : 0) },
  { id: 'on-ball-menace', name: 'On-Ball Menace', group: 'defense', units: (b, _c, p) => proxy(played(b, 20) && guard(p)) + (b.stl >= 2 ? 1 : 0) + trickle(played(b)) },
  { id: 'paint-patroller', name: 'Paint Patroller', group: 'defense', units: (b, _c, p) => (big(p) ? b.blk : b.blk * 0.5) + proxy(played(b) && big(p)) + trickle(played(b)) },
  { id: 'pick-dodger', name: 'Pick Dodger', group: 'defense', units: (b, _c, p) => proxy(played(b, 20) && guard(p)) + (b.plusMinus >= 8 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'post-lockdown', name: 'Post Lockdown', group: 'defense', units: (b, _c, p) => proxy(played(b) && big(p)) + (big(p) && b.blk >= 2 ? 1 : 0) + trickle(played(b)) },
  // ---- Rebounding (2)
  { id: 'boxout-beast', name: 'Boxout Beast', group: 'rebounding', units: b => (b.reb >= 8 ? 1.5 : b.reb >= 5 ? 0.5 : 0) },
  { id: 'rebound-chaser', name: 'Rebound Chaser', group: 'rebounding', units: b => (b.reb >= 10 ? 2 : b.reb >= 7 ? 1 : 0) },
  // ---- General offense + all-around (3)
  { id: 'brick-wall', name: 'Brick Wall', group: 'general', units: (b, _c, p) => proxy(played(b, 20) && big(p)) + (big(p) && b.plusMinus >= 5 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'slippery-off-ball', name: 'Slippery Off-Ball', group: 'general', units: (b, _c, p) => proxy(played(b, 20) && !big(p)) + (b.tpm >= 3 ? 0.5 : 0) + trickle(played(b)) },
  { id: 'pogo-stick', name: 'Pogo Stick', group: 'general', units: b => ((b.blk + b.reb >= 8) ? 1 : 0) + proxy(played(b, 20)) },
]

export function tierOf(progress: number): number {
  let tier = 0
  for (const t of TIER_THRESHOLDS) if (progress >= t) tier++
  return tier
}

export function progressForTier(tier: number): number {
  return tier <= 0 ? 0 : TIER_THRESHOLDS[tier - 1]
}

export function applyBadgeProgress(
  badges: Record<string, BadgeState>, box: BoxScore, ctx: GameContext, position: Position, gameId: string,
  styleId: string = 'balanced',
): Instruction[] {
  const instructions: Instruction[] = []
  let n = 0 // local counter, resets per call -> deterministic ids across replays
  for (const def of BADGES) {
    const state = badges[def.id]
    if (!state) continue
    const before = tierOf(state.progress)
    state.progress += def.units(box, ctx, position) * styleBadgeMult(styleId, def.id)
    const after = tierOf(state.progress)
    if (after > before) {
      instructions.push({
        id: `badge-${gameId}-${n++}`, type: 'badge',
        text: `Suba ${def.name} para ${TIER_NAMES[after]} no 2K`,
        badge: def.id, tier: after,
      })
    }
  }
  return instructions
}
