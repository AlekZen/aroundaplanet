import type { ContractTemplate } from '@/schemas/contractTemplateSchema'

/**
 * Story 10.1.3 — Match heurístico tripName/tripId → contractTemplate.
 *
 * Reglas (consensuadas Alek sesión 43, post-feedback Paloma):
 * - Bloquea generación si no hay match → admin no puede usar plantilla equivocada por accidente.
 * - Match por tokens del `destinoLabel` contra `tripName`/`tripId` normalizados.
 * - Score = tokens matched / total tokens del destinoLabel.
 * - Threshold mínimo: 1.0 (todos los tokens del destinoLabel deben estar en el tripName).
 *   Esto es estricto: COLOMBIA MAYO match "COLOMBIA MAYO 2026 ORIGINAL" (ambos tokens dentro)
 *   pero NO con "COLOMBIA OCTUBRE" (falta MAYO).
 * - Si dos templates empatan, gana el de destinoLabel más largo (más específico).
 */

function normalize(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter((t) => t.length >= 2)
}

export interface TemplateMatchResult {
  template: ContractTemplate | null
  score: number
  reason: string
}

/**
 * Busca la plantilla que mejor coincide con el viaje. Devuelve `null` si ninguna
 * cumple el threshold (admin DEBE elegir manualmente o crear plantilla nueva).
 */
export function findTemplateForTrip(
  tripName: string | null | undefined,
  tripId: string | null | undefined,
  templates: ContractTemplate[]
): TemplateMatchResult {
  if (!templates.length) {
    return { template: null, score: 0, reason: 'No hay plantillas activas en el catálogo' }
  }

  // Combina tripName + tripId para incluir info de ambos canales (Odoo y Firestore)
  const haystack = new Set([...tokenize(tripName ?? ''), ...tokenize(tripId ?? '')])
  if (haystack.size === 0) {
    return {
      template: null,
      score: 0,
      reason: 'El viaje no tiene nombre. Captura el viaje antes de generar el contrato.',
    }
  }

  let best: { tpl: ContractTemplate; score: number } | null = null
  for (const tpl of templates) {
    const needleTokens = tokenize(tpl.destinoLabel)
    if (needleTokens.length === 0) continue
    const matched = needleTokens.filter((t) => haystack.has(t)).length
    const score = matched / needleTokens.length
    if (score < 1.0) continue // estricto: todos los tokens del destinoLabel deben estar
    if (
      !best ||
      score > best.score ||
      (score === best.score && tpl.destinoLabel.length > best.tpl.destinoLabel.length)
    ) {
      best = { tpl, score }
    }
  }

  if (!best) {
    const tripDisplay = (tripName ?? tripId ?? '').toString()
    return {
      template: null,
      score: 0,
      reason: `No se encontró plantilla para "${tripDisplay}". Crea la plantilla antes de generar el contrato.`,
    }
  }

  return {
    template: best.tpl,
    score: best.score,
    reason: `Match automático: ${best.tpl.destinoLabel}`,
  }
}
