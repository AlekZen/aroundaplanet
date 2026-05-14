# Story 9.4: Comprobantes en Odoo Documents (Attachment Individual)

Status: draft

> **Tipo:** Feature (S/M)
> **Bloqueada por:** 9.0a (spike `res_id` ✅) · 9.2 (push `syncVerifiedPaymentToOdoo` ✅) · 9.7 (schema canónico Zod ✅)
> **Bloquea:** retro Epic 9 (segundo pilar del sync — comprobantes navegables desde Odoo Documents)
> **Insumos:**
> - `_bmad-output/planning-artifacts/epics.md#Story-9.4` (líneas 1812-1848)
> - `_bmad-output/implementation-artifacts/spikes/9-0a-findings.md` (snippet code-ready `uploadPaymentReceipt`, líneas 148-275; decisiones técnicas líneas 99-146)
> - `_bmad-output/implementation-artifacts/9-0a-spike-documents-res-id.md` (story del spike)
> - `src/lib/odoo/payments-push.ts` (orquestador `syncVerifiedPaymentToOdoo` — enchufe post-push)
> - `src/schemas/paymentSchema.ts` (campos mirror ya definidos: `odooAttachmentIds`, `odooFolderId`, `odooDocumentId`)
> - `src/app/api/payments/[paymentId]/retry-attachment/route.ts` (placeholder 501 dejado por Story 9.6 — esta story lo implementa)

## Story

Como **sistema y admin (Paloma)**,
quiero **que cada comprobante de pago verificado quede como `ir.attachment` individual asociado al `account.payment` correspondiente en Odoo, con tag `aroundaplanet_comprobante`**,
para **que Paloma encuentre los comprobantes desde el chatter del payment o desde Odoo Documents filtrado por tag, sin salir de su flujo contable** y para **que el sistema mantenga trazabilidad 1:1 Firestore↔Odoo de los archivos (NO PDF maestro {Cliente}.pdf, descartado por research Punto 6)**.

## Contexto

- **Spike 9.0a validó Patrón B**: `ir.attachment.create` en un solo XML-RPC call con `name + datas (base64) + mimetype + res_model='account.payment' + res_id=<paymentId> + tag_ids` desde el inicio. p50=199ms / p95=201ms. Más simple y más rápido que Patrón A (create + write). Sin riesgo de attachment huérfano si el write fallara.
- **Regla operacional crítica (spike EDGE)**: si `res_id` apunta a un `account.payment` inexistente o cancelado, el attachment se crea pero **queda inaccesible (ACL record-rule)** y NO se puede limpiar desde nuestro service account. Ya tenemos 1 huérfano residual (id=45803) pendiente de Paloma manual. Por eso el orden es estricto: **payment FIRST → validar existencia y `state != 'canceled'` → attachment AFTER**. NUNCA invertir, ni "para optimizar".
- **Enchufe**: el upload se dispara dentro de `syncVerifiedPaymentToOdoo` (`src/lib/odoo/payments-push.ts:276`), **después** del paso 3 (`pushPaymentToOdoo` exitoso) y **antes** de retornar. Si el push fue exitoso pero el attachment falla, el pago se queda `odooSyncStatus='synced'` pero con flag `odooAttachmentSyncStatus='error'` → la cola UI 9.6 lo mostrará separado (no es regresión del push). Si el push fue `orphan`, el attachment NO se intenta (sin `odooPaymentId` válido no hay donde enganchar).
- **Tag `aroundaplanet_comprobante`**: existe en Odoo 18 como `ir.attachment.tag` (no `documents.tag` — confirmado en spike). Pre-sprint task de esta story: crear vía XML-RPC subagente (mismo patrón que custom fields de 9.7), persistir el `tagId` en Firestore Remote Config (colección `appConfig/odoo`) o env var. NO hardcodear.
- **Múltiples comprobantes por pago**: el shape del schema soporta `odooAttachmentIds: number[]`. MVP de esta story: 1 comprobante = 1 entrada en el array. Diseñado para futuro escalado (re-upload, complemento). Si se sube el mismo pago dos veces, el segundo append.
- **MIME types**: el frontend ya whitelist `pdf | image/jpeg | image/png` (Story 3.1). El backend confía en lo que recibe pero pasa `mimetype` literal a Odoo. Max file size 10 MB (límite UX, Odoo Online acepta hasta ~25 MB).
- **Retroactivo (`/admin/verification` para pagos viejos)**: scope de la story incluye un endpoint `POST /api/payments/{id}/retry-attachment` que reemplaza el placeholder 501 de 9.6. Permite re-subir el comprobante de un pago ya synced si el attachment falló inicialmente. Idempotencia: lee `odooAttachmentIds` actual; si ya existe un attachment con el mismo `file_size + name` enlazado al payment, no duplica. Si no, crea uno nuevo.
- **NO se implementa folder de Documents en esta story**. La asignación de folder canónico por destino+mes+año es Story 9.5 (folder dedup 26 clusters). Mientras tanto: attachment queda al `account.payment` (visible en chatter) y, vía tag, en Odoo Documents sin carpeta — Paloma valida en smoke que sí aparece.

## Acceptance Criteria

### AC1 — Setup pre-sprint: tag `aroundaplanet_comprobante` en Odoo

**Given** la story arranca con Odoo 18 producción
**When** se ejecuta un script de setup (`scripts/setup-9-4-attachment-tag.mjs`, patrón equivalente a `execute-9-7-*`)
**Then** existe el record `ir.attachment.tag` con `name='aroundaplanet_comprobante'` (idempotente: si ya existe, lo reutiliza por search; si no, lo crea).
**And** el `tagId` numérico se guarda en Firestore `appConfig/odoo` campo `attachmentReceiptTagId: number` (o env `ODOO_RECEIPT_TAG_ID` — decidir en task 1; preferencia config Firestore para alinear con custom fields 9.7).
**And** el script imprime el `tagId` y deja registro en `runbooks/9-4-attachment-tag-setup.md`.
**And** la creación del tag NO bloquea el deploy: si la lectura del config falla en runtime, el upload se hace SIN tag (degraded) y el pago queda en `paymentAlerts/` con type=`unknown_method` o nuevo type `missing_tag` (decisión en task 2).

### AC2 — Función `uploadPaymentReceipt()` + módulo `src/lib/odoo/payments-attachments.ts`

**Given** se diseña la integración Odoo Documents
**When** se crea `src/lib/odoo/payments-attachments.ts`
**Then** expone funciones:
- `uploadPaymentReceipt(input: UploadPaymentReceiptInput): Promise<UploadReceiptResult>` — la del snippet 9.0a (líneas 188-258), con dos cambios obligatorios respecto al snippet:
  1. **NO usar `client.searchRead` para validar el payment** (la abstracción `OdooClient` actual ya valida en `pushPaymentToOdoo`; el caller pasa `odooPaymentId` ya confirmado). Saltar la validación pre-upload reduce 1 call y el flujo es seguro porque `uploadPaymentReceipt` solo se llama **después** de un push exitoso (no-orphan).
  2. **Agregar parámetro `tagId?: number`** (resuelto por el caller desde `appConfig/odoo`). Si `tagId` viene definido, incluir `tag_ids: [[6, 0, [tagId]]]` en `createVals` (sintaxis x2many Odoo). Si NO viene, omitir el campo entero.
- `listPaymentReceipts(odooPaymentId: number)` — del snippet líneas 263-274. Útil para `retry-attachment` (verifica si ya existe attachment antes de re-subir) y para Story 9.6 (drill-down "ver comprobantes" en cola).
- `UploadReceiptResultSchema` (Zod, del snippet líneas 158-167) — validar runtime de output.
- `UploadPaymentReceiptInput` type.

**And** el módulo aplica retry con backoff `[1s, 2s, 4s]` máximo 3 reintentos (idéntico al patrón push 9.2).
**And** errores se mapean a `AppError` con `code` específico: `ODOO_ATTACHMENT_CREATE_FAILED` (retryable=true) y `ODOO_ATTACHMENT_INVALID_INPUT` (retryable=false).
**And** logging estructurado: `console.error('[uploadPaymentReceipt]', {firestoreId, odooPaymentId, attempt, error})` para debugging post-mortem.

### AC3 — Descarga del `receiptUrl` desde Firebase Storage

**Given** el upload necesita el binario del comprobante
**When** la función orquestadora prepara el upload
**Then** descarga el archivo desde Firebase Storage usando Admin SDK `getDownloadURL` o `getStream()`:
- Path: `getStorage().bucket().file(<path extraído de receiptUrl>).download()` → retorna Buffer.
- El parseo del path desde `receiptUrl` es robusto: si es URL firmada larga (`https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?token=...`), decodificar el path; si es `gs://bucket/path`, parse directo.
- Helper: `src/lib/storage/download-receipt.ts` con función `downloadReceiptFromUrl(receiptUrl: string): Promise<{buffer: Buffer, mimetype: string, fileName: string}>`.
- El `mimetype` se infiere del Content-Type del file metadata (`file.getMetadata()`) o, fallback, del sufijo del nombre (`.pdf`, `.jpg`, `.png`).
- El `fileName` para Odoo: `comprobante-<firestoreId>.<ext>` (NO el nombre original que pudo ser `IMG_001.jpg` — para que Paloma identifique inequívocamente).

**And** si el download falla:
- 404 / file not found → `AppError('RECEIPT_NOT_FOUND', ...)` retryable=false. Loggear en `paymentAlerts/` type=`attachment_failed` con reason=`receipt_missing`.
- Network / timeout → retryable=true, el orquestador deja el pago en `odooAttachmentSyncStatus='error'` con `odooAttachmentLastError` y `attachmentRetryCount` incrementado.

### AC4 — Enchufe en `syncVerifiedPaymentToOdoo` (orquestación)

**Given** un pago se verifica y `pushPaymentToOdoo` retorna `orphan=false`
**When** la ejecución continúa en `syncVerifiedPaymentToOdoo` (`src/lib/odoo/payments-push.ts` paso 4)
**Then** después de escribir el mirror de push (líneas 308-324), **dispara el upload del comprobante** así:
1. Lee `paymentData.receiptUrl`. Si está vacío/null → skip (loggea en consola, marca `odooAttachmentSyncStatus='skipped_no_receipt'`).
2. Resuelve `tagId` desde `appConfig/odoo` (cache in-memory por proceso, refresh cada 10min — patrón `getOdooClient()`).
3. `downloadReceiptFromUrl(paymentData.receiptUrl)` → buffer + mimetype + fileName canónico.
4. `uploadPaymentReceipt({odooPaymentId: result.odooPaymentId, receiptBuffer, fileName, mimetype, tagId})`.
5. Si OK: persiste mirror **adicional** en el mismo `paymentRef.set({merge:true})`:
   ```ts
   {
     odooAttachmentIds: FieldValue.arrayUnion(uploadResult.odooAttachmentId),
     odooAttachmentSyncStatus: 'synced',
     odooAttachmentSyncedAt: FieldValue.serverTimestamp(),
     odooAttachmentLastError: null,
     attachmentRetryCount: 0,
   }
   ```
6. Si falla: persiste `odooAttachmentSyncStatus='error' + odooAttachmentLastError + FieldValue.increment(attachmentRetryCount)`, y escribe doc en `paymentAlerts/{auto-id}` con shape:
   ```ts
   {
     type: 'attachment_failed',
     paymentId: firestoreId,
     odooPaymentId: result.odooPaymentId,
     status: 'open',
     reason: 'upload_failed' | 'receipt_missing' | 'tag_unavailable',
     errorMessage: <truncated 500>,
     detectedAt: serverTimestamp(),
   }
   ```
7. **El fallo del attachment NO degrada el `odooSyncStatus` del push**. El push sigue `synced`. La separación es deliberada: contabilidad ya está alineada, el comprobante se reintenta en banda lateral (Story 9.6 cola).

**And** el flujo es **best-effort**: cualquier excepción del upload se captura, NO propaga, NO hace re-throw que tumbe el push verde.
**And** los nuevos campos (`odooAttachmentSyncStatus`, `odooAttachmentSyncedAt`, `odooAttachmentLastError`, `attachmentRetryCount`) se agregan a `paymentSchema.ts` (Zod) — extensión del bloque `paymentOdooSyncSchema` líneas 211-214 con un sub-bloque "Attachment sync metadata".

### AC5 — Endpoint `POST /api/payments/{paymentId}/retry-attachment`

**Given** existe el placeholder 501 dejado en Story 9.6 (`src/app/api/payments/[paymentId]/retry-attachment/route.ts`)
**When** se reemplaza por la implementación real
**Then**:
- Valida claims admin (`request.auth.token.admin === true`, mismo guard que `retry-odoo-push`).
- Lee `payments/{paymentId}` (Admin SDK). Si no existe → 404. Si `odooPaymentId` es null → 400 (`PAYMENT_NOT_PUSHED`). Si `odooSyncStatus !== 'synced'` y no es `legacy_linked` → 400 (`PAYMENT_NOT_SYNCED`).
- **Idempotencia**: invoca `listPaymentReceipts(odooPaymentId)` y compara contra el `fileName` canónico que se generaría. Si ya existe un attachment con ese exact name + similar `file_size` (±5%), retorna 200 con `{alreadyExists: true, attachmentId}` SIN crear duplicado, y se asegura que esté en `odooAttachmentIds`.
- Si no existe: ejecuta el mismo flow de AC4 (download + upload + persist mirror).
- Limita rate: 5 retries por pago en 24h (lectura de `attachmentRetryCount`); más allá → 429 (`RATE_LIMITED`) con mensaje "5 retries en 24h superados, escalar a Paloma".
- Tras éxito: marca `paymentAlerts` correspondientes (type=`attachment_failed` para ese `paymentId`) como `status='resolved' + resolvedBy=uid + resolvedAt=serverTimestamp()`.
- Devuelve 200 con `{odooAttachmentId, alreadyExists, retryCount}`.

### AC6 — Pull (9.3) mantiene mirror `odooAttachmentIds` actualizado

**Given** Paloma sube manualmente un comprobante extra en Odoo (futuro escenario, NO bloqueante)
**When** el polling pull corre
**Then** por cada `account.payment` synced en este ciclo, el pull invoca `listPaymentReceipts(odooPaymentId)` (en batch o por payment, decidir en task 5 según rate-limit budget).
**And** actualiza `payments/{paymentId}.odooAttachmentIds` con el array de IDs vivos en Odoo (NO solo append, sino reemplazo del array — refleja lo que Paloma realmente ve).
**And** si detecta IDs nuevos respecto al snapshot anterior, registra evento `syncLog/odooPull-<runId>` con `attachmentsAdded`.
**And** este AC NO se entrega si el costo del rate-limit es prohibitivo (más de 30 paymentos synced → 30 calls extra por corrida). Decisión a tomar en task 5; si se difiere, queda como story 9.4b backlog.

### AC7 — Schema Zod extendido + Firestore rules

**Given** se agregan campos nuevos al doc `payments`
**When** se actualiza `src/schemas/paymentSchema.ts`
**Then** se extiende `paymentOdooSyncSchema` con:
```ts
// === Attachment sync metadata (Story 9.4) ===
odooAttachmentSyncStatus: z.enum(['never', 'synced', 'error', 'skipped_no_receipt']).optional(),
odooAttachmentSyncedAt: lwwTimestamp.nullable().optional(),
odooAttachmentLastError: z.string().max(2000).nullable().optional(),
attachmentRetryCount: z.number().int().min(0).optional(),
```
**And** se agrega refine: `odooAttachmentSyncStatus === 'synced'` requiere `odooAttachmentIds.length > 0`.
**And** `firestore.rules`: `paymentAlerts` ya escribible solo por server (Admin SDK) — sin cambios. Lectura admin desde Story 9.6 sigue aplicando.
**And** se agrega entry en `PAYMENT_FIELD_OWNERSHIP`: los 4 campos nuevos son `bridge` (los escribe el sync, NO Firestore-owned ni Odoo-owned puro).

### AC8 — UI Sync Console: tab "Comprobantes" o columna nueva en cola

**Given** la consola `/admin/payments/sync-console` ya existe (Story 9.6)
**When** se agrega visibilidad de attachments
**Then** **decisión preferida**: extender la tabla "Cola de push" con una columna "Comprobante" con 3 estados visuales:
- ✅ Synced (badge verde, click → tooltip con `odooAttachmentIds`)
- ⚠️ Error (badge amarillo, click → tooltip con `odooAttachmentLastError`)
- ⏳ Pendiente / N/A (gris)

**And** en la cola un botón secundario "Reintentar comprobante" llama a `POST /api/payments/{id}/retry-attachment` (reemplaza el placeholder de 9.6). Acción confirma con toast el resultado (sync OK / ya existía / error).
**And** la tabla "Alertas" muestra `type='attachment_failed'` (ya soportado por shape de alertas 9.6, solo registrar el tipo y label en `AlertsTable.tsx`).
**And** NO se agrega tab dedicado "Comprobantes" — los attachments viven asociados al pago, la cola del pago es el lugar natural. Si futuro requiere vista cross-pago: scope de story posterior.

### AC9 — Smoke prod end-to-end con browser real

**Given** la story está deployada a prod
**When** Alek (o Paloma post-fix) ejecuta el smoke
**Then** verifica los 7 escenarios:
1. **Happy path**: nuevo pago verificado → `odooSyncStatus=synced` + `odooAttachmentSyncStatus=synced` + abrir Odoo UI `account.payment` y ver el attachment en chatter con tag `aroundaplanet_comprobante`.
2. **Pago sin `receiptUrl`** (legacy): se sincroniza pago en Odoo, attachment status = `skipped_no_receipt`, sin alerta.
3. **Download fail**: simular borrando temporal el blob → reintentar genera `paymentAlerts/attachment_failed` reason=`receipt_missing` + cola Console muestra warning.
4. **Upload fail (tag invalid)**: temporal cambiar `tagId` en config a un id inexistente → upload retornará error Odoo → alerta `tag_unavailable`, `attachmentRetryCount=1`, retry desde Console resuelve tras restaurar config.
5. **Retry desde Console**: pulsar "Reintentar comprobante" en pago con `odooAttachmentSyncStatus=error` → llama endpoint → si ya existe, retorna idempotente; si no, sube. UI refresca a `synced`.
6. **Idempotencia retry**: pulsar 2x el retry → segundo call retorna `alreadyExists: true`, NO duplica attachment.
7. **Buscar en Odoo Documents**: filtrar por tag `aroundaplanet_comprobante` → aparecen los attachments subidos por la story (validar con Paloma).

**And** los 7 escenarios pasan o quedan documentados con bug + plan de remediación.
**And** el smoke se hace con browser real Playwright MCP (NO solo unit/integration tests) — regla aprendida sesión 38.

## Tasks

### Task 1 — Setup tag `aroundaplanet_comprobante` y config Firestore (AC1)
1.1 Script `scripts/setup-9-4-attachment-tag.mjs`: idempotente, busca o crea `ir.attachment.tag` por name. Imprime tagId.
1.2 Persistir tagId en Firestore `appConfig/odoo.attachmentReceiptTagId` vía Admin SDK (script o manual). Documentar.
1.3 Helper `src/lib/odoo/config.ts` con `getReceiptTagId(): Promise<number | null>` con cache in-memory TTL 10min.
1.4 Runbook `_bmad-output/implementation-artifacts/runbooks/9-4-attachment-tag-setup.md` con pasos exactos + output capturado.

### Task 2 — Schema Zod + helpers (AC7)
2.1 Extender `paymentOdooSyncSchema` con los 4 campos nuevos + refine.
2.2 Agregar entries a `PAYMENT_FIELD_OWNERSHIP` (4 × `bridge`).
2.3 Tests Zod: valid/invalid casos del refine.
2.4 Si decidimos endpoint level: extender `paymentAlertSchema.ts` para incluir `type='attachment_failed'` con sub-`reason` enum.

### Task 3 — Módulo `payments-attachments.ts` (AC2)
3.1 `src/lib/odoo/payments-attachments.ts` con `uploadPaymentReceipt` + `listPaymentReceipts` + `UploadReceiptResultSchema`.
3.2 Test co-localizado `payments-attachments.test.ts` con mock `OdooClient`: happy path, retry-then-success, max-retries-fail, tagId optional.
3.3 Validación: `pnpm typecheck` 0 errores + tests verde.

### Task 4 — Helper download Firebase Storage (AC3)
4.1 `src/lib/storage/download-receipt.ts` con `downloadReceiptFromUrl(url)`.
4.2 Soporta URLs firmadas Firebase + `gs://` paths.
4.3 Infiere mimetype desde metadata; fallback por sufijo.
4.4 Tests co-localizados con mock `getStorage`.

### Task 5 — Enchufe en `syncVerifiedPaymentToOdoo` + pull update mirror (AC4, AC6)
5.1 Modificar `src/lib/odoo/payments-push.ts:308-324` agregando bloque post-push.
5.2 Capturar todo en try/catch independiente. Persistir mirror attachment.
5.3 Escribir alerta en `paymentAlerts/` si falla.
5.4 Decisión AC6: implementar mirror sync en pull o diferir a 9.4b. Documentar decisión en story con argumento rate-limit (probable: implementar pero limitando a `attachments_audit_every_n_runs=4` → cada hora, no cada 15min).
5.5 Tests existentes de `syncVerifiedPaymentToOdoo` (>20) deben seguir pasando + nuevos tests del bloque attachment.

### Task 6 — Endpoint retry-attachment real (AC5)
6.1 Reemplazar 501 placeholder en `src/app/api/payments/[paymentId]/retry-attachment/route.ts`.
6.2 Guards (admin, payment existe, synced/legacy_linked, retry count <5/24h).
6.3 Idempotencia vía `listPaymentReceipts` + comparación nombre+size.
6.4 Marcar alertas `attachment_failed` como `resolved` tras éxito.
6.5 Tests co-localizados cubriendo: éxito, idempotencia, payment no-synced, rate-limit, fallo cascade.

### Task 7 — UI Sync Console: columna comprobante (AC8)
7.1 Modificar `src/app/(admin)/admin/payments/sync-console/PushQueueTable.tsx`: agregar columna "Comprobante" con badge.
7.2 Modificar el modal de la fila (o ya existente botón "Reintentar push"): agregar botón secundario "Reintentar comprobante".
7.3 Modificar `AlertsTable.tsx`: registrar label y acción para `type='attachment_failed'` (filtros, badge, drill-down).
7.4 Tests Vitest co-localizados: render del badge en 4 estados, click reintentar dispara fetch correcto.

### Task 8 — Smoke prod + validaciones (AC9)
8.1 Deploy via skill `/deploy` (typecheck + lint + vitest + push master).
8.2 Smoke real con Playwright MCP en prod URL: 7 escenarios AC9.
8.3 Confirmación visual en Odoo UI (chatter del payment + Documents filtrado por tag) con Paloma o cuenta admin disponible.
8.4 Si bugs: ciclo corregir → re-deploy. Si OK: marcar story `done` en `sprint-status.yaml` + actualizar `MEMORY.md`.

## Dev Notes (anti-trampas heredadas)

1. **Orden estricto payment → attachment NUNCA invertir**. Si lo "optimizas" creando attachment primero, dejas un `ir.attachment` huérfano ACL-locked que ni nosotros podemos limpiar. Hay 1 (id=45803) en prod como evidencia. (Spike 9.0a EDGE — líneas 61-72 findings.)
2. **`buildMemo()` y otros campos derivados**: el push usa memo derivado de `clientName+orderId`. El attachment NO toca memo Odoo. Si en futuro queremos memo alineado, NO via attachment.
3. **Patrón B (1 call) sobre Patrón A (2 calls)**: confirmado por spike. NO usar Patrón A "por defensa" — Patrón B es atómico, A puede dejar attachment sin res_id si el segundo write falla.
4. **`unlink` y `state='cancel'` están PROHIBIDOS en Odoo** (regla firme negocio). Para cleanup en tests/spike: rename `_CLEANED_<ts>`. Para retirar attachment en prod: NO se retira automático — Paloma lo maneja manual via UI Odoo. Esta story NO implementa "borrar attachment Firestore-side".
5. **Tag x2many syntax Odoo**: `tag_ids: [[6, 0, [tagId]]]` (replace all). Si necesitas append: `[[4, tagId]]`. MVP usa replace porque el attachment es nuevo y solo necesita 1 tag.
6. **Service Worker Serwist (regla sesión 38)**: post-deploy validar en browser con nav a otra ruta + bust query string. UI columna nueva no se ve si SW cachea bundle viejo.
7. **firebase-admin set+merge con FieldPath**: NUNCA usar claves con punto literales (`'lww.memo.value'`). Siempre objeto nested literal `{ lww: { memo: { value } } }`. Aplica a `odooAttachmentIds` con `FieldValue.arrayUnion` que es nativo (sin punto).
8. **Rate-limit Odoo (60 req/min)**: cada upload = 1 call (Patrón B) más, opcionalmente, `listPaymentReceipts` en retry idempotente (+1 call). Cap 30 uploads/min — suficiente para verificación user-driven. Para AC6 (pull update mirror), aplicar throttle `enqueueOdooSync` de spike 9.0b.
9. **Tests con mocks NO detectan bugs de field names ni ACL**: regla del proyecto. AC9 smoke con browser real es OBLIGATORIO antes de marcar `done`. Lecciones sesión 38 confirman: 4 bugs cazados solo en prod (amount vs amountCents, fallback nombre, rules deploy silencioso, etc).
10. **Si me ciclo en hipótesis tras 2 fallos** (regla retro 9.6): delegar audit fresh-context a subagente Sonnet con brief "NO ASUMAS, COMPRUEBA".

## Test Plan (resumen)

| Capa | Casos clave |
|---|---|
| Unit `payments-attachments.test.ts` | happy / retry-then-success / max-retries-fail / tagId omit / Zod parse output |
| Unit `download-receipt.test.ts` | Firebase signed URL / gs:// / mimetype infer / 404 / network |
| Unit `payments-push.test.ts` extensión | push synced + attachment OK / push synced + attachment fail (mirror correcto + alerta escrita) / push orphan → NO intento de attachment |
| Unit `retry-attachment/route.test.ts` | éxito / payment no-synced / idempotencia (alreadyExists) / rate-limit 6º intento / no admin → 403 |
| Unit `PushQueueTable.test.tsx` | render badge 4 estados / click retry attachment dispara fetch correcto |
| Unit `AlertsTable.test.tsx` | render alert type=attachment_failed con reason específico |
| Integration (smoke local) | nuevo pago end-to-end con Odoo TEST tenant si existe (skip si no — fallback prod en AC9) |
| E2E Playwright (skip por ahora, helper auth pendiente) | escenario completo verificación → ver attachment en cola Console |
| Smoke prod (manual + Playwright MCP) | 7 escenarios AC9 con browser real |

## Senior Developer Review (AI) — placeholder

Se completa post-implementación con subagente Sonnet fresh-context (patrón sesión 38).

## Definition of Done

- [ ] AC1-AC9 satisfechos.
- [ ] `pnpm typecheck` 0 errores.
- [ ] `pnpm lint` 0 errores.
- [ ] `pnpm test` verde (baseline 1517 + nuevos).
- [ ] Code-review subagente Sonnet outcome no peor que "approved with minor".
- [ ] Deploy prod via skill `/deploy` exitoso, Cloud Run revision matchea commit.
- [ ] Smoke prod AC9 7/7 escenarios validados (o 6/7 con escalable documentado).
- [ ] `_bmad-output/implementation-artifacts/sprint-status.yaml` story 9.4 → `done`.
- [ ] `MEMORY.md` actualizada con resumen + lecciones nuevas.
- [ ] (Opcional) Retro lessons en `retrospectives/9-4-retrospective.md`.

## Pendientes documentados (NO bloquean DoD)

- AC6 mirror sync vía pull: implementar con throttle o diferir a 9.4b según rate-limit observado.
- Story 9.5 folder dedup: cuando se entregue, agregar paso "asignar folder canónico" al upload (Task 5 será modificado).
- Attachment huérfano id=45803: limpieza manual Paloma (Settings → Technical → Attachments). NO bloquea esta story.
- Migración retroactiva masiva de comprobantes de pagos legacy (200 reales pre-Epic 9): scope separado, requiere lote nightly throttled. Story 9.1 ya enlazó referencias; subir comprobantes históricos puede ir como story 9.4c backlog si Paloma lo pide.

## Estimación

- **Tamaño**: M (medium). Razón: 2 helpers nuevos + 1 endpoint real + extensión orquestador + UI columna + setup tag + smoke. No es L porque el spike ya entregó snippet code-ready y los hooks del schema ya existen.
- **Esfuerzo estimado**: 1.5-2 días dev + 0.5 día smoke prod = ~2-2.5 días totales.
- **Riesgo principal**: descarga de Firebase Storage con URLs firmadas de tipos variados (URL legacy vs nueva, paths con caracteres especiales). Mitigación: helper aislado con tests de cada shape.
