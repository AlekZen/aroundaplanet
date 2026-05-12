/**
 * Pure scoring for Firestore↔Odoo payment reconciliation.
 * Unidad canónica: AMBOS lados se normalizan a PESOS (float) en la entrada de scoreMatch.
 * Convertir Firestore `amountCents` ÷ 100 antes de llamar.
 */

export interface ReconciliationInput {
  firestore: {
    partnerName: string | null
    amount: number // en pesos (decimal)
    dateYmd: string | null // 'YYYY-MM-DD'
  }
  odoo: {
    partnerName: string | null
    amount: number // en pesos (decimal)
    dateYmd: string | null
  }
}

export type MatchConfidence = 'high' | 'medium' | 'low' | 'none'

export interface MatchScore {
  confidence: MatchConfidence
  reasons: string[]
  diff: {
    amountDiff: number
    dateDiff: number
    partnerJaccard: number
  }
}

const DATE_TOLERANCE_DAYS = 3
const AMOUNT_TOLERANCE_PESOS = 1

export function normalizePartner(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenSet(s: string | null | undefined): Set<string> {
  return new Set(
    normalizePartner(s).split(' ').filter((t) => t.length >= 2),
  )
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

export function dayDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.abs(Math.round((da - db) / 86_400_000))
}

export function scoreMatch(input: ReconciliationInput): MatchScore {
  const fsTokens = tokenSet(input.firestore.partnerName)
  const odooTokens = tokenSet(input.odoo.partnerName)
  const jac = jaccard(fsTokens, odooTokens)

  const amountDiff = Math.abs(input.firestore.amount - input.odoo.amount)
  const dateDiff =
    input.firestore.dateYmd && input.odoo.dateYmd
      ? dayDiff(input.firestore.dateYmd, input.odoo.dateYmd)
      : 999

  const partnerOk = jac >= 0.6 || (jac === 0 && normalizePartner(input.firestore.partnerName) === normalizePartner(input.odoo.partnerName) && normalizePartner(input.firestore.partnerName) !== '')
  const amountOk = amountDiff <= AMOUNT_TOLERANCE_PESOS
  const dateOk = dateDiff <= DATE_TOLERANCE_DAYS

  const reasons: string[] = [
    partnerOk ? `partner✓(jac=${jac.toFixed(2)})` : `partner✗(jac=${jac.toFixed(2)})`,
    amountOk ? `amount✓(Δ=${amountDiff.toFixed(2)})` : `amount✗(Δ=${amountDiff.toFixed(2)})`,
    dateOk ? `date✓(Δ=${dateDiff}d)` : `date✗(Δ=${dateDiff}d)`,
  ]

  let confidence: MatchConfidence
  if (jac === 1.0 && amountDiff === 0 && dateDiff <= 1) {
    confidence = 'high'
  } else if (partnerOk && amountOk && dateOk) {
    confidence = 'medium'
  } else {
    const okCount = (partnerOk ? 1 : 0) + (amountOk ? 1 : 0) + (dateOk ? 1 : 0)
    confidence = okCount >= 2 ? 'low' : 'none'
  }

  return {
    confidence,
    reasons,
    diff: {
      amountDiff,
      dateDiff,
      partnerJaccard: jac,
    },
  }
}
