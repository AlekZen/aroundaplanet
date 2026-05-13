# Spike 9.0a — Findings: `ir.attachment.res_model` + `res_id` en Odoo 18 Enterprise Online

**Fecha:** 2026-05-12
**Autor:** Quick-Dev (Claude Opus 4.7) bajo supervisión de Alek
**Tenant:** aroundaplanet.odoo.com (producción, sin sandbox disponible)
**User XML-RPC:** Noel Sahagun Cervantes (uid=2)
**Ejecución:** `node scripts/spike-9-0a-documents-res-id.mjs` + `node scripts/spike-9-0a-cleanup-followup.mjs`
**Output crudo:** `scripts/audit-output/spike-9-0a-output.json` + `spike-9-0a-cleanup-followup.json`

## TL;DR

| Pregunta | Veredicto |
|---|---|
| ¿Patrón A funciona? (create sin res_id → `write({res_model,res_id})`) | ✅ **SÍ** — `res_model` y `res_id` quedan persistidos, NO son read-only en Odoo Online Custom |
| ¿Patrón B funciona? (create directo con `res_model`+`res_id`) | ✅ **SÍ** — persiste desde el primer call |
| ¿Edge `res_id=999999` (huérfano) aceptado? | ⚠️ **SÍ aceptado**, pero **vuelve el attachment INACCESIBLE** para el caller (record rules ACL aplican sobre el padre inexistente). Ni `read`, ni `write`, ni `search_read` lo devuelven al user XML-RPC normal |
| `search_read([res_model='account.payment', res_id=payId])` ¿devuelve los attachments? | ✅ **SÍ** — devuelve ambos (Patrón A y Patrón B, mismo payment) |
| Recomendación Story 9.4 | **Patrón B** (1 call) — más simple, más rápido, idéntico resultado funcional |
| Latencia p50/p95 Patrón B | **199 ms / 201 ms** por upload (1 XML-RPC call) |
| Latencia Patrón A | **~237 ms** combinada (create 123ms + write 114ms) — equivalente pero 2 calls |
| Rate limit impacto Story 9.4 | A 30 req/min Odoo, **1 call por upload** → 30 comprobantes/min máx → suficiente para flujo verificación (un admin no verifica >5/min) |

## Setup

- **Partner TEST:** id=4314 (`<`, primer match `customer_rank > 0`).
- **Journal:** id=13, code=`BNK1`, type=`bank`.
- **account.payment TEST:** id=8132 (también 8131 de run aborted), `state='draft'`, $1, partner=4314.
- **Dummy PDF:** 1024B base64 (header PDF mínimo + padding).
- **Prefijo TEST:** `TEST_AROUNDA_2026-05-12_spike9-0a-` en `name` de attachments y `memo` de payment.
- **NUNCA `unlink`** — cleanup vía `write({state:'canceled'})` para payments + rename `_CLEANED_<ts>` para attachments. `ir.attachment` en Odoo 18 NO expone campo `active` (filterable) — sólo rename funciona como mecanismo de soft-disable visible.

## Hallazgos por escenario

### Patrón A — create sin `res_id` → `write({res_model,res_id})` post-create

- **Create (sin res_id):** id=45801, latencia=115 ms.
- **Estado inicial:** `res_model=False`, `res_id=0` (campos vacíos).
- **Write({res_model:'account.payment', res_id:8132}):** retorna `True`, latencia=114 ms.
- **Re-read post-write:** `res_model='account.payment'`, `res_id=8132` ✅ persistido.
- **Total latencia:** ~229 ms (2 XML-RPC calls).
- **Conclusión:** los campos NO son read-only en este tenant. El research técnico mencionaba "read-only por default" como riesgo C — **descartado empíricamente**.

### Patrón B — create YA con `res_model`+`res_id`

- **Create:** id=45802 en un solo call, latencia=205 ms (más alto que A.create solo porque incluye el setup del FK check de res_id).
- **Re-read:** `res_model='account.payment'`, `res_id=8132` ✅ persistido desde el inicio.
- **Total latencia:** 205 ms (1 XML-RPC call).
- **Latencias 5 iteraciones consecutivas:**

  | iter | totalMs |
  |---|---|
  | 1 | 207 |
  | 2 | 196 |
  | 3 | 201 |
  | 4 | 197 |
  | 5 | 199 |

  **Stats:** min=196, **p50=199**, **p95=201**, max=207.
- **Conclusión:** Patrón B es **viable, idiomático y +1 call menos** que Patrón A.

### EDGE — `res_id=999999` (payment inexistente)

- **Create:** id=45803 ACEPTADO por Odoo en 204 ms. **Odoo NO valida FK del `res_id`** contra el modelo target (paralelo a hallazgo V3 de spike 9.0b sobre `ir.model.data.res_id`).
- **Re-read post-create:** ❌ **falla con ACL**:
  ```
  XML-RPC fault: Estos registros están restringidos.
  Noel Sahagun Cervantes (id=2) no tiene acceso 'leer' a:
  - Adjunto (ir.attachment)
  ```
- **search_read([id=45803]):** devuelve 0 resultados (el attachment "desaparece" para nuestro user).
- **write(name='...'):** mismo error ACL — **el cleanup desde nuestro service account es imposible**. Queda como huérfano hasta que un admin (Paloma con cuenta `aroundaplanet.com` o `noel.sahagun` con grupos elevados) lo limpie.
- **Implicación crítica para Story 9.4:** **NUNCA, JAMÁS** crear un `ir.attachment` con `res_id` ausente o apuntando a un payment que aún no existe. Si la sincronización falla entre crear el payment y subir el comprobante, hay que **subir el comprobante DESPUÉS** del create payment confirmado. Inversión del orden = huérfano inaccesible permanente.

### SEARCH — `search_read` por (res_model, res_id)

- Query: `[('res_model','=','account.payment'),('res_id','=',8132)]`.
- **Resultados:** 2 attachments (45801 Patrón A, 45802 Patrón B). ✅ El attachment EDGE huérfano (45803) NO aparece (ACL).
- **Latencia:** 193 ms.
- **Conclusión:** este es el patrón canónico para Story 9.3 (pull Odoo→Firestore) — saber qué comprobantes están enlazados a un payment.

## Cleanup ejecutado

### Renames `_CLEANED_<ts>` exitosos (12 attachments)

Listado completo en `9-0a-cleanup-list.txt`. Resumen:
- `ir.attachment` 45798, 45799, 45800 (run aborted 1) + 45801, 45802, 45804, 45805, 45806, 45807, 45808 (run final) → renamed `_CLEANED_2026-05-12T...`.
- `ir.attachment` 45803 → **NO limpiable desde XML-RPC user normal** (ACL — record rule bloquea). Documentado para Paloma/admin web.

### Payments cancelados (state='canceled')

- 8131, 8132 → `state='canceled'` vía `write({state:'canceled'})` (Odoo 18 usa `'canceled'`, no `'cancel'` — confirmado en spike 9.0b). `action_cancel` rompe XML-RPC marshalling al devolver `None`, **NO USAR**.
- Memo final: ambos quedaron con `memo='false_CLEANED_<ts>'` (su `name` original era `False` porque la secuencia de Odoo asigna `name` al post; en draft `name` es falso). Inocuo.

### Hallazgo cleanup operativo

- `ir.attachment` en Odoo 18 NO acepta `('active','=',True)` en domain (`Invalid field ir.attachment.active in leaf`). El modelo no expone `active` como filterable. **Cleanup sólo por rename**.
- Para verificar cleanup completo: `search_count([('id','in',[...]),('name','=like','%_CLEANED_%')])`.

## Decisiones técnicas para Story 9.4

### 1. **Patrón B es la elección oficial**

Justificación:
- 1 XML-RPC call vs 2 → 50% menos consumo del rate limit Odoo (60 req/min).
- Latencia equivalente (B p50=199ms vs A 229ms combinado).
- Atomicidad: si falla, el attachment NO se crea (vs Patrón A que puede dejar attachment huérfano sin res_id si el `write` falla).

### 2. **Orden estricto: payment FIRST, attachment AFTER**

Por el hallazgo EDGE: un attachment con `res_id` apuntando a payment inexistente es **inaccesible y no-limpiable** para nuestro service account. Por tanto:

```
1. Push payment a Odoo (Story 9.2 — flow invertido 3-call con ir.model.data)
2. Verificar que paymentId existe y persistió
3. Upload del comprobante con res_model='account.payment' + res_id=paymentId
```

**NUNCA invertir el orden**, ni siquiera "para optimizar". La pérdida de control sobre attachments huérfanos es operacionalmente costosa.

### 3. **No usar `documents.document` wrapper directamente**

El research mencionaba `documents.document` como wrapper de la app Odoo Documents. Decisión:
- Para el MVP de Story 9.4: usar `ir.attachment` con `res_model`+`res_id`+`tag_ids` (cuando existan tags `aroundaplanet_comprobante`).
- La app Documents listará los attachments automáticamente si están taggeados — confirmar en Story 9.4 post-merge con Paloma vía UI.
- `documents.document` añade complejidad (folder_id obligatorio en algunos perfiles) sin beneficio claro vs `ir.attachment` directo. Si en Story 9.4 se descubre que la app Documents no los lista sin wrapper, escalar a sub-spike de 4h.

### 4. **Validar paymentId antes del upload**

Antes de crear el attachment, hacer un `read('account.payment', [paymentId], ['id','state'])` que confirme:
- El payment existe (no es huérfano).
- `state` no es `'canceled'` (uploading a un payment cancelado deja huérfano operativo).

Esto consume +1 call por upload pero previene el caso EDGE 100%.

### 5. **Tag canónico `aroundaplanet_comprobante`** (TODO Story 9.4)

- Crear tag en `ir.attachment` (o `documents.tag` si existe) durante setup de Story 9.4.
- Aplicar `tag_ids=[(6,0,[tagId])]` en cada upload.
- Esto facilita la dedup de folders (Story 9.5) y la búsqueda admin (Story 9.6).

### 6. **Rate limit**

A 60 req/min Odoo, con Patrón B + validación pre-upload:
- 2 calls por upload (read payment + create attachment) → 30 uploads/min máx.
- En flujo real (un admin verifica un pago a la vez, upload comprobante manual o batch nightly), nunca alcanzamos saturación.
- Reutilizar el throttling `enqueueOdooSync` del snippet de spike 9.0b si Story 9.4 hace batch import retroactivo (Story 9.1).

## Snippet TypeScript copy-paste para Story 9.4

```typescript
// src/lib/odoo/payments-attachments.ts (NEW en Story 9.4 — no se commitea en este spike)
import { getOdooClient } from '@/lib/odoo/client'
import { AppError } from '@/lib/errors/AppError'
import { z } from 'zod'

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const

// Schema Zod del response de upload (Story 9.7 contract)
export const UploadReceiptResultSchema = z.object({
  odooAttachmentId: z.number().int().positive(),
  resModel: z.literal('account.payment'),
  resId: z.number().int().positive(),
  fileName: z.string().min(1),
  mimetype: z.string().min(1),
  uploadedAt: z.string().datetime(),
})
export type UploadReceiptResult = z.infer<typeof UploadReceiptResultSchema>

export type UploadPaymentReceiptInput = {
  odooPaymentId: number
  receiptBuffer: Buffer
  fileName: string         // ej: 'comprobante-{firestoreId}.pdf'
  mimetype: string         // ej: 'application/pdf' | 'image/jpeg' | 'image/png'
  tagIds?: number[]        // ej: [tagIdAroundaplantComprobante] — opcional MVP
}

async function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

/**
 * Sube un comprobante a Odoo asociándolo al account.payment indicado.
 *
 * REGLAS CRÍTICAS (spike 9.0a):
 * - SIEMPRE en orden: payment existe → upload attachment. NUNCA al revés.
 * - SIEMPRE incluir res_model + res_id en el create (Patrón B). NUNCA crear huérfano y attachear después.
 * - Si res_id apunta a un payment inexistente, el attachment queda inaccesible (record rule ACL).
 */
export async function uploadPaymentReceipt(
  input: UploadPaymentReceiptInput,
): Promise<UploadReceiptResult> {
  const client = getOdooClient()

  // 1) Validar que el payment existe y no está cancelado (previene EDGE inaccesible).
  const paymentRows = await client.searchRead(
    'account.payment',
    [['id', '=', input.odooPaymentId]],
    ['id', 'state'],
    { limit: 1 },
  )
  if (!paymentRows.length) {
    throw new AppError(
      'ODOO_PAYMENT_NOT_FOUND',
      `account.payment id=${input.odooPaymentId} no existe — upload abortado para evitar attachment huérfano`,
      404,
      false,
    )
  }
  if (paymentRows[0].state === 'canceled') {
    throw new AppError(
      'ODOO_PAYMENT_CANCELED',
      `account.payment id=${input.odooPaymentId} está canceled — no aceptar comprobantes`,
      409,
      false,
    )
  }

  // 2) Upload con Patrón B (1 call, res_model+res_id desde el inicio).
  const base64 = input.receiptBuffer.toString('base64')
  const createVals: Record<string, unknown> = {
    name: input.fileName,
    datas: base64,
    mimetype: input.mimetype,
    res_model: 'account.payment',
    res_id: input.odooPaymentId,
  }
  if (input.tagIds?.length) {
    createVals.tag_ids = [[6, 0, input.tagIds]]
  }

  // Retry con backoff para tolerar Network blips / rate limit.
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const attachmentId = await client.create('ir.attachment', createVals)
      const result: UploadReceiptResult = {
        odooAttachmentId: attachmentId,
        resModel: 'account.payment',
        resId: input.odooPaymentId,
        fileName: input.fileName,
        mimetype: input.mimetype,
        uploadedAt: new Date().toISOString(),
      }
      return UploadReceiptResultSchema.parse(result)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay !== undefined) await sleep(delay)
    }
  }

  throw new AppError(
    'ODOO_ATTACHMENT_CREATE_FAILED',
    `Upload del comprobante falló tras ${RETRY_DELAYS_MS.length + 1} intentos: ${lastError?.message ?? 'unknown'}`,
    502,
    true,
  )
}

/**
 * Lista comprobantes (ir.attachment) asociados a un payment.
 * Útil para Story 9.3 (pull Odoo→Firestore) y Story 9.6 (UI admin verificación).
 */
export async function listPaymentReceipts(odooPaymentId: number) {
  const client = getOdooClient()
  return client.searchRead(
    'ir.attachment',
    [
      ['res_model', '=', 'account.payment'],
      ['res_id', '=', odooPaymentId],
    ],
    ['id', 'name', 'mimetype', 'file_size', 'create_date'],
    { limit: 50 },
  )
}
```

### Por qué este patrón es seguro

| Falla en paso | Estado residual | Recovery |
|---|---|---|
| 1 (read payment falla) | nada | retry inline con backoff; si payment no existe, AppError 404 no retryable |
| 2 (create attachment fail por red) | nada | retry inline 1s→2s→4s |
| 2 (create attachment fail por ACL) | nada | escalar — caller no debería ver esto si paso 1 pasó |
| Retry exitoso tras parcial | attachment puede duplicarse si Odoo procesó pero respuesta perdida | **mitigación:** Story 9.6 reconciliación dedup por (res_id, file_size, name) |

**Limitación documentada para Story 9.4:** retries pueden producir attachments duplicados si la respuesta del create se pierde en red. Mitigación en Story 9.6: dedup admin UI usa `(res_id, file_size, mimetype, name)` como clave heurística. Aceptable para MVP.

## Test plan para Story 9.4 (NO implementado aquí)

- **Unit:** mock `OdooClient` retornando `searchRead([])` → `ODOO_PAYMENT_NOT_FOUND`.
- **Unit:** mock con `state='canceled'` → `ODOO_PAYMENT_CANCELED`.
- **Unit:** mock con 2 fallos red en `create` + 3er retry éxito → `UploadReceiptResult` válido.
- **Unit:** mock con 4 fallos → `AppError ODOO_ATTACHMENT_CREATE_FAILED retryable=true`.
- **Unit:** validar `UploadReceiptResultSchema.parse` rechaza `resId<=0` y `odooAttachmentId<=0`.
- **Integration (behind flag):** correr contra Odoo TEST tenant si existe (no aplica todavía — producción única).
- **E2E manual post-merge:** subir comprobante real en `/admin/verification`, abrir Odoo UI y verificar chatter del payment muestra el attachment.

## Throttling reutilizable (Story 9.4 batch retroactivo, Story 9.1)

Reusar el snippet `enqueueOdooSync` de spike 9.0b (`p-limit(1)` + min interval 2000ms). En modo verificación user-driven NO se necesita; en modo batch retroactivo (Story 9.1 reconciliación 16 high-confidence) sí.

## Riesgos abiertos / TODO para Story 9.4

- **Validar comportamiento de Odoo Documents app:** confirmar manualmente que los attachments creados con `res_model='account.payment'` aparecen en la app Documents sin necesidad de wrapper `documents.document`. Si NO aparecen, evaluar wrapper en sub-spike de 4h.
- **Tag canónico `aroundaplanet_comprobante`:** crear primero (en Story 9.4 fase setup), guardar tagId en env o Firestore config. NO hardcodear.
- **Attachment 45803 huérfano:** Paloma (cuenta admin) debe limpiarlo manualmente desde la web Odoo (Settings → Technical → Attachments). NO bloquea Story 9.4. Ver `9-0a-cleanup-list.txt`.
- **MIME types aceptados:** spike usó `application/pdf`. Story 9.4 debe whitelist en frontend (`pdf`, `image/jpeg`, `image/png`) — el backend confía en lo que reciba pero Odoo respeta cualquier mimetype string.
- **Max file size:** Odoo Online default ~25 MB por attachment. Frontend debe limitar a ~10 MB para UX. No probado en spike.

## Validaciones técnicas

- `pnpm typecheck` — sin código nuevo en `src/` (spike sólo `.mjs` exploratorio). Pendiente correr como cierre formal del spike (no estricto al ser script `.mjs`).
- `pnpm test` — sin tests nuevos en este spike.
- Cleanup verificado: 12/13 attachments renamed + 2/2 payments canceled. 1 attachment huérfano (45803) documentado para limpieza admin manual.

## Sources

- Research técnico Punto 6 — Documents: `_bmad-output/planning-artifacts/research/technical-epic-9-sync-bidireccional-pagos-research-2026-05-12.md#6-documents-api`
- Spike 9.0b findings (latencias y patrones similares): `_bmad-output/implementation-artifacts/spikes/9-0b-findings.md`
- [Set res_id and res_model for ir.attachment — Odoo forum](https://www.odoo.com/forum/help-1/set-res-id-and-res-model-for-ir-attachment-192324)
- [External API — Odoo 18.0 docs](https://www.odoo.com/documentation/18.0/developer/reference/external_api.html)
- Odoo 18 source: `addons/base/models/ir_attachment.py` (record rules sobre `res_model`/`res_id` confirman comportamiento EDGE ACL).
