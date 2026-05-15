import { z } from 'zod'

/**
 * Schema del doc Firestore `appConfig/odoo` — config runtime de la integración Odoo.
 *
 * Campos:
 *  - `attachmentReceiptTagId`: tag id de `documents.tag` `aroundaplanet_comprobante` (Story 9.4).
 *  - `folderCanonicoTagId` + `folderDuplicadoTagId`: tags para marcar folders canónicos vs
 *    duplicados en la dedup de Documents (Story 9.5).
 *  - `folderAutoAssign`: feature flag — si true, los nuevos comprobantes 9.4 resuelven el
 *    folder canónico de su destino+mes+año y lo asignan al `documents.document`.
 *  - `folderAutoCreate`: feature flag — si true y no hay canónico para un destino+mes+año,
 *    el sistema crea uno nuevo y lo marca canónico. Si false (default), retorna no-match.
 *  - `webhookSecret` y `webhookSecretPrev` viven en Secret Manager, NO aquí.
 *
 * Todos los campos son opcionales para soportar bootstrap incremental.
 */
export const appConfigOdooSchema = z
  .object({
    attachmentReceiptTagId: z.number().int().positive().optional(),
    folderCanonicoTagId: z.number().int().positive().optional(),
    folderDuplicadoTagId: z.number().int().positive().optional(),
    folderAutoAssign: z.boolean().optional(),
    folderAutoCreate: z.boolean().optional(),
  })
  .refine(
    (d) => {
      const hasCanon = d.folderCanonicoTagId !== undefined
      const hasDup = d.folderDuplicadoTagId !== undefined
      return hasCanon === hasDup
    },
    {
      message:
        'folderCanonicoTagId y folderDuplicadoTagId deben definirse en conjunto (ambos o ninguno)',
    },
  )
  .refine(
    (d) => {
      if (d.folderAutoAssign === true) {
        return d.folderCanonicoTagId !== undefined
      }
      return true
    },
    {
      message:
        'folderAutoAssign=true requiere folderCanonicoTagId definido',
    },
  )
  .refine(
    (d) => {
      if (d.folderAutoCreate === true) {
        return d.folderAutoAssign === true
      }
      return true
    },
    {
      message: 'folderAutoCreate=true requiere folderAutoAssign=true',
    },
  )

export type AppConfigOdoo = z.infer<typeof appConfigOdooSchema>
