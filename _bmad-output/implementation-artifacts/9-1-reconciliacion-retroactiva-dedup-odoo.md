# Story 9.1: Reconciliación Retroactiva Firestore↔Odoo + Dedup Interno Odoo

Status: ready-for-dev

> **Tipo:** Feature (Large) — PARTE A (read-only Odoo) + PARTE B (writes acotados a 2 custom fields Odoo)
> **Bloquea:** Story 9.2 (push) — necesita `odooPaymentId` mapeados y duplicados canónicamente marcados antes de iniciar push idempotente
> **Bloqueada por:**
> - Story 9.7 (schema Zod canónico + custom fields Odoo) — **DONE**
> - Story 9.0b (spike idempotencia 2-call) — `ready-for-dev`, sus hallazgos aplican a PARTE B
> **Supersede:** 9-1a (PARTE A sola — diferida originalmente) + 9-1b (PARTE B sola — diferida originalmente). Esta story consolida ambas tras confirmar 2026-05-12 que los custom fields del runbook 9.7 ya existen en Odoo producción.

## Story

Como **admin (Paloma)**,
quiero dos pantallas administrativas — `/admin/payments/reconciliation` (PARTE A) y `/admin/odoo/duplicates` (PARTE B) — para (1) enlazar retroactivamente los pagos Firestore con los `account.payment` legacy de Odoo vía `odooPaymentId`, y (2) marcar canónicos/secundarios dentro de Odoo en los 17 clusters de duplicados internos detectados, **sin borrar ni cancelar nada** y escribiendo en Odoo **solo** a los dos campos custom autorizados (`x_dup_status` y `x_canonical_payment_id`),
para que cuando Story 9.2 (push Firestore→Odoo) arranque, el sistema parta de un estado consistente: cada pago Firestore con su `odooPaymentId` resuelto, cada cluster de duplicados Odoo con un canónico identificado, y todas las decisiones auditables en Firestore.

## Contexto

### Verificación clave 2026-05-12

Hoy se confirmó (vía API por subagente, no por Paloma) que los custom fields definidos en el runbook 9.7 **ya existen en `account.payment` de Odoo producción**. Detalle en `_bmad-output/implementation-artifacts/runbooks/9-7-execution-log.md`:

| Campo | Tipo | ID Odoo |
|---|---|---|
| `x_firebase_payment_id` | char (indexed) | 22927 |
| `x_firebase_agent_uid` | char | 22933 |
| `x_ocr_confidence` | float | 22935 |
| `x_canonical_payment_id` | many2one a `account.payment` | 22937 |
| `x_dup_status` | selection (`canonico` / `secundario` / null) | 22939 |

### DIVERGENCIA vs research original

El research técnico (`technical-epic-9-sync-bidireccional-pagos-research-2026-05-12.md`) propuso usar tags `account.account.tag` con valores `dup-canonico` / `dup-secundario` para marcar duplicados. **Esos tags NO se crearon.** En su lugar se usa el campo `selection` `x_dup_status` directamente en `account.payment`. Es funcionalmente equivalente, más simple, y elimina la dependencia de mantener un vocabulario externo en `account.account.tag`.

**Implicación para esta story:** toda la lógica de PARTE B se basa en escribir/leer `x_dup_status` + `x_canonical_payment_id` directamente en `account.payment`, NO en tags.

### Auditoría datos reales (sesión 35)

`scripts/audit-output/cross-match-result.json` + memoria `session-35-payments-sync-audit.md`:

- **31 pagos Firestore** (todos test 2026-05-11) vs **200 `account.payment` Odoo** (60 d reales).
- **Cross-match Firestore↔Odoo** (`partner+amount±$1+date±3d`):
  - 16 high-confidence
  - 12 medium
  - 3 low
  - 0 Firestore-only sin candidato
  - 175 Odoo-only sin Firestore (no se tocan en PARTE A)
- **Dedup interno Odoo**: 17 clusters detectados (mismo partner+amount±$1+date±3d agrupando solo lado Odoo).
- 8 de 31 pagos Firestore tienen `clientName` faltante (denormalización pendiente desde `orders.contactName`).

## Alcance

### Incluye

**PARTE A — Reconciliación retroactiva Firestore↔Odoo (read-only Odoo):**

1. Endpoint `GET /api/admin/payments/reconciliation` (lee Firestore y Odoo, NO escribe Odoo).
2. Endpoint `POST /api/admin/payments/reconciliation/[firestorePaymentId]/confirm` (escribe SOLO Firestore).
3. Endpoint `POST /api/admin/payments/reconciliation/[firestorePaymentId]/reject` (escribe SOLO Firestore — log).
4. UI `/admin/payments/reconciliation` con 3 secciones (high/medium/low) + cola enlazados.
5. Colección Firestore `paymentReconciliationLog` para auditoría.

**PARTE B — Dedup interno Odoo (writes ACOTADOS):**

6. Endpoint `GET /api/admin/odoo/payments/duplicates` (lee Odoo y detecta clusters, NO escribe).
7. Endpoint `POST /api/admin/odoo/payments/duplicates/set-canonical` (escribe en Odoo `x_dup_status` + `x_canonical_payment_id` y en Firestore log).
8. UI `/admin/odoo/duplicates` con clusters agrupados + modal de confirmación irreversible.
9. Colección Firestore `paymentDedupLog` para auditoría de cada acción de marcado.

### Excluye explícitamente

- **NO se escribe a `payments` en Odoo** salvo a los campos `x_dup_status` y `x_canonical_payment_id`. Cualquier otro `write({...})` es bug.
- **NO se hace `unlink`**, **NO se cancela** (`action_cancel` / `state='cancel'`), **NO se modifica `name`/`amount`/`partner_id`/`journal_id`/`date`** en ningún `account.payment` legacy.
- **NO se crean tags** `dup-canonico` / `dup-secundario` (decisión 2026-05-12, se usa `x_dup_status`).
- **NO se crean `ir.model.data`** para legacy en esta story (eso es Story 9.2).
- **NO se hace folder dedup Documents** (eso es Story 9.5).
- **NO se desenlazan pagos** (`odooPaymentId` seteado solo se limpia vía consola en caso emergencia).
- **NO se reasigna canónico** una vez confirmado (acción irreversible vía UI; reversión solo en consola).

## Acceptance Criteria

### PARTE A — Reconciliación Firestore↔Odoo

#### AC1: Endpoint `GET /api/admin/payments/reconciliation`

**Given** un usuario autenticado con rol `admin` o `superadmin`
**When** ejecuta `GET /api/admin/payments/reconciliation?status=pending&agentId=...&tripId=...`
**Then** el endpoint:
1. Lee la colección `payments` de Firestore (filtrada opcionalmente por `agentId`, `tripId`).
2. Lee `account.payment` de Odoo vía `OdooClient.searchRead` con dominio `[('state','in',['draft','in_process','paid'])]` (lectura pura, sin paginación bloqueante; loop hasta agotar).
3. Cruza ambos sets con la heurística `partner+amount±$1+date±3d` (Jaccard sobre `partner_name` normalizado a lowercase sin acentos; |Δamount| ≤ 100 centavos; |Δdate| ≤ 3 días naturales).
4. Clasifica cada pago Firestore en uno de 4 buckets:
   - `high` — partner Jaccard = 1.0 ∧ amountDiff = 0 ∧ dateDiff ≤ 1
   - `medium` — partner Jaccard ≥ 0.6 ∧ amountDiff ≤ $1 ∧ dateDiff ≤ 3
   - `low` — al menos 2 de 3 criterios sin llegar a medium
   - `none` — sin candidato razonable
5. Excluye automáticamente los pagos Firestore con `odooPaymentId !== null` (ya enlazados) salvo `status=matched`.
6. Filtra pares ya rechazados (`paymentReconciliationLog` con `action='rejected'` para ese `firestoreId+odooId`).
7. Responde JSON directo (sin wrapper `{success,data}`), shape validado por Zod (`reconciliationGetResponseSchema`):
   ```ts
   {
     generatedAt: string,      // ISO
     summary: { high: number, medium: number, low: number, none: number, matched: number },
     buckets: {
       high: ReconciliationCandidate[],
       medium: ReconciliationCandidate[],
       low: ReconciliationCandidate[],
       none: FirestorePaymentSummary[],
     }
   }
   ```

**And** `ReconciliationCandidate` incluye, lado a lado: `firestoreId`, `firestorePayment` (subset partner/clientName/agentName/amount/paymentDate/paymentMethod/orderId), `odooId`, `odooPayment` (subset partner_id/partner_name/amount/date/journal_id/journal_name/state/ref), `diff: { amountDiff, dateDiff, partnerJaccard }`, `confidence`, `reasons: string[]`, `warnings: string[]`.
**And** si el caller NO es admin/superadmin, responde `403` con `AppError { code: 'forbidden', message, retryable: false }`.

#### AC2: Endpoint `POST /api/admin/payments/reconciliation/[firestorePaymentId]/confirm`

**Given** admin autenticado, body `{ odooPaymentId: number, confidence: 'high'|'medium'|'low', notes?: string }` (validado por Zod)
**When** se llama el endpoint con un `firestorePaymentId` válido
**Then** Firestore `runTransaction`:
1. Verifica que `payments/{firestorePaymentId}` existe y `odooPaymentId === null`.
2. Verifica unicidad: ningún otro doc en `payments` tiene `odooPaymentId === body.odooPaymentId` (query CG con `where('odooPaymentId','==',body.odooPaymentId)`).
3. Actualiza `payments/{firestorePaymentId}` con `odooPaymentId`, `linkedAt = serverTimestamp()`, `linkedBy = auth.uid`.
4. Crea `paymentReconciliationLog/{autoId}` con `{ firestorePaymentId, odooPaymentId, confidence, action: 'linked', adminUid, adminEmail, notes, createdAt: Timestamp }`.

**And** NO ejecuta ningún XML-RPC a Odoo durante el confirm.
**And** responde `200` con `{ firestorePaymentId, odooPaymentId, linkedAt }`.
**And** si pago ya enlazado → `409 AppError { code: 'already_linked', retryable: false }`.
**And** si `odooPaymentId` ya tomado por otro Firestore doc → `409 AppError { code: 'odoo_id_taken', retryable: false }`.

#### AC3: Endpoint `POST /api/admin/payments/reconciliation/[firestorePaymentId]/reject`

**Given** admin autenticado, body `{ odooPaymentId: number, reason: string }`
**When** Paloma descarta un match propuesto
**Then** crea `paymentReconciliationLog/{autoId}` con `action: 'rejected'`, `firestorePaymentId`, `odooPaymentId`, `reason`, `adminUid`, `createdAt`.
**And** el pago Firestore permanece sin `odooPaymentId`.
**And** NO escribe a Odoo.
**And** futuras llamadas GET excluyen el par rechazado (AC1.6).

#### AC4: Warning de `clientName` faltante

**Given** un pago Firestore con `clientName === null` o `clientName === ''`
**When** aparece en cualquier bucket
**Then** se incluye en `warnings: ['missing_clientName']`.
**And** la UI muestra banner naranja en la card: *"Resolver clientName desde orders.contactName antes de matchear"*.
**And** el botón "Confirmar match" se deshabilita para ese pago (rechazo sigue habilitado).
**And** UI ofrece link a `/admin/orders/[orderId]` si `orderId` existe.

#### AC5: UI `/admin/payments/reconciliation`

**Given** admin navega a la ruta
**When** la pantalla carga (Server Component pre-fetcha GET inicial; interacciones en Client Component con `revalidatePath`)
**Then** veo:
- Header con contadores (`16 high · 12 medium · 3 low · 0 sin match · N enlazados`).
- Filtros: dropdown `status` (`pending` default / `matched`), dropdown `agentId` (desde `odooAgents`), dropdown `tripId` (desde trips publicados).
- 3 `<Accordion>` plegables: High (abierto), Medium (abierto), Low (cerrado por default).
- Cada candidato = 2 columnas lado a lado (`<Card>` Firestore izq, `<Card>` Odoo der) con campos comparables (monto, fecha, partner, método/journal, agente).
- Badges con `confidence` y `reasons` legibles (ej. `partner✓(jac=1.00)`, `Δmonto=0`, `Δdías=1`).
- Botones "Confirmar match" (variant default) + "No es match" (variant outline).
- Skeleton (`<Skeleton />`) durante carga, NUNCA spinner.
- Error boundary del route group `(admin)`.
- Optimistic update + toast con `sonner`.

#### AC6: Auditoría visible

**Given** admin filtra por `status=matched`
**When** la pantalla carga
**Then** veo pagos enlazados con `firestoreId`, `odooPaymentId`, `linkedAt`, `linkedBy (email)`, `confidence`, y botón "Ver log" que abre modal con `paymentReconciliationLog` para ese par.
**And** la lista es read-only (no desenlazar).

### PARTE B — Dedup interno Odoo

#### AC7: Endpoint `GET /api/admin/odoo/payments/duplicates`

**Given** admin autenticado
**When** ejecuta `GET /api/admin/odoo/payments/duplicates`
**Then** el endpoint:
1. Lee TODOS los `account.payment` Odoo con `state in ('draft','in_process','paid')` vía `OdooClient.searchRead` (campos: `id, name, ref, amount, date, partner_id, journal_id, state, x_dup_status, x_canonical_payment_id`).
2. Agrupa en clusters por la clave normalizada `partner_id` + `bucket_amount` (±$1, rounding al peso) + `bucket_date` (ventana 3d).
3. Filtra clusters con ≥2 elementos.
4. Para cada cluster, calcula `currentState`:
   - `unmarked` — ningún miembro con `x_dup_status`
   - `canonical_set` — exactamente uno con `x_dup_status='canonico'` y resto `secundario` apuntando con `x_canonical_payment_id`
   - `inconsistent` — cualquier otro estado (múltiples canónicos, secundarios sin canonical_id, canonical_id apuntando fuera del cluster)
5. Responde JSON validado por Zod (`duplicatesGetResponseSchema`):
   ```ts
   {
     generatedAt: string,
     summary: { totalClusters: number, unmarked: number, canonicalSet: number, inconsistent: number },
     clusters: DuplicateCluster[],
   }
   ```
   donde `DuplicateCluster = { clusterId: string, currentState, members: OdooPaymentRow[], canonicalId: number|null }`.

**And** `clusterId` es estable entre llamadas (hash determinista de los `id` ordenados).
**And** si caller NO es admin/superadmin → `403`.
**And** NO se escribe en Odoo.

#### AC8: Endpoint `POST /api/admin/odoo/payments/duplicates/set-canonical`

**Given** admin autenticado, body `{ clusterId: string, canonicalOdooId: number, memberOdooIds: number[] }` (validado por Zod, `memberOdooIds.length ≥ 2`, `canonicalOdooId ∈ memberOdooIds`)
**When** Paloma confirma el canónico de un cluster
**Then** el endpoint:
1. **Pre-flight:** re-ejecuta el cluster detection sobre los `memberOdooIds` para verificar que (a) todos existen, (b) comparten partner/amount/date dentro de tolerancia, (c) `currentState === 'unmarked'` (rechaza si ya marcado: `409 already_set`).
2. **Write Odoo idempotente** vía `OdooClient.write`:
   - Sobre `account.payment` ID = `canonicalOdooId`: `write({ x_dup_status: 'canonico', x_canonical_payment_id: false })`
   - Sobre cada secundario en `memberOdooIds.filter(id => id !== canonicalOdooId)`: `write({ x_dup_status: 'secundario', x_canonical_payment_id: canonicalOdooId })`
   - Calls secuenciales con throttle del `OdooClient` (≤60 req/min). Cada call con retry exponencial 1s→2s→4s (max 3) ya provisto por el client.
3. **Post-write verification:** read-back de los `memberOdooIds` y valida que `x_dup_status` quedó consistente. Si NO → marca el log con `status: 'partial'` (no aborta; ya escribió lo que pudo) y devuelve `207` con detalle.
4. **Write Firestore:** crea `paymentDedupLog/{autoId}` con:
   ```ts
   {
     clusterId: string,
     canonicalOdooId: number,
     secondaryOdooIds: number[],
     memberOdooIds: number[],
     adminUid: string,
     adminEmail: string | null,
     action: 'set_canonical',
     status: 'success' | 'partial',
     verifyResult: Record<number, { x_dup_status: string|null, x_canonical_payment_id: number|null }>,
     createdAt: Timestamp,
   }
   ```

**And** restricciones inviolables:
- NUNCA se ejecuta `unlink`.
- NUNCA se modifica `state` (no `action_cancel`, no `action_post`).
- NUNCA se modifica `amount`, `partner_id`, `date`, `journal_id`, `name`, `ref`.
- SOLO se escriben los campos `x_dup_status` y `x_canonical_payment_id`.

**And** respuestas:
- `200` con `{ clusterId, canonicalOdooId, secondaryOdooIds, status: 'success' }` si verify pasa.
- `207` con `{ ..., status: 'partial', verifyResult }` si algún secundario no quedó actualizado (Paloma reintenta vía UI).
- `409 AppError { code: 'already_set' }` si el cluster ya estaba marcado (`currentState !== 'unmarked'`).
- `400 AppError { code: 'invalid_cluster' }` si pre-flight detecta miembros que ya no coinciden o no existen.

#### AC9: UI `/admin/odoo/duplicates`

**Given** admin navega a la ruta
**When** la pantalla carga (Server Component pre-fetcha GET; acciones en Client Component)
**Then** veo:
- Header con contadores (`17 clusters · 17 unmarked · 0 canonical_set · 0 inconsistent`).
- Lista de clusters como `<Card>` apilados, cada uno con:
  - Resumen: partner, monto, rango fechas, journal(s), # miembros.
  - Tabla interna con miembros (columns: `id`, `name`, `ref`, `date`, `journal`, `state`, `x_dup_status` actual).
  - Para clusters `unmarked`: botón "Marcar canónico" por fila → al click abre modal de confirmación.
  - Para clusters `canonical_set`: badge verde "Canónico definido" + read-only (sin acciones).
  - Para clusters `inconsistent`: badge rojo "Estado inconsistente — revisar manual" + tooltip con detalle.
- Modal de confirmación (irreversible):
  - Resumen: "Marcarás `payment #{id}` como CANÓNICO y los otros {n} como SECUNDARIOS."
  - Lista visible de canónico vs secundarios.
  - Checkbox "Entiendo que esta acción se escribe en Odoo y NO se puede revertir desde la UI".
  - Botón "Confirmar" deshabilitado hasta marcar checkbox.
- Optimistic update + toast `sonner` con resultado (`success` o `partial`).
- Skeleton durante carga.

#### AC10: Auditoría dedup

**Given** admin click "Ver log" en un cluster ya marcado
**When** se abre modal
**Then** muestra todas las entradas de `paymentDedupLog` filtradas por `clusterId`, ordenadas desc por `createdAt`, con `adminEmail`, `action`, `status`, `verifyResult` legible.

### Transversales

#### AC11: Seguridad

**Given** Firestore Security Rules
**When** un cliente no-admin intenta escribir/leer `paymentReconciliationLog` o `paymentDedupLog`, o escribir `payments/{id}.odooPaymentId`
**Then** la operación se rechaza por rules.
**And** los endpoints validan claims `roles` server-side (NO confían en el cliente).
**And** `paymentDedupLog` y `paymentReconciliationLog` son RW solo para `admin`/`superadmin`.
**And** acceso a `OdooClient` solo desde server (API routes), nunca desde Client Components directamente.

#### AC12: Tests

**Given** el código nuevo
**When** se ejecuta `pnpm test`
**Then** los siguientes archivos co-located cubren:
- `src/lib/payments/reconciliationMatch.ts` + `.test.ts` — scoring puro Firestore↔Odoo, ≥8 casos.
- `src/lib/payments/duplicateClustering.ts` + `.test.ts` — clustering puro Odoo↔Odoo (mismo bucket key + verificación cluster, ≥6 casos: 2-miembros simple, 3-miembros, partner distinto, monto $1 off válido, fecha 4d inválido, cluster ya marcado).
- `src/schemas/reconciliationSchema.ts` + `.test.ts`
- `src/schemas/dedupSchema.ts` + `.test.ts`
- `src/app/api/admin/payments/reconciliation/route.test.ts` — GET con OdooClient mockeado.
- `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/confirm/route.test.ts` — happy, 409 already_linked, 409 odoo_id_taken, log creado.
- `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/reject/route.test.ts` — log creado, no toca payment doc.
- `src/app/api/admin/odoo/payments/duplicates/route.test.ts` — GET con clusters mockeados.
- `src/app/api/admin/odoo/payments/duplicates/set-canonical/route.test.ts` — happy path con `OdooClient.write` mockeado (verifica que se llaman EXACTAMENTE los 2 fields y NADA MÁS), 409 already_set, 400 invalid_cluster, 207 partial cuando verify falla parcial.

**And** los tests del endpoint set-canonical verifican explícitamente que `OdooClient.write` NUNCA se llamó con keys distintas a `['x_dup_status','x_canonical_payment_id']` (assertion estricta sobre args).
**And** suite total ≥1227 pasando (sin regresiones).

#### AC13: Browser smoke real

**Given** dev local con `pnpm dev` y `.env.local` apuntando a producción Odoo
**When** el dev ejecuta:

**PARTE A:**
1. Login con cuenta admin (`ocompudoc@gmail.com`).
2. Navega a `/admin/payments/reconciliation`.
3. Verifica contadores correctos (16 high / 12 medium / 3 low aprox vs `cross-match-result.json`).
4. Confirma **1 match high-confidence** real.
5. Verifica en Firebase Console que `payments/{firestoreId}.odooPaymentId` se setteó y existe `paymentReconciliationLog/{logId}`.
6. Recarga la pantalla y confirma que el match desaparece del bucket pending.

**PARTE B:**
7. Navega a `/admin/odoo/duplicates`.
8. Verifica que aparecen los 17 clusters.
9. Elige **1 cluster** específico (anotar `clusterId` y member IDs en el reporte), marca un canónico vía modal.
10. Espera respuesta `200 success`.
11. Verifica en Odoo (vía web admin o read directo en consola del navegador a través del endpoint GET) que:
    - El canónico tiene `x_dup_status='canonico'`, `x_canonical_payment_id=false`.
    - Los secundarios tienen `x_dup_status='secundario'`, `x_canonical_payment_id=<id canónico>`.
12. Verifica en Firebase Console que `paymentDedupLog/{logId}` existe con shape esperado.
13. Recarga `/admin/odoo/duplicates` y confirma que el cluster aparece como `canonical_set` (badge verde, sin acción disponible).

**Then** los 13 pasos pasan sin errores de consola.
**And** se documenta en sección "Dev Agent Record" de este archivo:
- ¿Cuántos matches PARTE A confirmados en el smoke? (≥1 obligatorio)
- ¿En qué cluster PARTE B se marcó canónico? `clusterId` + IDs miembros + cuál fue canónico vs secundarios.
- Verificación post-action: snippet del read Odoo mostrando `x_dup_status='canonico'` en el canónico marcado.
- 0 console errors.

#### AC14: Validaciones finales (DOR → DONE)

**Given** la story se considera DONE
**When** se ejecuta:
- `pnpm typecheck` → 0 errores (ignorar error pre-existente en `scripts/audit-odoo-payments.ts` documentado).
- `pnpm lint` → 0 errores.
- `pnpm test` → ≥1227 pasando.
- Browser smoke AC13 → 13/13 pasos OK con reporte completo.

**Then** se actualiza `_bmad-output/implementation-artifacts/sprint-status.yaml`:
- `9-1-reconciliacion-retroactiva-dedup-odoo: done` (status final).
- `9-1a-reconciliacion-retroactiva-firestore-odoo: superseded` (consolidada en 9-1).
- `9-1b-dedup-interno-odoo: superseded` (consolidada en 9-1).
**And** se actualiza `memory/MEMORY.md` con nota de Story 9.1 DONE + IDs del cluster marcado canónico en smoke.

## Tasks / Subtasks

### Foundation (puro + schemas)

- [ ] **Task 1 — Función pura scoring reconciliación** (AC1, AC12)
  - [ ] `src/lib/payments/reconciliationMatch.ts` con `scoreMatch(fs, odoo): { confidence, reasons, diff }` (puro, sin I/O)
  - [ ] `.test.ts` co-located con ≥8 casos
- [ ] **Task 2 — Función pura clustering duplicados** (AC7, AC12)
  - [ ] `src/lib/payments/duplicateClustering.ts` con `groupClusters(odooPayments): DuplicateCluster[]` + `clusterStateOf(cluster): 'unmarked'|'canonical_set'|'inconsistent'`
  - [ ] `.test.ts` con ≥6 casos
- [ ] **Task 3 — Zod schemas** (AC1–AC10, AC12)
  - [ ] `src/schemas/reconciliationSchema.ts` con `reconciliationCandidateSchema`, `reconciliationGetResponseSchema`, `reconciliationConfirmBodySchema`, `reconciliationRejectBodySchema`, `reconciliationLogSchema`
  - [ ] `src/schemas/dedupSchema.ts` con `duplicateClusterSchema`, `duplicatesGetResponseSchema`, `setCanonicalBodySchema`, `dedupLogSchema`
  - [ ] Tests co-located por schema

### Endpoints PARTE A

- [ ] **Task 4 — GET reconciliation** (AC1, AC4, AC11)
  - [ ] `src/app/api/admin/payments/reconciliation/route.ts`
  - [ ] Claim check admin/superadmin
  - [ ] `OdooClient.searchRead` loop hasta agotar (paginación interna)
  - [ ] Filtro `paymentReconciliationLog` `action='rejected'`
  - [ ] Test con OdooClient mockeado + fixture `cross-match-result.json`
- [ ] **Task 5 — POST confirm** (AC2, AC11)
  - [ ] `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/confirm/route.ts`
  - [ ] `runTransaction` con uniqueness check
  - [ ] Tests happy + 2 paths 409
- [ ] **Task 6 — POST reject** (AC3, AC11)
  - [ ] `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/reject/route.ts`
  - [ ] Tests creación log

### Endpoints PARTE B

- [ ] **Task 7 — GET duplicates** (AC7, AC11)
  - [ ] `src/app/api/admin/odoo/payments/duplicates/route.ts`
  - [ ] Read Odoo con campos custom incluidos
  - [ ] Clustering + state per cluster
  - [ ] Test con OdooClient mockeado
- [ ] **Task 8 — POST set-canonical** (AC8, AC11)
  - [ ] `src/app/api/admin/odoo/payments/duplicates/set-canonical/route.ts`
  - [ ] Pre-flight cluster re-check
  - [ ] `OdooClient.write` solo a `x_dup_status` y `x_canonical_payment_id`
  - [ ] Post-write verify
  - [ ] Log `paymentDedupLog`
  - [ ] Tests happy / already_set / invalid_cluster / partial — con assertion estricta de keys escritas

### Seguridad

- [ ] **Task 9 — Firestore Security Rules** (AC11)
  - [ ] Reglas `paymentReconciliationLog` y `paymentDedupLog` (admin/superadmin RW; resto deny)
  - [ ] Update rule `payments/{id}` permite mutar `odooPaymentId/linkedAt/linkedBy` solo a admin/superadmin
  - [ ] Smoke manual con emulator si disponible

### UI

- [ ] **Task 10 — UI reconciliación** (AC5, AC6)
  - [ ] `src/app/(admin)/admin/payments/reconciliation/page.tsx` Server Component
  - [ ] `ReconciliationTable.tsx` + `ReconciliationCard.tsx` Client Components co-located
  - [ ] Skeleton, filtros shadcn Select, toasts sonner
- [ ] **Task 11 — UI duplicates** (AC9, AC10)
  - [ ] `src/app/(admin)/admin/odoo/duplicates/page.tsx` Server Component
  - [ ] `DuplicateClusterList.tsx` + `DuplicateClusterCard.tsx` + `SetCanonicalConfirmDialog.tsx` Client Components co-located
  - [ ] Modal de confirmación irreversible con checkbox obligatorio
  - [ ] Skeleton, toasts
- [ ] **Task 12 — Sidebar admin**
  - [ ] Entradas "Reconciliación pagos" + "Duplicados Odoo" en `AdminSidebar` con permission gate

### Cierre

- [ ] **Task 13 — Browser smoke + docs** (AC13, AC14)
  - [ ] Ejecutar smoke completo PARTE A + B, anotar en "Dev Agent Record"
  - [ ] Actualizar `sprint-status.yaml` (9-1 done, 9-1a/9-1b superseded)
  - [ ] Actualizar `memory/MEMORY.md`
- [ ] **Task 14 — Validaciones cierre** (AC14)
  - [ ] `pnpm typecheck` ✓
  - [ ] `pnpm lint` ✓
  - [ ] `pnpm test` ≥1227 ✓

## Dev Notes

### Patrones del proyecto a respetar

- **`OdooClient.write` SOLO a 2 fields**: cualquier `write` con keys distintas a `x_dup_status` o `x_canonical_payment_id` es bug. Los tests deben afirmarlo explícitamente.
- `camelCase` collections Firestore (`paymentReconciliationLog`, `paymentDedupLog`).
- Currency en centavos enteros (confirmar al cruzar amounts FS vs Odoo — Odoo entrega en unidades, FS en centavos; normalizar a la misma unidad antes de comparar).
- Timestamps Firebase, NUNCA ISO strings en writes.
- Zod `safeParse` en bordes externos (respuesta Odoo) — NUNCA `as Type`.
- API routes retornan JSON directo sin wrapper.
- App Router Server Components default; `'use client'` solo donde hay interactividad real.
- Skeleton para loading.
- Error boundary del route group `(admin)` ya existe.

### Idempotencia PARTE B (relación con spike 9.0b)

El spike 9.0b validó el patrón **reservar extId primero → crear payment → escribir res_id real** para Story 9.2 (push). **Esta story (9.1) NO crea pagos en Odoo**, solo escribe 2 fields en payments existentes. Por tanto:

- **No requiere el patrón 2-call con `ir.model.data`** — los pagos ya existen, `write` por id es idempotente por naturaleza (escribir el mismo valor 2 veces da el mismo resultado).
- **El riesgo de race condition** se concreta solo si dos admins marcan el mismo cluster simultáneamente. Mitigación: el pre-flight `currentState === 'unmarked'` rechaza con `409 already_set` el segundo intento; el primero gana.
- **No hay extId nuevo** que reservar — Story 9.2 será responsable de empezar a poblar `x_firebase_payment_id` al pushear pagos nuevos.

### Restricciones de negocio (no negociables)

- NUNCA borrar / `unlink` en Odoo.
- NUNCA modificar `state` (`action_cancel`, `action_post`, etc.).
- NUNCA modificar campos contables (`amount`, `partner_id`, `journal_id`, `date`, `name`, `ref`).
- Marca de canónico es **irreversible vía UI** — reversión solo en consola con admin Odoo.
- Heurística fija: `partner+amount±$1+date±3d` — no se expone configurable.
- 8 de 31 pagos FS con `clientName` faltante: warning + bloqueo del botón confirmar para esos pagos (no se intenta auto-resolver acá; deuda separada).

### Source tree

**Nuevos archivos:**
- `src/lib/payments/reconciliationMatch.ts` + `.test.ts`
- `src/lib/payments/duplicateClustering.ts` + `.test.ts`
- `src/schemas/reconciliationSchema.ts` + `.test.ts`
- `src/schemas/dedupSchema.ts` + `.test.ts`
- `src/app/api/admin/payments/reconciliation/route.ts` + `.test.ts`
- `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/confirm/route.ts` + `.test.ts`
- `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/reject/route.ts` + `.test.ts`
- `src/app/api/admin/odoo/payments/duplicates/route.ts` + `.test.ts`
- `src/app/api/admin/odoo/payments/duplicates/set-canonical/route.ts` + `.test.ts`
- `src/app/(admin)/admin/payments/reconciliation/page.tsx`
- `src/app/(admin)/admin/payments/reconciliation/ReconciliationTable.tsx`
- `src/app/(admin)/admin/payments/reconciliation/ReconciliationCard.tsx`
- `src/app/(admin)/admin/odoo/duplicates/page.tsx`
- `src/app/(admin)/admin/odoo/duplicates/DuplicateClusterList.tsx`
- `src/app/(admin)/admin/odoo/duplicates/DuplicateClusterCard.tsx`
- `src/app/(admin)/admin/odoo/duplicates/SetCanonicalConfirmDialog.tsx`

**Modificados:**
- `firestore.rules` — reglas `paymentReconciliationLog`, `paymentDedupLog`, update `payments`
- `src/components/admin/AdminSidebar.tsx` (o equivalente) — 2 entradas nuevas
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Sin cambios:**
- `src/lib/odoo/client.ts` — se consume `searchRead` (PARTE A+B GET) y `write` (PARTE B set-canonical). Si el cliente no expone `write` aún, agregar wrapper mínimo conservando contrato.

### Testing standards

- Vitest unit/integration co-located.
- OdooClient mockeado en todos los tests; mocks ESTRICTOS para el endpoint `set-canonical` (verifican que `write` solo recibe `x_dup_status` y `x_canonical_payment_id`).
- Uno de los tests de PARTE A consume `scripts/audit-output/cross-match-result.json` como fixture real para sanity-check end-to-end.
- Browser smoke real (AC13) manual, documentado — NO se automatiza con Playwright en esta story.

### Performance

- `OdooClient.searchRead` puede devolver 200+ records; paginar internamente (offset+limit=200 loop hasta agotar).
- Clustering en memoria server-side — O(n²) por partner, aceptable para n=200.
- Frontend renderiza ≤30 clusters/candidatos por vista por default; paginación UI no necesaria en este alcance.

## Referencias

- **Spec base:** `_bmad-output/planning-artifacts/epics.md` — Epic 9 Story 9.1 (PARTE A + PARTE B)
- **Research técnico:** `_bmad-output/planning-artifacts/research/technical-epic-9-sync-bidireccional-pagos-research-2026-05-12.md` (nota divergencia: usar `x_dup_status` en lugar de tags)
- **Runbook 9.7 execution log:** `_bmad-output/implementation-artifacts/runbooks/9-7-execution-log.md` (custom fields creados 2026-05-12)
- **Spike 9.0b:** `_bmad-output/implementation-artifacts/spikes/9-0b-findings.md` (patrón idempotencia 2-call — informativo, no aplica directamente acá)
- **Auditoría sesión 35:** `memory/session-35-payments-sync-audit.md`
- **Matches concretos:** `scripts/audit-output/cross-match-result.json`
- **Schema canónico (Story 9.7 DONE):** `src/schemas/paymentSchema.ts`
- **Convenciones:** `CLAUDE.md` sección "Critical Implementation Rules"

## Project Structure Notes

- PARTE A vive en `src/app/(admin)/admin/payments/reconciliation/`.
- PARTE B vive en `src/app/(admin)/admin/odoo/duplicates/`.
- `paymentReconciliationLog` y `paymentDedupLog` son colecciones top-level Firestore nuevas — convención camelCase plural.
- Story 9.1a (archivo `_bmad-output/implementation-artifacts/9-1a-reconciliacion-retroactiva-firestore-odoo.md`) queda como referencia histórica; su contenido está totalmente cubierto por esta story 9.1.

## Dev Agent Record

### Agent Model Used

(se completa al implementar)

### Debug Log References

### Completion Notes List

- [ ] Función pura `scoreMatch` con ≥8 tests
- [ ] Función pura `groupClusters` + `clusterStateOf` con ≥6 tests
- [ ] PARTE A: GET reconciliation produce buckets correctos contra fixture real
- [ ] PARTE A: confirm bloquea doble-enlace (409 already_linked + 409 odoo_id_taken)
- [ ] PARTE A: UI muestra 16 high / 12 medium / 3 low en pre-prod
- [ ] PARTE B: GET duplicates detecta 17 clusters con state correcto
- [ ] PARTE B: set-canonical escribe SOLO `x_dup_status` + `x_canonical_payment_id` (assertion estricta verde)
- [ ] PARTE B: post-write verify confirma consistencia
- [ ] Firestore Security Rules aplicadas
- [ ] Browser smoke real PARTE A 6/6 OK
- [ ] Browser smoke real PARTE B 7/7 OK con reporte de cluster marcado (clusterId + canónico + secundarios) y read Odoo verificado
- [ ] `sprint-status.yaml` actualizado (9-1 done, 9-1a/9-1b superseded)
- [ ] `memory/MEMORY.md` actualizado

### File List

(se completa al implementar; ver "Source tree" arriba)
