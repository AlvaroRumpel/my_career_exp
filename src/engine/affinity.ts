import type { Category, Position } from './types'
import { ATTRIBUTES } from './attributes'
import { getStyle } from './playStyles'

export type Tag = 'buff' | 'normal' | 'contra'
export type HeightBand = 'short' | 'mid' | 'tall'

export interface AxisAffinity {
  buffCats?: Category[]
  contraCats?: Category[]
  attrOverrides?: Record<string, Tag>
  badgeOverrides?: Record<string, Tag>
}

// deslocamentos por eixo (ver spec)
const STYLE_DELTA = 0.5
const POSITION_DELTA = 0.35
const HEIGHT_DELTA = 0.25
const MIN_W = 0.25
const MAX_W = 2.5

export const POSITION_AFFINITY: Record<Position, AxisAffinity> = {
  PG: { buffCats: ['playmaking', 'three'], contraCats: ['inside', 'rebounding'],
    attrOverrides: { steal: 'buff', perimeterD: 'buff', midRange: 'buff', block: 'contra', interiorD: 'contra' },
    badgeOverrides: { 'on-ball-menace': 'buff', 'pick-dodger': 'buff', 'post-lockdown': 'contra', 'paint-patroller': 'contra', 'brick-wall': 'contra' } },
  SG: { buffCats: ['three', 'mid'], contraCats: ['rebounding', 'inside'],
    attrOverrides: { perimeterD: 'buff', block: 'contra', layup: 'normal', drivingDunk: 'normal' },
    badgeOverrides: { 'on-ball-menace': 'buff', 'post-lockdown': 'contra', 'brick-wall': 'contra' } },
  SF: { buffCats: ['mid', 'physical'], contraCats: [],
    attrOverrides: { postHook: 'contra', standingDunk: 'contra' } },
  PF: { buffCats: ['inside', 'rebounding'], contraCats: ['three', 'playmaking'],
    attrOverrides: { midRange: 'normal', passIQ: 'normal' },
    badgeOverrides: { 'paint-patroller': 'buff', 'brick-wall': 'buff', 'on-ball-menace': 'contra' } },
  C: { buffCats: ['inside', 'rebounding', 'defense'], contraCats: ['three', 'playmaking'],
    attrOverrides: { perimeterD: 'contra', steal: 'contra', interiorD: 'buff', block: 'buff' },
    badgeOverrides: { 'paint-patroller': 'buff', 'post-lockdown': 'buff', 'brick-wall': 'buff', 'on-ball-menace': 'contra', 'pick-dodger': 'contra', 'ankle-assassin': 'contra' } },
}

// cm: < short → 'short'; > tall → 'tall'; senão 'mid'
export const HEIGHT_BANDS: Record<Position, { short: number; tall: number }> = {
  PG: { short: 185, tall: 195 },
  SG: { short: 190, tall: 200 },
  SF: { short: 196, tall: 206 },
  PF: { short: 201, tall: 211 },
  C:  { short: 206, tall: 216 },
}

const SHORT_BUFF_ATTRS = ['speed', 'agility', 'ballHandle', 'speedWithBall', 'perimeterD', 'steal']
const SHORT_CONTRA_ATTRS = ['standingDunk', 'postHook', 'postFade', 'postControl', 'block', 'interiorD', 'offRebound', 'defRebound']
const SHORT_BUFF_BADGES = ['shifty-shooter', 'ankle-assassin', 'handles-for-days', 'lightning-launch', 'on-ball-menace', 'pick-dodger', 'slippery-off-ball']
const SHORT_CONTRA_BADGES = ['post-fade-phenom', 'post-powerhouse', 'post-up-poet', 'post-lockdown', 'hook-specialist', 'paint-prodigy', 'rise-up', 'paint-patroller', 'boxout-beast', 'rebound-chaser', 'brick-wall', 'immovable-enforcer', 'pogo-stick']

const tagMap = (buff: string[], contra: string[]): Record<string, Tag> => ({
  ...Object.fromEntries(buff.map(id => [id, 'buff' as Tag])),
  ...Object.fromEntries(contra.map(id => [id, 'contra' as Tag])),
})

export const HEIGHT_AFFINITY: Record<HeightBand, AxisAffinity> = {
  short: { attrOverrides: tagMap(SHORT_BUFF_ATTRS, SHORT_CONTRA_ATTRS), badgeOverrides: tagMap(SHORT_BUFF_BADGES, SHORT_CONTRA_BADGES) },
  mid: {},
  tall: { attrOverrides: tagMap(SHORT_CONTRA_ATTRS, SHORT_BUFF_ATTRS), badgeOverrides: tagMap(SHORT_CONTRA_BADGES, SHORT_BUFF_BADGES) },
}

export function heightBand(pos: Position, cm: number): HeightBand {
  const b = HEIGHT_BANDS[pos]
  return cm < b.short ? 'short' : cm > b.tall ? 'tall' : 'mid'
}

const DELTA: Record<Tag, number> = { buff: 1, normal: 0, contra: -1 }
const clamp = (w: number) => Math.min(MAX_W, Math.max(MIN_W, w))

function axisTagForCategory(axis: AxisAffinity, cat: Category | null): Tag {
  if (cat && axis.buffCats?.includes(cat)) return 'buff'
  if (cat && axis.contraCats?.includes(cat)) return 'contra'
  return 'normal'
}

function styleTagForCategory(styleId: string | undefined, cat: Category | null): Tag {
  if (!cat) return 'normal'
  const m = getStyle(styleId).catMults[cat]
  return m === undefined || m === 1 ? 'normal' : m > 1 ? 'buff' : 'contra'
}

const attrCategory = new Map(ATTRIBUTES.map(a => [a.id, a.category]))

export function attrWeight(attrId: string, styleId: string | undefined, pos: Position, cm: number): number {
  const cat = attrCategory.get(attrId) ?? null
  const style = getStyle(styleId)
  const s = style.attrOverrides?.[attrId] ?? styleTagForCategory(styleId, cat)
  const posAxis = POSITION_AFFINITY[pos]
  const p = posAxis.attrOverrides?.[attrId] ?? axisTagForCategory(posAxis, cat)
  const hAxis = HEIGHT_AFFINITY[heightBand(pos, cm)]
  const h = hAxis.attrOverrides?.[attrId] ?? axisTagForCategory(hAxis, cat)
  return clamp(1 + DELTA[s] * STYLE_DELTA + DELTA[p] * POSITION_DELTA + DELTA[h] * HEIGHT_DELTA)
}

// group da badge → categoria de atributo equivalente (general não tem)
export type BadgeGroup = 'inside' | 'outside' | 'playmaking' | 'defense' | 'rebounding' | 'general'
const GROUP_CATEGORY: Record<BadgeGroup, Category | null> = {
  inside: 'inside', outside: 'three', playmaking: 'playmaking',
  defense: 'defense', rebounding: 'rebounding', general: null,
}

export function badgeWeight(badgeId: string, group: BadgeGroup, styleId: string | undefined, pos: Position, cm: number): number {
  const cat = GROUP_CATEGORY[group]
  const style = getStyle(styleId)
  const s: Tag = style.focusBadges.includes(badgeId) ? 'buff'
    : style.contraBadges.includes(badgeId) ? 'contra'
    : styleTagForCategory(styleId, cat)
  const posAxis = POSITION_AFFINITY[pos]
  const p = posAxis.badgeOverrides?.[badgeId] ?? axisTagForCategory(posAxis, cat)
  const hAxis = HEIGHT_AFFINITY[heightBand(pos, cm)]
  const h = hAxis.badgeOverrides?.[badgeId] ?? axisTagForCategory(hAxis, cat)
  return clamp(1 + DELTA[s] * STYLE_DELTA + DELTA[p] * POSITION_DELTA + DELTA[h] * HEIGHT_DELTA)
}
