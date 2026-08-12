import type { BoxScore, Category, Position } from './types'

// fração dos 2P que conta como "inside" (resto vai pra mid)
const INSIDE_SHARE: Record<Position, number> = { PG: 0.4, SG: 0.4, SF: 0.5, PF: 0.7, C: 0.75 }

export function categoryXp(box: BoxScore, position: Position): Record<Category, number> {
  if (box.min <= 0) {
    return { inside: 0, mid: 0, three: 0, ft: 0, playmaking: 0, rebounding: 0, defense: 0, physical: 0 }
  }

  const twoPm = box.fgm - box.tpm
  const twoPa = box.fga - box.tpa
  const twoPct = twoPa > 0 ? twoPm / twoPa : 0
  const twoEff = twoPa >= 5 ? (twoPct >= 0.55 ? 1.4 : twoPct < 0.4 ? 0.6 : 1.0) : 1.0
  const twoXp = twoPm * 9 * twoEff
  const insideShare = INSIDE_SHARE[position]

  const tpPct = box.tpa > 0 ? box.tpm / box.tpa : 0
  const threeEff = box.tpa >= 4 ? (tpPct >= 0.4 ? 1.5 : tpPct < 0.25 ? 0.5 : 1.0) : 1.0

  const ftPct = box.fta > 0 ? box.ftm / box.fta : 0
  const ftEff = box.fta >= 4 ? (ftPct >= 0.8 ? 1.3 : ftPct < 0.6 ? 0.6 : 1.0) : 1.0

  const astRatio = box.tov > 0 ? box.ast / box.tov : box.ast
  const astEff = astRatio >= 2.5 ? 1.3 : astRatio < 1 ? 0.6 : 1.0

  return {
    inside: twoXp * insideShare,
    mid: twoXp * (1 - insideShare),
    three: box.tpm * 12 * threeEff,
    ft: box.ftm * 6 * ftEff,
    playmaking: box.ast * 8 * astEff,
    rebounding: box.reb * 6,
    defense: (box.stl + box.blk) * 10 + Math.max(box.plusMinus, 0) * 0.5,
    physical: box.min * 0.6,
  }
}
