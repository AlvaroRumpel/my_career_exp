import type { Category } from './types'

export interface PlayStyle {
  id: string; name: string; reference: string
  catMults: Partial<Record<Category, number>>
  focusBadges: string[]
}

const F = 1.5, S = 0.7

export const PLAY_STYLES: PlayStyle[] = [
  { id: 'balanced', name: 'Equilibrado', reference: '', catMults: {}, focusBadges: [] },
  { id: 'sniper', name: 'Sniper', reference: 'Stephen Curry',
    catMults: { three: F, ft: F, inside: S, rebounding: S },
    focusBadges: ['deadeye', 'limitless-range', 'set-shot-specialist', 'mini-marksman'] },
  { id: 'slasher', name: 'Slasher', reference: 'Ja Morant',
    catMults: { inside: F, physical: F, three: S },
    focusBadges: ['posterizer', 'physical-finisher', 'layup-mixmaster', 'aerial-wizard'] },
  { id: 'maestro', name: 'Maestro', reference: 'Chris Paul',
    catMults: { playmaking: F, rebounding: S, inside: S },
    focusBadges: ['dimer', 'versatile-visionary', 'bail-out', 'unpluckable'] },
  { id: 'defensor', name: 'Defensor de Elite', reference: 'Kawhi Leonard',
    catMults: { defense: F, three: S },
    focusBadges: ['glove', 'on-ball-menace', 'challenger', 'interceptor', 'pick-dodger'] },
  { id: 'ancora', name: 'Âncora do Garrafão', reference: 'Rudy Gobert',
    catMults: { defense: F, rebounding: F, three: S, playmaking: S },
    focusBadges: ['paint-patroller', 'boxout-beast', 'rebound-chaser', 'immovable-enforcer', 'pogo-stick'] },
  { id: 'poste', name: 'Gigante do Poste', reference: 'Joel Embiid',
    catMults: { inside: F, three: S, playmaking: S },
    focusBadges: ['post-powerhouse', 'hook-specialist', 'post-fade-phenom', 'paint-prodigy', 'post-up-poet'] },
  { id: 'criador', name: 'Criador de Jogadas', reference: 'Kevin Durant',
    catMults: { mid: F, playmaking: F, inside: S, rebounding: S },
    focusBadges: ['shifty-shooter', 'ankle-assassin', 'strong-handle', 'handles-for-days'] },
  { id: 'transicao', name: 'Motor de Transição', reference: 'Giannis Antetokounmpo',
    catMults: { physical: F, inside: F, mid: S },
    focusBadges: ['lightning-launch', 'break-starter', 'aerial-wizard', 'posterizer', 'rise-up'] },
]

const byId = new Map(PLAY_STYLES.map(s => [s.id, s]))

export function getStyle(id?: string | null): PlayStyle {
  return (id && byId.get(id)) || PLAY_STYLES[0]
}

export function styleCategoryMult(id: string | undefined, cat: Category): number {
  return getStyle(id).catMults[cat] ?? 1.0
}

export function styleBadgeMult(id: string | undefined, badgeId: string): number {
  return getStyle(id).focusBadges.includes(badgeId) ? 1.5 : 1.0
}
