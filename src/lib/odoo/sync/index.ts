/**
 * Helpers compartidos entre los orchestradores de sync Odoo (Stories 9.2, 9.3, 9.4+).
 */

import type { OdooClient } from '@/lib/odoo/client'
import { EXTID_MODULE } from '@/lib/odoo/payments-push'

export interface IrModelDataRow {
  id: number
  name: string
  res_id: number
  model: string
}

/**
 * Prefetch batched de `ir.model.data` por `res_id` (1 sola query Odoo).
 * Usado por el pull para resolver Tier 2 sin N+1.
 *
 * Retorna mapa `{ resId → ir.model.data row }` para los res_id que tengan
 * external id en `__aroundaplanet__` model `account.payment`.
 */
export async function prefetchIrModelDataByResIds(
  client: OdooClient,
  resIds: number[],
  module: string = EXTID_MODULE,
  model: string = 'account.payment',
): Promise<Map<number, IrModelDataRow>> {
  const map = new Map<number, IrModelDataRow>()
  if (!resIds.length) return map

  const rows = await client.searchRead(
    'ir.model.data',
    [
      ['module', '=', module],
      ['model', '=', model],
      ['res_id', 'in', resIds],
    ],
    ['id', 'name', 'res_id', 'model'],
    { limit: resIds.length + 10 },
  )

  for (const row of rows) {
    const resId = Number(row.res_id)
    if (!Number.isFinite(resId) || resId <= 0) continue
    map.set(resId, {
      id: Number(row.id),
      name: String(row.name),
      res_id: resId,
      model: String(row.model),
    })
  }
  return map
}

/**
 * Extrae el firestoreId desde `ir.model.data.name` con prefijo `payment_<id>`.
 * Retorna null si no matchea el patrón.
 */
export function extractFirestoreIdFromExtId(extName: string | null | undefined): string | null {
  if (!extName) return null
  const m = extName.match(/^payment_(.+)$/)
  return m ? m[1] : null
}

/**
 * Verificación de secrets con soporte para rotación (current + previous).
 * Compara constant-time contra cada secret válido. `null`/`undefined` en el
 * array se ignoran (permite definir solo `ODOO_X_SECRET` sin `_PREV`).
 */
export function verifySecret(provided: string | null | undefined, validSecrets: Array<string | null | undefined>): boolean {
  if (!provided) return false
  const providedBuf = Buffer.from(provided)
  for (const secret of validSecrets) {
    if (!secret) continue
    const secretBuf = Buffer.from(secret)
    if (secretBuf.length !== providedBuf.length) continue
    // crypto.timingSafeEqual requiere mismo length; ya filtramos arriba
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto') as typeof import('crypto')
    if (crypto.timingSafeEqual(providedBuf, secretBuf)) return true
  }
  return false
}
