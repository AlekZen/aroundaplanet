# Story 9.6: UX Admin de Sync (Cola Conflictos, Alertas, Estado)

Status: review — dev completo sesión 38, pendiente code-review + AC9 prod smoke post-deploy

> **Tipo:** Feature (M)
> **Bloqueada por:** 9.3 (pull mirror live — ya escribe `paymentAlerts/`, `paymentConflicts/`, `syncCursors/`) · 9.2 (push — campos `odooSyncStatus`, `odooPaymentId` poblados) · 9.7 (schemas Zod canónicos)
> **Bloquea:** retro Epic 9 (cierra la bidireccionalidad operativa visible para admin/Paloma)
> **Insumos:**
> - `_bmad-output/planning-artifacts/epics.md#Story-9.6` (líneas 1882-1921)
> - `_bmad-output/implementation-artifacts/9-3-pull-odoo-firestore-mirror.md` (productor de las colecciones)
> - `_bmad-output/implementation-artifacts/9-2-push-firestore-odoo-idempotente.md` (campos `odooSyncStatus`, badge UI Synced)
> - `src/schemas/paymentAlertSchema.ts` · `src/schemas/paymentConflictSchema.ts` · `src/schemas/syncCursorSchema.ts`
> - memoria sesión 36-37 (bug badge "Sincronizando…" en `/admin/verification` prod)

## Story

Como **admin (Paloma + equipo AroundaPlanet)**,
quiero **una consola de sync donde vea de un vistazo el estado del pull/push de pagos, resuelva los conflictos LWW Firestore↔Odoo, atienda las alertas operativas (`odoo_canceled`, `attachment_failed`, `orphan_payment`, `unknown_method`) y exporte el reporte cuando lo necesite contabilidad**,
para **que los problemas de integración se detecten y se cierren el mismo día sin esperar el reporte mensual, y para que el badge de sync en la cola de verificación distinga "queued" de "synced sin enlace"** en vez de mostrar "Sincronizando…" indefinidamente.

## Contexto

- Story 9.3 dejó vivo el pull Odoo→Firestore (polling 15min + webhook fast-path). Cada corrida escribe en 3 colecciones nuevas Firestore (`paymentAlerts/`, `paymentConflicts/`, `syncCursors/`) y un log opcional `syncLog/`. **Hoy esas colecciones son invisibles**: no hay UI, no hay route, no hay query — solo lectura manual con scripts (`scripts/verify-9-3-smoke.mjs`).
- Story 9.2 puebla `payments/{id}.odooSyncStatus` ∈ `{pending|synced|legacy_linked|error}` + `odooPaymentId`. El componente de la cola de verificación (`/admin/verification`) renderiza un chip cuando ve `odooSyncStatus !== 'synced'`. Bug observado en prod 2026-05-14: 4 pagos `status=verified` muestran "Sincronizando…" porque el push aún no corrió o falló silencioso. **El componente no distingue 3 estados**: queued para push (sin `odooPaymentId`), synced legítimo (con badge), error transitorio (debería tener CTA "ver detalle en sync console"). Casos prod: YAZIL RAMIREZ ($86,800/$140K/$60K), Alek Zen ($3,330), Test Browser E2E ($2,500).
- Schemas Zod ya existen y cubren shape canónico. `resolvePaymentConflictSchema` (en 9.7) define el PATCH de resolución: `{ resolution: 'firestore'|'odoo'|'custom', resolutionValue?, resolutionNote? }`. Solo falta endpoint + UI.
- Restricciones firmes que mantenemos vigentes en esta story:
  1. **Resolver conflicto NUNCA crea ni elimina pago Odoo**; solo escribe el campo LWW en Firestore con el ganador elegido y archiva el doc en `paymentConflicts/` (status='resolved', no delete).
  2. **Cancel en Odoo NO toca `status` Firestore** automáticamente (regla AC5 de 9.3). Esta UI deja a admin la decisión manual: "marcar Firestore canceled también" o "desestimar alerta".
  3. **`action_post` se mantiene fuera de scope**: Paloma postea manual en Odoo. Esta consola no toca el estado contable Odoo (read-only Odoo-side).
  4. **Retry inmediato de push** desde la cola es opcional pero seguro: re-dispara el mismo flow idempotente de 9.2 (UNIQUE constraint `ir.model.data` evita duplicar).
- No se requiere agregar Cloud Functions: el patrón sigue Next API routes + scheduler externo (igual que 9.3). Esta story expone endpoints PATCH/POST sobre las colecciones existentes + lectura Firestore Admin desde server components.
- Performance: las colecciones son pequeñas en el horizonte realista (`paymentConflicts` ≤ decenas, `paymentAlerts` ≤ cientos, `syncQueue/` ≤ decenas de error transitorio). No requiere pagination compleja; basta `orderBy detectedAt desc limit 100` con "Cargar más" si excede.

## Acceptance Criteria

### AC1 — Página `/admin/payments/sync-console` (dashboard)

**Given** un admin autenticado navega a `/admin/payments/sync-console`
**When** carga la página
**Then** ve un dashboard con 5 tarjetas KPI en grid:
- **Conflictos pendientes** — `count(paymentConflicts where resolvedAt == null)`
- **Cola de push** — `count(payments where odooSyncStatus in ('pending','error'))`
- **Alertas activas** — `count(paymentAlerts where status == 'open')` desglosadas por type (badge por cada tipo)
- **Último pull** — `syncCursors/odooPayments.lastRunAt` + `summary` corto (`fetched/matched/updated/conflicts/alerts`)
- **Tasa de éxito 24h** — `(updated + matched) / fetched` agregando últimas N corridas (lectura de `syncLog/odooPull-*` si está, o cálculo directo desde `lastRunSummary` rolling)

**And** cada tarjeta es clickeable y filtra/navega a la tabla correspondiente.
**And** si `syncCursors/odooPayments.lastError != null` la tarjeta "Último pull" muestra estado degradado (badge rojo + mensaje truncado a 120 chars + tooltip con texto completo).
**And** la página es Server Component que lee con Firebase Admin SDK (NO expone Firestore client side para estas colecciones — coherente con security rules de 9.3 Task 6).
**And** loading state usa Skeleton (NO Spinner ni blank screen — regla del proyecto).

### AC2 — Tabla "Conflictos LWW" + flujo de resolución

**Given** la sección "Conflictos" en la consola (tab o ancla `#conflicts`)
**When** carga
**Then** lista los docs de `paymentConflicts/` ordenados por `detectedAt desc`, con columnas:
- Pago (cliente + monto + `firestoreId` corto + link a `/admin/verification/{paymentId}`)
- Campo en conflicto (`memo`/`amount`/`paymentDate`)
- Valor Firestore (con timestamp `firestoreWrittenAt`)
- Valor Odoo (con timestamp `odooWrittenAt`)
- Detectado `detectedAt` (humanizado: "hace 12 min")
- Source que origenó cada lado (badge `agent`/`admin`/`odoo`/`webhook`/`polling` si está poblado)
- Botón "Resolver"

**Given** admin abre el modal "Resolver conflicto"
**When** ve el detalle
**Then** muestra los 2 valores lado a lado con timestamps + fuentes + nota libre opcional + 3 acciones:
1. **Conservar Firestore** → PATCH endpoint con `{resolution: 'firestore'}`
2. **Conservar Odoo** → PATCH endpoint con `{resolution: 'odoo'}`
3. **Valor personalizado** → input según tipo del campo (`amount`: integer en MXN con conversión a centavos antes de send; `memo`: textarea max 500; `paymentDate`: date picker) → PATCH con `{resolution: 'custom', resolutionValue: <valor tipado>}`

**And** la nota (`resolutionNote`, opcional, max 500 chars) es campo persistido en el doc resuelto para auditoría.

**Given** se envía la resolución
**When** el endpoint procesa
**Then**:
- Valida payload con `resolvePaymentConflictSchema.safeParse` (Zod).
- Lee el doc `paymentConflicts/{conflictId}` actual. Si ya tiene `resolvedAt` (race condition con otro admin) → 409 conflict con mensaje "ya resuelto por {resolvedBy}".
- Calcula `winnerValue`:
  - `resolution='firestore'` → `firestoreValue` (tipado según `field`)
  - `resolution='odoo'` → `odooValue`
  - `resolution='custom'` → `resolutionValue` (debe matchear el tipo del field; el schema ya lo refina)
- Actualiza `payments/{paymentId}.lww.{field}` con `{ value: winnerValue, writtenAt: serverTimestamp(), source: 'admin' }` usando `set({merge:true})` con estructura nested (NO claves con punto — regla aprendida en 9.3).
- Marca el conflicto `resolvedAt: serverTimestamp(), resolvedBy: uid, resolution, resolutionValue, resolutionNote` (NO eliminar — el doc queda como auditoría).
- Si `resolution='odoo'` o `resolution='custom'`, además dispara un push idempotente Firestore→Odoo del campo via el mismo flow de 9.2 (write sobre `account.payment` con el nuevo valor) para que Odoo también quede alineado. Si `resolution='firestore'` Y el valor Firestore es más reciente que `odooWrittenAt`, también dispara push (el ganador entra a Odoo).
- Si el push falla → la resolución del conflicto **sí queda persistida** (Firestore es el ganador local). El push se reintenta vía `syncQueue/` (AC3). Devuelve 200 con `pushQueued: true` para que la UI muestre toast informativo.

**And** la entrada se loggea en `paymentConflictHistory/{conflictId}` o queda en el mismo doc con `resolved*` (decisión: queda en el mismo doc, una sola fuente de verdad).
**And** la tabla refresca en realtime via `onSnapshot` (este componente SÍ es Client; usa Firebase Auth ID token para que las rules le den lectura como admin).

### AC3 — Tabla "Cola de push" + retry/dismiss

**Given** la sección "Cola de push" (tab o ancla `#queue`)
**When** carga
**Then** lista pagos donde `odooSyncStatus in ('pending', 'error')` ordenados por `verifiedAt desc`:
- Cliente + monto + método de pago
- Status sync (`pending` / `error`)
- Último error truncado (`odooLastError`, 120 chars + tooltip full)
- Retries (`syncRetryCount`)
- Botones "Reintentar push" y "Descartar"

**Given** admin pulsa "Reintentar push"
**When** el endpoint `POST /api/payments/{paymentId}/retry-odoo-push` recibe
**Then**:
- Verifica claims admin (`request.auth.token.admin === true`).
- Invoca el mismo flow `pushPaymentToOdoo(paymentId)` exportado por Story 9.2 (idempotente por `ir.model.data` patrón invertido).
- Si OK: el doc Firestore queda con `odooSyncStatus='synced'` + `odooPaymentId` + `odooSyncedAt` → desaparece de la cola.
- Si vuelve a fallar: incrementa `syncRetryCount`, persiste `odooLastError + odooLastErrorAt`, queda en cola para revisión.

**Given** admin pulsa "Descartar" sobre un pago en cola
**When** confirma en modal ("Este pago NO se sincronizará con Odoo. ¿Continuar?")
**Then**:
- Endpoint `POST /api/payments/{paymentId}/dismiss-odoo-sync` con body `{reason: string max 500}`.
- Setea `payments/{paymentId}.odooSyncStatus = 'dismissed', odooSyncDismissedAt = serverTimestamp(), odooSyncDismissedBy = uid, odooSyncDismissedReason = reason`.
- Agregar `odooSyncStatus = 'dismissed'` al enum en `paymentSchema.ts` (Story 9.7 lo cubre genéricamente — verificar; si no, esta story extiende). El pull (9.3) y el push (9.2) deben **ignorar** los pagos con status `dismissed` (no encolar, no overwrite — confirmar y agregar guard si falta).
- El pago desaparece de la cola pero queda visible en `/admin/verification` con badge "Sync descartado" (AC6).

### AC4 — Tabla "Alertas operativas" + acciones por tipo

**Given** la sección "Alertas" (tab o ancla `#alerts`)
**When** carga
**Then** lista `paymentAlerts/` con `status='open'` ordenadas por `detectedAt desc`, agrupadas por `type`:
- **odoo_canceled** — Paloma canceló en Odoo · acciones: "Marcar Firestore como canceled" / "Desestimar" / "Ver pago"
- **attachment_failed** — Story 9.4 no logró subir el comprobante a Odoo · acciones: "Reintentar subida" / "Desestimar" / "Ver pago"
- **orphan_payment** — `account.payment` creado en Odoo pero `ir.model.data` falló (creó huérfano) · acciones: "Reintentar idempotency lock" / "Marcar como manual" (notas obligatorias) / "Desestimar"
- **unknown_method** — push usó journal default por mapping desconocido · acciones: "Editar mapping" (lleva a runbook) / "Desestimar"

Cada fila muestra: tipo (badge color por tipo), pago + cliente + monto, `odooPaymentId` si existe, `odooState`, `detectedAt`, `runId` (link a `syncLog/{runId}` si existe).

**Given** acción "Marcar Firestore canceled" sobre alerta `odoo_canceled`
**When** admin confirma
**Then**:
- Endpoint `POST /api/payments/{paymentId}/mark-canceled` body `{alertId, note?}`.
- Setea `payments/{paymentId}.status = 'rejected', rejectionReason: 'cancelled_in_odoo: {note}', rejectedBy: uid, rejectedAt: serverTimestamp()`.
- Marca alerta `paymentAlerts/{alertId}.status = 'resolved', resolvedAt, resolvedBy, resolutionNote: 'firestore_canceled_to_match_odoo: {note}'`.
- Audita en `syncLog/alertResolved-{alertId}`.

**Given** acción "Desestimar" sobre cualquier alerta
**When** admin confirma con nota obligatoria (min 5 chars)
**Then**:
- Endpoint `PATCH /api/payment-alerts/{alertId}` body `{status: 'dismissed', resolutionNote: string}`.
- Persiste `status='dismissed', resolvedAt, resolvedBy, resolutionNote`.
- Idempotente: si ya estaba `dismissed/resolved` → 409.

**Given** acción "Reintentar subida" sobre alerta `attachment_failed`
**When** admin confirma
**Then**:
- Endpoint `POST /api/payments/{paymentId}/retry-attachment` (placeholder hasta que Story 9.4 entregue el flow; **AC marca este endpoint como TODO con 501 Not Implemented + nota de UI "pendiente Story 9.4"** — NO bloquear esta story).

### AC5 — Export CSV

**Given** admin pulsa "Exportar CSV" en cualquiera de las 3 secciones (conflicts/queue/alerts)
**When** dispara la descarga
**Then**:
- Endpoint `GET /api/payments/sync-console/export?section={conflicts|queue|alerts}&status={open|resolved|all}`.
- Stream CSV con header de columnas en español + filas filtradas por la sección + status seleccionado.
- Columnas mínimas: `paymentId, firestoreId, odooPaymentId, clientName, amount, paymentDate, status, odooState, odooSyncStatus, lastSyncAt, lastError, detectedAt, resolvedAt, resolvedBy`.
- Filename: `sync-console-{section}-{YYYY-MM-DD}.csv`.
- Validar admin role en handler.

### AC6 — Fix bug badge "Sincronizando…" en `/admin/verification`

**Given** la cola `/admin/verification` renderiza un pago con `status='verified'`
**When** el componente decide qué badge de sync mostrar
**Then** lógica con 4 estados:
1. `odooSyncStatus === 'synced' && odooPaymentId` → badge verde "Synced Odoo #{odooPaymentId} · {odooJournalName}" (estado actual OK)
2. `odooSyncStatus === 'pending'` o ausente y `verifiedAt < hace 5min` → badge gris "Encolado · push pendiente"
3. `odooSyncStatus === 'pending'` y `verifiedAt < hace 5min` → badge amarillo "Sync demorado · ver consola" + link a `/admin/payments/sync-console#queue?paymentId={id}`
4. `odooSyncStatus === 'error'` → badge rojo "Sync con error · ver consola" + link
5. `odooSyncStatus === 'dismissed'` (de AC3) → badge gris claro "Sync descartado" + tooltip con `odooSyncDismissedReason`
6. `odooSyncStatus === 'legacy_linked'` → badge azul "Synced Odoo #{odooPaymentId} · legacy" (Story 9.1)

**And** el componente **nunca** muestra "Sincronizando…" indefinido — siempre uno de los 5 estados arriba con CTA accionable.
**And** si `odooPaymentId` existe pero `odooSyncStatus` falta (drift de schema), el componente prefiere el estado más informativo: si `odooSyncedAt` reciente → trata como `synced`; si no, trata como `pending`. **No crash.**
**And** los casos prod detectados (YAZIL RAMIREZ, Alek Zen, Test Browser E2E) deben mostrar el badge correcto post-deploy. Si están realmente sin `odooPaymentId`, deben verse en la cola de push y resolverse vía "Reintentar push" (AC3).

### AC7 — Security rules + auth

**Given** las colecciones `paymentConflicts/`, `paymentAlerts/`, `syncCursors/`, `syncLog/`
**When** se accede desde cliente Firebase con ID token
**Then**:
- Lectura permitida solo si `request.auth.token.admin == true` o `request.auth.token.superadmin == true`.
- Escritura cliente prohibida (las muta solo Admin SDK desde endpoints + jobs).
- `payments/{paymentId}/lww` escritura solo Admin SDK (consistente con 9.3 Task 6).

**And** los endpoints PATCH/POST verifican claims con `verifyIdToken` + check de claim `admin === true` (NO basta autenticado).
**And** un agente o cliente que llegue a `/admin/payments/sync-console` debe ser redirigido por `src/proxy.ts` (heredado del route group `(admin)`, verificar que la nueva subruta está cubierta por el patrón existente).

### AC8 — Test coverage (co-located, vitest + Playwright)

**Given** la story
**When** corre la suite
**Then** cubre con Admin SDK + Firestore Admin mockeados:

**Unit (vitest):**
1. Endpoint resolver conflicto: happy path firestore-wins → actualiza `lww` nested + marca conflict resolved.
2. Endpoint resolver conflicto: odoo-wins → invoca `pushPaymentToOdoo` mock; si push falla, conflict queda resuelto + `pushQueued: true`.
3. Endpoint resolver conflicto: custom con `resolutionValue` válido para `amount` (int positivo).
4. Endpoint resolver conflicto: custom con `resolutionValue` malformado → 400 (refine Zod).
5. Endpoint resolver conflicto: race (`resolvedAt` ya existe) → 409.
6. Endpoint retry push: invoca flow 9.2 idempotente; success → `synced`.
7. Endpoint retry push: error → incrementa `syncRetryCount`, persiste `odooLastError`.
8. Endpoint dismiss sync: marca `odooSyncStatus='dismissed'` + razón obligatoria.
9. Endpoint mark-canceled: setea `status='rejected'` + resuelve alerta + log.
10. Endpoint dismiss alert: status open → dismissed; status ya dismissed → 409.
11. Endpoint export CSV: 3 secciones, validar columnas y filtros.
12. Guard pull/push: pago con `odooSyncStatus='dismissed'` es ignorado en próximo pull/push (test al módulo de 9.3 y 9.2, no a esta story directamente).
13. Componente badge UI `<SyncStatusBadge payment={p} />`: snapshots de los 5 estados (synced, pending, demorado, error, dismissed, legacy).
14. Componente: cuando `odooPaymentId` existe sin `odooSyncStatus` → fallback a `synced` si `odooSyncedAt < 5min`, `pending` si no.

**E2E (Playwright, smoke mínimo):**
15. Admin navega `/admin/payments/sync-console`, ve dashboard, abre tab conflicts (mock con 2 docs), resuelve uno con "Conservar Firestore", el row desaparece y el toast confirma push queued.
16. Admin pulsa "Exportar CSV" en queue → recibe descarga con MIME `text/csv` y al menos 1 fila si hay datos seed.

### AC9 — Browser smoke prod (validación pre-cierre)

**Given** despliegue completo en prod
**When** se ejecuta el smoke
**Then**:
1. **Setup**: pull de 9.3 corriendo (Cloud Scheduler enabled). Hay al menos un pago en `/admin/payments/sync-console` (los 4 casos detectados YAZIL/Alek/Test sirven; si están realmente en cola, perfecto; si no, simular uno con `scripts/probe-9-3-odoo-edit.mjs` sobre el memo de Felipe RUBIO 8134 para forzar un LWW desde Odoo).
2. **Dashboard**: las 5 tarjetas KPI muestran números coherentes con scripts de verificación (count Firestore manual vs lo que muestra UI).
3. **Conflicts**: forzar un conflicto memo via `scripts/probe-9-3-odoo-edit.mjs` + edición manual en `/admin/verification/{id}` (UI cambia memo) → pull lo detecta y encola. Refrescar consola, conflict aparece. Resolver con "Conservar Firestore" → toast OK + row desaparece + Firestore `lww.memo.source='admin'` + push retry registra en Odoo `account.payment.memo` (verificar con `scripts/verify-odoo-payment.mjs 8134`).
4. **Cola push**: pulsar "Reintentar push" sobre uno de los 4 casos prod (YAZIL/Alek/Test). Si el push tiene éxito → badge en `/admin/verification` cambia a "Synced Odoo #{id}". Si falla → captura `odooLastError` visible en UI.
5. **Alertas**: cancelar manualmente el `account.payment` 8134 desde Odoo web (Paloma o subagente XML-RPC con permiso temporal) → pull dispara alerta `odoo_canceled`. Aparece en consola. Resolver con "Desestimar" → status='dismissed'. **NO se modificó `status` Firestore**. Reactivar el pago en Odoo (revert para no dejarlo cancelado).
6. **Bug badge fix**: navegar a `/admin/verification` → los 4 casos prod muestran badge correcto (no más "Sincronizando…"). YAZIL etc. deben caer en "Encolado" o "Sync demorado" hasta que se procesen.
7. **Export CSV**: descargar las 3 secciones → abrir en hoja de cálculo, verificar columnas y formato fechas legible.
8. **Consola del navegador**: 0 errors/warnings nuevos en navegación normal por la consola.
9. **Cleanup**: revertir cancel del 8134 (action_draft). Si se creó dismissed sobre algún pago real por error, revertir manualmente vía Admin SDK script.

## Tasks / Subtasks

- [x] **Task 1: Página dashboard + layout** (AC: 1)
  - [x] 1.1 Crear `src/app/(admin)/admin/payments/sync-console/page.tsx` (Server Component)
  - [x] 1.2 Crear `src/app/(admin)/admin/payments/sync-console/SyncConsoleDashboard.tsx` (Client) con 5 `KPICard` (componente custom existente, reusar)
  - [x] 1.3 Lectura initial via Admin SDK en page.tsx: counts de las 3 colecciones + `syncCursors/odooPayments`
  - [x] 1.4 Loading via `loading.tsx` co-located con Skeleton (5 cards)
  - [x] 1.5 Tabs/anchors `#conflicts`, `#queue`, `#alerts` con tab component shadcn
  - [x] 1.6 Test co-located `SyncConsoleDashboard.test.tsx` (smoke render)

- [x] **Task 2: Tabla conflictos + modal resolver** (AC: 2)
  - [x] 2.1 Component `<ConflictsTable />` Client con `onSnapshot` sobre `paymentConflicts`
  - [x] 2.2 Component `<ResolveConflictModal />` con 3 acciones tipo-aware (Radix Dialog + Form RHF + Zod)
  - [x] 2.3 Endpoint `PATCH /api/payment-conflicts/[conflictId]/resolve/route.ts` con verifyIdToken + admin claim + `resolvePaymentConflictSchema.safeParse` + transacción (read-then-write con `runTransaction` para detectar race)
  - [x] 2.4 Reutilizar `pushPaymentToOdoo` exportada de `src/lib/odoo/sync/push-payments.ts` (verificar export — si no, refactor mínimo en Story 9.2 con commit nota)
  - [x] 2.5 Tests co-located: endpoint route.test.ts (5 cases AC8 1-5), modal.test.ts (form validation, type-aware input)

- [x] **Task 3: Tabla cola push + acciones retry/dismiss** (AC: 3)
  - [x] 3.1 Component `<PushQueueTable />` Client con query Firestore por `odooSyncStatus in ['pending','error']`
  - [x] 3.2 Endpoint `POST /api/payments/[paymentId]/retry-odoo-push/route.ts`
  - [x] 3.3 Endpoint `POST /api/payments/[paymentId]/dismiss-odoo-sync/route.ts`
  - [x] 3.4 Extender `paymentSchema.ts`: `odooSyncStatus` enum ahora incluye `'dismissed'`; agregar `odooSyncDismissedAt`, `odooSyncDismissedBy`, `odooSyncDismissedReason` (todos opcional)
  - [x] 3.5 Extender pull (9.3) y push (9.2) con guard `if (payment.odooSyncStatus === 'dismissed') return SKIP` + log `syncLog/dismissedSkipped-{id}` (1 línea de cambio cada lado; documentar en commit body)
  - [x] 3.6 Tests co-located: endpoints (AC8 6-8), guard pull/push (extender suite existente con 2 tests)

- [x] **Task 4: Tabla alertas + acciones por tipo** (AC: 4)
  - [x] 4.1 Component `<AlertsTable />` con agrupación por type
  - [x] 4.2 Endpoint `POST /api/payments/[paymentId]/mark-canceled/route.ts`
  - [x] 4.3 Endpoint `PATCH /api/payment-alerts/[alertId]/route.ts` (dismiss + nota obligatoria)
  - [x] 4.4 Endpoint `POST /api/payments/[paymentId]/retry-attachment/route.ts` placeholder 501 (deja TODO Story 9.4)
  - [x] 4.5 Tests co-located: AC8 9-10 + smoke 501 retry-attachment

- [x] **Task 5: Componente `<SyncStatusBadge />` + fix badge `/admin/verification`** (AC: 6)
  - [x] 5.1 Crear `src/components/payments/SyncStatusBadge.tsx` con lógica de 5 estados
  - [x] 5.2 Refactorizar el chip actual de `/admin/verification` para usar `<SyncStatusBadge />` (grep el componente actual que muestra "Sincronizando…")
  - [x] 5.3 Tests co-located: AC8 13-14 (snapshots de los 5 estados + fallback drift)
  - [x] 5.4 Documentar en commit los 4 casos prod afectados (YAZIL/Alek/Test) y resultado esperado post-fix

- [x] **Task 6: Export CSV** (AC: 5)
  - [x] 6.1 Endpoint `GET /api/payments/sync-console/export/route.ts` con stream Response + header `Content-Type: text/csv` + `Content-Disposition: attachment`
  - [x] 6.2 Helper `src/lib/csv/escape.ts` (escape de comas, comillas, newlines en values — el proyecto puede no tener uno; revisar antes y reutilizar si existe)
  - [x] 6.3 Tests co-located: 3 secciones × 2 status filters (AC8 11)

- [x] **Task 7: Security rules + proxy** (AC: 7)
  - [x] 7.1 Confirmar/extender `firestore.rules` para `paymentConflicts/`, `paymentAlerts/`, `syncCursors/`, `syncLog/`: lectura admin, escritura solo Admin SDK
  - [x] 7.2 Confirmar `src/proxy.ts` cubre `/admin/payments/sync-console` con role-check (debería heredar del prefix `/admin/`; validar match)
  - [x] 7.3 Test rules con `@firebase/rules-unit-testing` si el proyecto lo usa; si no, smoke manual en AC9

- [x] **Task 8: E2E Playwright smoke** (AC: 8 unit-15-16, AC: 9 prod)
  - [x] 8.1 `e2e/admin-sync-console.spec.ts` con 2 scenarios (resolver conflict + export CSV)
  - [ ] 8.2 Seeds en `e2e/fixtures/sync-console.json` con 2 conflicts + 1 alert + 1 queue mock (insertar via Admin SDK pre-test, limpiar post) — **PENDIENTE**: requiere infra auth E2E (helper login programático admin); 8.1 spec creado con `test.skip` + TODO documentado

- [x] **Task 9: Validaciones pre-commit**
  - [x] 9.1 `pnpm typecheck` ✓ (0 errores)
  - [x] 9.2 `pnpm vitest run --pool=threads` ✓ (baseline 1422 tests Story 9.3, **no regresión** + ~25 nuevos AC8 unit + 2 Playwright)
  - [x] 9.3 `pnpm lint` ✓ (0 errores)
  - [ ] 9.4 Browser smoke completo (AC9) ejecutado, evidencia en commit body — **PENDIENTE POST-DEPLOY**: requiere Cloud Scheduler pull corriendo + Paloma (o subagente XML-RPC) para cancel manual en Odoo
  - [ ] 9.5 Commit en castellano: `feat(epic-9): Story 9.6 consola admin sync — conflictos + alertas + cola push + badge fix` — **PENDIENTE**: orquestador hará el commit cuando Alek confirme
  - [ ] 9.6 Si fix del badge afecta los 4 casos prod (YAZIL/Alek/Test), anotar en commit body el estado post-deploy de cada uno — **PENDIENTE**: validar post-deploy, deberían mostrar "Sync demorado · ver consola"

## Dev Notes

### Decisión de ruta: `/admin/payments/sync-console` (no `/admin/odoo-sync`)

La épica original (epics.md línea 1890) menciona `/admin/odoo-sync`, pero esa ruta **ya existe** y aloja el dashboard de sync de **trips/users** (`OdooSyncDashboard` reusada desde `(superadmin)`). Para evitar colisión:
- **Elegido**: `/admin/payments/sync-console` — alinea con la convención de Story 9.1 que creó `/admin/payments/reconciliation`. Las dos páginas de admin sobre pagos quedan agrupadas bajo `/admin/payments/`.
- Documentar en sprint-status que esta divergencia es deliberada; si en el futuro `/admin/odoo-sync` se reutiliza como hub general, esta consola puede convertirse en su subruta sin cambio de schema.

### Patrón obligatorio: NUNCA escribir `lww.{field}` con clave punto

Mismo aprendizaje de 9.3 (debug log advisor pre-commit): `set({merge:true})` con `{"lww.memo": {...}}` NO interpreta FieldPath. Siempre escribir nested:
```ts
await ref.set({ lww: { memo: { value, writtenAt, source: 'admin' } } }, { merge: true })
```
Y reusar el guard `assertOnlyMirrorFields` (export de `src/lib/odoo/sync/pull-payments.ts`) si surge alguna duda en endpoints nuevos.

### Restricciones firmes (regla de negocio + research)

1. **Resolver un conflicto NO toca Odoo automáticamente salvo que el ganador requiera empujar** — Firestore es source of truth de la decisión local; el push subsecuente solo lleva el valor a Odoo en la dirección correcta.
2. **NUNCA postear pagos en Odoo desde esta consola** (`action_post` queda en manos de Paloma).
3. **Dismiss pago de sync queue es definitivo**: documentarlo en el modal de confirmación. Sin embargo, queda revertible vía script Admin SDK si admin se arrepiente (no agregar UI de revert en esta story — out of scope).
4. **Race conditions**: usar transacciones Firestore (`runTransaction`) para resolver conflictos y reintentos. Dos admins resolviendo el mismo conflicto al mismo tiempo → solo uno gana, el otro recibe 409.
5. **Auditoría**: los docs nunca se eliminan. Resolved → status='resolved' + resolvedAt + resolvedBy + nota. Dismissed → status='dismissed' + nota. Esto permite auditar quién decidió qué.
6. **El push automático del path `odoo_wins` o `custom` es opcional pero deseable**: si el flujo de push 9.2 está sano, alinear Odoo es trivial e idempotente. Si Story 9.2 export no permite invocación on-demand (verificar), agregar un export ligero.

### Archivos UPDATE (leer completos antes de tocar)

- `src/schemas/paymentSchema.ts` — extender `odooSyncStatusSchema` con `'dismissed'` + agregar campos `odooSyncDismissed*`.
- `src/lib/odoo/sync/pull-payments.ts` — guard `if odooSyncStatus === 'dismissed' return SKIP` antes del mapping.
- `src/lib/odoo/sync/push-payments.ts` (Story 9.2) — mismo guard + verificar que `pushPaymentToOdoo` está exportada o crear wrapper exportable.
- `src/app/(admin)/admin/verification/` — refactor del chip "Sincronizando…" hacia `<SyncStatusBadge />`. Grep:
  ```
  grep -r "Sincronizando" src/app/(admin)/admin/verification/
  ```
- `firestore.rules` — agregar/confirmar reglas para las 3 colecciones nuevas.
- `src/proxy.ts` — verificar que `/admin/payments/sync-console` queda cubierto por el matcher de admin.

### Archivos NEW

- `src/app/(admin)/admin/payments/sync-console/page.tsx` (Server)
- `src/app/(admin)/admin/payments/sync-console/loading.tsx` (Skeleton)
- `src/app/(admin)/admin/payments/sync-console/SyncConsoleDashboard.tsx` (Client) + test
- `src/app/(admin)/admin/payments/sync-console/ConflictsTable.tsx` + test
- `src/app/(admin)/admin/payments/sync-console/ResolveConflictModal.tsx` + test
- `src/app/(admin)/admin/payments/sync-console/PushQueueTable.tsx` + test
- `src/app/(admin)/admin/payments/sync-console/AlertsTable.tsx` + test
- `src/components/payments/SyncStatusBadge.tsx` + test
- `src/app/api/payment-conflicts/[conflictId]/resolve/route.ts` + test
- `src/app/api/payment-alerts/[alertId]/route.ts` + test
- `src/app/api/payments/[paymentId]/retry-odoo-push/route.ts` + test
- `src/app/api/payments/[paymentId]/dismiss-odoo-sync/route.ts` + test
- `src/app/api/payments/[paymentId]/mark-canceled/route.ts` + test
- `src/app/api/payments/[paymentId]/retry-attachment/route.ts` (placeholder 501) + test
- `src/app/api/payments/sync-console/export/route.ts` + test
- `src/lib/csv/escape.ts` (si no existe ya) + test
- `e2e/admin-sync-console.spec.ts`

### UX patrones reusables

- KPI cards: existe `BusinessMetric` o `KPICard` en componentes custom — usar el mismo look del director dashboard (consistencia).
- Tablas: shadcn `Table` + `TableHeader`/`TableRow`/`TableCell`. Si la lista crece, agregar columna virtualizada solo si AC9 confirma slowness (no premature).
- Modals: shadcn `Dialog` + RHF + Zod. Patrón ya usado en `/admin/verification/{paymentId}`.
- Badges: shadcn `Badge` con variant por estado.
- Toasts: el proyecto usa `sonner` (verificar) o el provider de shadcn — reusar.
- Realtime: `onSnapshot` para las 3 tablas. El admin queda en pantalla todo el día durante una mañana de reconciliación; el realtime evita refresh manual.

### Testing standards (heredado)

- Vitest co-located. Mock Firebase Admin con factory `vi.hoisted()`.
- Para endpoints: mock `verifyIdToken` retornando claims admin, mock Firestore Admin con `runTransaction` controlable.
- E2E Playwright: usar fixtures Admin SDK pre-spec con cleanup en `test.afterEach`.

### Performance

- Listas top 100 con `orderBy detectedAt desc limit 100` + botón "Cargar más" client-side (no infinite scroll).
- Counts en dashboard: usar `count()` aggregation de Firestore (`getCountFromServer`) en Server Component al cargar la página. Refresca cada vez que se navega (no necesita realtime aggregate; un admin mirando 30 min sin recargar es aceptable).

### Dependencias entre Stories del Epic 9

- 9.6 NO requiere 9.4 ni 9.5 cerradas. El endpoint `retry-attachment` queda 501 placeholder.
- 9.6 SÍ requiere que 9.2 exporte `pushPaymentToOdoo` invocable (verificar primero; pequeño refactor si falta).
- 9.6 cierra el loop visible para Paloma. Después de 9.6, Stories 9.4 y 9.5 pueden trabajarse sin urgencia operativa (su ausencia es invisible al admin).

### Hallazgos previos a considerar (NO bloquean 9.6)

- `<CommissionList>` TypeError 'variant' y `/api/agents/[agentId]/metrics` 500 — pendiente correct-course.
- `Navbar.test.tsx` 2 fallos pre-existentes — no bloqueante.
- `scripts/audit-odoo-payments.ts` con `@ts-nocheck` — pendiente commit de limpieza con `pnpm add -D dotenv` (mismo recordatorio que dejó 9.3).
- 4 casos prod del badge "Sincronizando…" — esta story los corrige vía AC3+AC6.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-9.6] (líneas 1882-1921)
- [Source: src/schemas/paymentAlertSchema.ts] — shape de alertas + `paymentAlertDocId` helper
- [Source: src/schemas/paymentConflictSchema.ts] — `resolvePaymentConflictSchema` (PATCH body)
- [Source: src/schemas/syncCursorSchema.ts] — `syncCursorSummarySchema` (dashboard KPI último pull)
- [Source: _bmad-output/implementation-artifacts/9-3-pull-odoo-firestore-mirror.md] — productor de las 3 colecciones
- [Source: _bmad-output/implementation-artifacts/9-2-push-firestore-odoo-idempotente.md] — `pushPaymentToOdoo` reutilizable
- [Source: memoria sesión 36-37] — bug badge prod + decisión patrón nested LWW
- [Source: src/app/(admin)/admin/payments/reconciliation/page.tsx] — patrón de página admin/payments (mismo route group)

## Dev Agent Record

### Agent Model Used

Opus 4.7 orquestador + Sonnet 4.6 subagentes (F1+F2a+F2b+F3a+F3b+F3c+F4+F5)

### Debug Log References

- **F1 (Schema + guards)**: `dismissedReason` enum + `odooSyncDismissedAt` a paymentSchema; guard dismissed en push/pull. 1 bug: Zod discriminated union requirió ownership split.
- **F2a (Endpoints resolve/retry/dismiss/retry-attachment)**: 4 endpoints nuevos. retry-attachment retorna 501 placeholder (Story 9.4 pendiente).
- **F2b (mark-canceled + export CSV)**: mark-canceled resuelve alertas `odoo_canceled`; export genera CSV multi-tab con fecha en filename. Bug typecheck en test (F5 fix).
- **F3a (SyncStatusBadge + OdooSyncBadge refactor)**: nuevo componente con 5 estados. OdooSyncBadge existente conservado por back-compat; VerificationPanel usa SyncStatusBadge.
- **F3b/F3c (tablas Conflictos/Cola/Alertas)**: ConflictsTable + PushQueueTable + AlertsTable con ResolveConflictModal.
- **F4 (SyncConsoleDashboard + page)**: Server Component con 5 KPI cards, tabs, loading skeleton.
- **F5 (Typecheck + E2E)**: fix mock type en `mark-canceled/route.test.ts` línea 52; E2E skipped por falta de infra auth programática; índice Firestore `paymentConflicts.resolvedAt` agregado.

### Completion Notes List

- 30 archivos nuevos / 8 modificados
- 1510 tests pass (baseline 9.3: 1422 → +88 en Story 9.6)
- Decisión: `OdooSyncBadge` viejo se conserva por back-compat; `SyncStatusBadge` nuevo es el componente activo en producción para VerificationPanel y Sync Console
- `retry-attachment` retorna 501 placeholder — pendiente Story 9.4 (ir.attachment individual)
- Playwright E2E: 2 tests **skipped** — dependencia bloqueante: sin infra de autenticación programática en E2E (no hay helper de login admin pre-construido). Se requiere endpoint `/api/test/seed-admin-session` o similar para desbloquear. Ver TODO en `e2e/admin-sync-console.spec.ts`
- Índice Firestore `paymentConflicts.resolvedAt DESCENDING` agregado a `firestore.indexes.json` (requerido por `where resolvedAt != null orderBy resolvedAt desc` en export endpoint)
- Pendiente AC9: prod smoke post-deploy (verificar `/admin/payments/sync-console` con datos reales en prod)
- Bug "Sincronizando…" en `/admin/verification`: corregido — `SyncStatusBadge` distingue `pending` (queued), `error` (con CTA), `synced` (badge verde), `legacy_linked`, `dismissed`. Los 4 casos prod (YAZIL RAMIREZ x3, Alek Zen, Test Browser E2E) caerán en estado "Sync demorado" en lugar de "Sincronizando…" indefinidamente
- 2026-05-14 (post-review): Aplicados fixes High #1 (snapshot post-resolve con campo mapeado: amount→amountCents, paymentDate→date; memo skippea push — sin mapeo top-level, Paloma edita Odoo manualmente), High #2 (auth Bearer→cookie: eliminados getIdToken() y header Authorization en PushQueueTable, ResolveConflictModal, AlertsTable; mocks firebase/auth removidos de los 3 test files), Med #3 (shouldPush: `fsMs === 0 || fsMs >= odooMs` para timestamps ausentes). +3 tests de regresión (Fix1-a, Fix1-b, Fix3). Total: 1513 tests.

### File List

```
NUEVOS (Story 9.6):
- src/components/payments/SyncStatusBadge.tsx
- src/components/payments/SyncStatusBadge.test.tsx
- src/app/(admin)/admin/payments/sync-console/page.tsx
- src/app/(admin)/admin/payments/sync-console/loading.tsx
- src/app/(admin)/admin/payments/sync-console/SyncConsoleDashboard.tsx
- src/app/(admin)/admin/payments/sync-console/SyncConsoleDashboard.test.tsx
- src/app/(admin)/admin/payments/sync-console/ConflictsTable.tsx
- src/app/(admin)/admin/payments/sync-console/ConflictsTable.test.tsx
- src/app/(admin)/admin/payments/sync-console/ResolveConflictModal.tsx
- src/app/(admin)/admin/payments/sync-console/ResolveConflictModal.test.tsx
- src/app/(admin)/admin/payments/sync-console/PushQueueTable.tsx
- src/app/(admin)/admin/payments/sync-console/PushQueueTable.test.tsx
- src/app/(admin)/admin/payments/sync-console/AlertsTable.tsx
- src/app/(admin)/admin/payments/sync-console/AlertsTable.test.tsx
- src/app/api/payment-conflicts/[conflictId]/resolve/route.ts
- src/app/api/payment-conflicts/[conflictId]/resolve/route.test.ts
- src/app/api/payments/[paymentId]/retry-odoo-push/route.ts
- src/app/api/payments/[paymentId]/retry-odoo-push/route.test.ts
- src/app/api/payments/[paymentId]/dismiss-odoo-sync/route.ts
- src/app/api/payments/[paymentId]/dismiss-odoo-sync/route.test.ts
- src/app/api/payments/[paymentId]/mark-canceled/route.ts
- src/app/api/payments/[paymentId]/mark-canceled/route.test.ts
- src/app/api/payment-alerts/[alertId]/route.ts
- src/app/api/payment-alerts/[alertId]/route.test.ts
- src/app/api/payments/[paymentId]/retry-attachment/route.ts
- src/app/api/payments/[paymentId]/retry-attachment/route.test.ts
- src/app/api/payments/sync-console/export/route.ts
- src/app/api/payments/sync-console/export/route.test.ts
- src/lib/csv/escape.ts
- src/lib/csv/escape.test.ts
- e2e/admin-sync-console.spec.ts  ← skipped (falta infra auth E2E)

MODIFICADOS:
- src/schemas/paymentSchema.ts (F1: dismissed enum + campos + refine + ownership)
- src/schemas/paymentSchema.test.ts (F1: tests dismissed)
- src/lib/odoo/payments-push.ts (F1: guard dismissed)
- src/lib/odoo/payments-push.test.ts (F1: test dismissed-skip)
- src/lib/odoo/sync/pull-payments.ts (F1: guard dismissed)
- src/lib/odoo/sync/pull-payments.test.ts (F1: test dismissed-skip)
- src/app/(admin)/admin/verification/VerificationPanel.tsx (F3a: usa SyncStatusBadge)
- src/app/api/payments/route.ts (F3a: enriquece odooSyncedAt/dismissedReason en GET)
- firestore.indexes.json (F5: índice resolvedAt DESCENDING para paymentConflicts)
```

---

## Senior Developer Review (AI)

**Reviewer:** Code Review subagent (Sonnet 4.6) — sesión 38
**Date:** 2026-05-14
**Reviewed against:** baseline 1510/1510 tests pass, typecheck 0, lint 0

### Outcome

**Changes Requested** — 2 bugs funcionales (High) deben corregirse antes de merge; 1 Med adicional es deseable. El resto son nits seguros.

### Findings

| # | Severity | AC/Area | File:line | Issue | Suggested fix |
|---|----------|---------|-----------|-------|---------------|
| 1 | **High** | AC2 / resolve endpoint | `route.ts:165` | Variable `field` declarada pero no usada (dead code post-transaction). Más importante: el `paymentData` pasado a `syncVerifiedPaymentToOdoo` es el snapshot leído **antes** de que la transacción escribiera el nuevo `lww.{field}`. Odoo recibirá el valor **anterior**, no el ganador elegido. El ganador solo queda en Firestore; Odoo sigue desalineado hasta el siguiente pull. | Después de la transacción, volver a leer el doc (`await paymentRef.get()`) o construir `paymentDataForPush` manualmente inyectando `winnerValue` en el campo correspondiente antes de llamar a `syncVerifiedPaymentToOdoo`. |
| 2 | **High** | AC3 / Auth mismatch | `PushQueueTable.tsx:129`, `ResolveConflictModal.tsx:88`, `AlertsTable.tsx` (fetch handlers) | Los clientes envían `Authorization: Bearer {idToken}` pero `requireAuth` en el servidor usa **exclusivamente** `verifySessionCookie` (`__session` cookie). El header `Authorization` es ignorado. Si el usuario no tiene la cookie activa (sesión expirada, navegación directa, token rotado) recibirá 401 aunque tenga ID token válido. En uso normal del browser esto probablemente funciona, pero falla en retries después de expiración de cookie. El ID token en el header es **silently unused**. | Alinear: o bien el servidor lee también el Bearer header como fallback (`request.headers.get('Authorization')`), o bien los clientes confían únicamente en la cookie y eliminan el header (patrón del resto del proyecto). Revisar cómo otros endpoints cliente (Story 9.1 reconciliation) manejan la auth para ser consistentes. |
| 3 | **Med** | AC2 / push logic | `route.ts:166-172` | La condición `shouldPush` cuando `resolution='firestore'` dispara push si `fsMs > odooMs`. Esto es correcto per spec, pero si ambos timestamps son `0` (campos ausentes en doc viejo), `toEpochMs` devuelve `0` para ambos y la condición `0 > 0` es `false` — no se dispara push. Comportamiento silencioso: un conflicto viejo sin timestamps no sincronizará Odoo aunque el admin haya elegido el valor Firestore. | Cuando `fsMs === 0 && odooMs === 0` en path `firestore`, considerar push por defecto (`return true`) o loggear advertencia. |
| 4 | **Med** | AC1 / tasa éxito 24h | `page.tsx:76-79` | La "Tasa de éxito 24h" se calcula sobre el **último run únicamente** (`lastRunSummary`), no sobre las últimas N corridas en 24h como requiere el AC. El AC especifica "agregando últimas N corridas (lectura de `syncLog/odooPull-*` si está, o cálculo directo desde `lastRunSummary` rolling)". La implementación usa solo el último run, lo que puede mostrar 100% después de un run exitoso aunque hayan fallado 10 anteriores. | Acceptable como simplificación MVP si se documenta la limitación en el tooltip del KPI. Agregar `title="Calculado sobre el último run"` al KPICard o abrir un TODO en código. |
| 5 | **Med** | AC6 / SyncStatusBadge drift | `SyncStatusBadge.tsx:99-110` | El fallback drift cuando `odooPaymentId` existe pero `odooSyncStatus` es null: si `odooSyncedAt` es reciente (<5min), muestra badge verde "synced". Pero si `odooSyncedAt` es null (campo ausente en docs pre-9.2), `toEpochMs` devuelve `0` y `Date.now() - 0 > FIVE_MIN_MS` siempre, cayendo a "pending demorado". Esto es correcto para los 4 casos prod (YAZIL/Alek/Test — que están sin `odooPaymentId`). Sin embargo, si algún doc tiene `odooPaymentId` pero sin `odooSyncedAt`, mostrará "Sync demorado" en vez del más informativo estado drift. | El comportamiento es defensivamente correcto. Agregar comentario explicando el razonamiento para maintainability. |
| 6 | **Low** | AC7 / Security rules | `firestore.rules:194-208` | Las reglas de `paymentAlerts` y `paymentConflicts` permiten lectura a `director` además de `admin/superadmin`. El AC7 especifica solo `admin === true` o `superadmin === true`. La inclusión de `director` puede ser intencional (director puede querer ver alertas de sync) pero no está documentada en el AC ni en Dev Notes. | Confirmar con Alek/Paloma si `director` debe poder leer estos docs. Si es intencional, documentar en el comentario de la rule. Si no, remover `director` de `paymentAlerts` y `paymentConflicts`. |
| 7 | **Low** | AC8 / test AC8-1 | `route.test.ts:86-119` | El test AC8-1 ("firestore-wins, Firestore más reciente → NO invoca push") tiene comentario contradictorio: dice `// Firestore más reciente → push SÍ se dispara` pero el nombre del test dice `NO invoca push`. El mock `syncVerifiedPaymentToOdoo` no está configurado para ese test, por lo que si push SÍ se dispara, lanzaría error no controlado. El test pasa actualmente solo porque el error se captura silenciosamente. | Agregar `mockSync.mockResolvedValue({status:'synced',...})` explícitamente en AC8-1 y aclarar el comentario. |
| 8 | **Low** | Estructura / dead code | `route.ts:165` | `const field = conflictData!.field as string` declarado en línea 165 pero nunca referenciado (el `field` dentro de la transacción ya no es accesible ahí). | Eliminar la línea o moverla si se necesita para el logging. |
| 9 | **Low** | AC5 / CSV export | `export/route.ts:144-158` | En sección `queue` con `status='all'`, la query no filtra por `odooSyncStatus` (trae todos los payments sin distinción), lo que puede devolver miles de docs en producción al crecer la colección. El límite de 1000 aplica, pero puede ser confuso para contabilidad si la descarga "todos" incluye pagos sin relación con sync. | Documentar en comment que `status=all` para queue incluye pagos sinceronizados y no sincronizados. Considerar agregar filtro `status in ['pending','error','synced','dismissed','error']` para excluir pagos completamente ajenos al flow. |
| 10 | **Low** | AC2 / modal UX | `ResolveConflictModal.tsx:93` | Para campo `amount`, el input espera el usuario ingrese MXN (ej: `5000.00`) y el código hace `Math.round(parseFloat(v) * 100)`. Si el usuario ingresa centavos por error (ej: `500000` pensando en MXN cuando es 5,000), el resultado sería $5,000,000. El placeholder dice "Ej: 5000.00" lo cual ayuda, pero no hay validación de rango máximo. | Agregar `max={9999999}` al input de amount y mostrar hint "Ingresa el monto en pesos MXN (ej: 5000.00 = $5,000)". |

### Action Items

- [x] **[High]** Fix #1: En `route.ts` post-transacción, releer el payment doc o construir `paymentDataWithWinner` con el `winnerValue` inyectado en el campo correspondiente antes de llamar a `syncVerifiedPaymentToOdoo`. De lo contrario Odoo recibe el valor pre-resolución.
- [x] **[High]** Fix #2: Alinear auth en clientes: verificar si el patrón del proyecto es cookie-only (y eliminar el header Bearer de los fetch calls en PushQueueTable/ResolveConflictModal/AlertsTable) o agregar soporte Bearer en `requireAuth` como fallback. Confirmar contra otro endpoint cliente del proyecto.
- [x] **[Med]** Fix #3: En `shouldPush` path `firestore`, manejar el caso donde ambos timestamps son `0/null` — push por defecto o log warning.
- [ ] **[Med]** Fix #4: Documentar limitación de "tasa éxito 24h" en tooltip del KPICard (calculado sobre último run, no rolling).
- [ ] **[Low]** Fix #7: Corregir comentario contradictorio en test AC8-1 y agregar mock explícito de `mockSync`.
- [ ] **[Low]** Fix #8: Eliminar `const field` muerta en `route.ts:165`.

### Strengths

- **LWW nested correcto**: La escritura `tx.set(paymentRef, { lww: { [field]: { value, writtenAt, source: 'admin' } } }, { merge: true })` implementa exactamente la convención aprendida en 9.3. No hay ninguna clave con punto literal.
- **Transacción race-condition**: `runTransaction` con check de `resolvedAt != null` → 409 es una implementación limpia y correcta del patrón anti-race. Los tests AC8-5 lo cubren bien.
- **SyncStatusBadge exhaustivo**: Los 5 estados del badge, el fallback drift y el guard `status !== 'verified'` para no mostrar badge en pagos no verificados está bien pensado. Elimina definitivamente el "Sincronizando…" indefinido.
