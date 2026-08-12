import type { Category } from './types'

export interface PlayStyle {
  id: string; name: string; reference: string
  catMults: Partial<Record<Category, number>>
  focusBadges: string[]
}

// Valores calibrados por styleBalance.test.ts: XP líquido de cada estilo fica
// em ±2.5% do equilibrado contra o box de referência do arquétipo. Focos de
// bigs em inside/rebounding ficam abaixo de 1.5 porque essas categorias
// dominam o box de um pivô.
export const PLAY_STYLES: PlayStyle[] = [
  { id: 'balanced', name: 'Equilibrado', reference: '', catMults: {}, focusBadges: [] },
  { id: 'sniper', name: 'Sniper', reference: 'Stephen Curry',
    catMults: { three: 1.5, ft: 1.5, inside: 0.7, rebounding: 0.7 },
    focusBadges: ['deadeye', 'limitless-range', 'set-shot-specialist', 'mini-marksman'] },
  { id: 'slasher', name: 'Slasher', reference: 'Ja Morant',
    catMults: { inside: 1.5, physical: 1.5, three: 0.7, mid: 0.7 },
    focusBadges: ['posterizer', 'physical-finisher', 'layup-mixmaster', 'aerial-wizard'] },
  { id: 'maestro', name: 'Maestro', reference: 'Chris Paul',
    catMults: { playmaking: 1.5, rebounding: 0.7, inside: 0.7 },
    focusBadges: ['dimer', 'versatile-visionary', 'bail-out', 'unpluckable'] },
  { id: 'defensor', name: 'Defensor de Elite', reference: 'Kawhi Leonard',
    catMults: { defense: 1.5, three: 0.7 },
    focusBadges: ['glove', 'on-ball-menace', 'challenger', 'interceptor', 'pick-dodger'] },
  { id: 'ancora', name: 'Âncora do Garrafão', reference: 'Rudy Gobert',
    catMults: { defense: 1.5, rebounding: 1.3, inside: 0.8, mid: 0.7, playmaking: 0.7, ft: 0.7, three: 0.7 },
    focusBadges: ['paint-patroller', 'boxout-beast', 'rebound-chaser', 'immovable-enforcer', 'pogo-stick'] },
  { id: 'poste', name: 'Gigante do Poste', reference: 'Joel Embiid',
    catMults: { inside: 1.25, mid: 0.7, playmaking: 0.7, physical: 0.7, three: 0.7 },
    focusBadges: ['post-powerhouse', 'hook-specialist', 'post-fade-phenom', 'paint-prodigy', 'post-up-poet'] },
  { id: 'criador', name: 'Criador de Jogadas', reference: 'Kevin Durant',
    catMults: { mid: 1.4, playmaking: 1.4, inside: 0.7, rebounding: 0.7, defense: 0.7, physical: 0.7 },
    focusBadges: ['shifty-shooter', 'ankle-assassin', 'strong-handle', 'handles-for-days'] },
  { id: 'transicao', name: 'Motor de Transição', reference: 'Giannis Antetokounmpo',
    catMults: { physical: 1.5, inside: 1.2, mid: 0.7, playmaking: 0.7, defense: 0.7, ft: 0.7 },
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
