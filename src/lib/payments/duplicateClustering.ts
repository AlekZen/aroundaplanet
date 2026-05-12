/**
 * Pure clustering of duplicate `account.payment` records inside Odoo.
 * Clave de cluster: partner_id + amount±$1 + date±3d.
 * Unidad de amount: pesos (float) — Odoo native.
 */

import { normalizePartner } from './reconciliationMatch'

export interface OdooPaymentRow {
  id: number
  name: string | null
  memo: string | null
  amount: number
  date: string | null // YYYY-MM-DD
  partnerId: number | null
  partnerName: string | null
  journalId: number | null
  journalName: string | null
  state: string
  xDupStatus: 'canonico' | 'secundario' | null
  xCanonicalPaymentId: number | null
}

export type ClusterState = 'unmarked' | 'canonical_set' | 'inconsistent'

export interface DuplicateCluster {
  clusterId: string
  members: OdooPaymentRow[]
  currentState: ClusterState
  canonicalId: number | null
}

const AMOUNT_BUCKET_PESOS = 1
const DATE_BUCKET_DAYS = 3

/**
 * Agrupa pagos Odoo en clusters de duplicados.
 * Solo retorna clusters con ≥2 miembros.
 *
 * Estrategia: bucketing tosco por partner+amount+date (con overlap por fecha)
 * y luego verificación par-a-par dentro del bucket.
 */
export function groupClusters(payments: OdooPaymentRow[]): DuplicateCluster[] {
  // Agrupar candidatos por partnerId; amount/date se verifican par-a-par dentro
  const candidates = new Map<number, OdooPaymentRow[]>()
  for (const p of payments) {
    if (!p.partnerId || !p.date) continue
    if (!candidates.has(p.partnerId)) candidates.set(p.partnerId, [])
    candidates.get(p.partnerId)!.push(p)
  }

  const clusters: DuplicateCluster[] = []
  const assigned = new Set<number>()

  for (const group of candidates.values()) {
    if (group.length < 2) continue

    // Dentro del grupo, encontrar sub-clusters donde las fechas están dentro de ±DATE_BUCKET_DAYS
    const sorted = [...group].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

    let current: OdooPaymentRow[] = []
    for (const p of sorted) {
      if (assigned.has(p.id)) continue
      if (current.length === 0) {
        current = [p]
        continue
      }
      const last = current[current.length - 1]
      const diff = Math.abs(diffDays(p.date!, last.date!))
      if (diff <= DATE_BUCKET_DAYS && Math.abs(p.amount - last.amount) <= AMOUNT_BUCKET_PESOS) {
        current.push(p)
      } else {
        if (current.length >= 2) {
          const cluster = makeCluster(current)
          clusters.push(cluster)
          current.forEach((m) => assigned.add(m.id))
        }
        current = [p]
      }
    }
    if (current.length >= 2) {
      const cluster = makeCluster(current)
      clusters.push(cluster)
      current.forEach((m) => assigned.add(m.id))
    }
  }

  return clusters
}

function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.round((da - db) / 86_400_000)
}

function makeCluster(members: OdooPaymentRow[]): DuplicateCluster {
  const ids = members.map((m) => m.id).sort((a, b) => a - b)
  const clusterId = `c_${ids.join('_')}`
  return {
    clusterId,
    members,
    ...clusterStateOf(members),
  }
}

export function clusterStateOf(members: OdooPaymentRow[]): { currentState: ClusterState; canonicalId: number | null } {
  const canonicals = members.filter((m) => m.xDupStatus === 'canonico')
  const secondaries = members.filter((m) => m.xDupStatus === 'secundario')
  const unmarked = members.filter((m) => m.xDupStatus === null)

  if (canonicals.length === 0 && secondaries.length === 0) {
    return { currentState: 'unmarked', canonicalId: null }
  }

  if (canonicals.length === 1 && unmarked.length === 0 && secondaries.length === members.length - 1) {
    const canonId = canonicals[0].id
    const allSecondariesPointToCanonical = secondaries.every(
      (s) => s.xCanonicalPaymentId === canonId,
    )
    if (allSecondariesPointToCanonical) {
      return { currentState: 'canonical_set', canonicalId: canonId }
    }
  }

  return { currentState: 'inconsistent', canonicalId: canonicals[0]?.id ?? null }
}

/** Solo expuesto para tests / endpoints — normaliza nombres antes de bucketear si se requiere. */
export { normalizePartner }
