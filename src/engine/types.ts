export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C'
export type Category =
  | 'inside' | 'mid' | 'three' | 'ft'
  | 'playmaking' | 'rebounding' | 'defense' | 'physical'
export interface BoxScore {
  min: number; pts: number; reb: number; ast: number; stl: number
  blk: number; tov: number; fgm: number; fga: number; tpm: number
  tpa: number; ftm: number; fta: number; plusMinus: number
}
export interface GameContext {
  opponent: string; home: boolean; playoffs: boolean; win: boolean; date: string
}
export type GoalKind = 'pts' | 'reb' | 'ast' | 'stocks' | 'fgPct' | 'tpPct' | 'awayWin'
export interface Goal { id: string; category: Category; kind: GoalKind; target: number; description: string }
export interface Game {
  id: string; context: GameContext; box: BoxScore | null
  goals: Goal[]; goalsMet: string[]; ovrAfter?: number
}
export interface Season { year: number; games: Game[]; playStyle?: string }
export interface AttributeState { value: number; xp: number }
export interface BadgeState { progress: number }
export interface Challenge {
  badgeId: string; stat: 'pts' | 'ast' | 'tpm' | 'reb' | 'stl' | 'blk'
  perGame: number; streakLen: number; currentStreak: number; description: string
  startGameIndex: number
}
export type InstructionType = 'attribute' | 'badge'
export interface Instruction {
  id: string; type: InstructionType; text: string
  attribute?: string; delta?: number; badge?: string; tier?: number
}
export interface EngineConfig {
  baseCost: number; costGrowth: number
  ageMults: { u21: number; prime: number; decline: number; late: number }
  playoffsMult: number; awayMult: number; winMult: number; goalBonusCap: number
}
export interface Player {
  name: string; position: Position; heightCm: number; team: string; startAge: number
}
export interface Career {
  player: Player
  initialAttributes: Record<string, number>
  initialBadges: Record<string, number>
  attributes: Record<string, AttributeState>
  badges: Record<string, BadgeState>
  activeChallenges: Challenge[]
  seasons: Season[]
  pendingInstructions: Instruction[]
  appliedInstructionIds?: string[]
  config: EngineConfig
  targetOverrides: Partial<Record<Category, string>>
  playStyle?: string
  nextGoals?: Goal[] | null
  lastResult?: { gameId: string; instructions: Instruction[]; goalsMet: string[]; goals: Goal[] } | null
}
export const DEFAULT_CONFIG: EngineConfig = {
  baseCost: 100, costGrowth: 1.12,
  ageMults: { u21: 1.3, prime: 1.0, decline: 0.5, late: 0.3 },
  playoffsMult: 1.5, awayMult: 1.15, winMult: 1.1, goalBonusCap: 0.3,
}
