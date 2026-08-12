import type { BoxScore } from './types'

export function validateBoxScore(box: BoxScore): string[] {
  const errors: string[] = []
  const nonNegative: (keyof BoxScore)[] = ['min','pts','reb','ast','stl','blk','tov','fgm','fga','tpm','tpa','ftm','fta']
  for (const k of nonNegative) {
    if (box[k] < 0 || !Number.isFinite(box[k])) errors.push(`${k} não pode ser negativo`)
  }
  if (box.min > 65) errors.push('Minutos acima do máximo possível (65)')
  if (box.fgm > box.fga) errors.push('FGM não pode ser maior que FGA')
  if (box.tpm > box.fgm) errors.push('3PM não pode ser maior que FGM')
  if (box.tpa > box.fga) errors.push('3PA não pode ser maior que FGA')
  if (box.tpm > box.tpa) errors.push('3PM não pode ser maior que 3PA')
  if (box.ftm > box.fta) errors.push('FTM não pode ser maior que FTA')
  const expectedPts = 2 * (box.fgm - box.tpm) + 3 * box.tpm + box.ftm
  if (box.pts !== expectedPts) errors.push(`Pontos inconsistentes: esperado ${expectedPts}`)
  return errors
}
