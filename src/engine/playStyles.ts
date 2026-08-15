import type { Category } from './types'
import type { Tag } from './affinity'

export interface PlayStyle {
  id: string; name: string; reference: string
  catMults: Partial<Record<Category, number>>
  focusBadges: string[]
  attrOverrides?: Record<string, Tag>
  contraBadges: string[]
}

// Valores calibrados por styleBalance.test.ts: todo estilo rende +8% a +18%
// de XP líquido sobre o Equilibrado contra o box de referência do arquétipo
// (equalizado por cima — estilos fracos foram buffados, fortes mantidos).
export const PLAY_STYLES: PlayStyle[] = [
  { id: 'balanced', name: 'Equilibrado', reference: '', catMults: {}, focusBadges: [], contraBadges: [] },
  { id: 'sniper', name: 'Sniper', reference: 'Stephen Curry',
    catMults: { three: 1.7, ft: 1.5, inside: 0.9, rebounding: 0.9 },
    focusBadges: ['deadeye', 'limitless-range', 'set-shot-specialist', 'mini-marksman'],
    contraBadges: ['posterizer', 'physical-finisher', 'post-powerhouse', 'hook-specialist', 'boxout-beast', 'rebound-chaser'] },
  { id: 'slasher', name: 'Slasher', reference: 'Ja Morant',
    catMults: { inside: 1.5, physical: 1.5, three: 0.8 },
    focusBadges: ['posterizer', 'physical-finisher', 'layup-mixmaster', 'aerial-wizard'],
    attrOverrides: { postHook: 'contra', postFade: 'contra', postControl: 'contra' },
    contraBadges: ['deadeye', 'limitless-range', 'set-shot-specialist', 'post-lockdown'] },
  { id: 'maestro', name: 'Maestro', reference: 'Chris Paul',
    catMults: { playmaking: 1.7, rebounding: 0.9, inside: 0.9 },
    focusBadges: ['dimer', 'versatile-visionary', 'bail-out', 'unpluckable'],
    contraBadges: ['boxout-beast', 'rebound-chaser', 'post-powerhouse', 'hook-specialist'] },
  { id: 'defensor', name: 'Defensor de Elite', reference: 'Kawhi Leonard',
    catMults: { defense: 1.8, mid: 1.2, three: 0.9 },
    focusBadges: ['glove', 'on-ball-menace', 'challenger', 'interceptor', 'pick-dodger'],
    contraBadges: ['limitless-range', 'post-up-poet', 'hook-specialist'] },
  { id: 'ancora', name: 'Âncora do Garrafão', reference: 'Rudy Gobert',
    catMults: { defense: 1.5, rebounding: 1.5, three: 0.7, playmaking: 0.7 },
    focusBadges: ['paint-patroller', 'boxout-beast', 'rebound-chaser', 'immovable-enforcer', 'pogo-stick'],
    attrOverrides: { perimeterD: 'normal', steal: 'normal' },
    contraBadges: ['deadeye', 'limitless-range', 'shifty-shooter', 'dimer', 'ankle-assassin'] },
  { id: 'poste', name: 'Gigante do Poste', reference: 'Joel Embiid',
    catMults: { inside: 1.5, three: 0.7, playmaking: 0.7 },
    focusBadges: ['post-powerhouse', 'hook-specialist', 'post-fade-phenom', 'paint-prodigy', 'post-up-poet'],
    attrOverrides: { drivingDunk: 'normal' },
    contraBadges: ['deadeye', 'limitless-range', 'ankle-assassin', 'handles-for-days'] },
  { id: 'criador', name: 'Criador de Jogadas', reference: 'Kevin Durant',
    catMults: { mid: 1.5, playmaking: 1.5, inside: 0.7, rebounding: 0.7 },
    focusBadges: ['shifty-shooter', 'ankle-assassin', 'strong-handle', 'handles-for-days'],
    contraBadges: ['post-powerhouse', 'hook-specialist', 'boxout-beast', 'rebound-chaser'] },
  { id: 'transicao', name: 'Motor de Transição', reference: 'Giannis Antetokounmpo',
    catMults: { physical: 1.5, inside: 1.5, mid: 0.7 },
    focusBadges: ['lightning-launch', 'break-starter', 'aerial-wizard', 'posterizer', 'rise-up'],
    attrOverrides: { postHook: 'contra', postFade: 'contra', postControl: 'contra' },
    contraBadges: ['set-shot-specialist', 'post-fade-phenom', 'post-up-poet'] },
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
