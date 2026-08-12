import type { Category, Position } from './types'

export interface AttributeDef { id: string; label: string; category: Category }

export const ATTRIBUTES: AttributeDef[] = [
  // Finishing / inside
  { id: 'closeShot', label: 'Close Shot', category: 'inside' },
  { id: 'layup', label: 'Layup', category: 'inside' },
  { id: 'standingDunk', label: 'Standing Dunk', category: 'inside' },
  { id: 'drivingDunk', label: 'Driving Dunk', category: 'inside' },
  { id: 'postHook', label: 'Post Hook', category: 'inside' },
  { id: 'postFade', label: 'Post Fade', category: 'inside' },
  { id: 'postControl', label: 'Post Control', category: 'inside' },
  { id: 'drawFoul', label: 'Draw Foul', category: 'inside' },
  // Shooting
  { id: 'midRange', label: 'Mid-Range Shot', category: 'mid' },
  { id: 'shotIQ', label: 'Shot IQ', category: 'mid' },
  { id: 'offConsistency', label: 'Offensive Consistency', category: 'mid' },
  { id: 'threePoint', label: 'Three-Point Shot', category: 'three' },
  { id: 'freeThrow', label: 'Free Throw', category: 'ft' },
  // Playmaking
  { id: 'passAccuracy', label: 'Pass Accuracy', category: 'playmaking' },
  { id: 'ballHandle', label: 'Ball Handle', category: 'playmaking' },
  { id: 'speedWithBall', label: 'Speed with Ball', category: 'playmaking' },
  { id: 'passIQ', label: 'Pass IQ', category: 'playmaking' },
  { id: 'passVision', label: 'Pass Vision', category: 'playmaking' },
  // Defense
  { id: 'interiorD', label: 'Interior Defense', category: 'defense' },
  { id: 'perimeterD', label: 'Perimeter Defense', category: 'defense' },
  { id: 'steal', label: 'Steal', category: 'defense' },
  { id: 'block', label: 'Block', category: 'defense' },
  { id: 'helpDefenseIQ', label: 'Help Defense IQ', category: 'defense' },
  { id: 'passPerception', label: 'Pass Perception', category: 'defense' },
  { id: 'defConsistency', label: 'Defensive Consistency', category: 'defense' },
  // Rebounding
  { id: 'offRebound', label: 'Offensive Rebound', category: 'rebounding' },
  { id: 'defRebound', label: 'Defensive Rebound', category: 'rebounding' },
  // Physical
  { id: 'speed', label: 'Speed', category: 'physical' },
  { id: 'agility', label: 'Agility', category: 'physical' },
  { id: 'strength', label: 'Strength', category: 'physical' },
  { id: 'vertical', label: 'Vertical', category: 'physical' },
  { id: 'stamina', label: 'Stamina', category: 'physical' },
  { id: 'hustle', label: 'Hustle', category: 'physical' },
  { id: 'durability', label: 'Overall Durability', category: 'physical' },
  { id: 'intangibles', label: 'Intangibles', category: 'physical' },
]

export function attributesByCategory(cat: Category): AttributeDef[] {
  return ATTRIBUTES.filter(a => a.category === cat)
}

export const PHYSICAL_REGRESSION_ORDER = ['speed', 'agility', 'vertical', 'stamina', 'strength']

// ponytail: média ponderada simples por posição, não a fórmula real de OVR do 2K
const POSITION_WEIGHTS: Record<Position, Partial<Record<Category, number>>> = {
  PG: { playmaking: 2, three: 1.5, mid: 1.2, defense: 1, physical: 1, inside: 0.8, ft: 0.8, rebounding: 0.5 },
  SG: { three: 2, mid: 1.5, playmaking: 1.2, defense: 1, physical: 1, inside: 0.9, ft: 0.8, rebounding: 0.5 },
  SF: { mid: 1.5, three: 1.3, inside: 1.2, defense: 1.2, physical: 1, playmaking: 0.9, ft: 0.8, rebounding: 0.8 },
  PF: { inside: 1.8, rebounding: 1.5, defense: 1.3, physical: 1.1, mid: 0.9, three: 0.7, playmaking: 0.6, ft: 0.7 },
  C:  { inside: 2, rebounding: 1.8, defense: 1.5, physical: 1.1, mid: 0.7, three: 0.5, playmaking: 0.5, ft: 0.6 },
}

export function estimateOverall(values: Record<string, number>, position: Position): number {
  const weights = POSITION_WEIGHTS[position]
  let sum = 0, wsum = 0
  for (const a of ATTRIBUTES) {
    const w = weights[a.category] ?? 1
    sum += (values[a.id] ?? 0) * w
    wsum += w
  }
  return Math.round(sum / wsum)
}
