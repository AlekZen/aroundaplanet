# Story 9.2: Push Idempotente Firestore→Odoo al Verificar

Status: ready-for-dev

> **Tipo:** Feature (M)
> **Bloqueada por:** 9.0b (spike done) · 9.1 (dedup, done para reconciliación retroactiva) · 9.7 (schema, done)
> **Bloquea:** 9.4 (attachments), 9.6 (UX sync)

## Story

As a **sistema (admin Paloma vía verification queue)**,
I want que al verificar un pago en Firestore se cree automáticamente el `account.payment` correspondiente en Odoo Online (state=`draft`) con idempotencia 100% garantizada,
so that Paloma ve los pagos verificados en su contabilidad sin captura manual y sin riesgo de duplicar al re-intentar verificaciones.

## Contexto

- Spike 9.0b validó el **patrón invertido 3-call** (reservar `ir.model.data` con `res_id=0` PRIMERO → create `account.payment` → write `res_id` real). El UNIQUE constraint de Postgres (`ir_model_data_module_name_uniq_index`) serializa creates concurrentes sin necesidad de lock distribuido. Findings completos + snippet TypeScript copy-paste: `_bmad-output/implementation-artifacts/spikes/9-0b-findings.md`.
- Story 9.7 ya definió todos los campos `odoo*` en `paymentSchema.ts` (líneas 181-253) y los custom fields ya están creados en Odoo prod (`x_firebase_payment_id` indexed, `x_firebase_agent_uid`, `x_ocr_confidence`, `x_canonical_payment_id`, `x_dup_status`).
- Story 9.1 ya enlazó los 16 legacy matches alta confianza con `odooSyncStatus='legacy_linked'`. **NO se deben tocar.**
- El endpoint PATCH `/api/payments/[paymentId]/verify` ya existe (`src/app/api/payments/[paymentId]/verify/route.ts`). Solo se hookea el push DESPUÉS del update Firestore exitoso.

## Acceptance Criteria

### AC1 — Hook al verify endpoint (happy path)

**Given** un admin verifica un pago en `/admin/verification` (transición `pending_verification` → `verified`)
**When** PATCH `/api/payments/[paymentId]/verify` completa el update Firestore + commission hook
**Then** se invoca `pushPaymentToOdoo({ firestoreId, ... })` después del commission hook (fire-but-awaited, mismo request)
**And** retorna `{ paymentId, status, action, odooSync: { odooPaymentId, isNew, orphan } }`
**And** Firestore `payments/{firestoreId}` se actualiza con:
  - `odooPaymentId: <id Odoo>`
  - `odooSyncStatus: 'synced'`
  - `odooSyncedAt: serverTimestamp()`
  - `odooState: 'draft'`
  - `odooJournalId`, `odooJournalName`
  - `syncRetryCount: 0`
  - `odooLastError: null`

### AC2 — Resolución de campos Odoo

**Given** se construye el payload para `account.payment.create`
**When** se mapean los campos:
**Then**
- `partner_id` = `res.partner` resuelto por search con `name =ilike clientName` (primer match con `customer_rank > 0`). Si **no hay match** → NO crash. Se persiste `odooSyncStatus='error'` con `odooLastError='partner_not_found: {clientName}'` y se retorna 200 con el sync fallido (la verificación Firestore sí persiste).
- `amount` = `payment.amount / 100` (centavos→float Monetary)
- `date` = `payment.paymentDate.value` formato `YYYY-MM-DD`
- `memo` = `${orderId ? orderId + ' — ' : ''}${clientName}` (Odoo 18 NO tiene `ref`, usar `memo`)
- `journal_id` = mapeo:
  - `paymentMethod === 'cash'` → journal type=`cash` (cache id de env `ODOO_JOURNAL_CASH_ID`)
  - otro caso → journal type=`bank` default (cache id de env `ODOO_JOURNAL_BANK_DEFAULT_ID`)
  - Si env no resuelve → log warning `unknown_method_fallback` en `syncLog/{firestoreId}` y usar bank default
- `payment_type` = `'inbound'`, `partner_type` = `'customer'`
- `state` queda en `'draft'` (Odoo default). **NUNCA `action_post`** — decisión contable de Paloma.
- Custom fields: `x_firebase_payment_id: firestoreId`, `x_firebase_agent_uid: agentId`, `x_ocr_confidence: ocrData?.confidence ?? null`

### AC3 — Patrón invertido 3-call con idempotencia atómica

**Given** la función `pushPaymentToOdoo` ejecuta (con o sin retry, con o sin paralelismo)
**When** corre el flow
**Then** sigue **exactamente** el snippet validado en spike 9.0b (`pushPaymentToOdoo` en `_bmad-output/implementation-artifacts/spikes/9-0b-findings.md` líneas 152-289):

1. `lookupExtId('payment_{firestoreId}')` — si retorna `resId > 0` → **early-exit** con `{isNew:false, odooPaymentId: existing.resId}` (idempotencia)
2. Si lookup retorna `resId === 0` (recovery): reusa `extIdRecordId`, salta al paso 4 con el extId existente
3. `create('ir.model.data', { module:'__aroundaplanet__', name:'payment_{firestoreId}', model:'account.payment', res_id:0, noupdate:true })`:
   - Si éxito → `extIdRecordId = nuevoId`
   - Si `duplicate key value` (UNIQUE violation) → otro caller ganó → lookup y retorna su resultado
4. `create('account.payment', {...payload AC2...})` → `odooPaymentId`
5. `write('ir.model.data', [extIdRecordId], { res_id: odooPaymentId })` — con **retry inline 1s→2s→4s, max 3 reintentos**

**And** si los 4 intentos del paso 5 fallan: persiste `syncLog/{firestoreId}` con `{ orphan: true, odooPaymentId, extIdRecordId, lastError, markedAt: serverTimestamp() }` Y actualiza Firestore.payment con `odooSyncStatus: 'orphan'` + `odooLastError`. El pago Firestore queda verified, el payment Odoo queda creado, el extId queda con `res_id=0` (recuperable por reintento manual UI 9.6).

### AC4 — Idempotencia bajo re-verify accidental

**Given** un pago ya tiene `odooSyncStatus='synced'` con `odooPaymentId` poblado
**When** se vuelve a llamar verify (caso no debería ocurrir per AC `INVALID_STATE` del route actual, pero pushPaymentToOdoo se puede invocar también desde botón "Reintentar sync")
**Then** lookupExtId retorna `resId > 0` → early-exit sin crear segundo `account.payment` en Odoo
**And** retorna `{ isNew: false, odooPaymentId: <mismo id>, orphan: false }`
**And** NO se crea segunda fila en `syncLog`

### AC5 — Error transitorio Odoo

**Given** XML-RPC retorna error transitorio (timeout, 503, ECONNRESET, rate limit)
**When** ocurre en cualquier paso (lookup, create payment, create ir.model.data, write)
**Then** la función NO bloquea el verify endpoint. Persiste en Firestore.payment:
  - `odooSyncStatus: 'error'`
  - `odooLastError: <error.message truncado a 2000 chars>`
  - `syncRetryCount: (prev ?? 0) + 1`
**And** el endpoint retorna 200 con el verify aplicado pero `odooSync: { error: '...', retryable: true }`
**And** la UI muestra el badge rojo con tooltip del error

### AC6 — Pago con cliente que no existe en res.partner

**Given** un pago verificado tiene `clientName` que NO matchea ningún `res.partner` con `customer_rank > 0`
**When** `pushPaymentToOdoo` busca el partner
**Then** NO crash, NO retry indefinido. Firestore.payment queda con `odooSyncStatus='error'`, `odooLastError='partner_not_found: {clientName}'`
**And** la UI badge rojo permite reintentar después de que Paloma cree el contacto en Odoo

### AC7 — Throttling para batch (botón "Reintentar todos")

**Given** se invoca `pushPaymentToOdoo` desde un batch (futuro botón admin "Reintentar todos los errores")
**When** múltiples flows se encolan
**Then** se usa wrapper `enqueueOdooSync` (snippet spike 9.0b líneas 315-330): `p-limit(concurrency=1)` + sleep 2000ms entre flows
**And** verify user-driven (1 click admin) NO pasa por el wrapper (no afecta latencia normal)

### AC8 — UI badges en cola verificación

**Given** un admin abre `/admin/verification`
**When** ve la lista de pagos verificados
**Then** cada pago muestra un badge sync:
  - `odooSyncStatus='synced'` → badge verde "Synced Odoo #{odooPaymentId} · {odooJournalName}"
  - `odooSyncStatus='pending' | undefined` (verificado recién, push en vuelo) → badge ámbar "Sincronizando…"
  - `odooSyncStatus='error'` → badge rojo "Sync error" con tooltip (`hover` o `Popover`) del `odooLastError`
  - `odooSyncStatus='orphan'` → badge naranja "Huérfano Odoo #{odooPaymentId}" con tooltip "Payment creado pero external_id no enlazó. Reintentar."
  - `odooSyncStatus='legacy_linked'` → badge azul "Legacy Odoo #{odooPaymentId}" (read-only, sin reintento)
**And** los pagos con `error` u `orphan` muestran botón "Reintentar sync" que llama `POST /api/payments/[paymentId]/retry-sync`

### AC9 — Endpoint retry

**Given** admin con permiso `payments:verify` hace click en "Reintentar sync"
**When** se llama `POST /api/payments/[paymentId]/retry-sync`
**Then** invoca `pushPaymentToOdoo` con los mismos args
**And** si exitoso: actualiza Firestore con `odooSyncStatus='synced'`, limpia `odooLastError`
**And** si vuelve a fallar: incrementa `syncRetryCount`, actualiza `odooLastError`
**And** retorna `{ odooPaymentId?, status: 'synced'|'error'|'orphan', error?: string }`

### AC10 — Conciliación a factura (best-effort, NO bloquea)

**Given** el pago Firestore tiene `tripId` o `orderId` resoluble a un `sale.order` Odoo
**When** después del paso 5 (write res_id), si `sale.order.invoice_ids` tiene al menos 1 `account.move` con `state='posted'`
**Then** intenta `account.payment.action_reconcile` (best-effort, swallow error)
**And** si falla → log warning en `syncLog/{firestoreId}.reconcileSkipped = error.message`, **NO marca odooSyncStatus='error'** (pago sí quedó sincronizado)
**Out-of-scope si Paloma no quiere reconcile automático**: feature-flag `ODOO_AUTO_RECONCILE=false` en env apaga este paso. **Default `false`** para el primer deploy.

## Tasks / Subtasks

- [ ] **Task 1: Crear módulo `pushPaymentToOdoo`** (AC: 1, 2, 3, 4, 5)
  - [ ] 1.1 Crear `src/lib/odoo/payments-push.ts` con el snippet del spike 9.0b líneas 152-289 (copy-paste exacto, ajustando imports al proyecto)
  - [ ] 1.2 Agregar helpers `resolvePartnerId(client, clientName)` (search `res.partner` por nombre, throw `AppError('ODOO_PARTNER_NOT_FOUND')` si no match)
  - [ ] 1.3 Agregar helper `resolveJournalId(client, paymentMethod)` que lea de env vars `ODOO_JOURNAL_BANK_DEFAULT_ID` y `ODOO_JOURNAL_CASH_ID` (fallback bank con warning)
  - [ ] 1.4 Co-locar test `payments-push.test.ts` con mock `OdooClient`:
    - Mock lookup-hit → `isNew=false`
    - Mock create OK → escribe Firestore mirror
    - Mock 2 fallos `write` → 3er retry exitoso
    - Mock 3 fallos → marca `orphan` en syncLog + odooSyncStatus='orphan'
    - Mock UNIQUE violation en create ir.model.data → recovery
    - Mock partner-not-found → AppError + odooSyncStatus='error'
  - [ ] 1.5 Agregar wrapper `enqueueOdooSync` en `src/lib/odoo/rate-limited-queue.ts` (snippet spike 9.0b líneas 315-330) — solo se usa en batch retry (Task 4)

- [ ] **Task 2: Hookear push al verify endpoint** (AC: 1, 5, 10)
  - [ ] 2.1 Modificar `src/app/api/payments/[paymentId]/verify/route.ts`: después de `createCommissionFromPayment` y solo si `action === 'verify'`, invocar `pushPaymentToOdoo` y persistir resultado en Firestore.payment
  - [ ] 2.2 Capturar errores: `AppError('ODOO_PARTNER_NOT_FOUND' | 'ODOO_RACE_INCONSISTENT' | XmlRpcFault)` y errores transitorios → escribir `odooSyncStatus='error' | 'orphan'` + `odooLastError`. **NUNCA throw**: el verify Firestore ya persistió, no debe revertirse por sync fail.
  - [ ] 2.3 Extender response JSON con `odooSync: { odooPaymentId?, status, error?, isNew, orphan }`
  - [ ] 2.4 Actualizar `route.test.ts` co-locado: mock `pushPaymentToOdoo` en 3 escenarios (success, partner not found, transient error)

- [ ] **Task 3: Endpoint retry-sync** (AC: 9)
  - [ ] 3.1 Crear `src/app/api/payments/[paymentId]/retry-sync/route.ts` con `POST` handler
  - [ ] 3.2 Permiso `payments:verify` (mismo que verify)
  - [ ] 3.3 Validar `status === 'verified'` y `odooSyncStatus in ('error', 'orphan', 'pending')` antes de invocar push
  - [ ] 3.4 Test co-locado con 3 casos (retry desde error, retry desde orphan, retry desde synced → 409)

- [ ] **Task 4: UI badges + botón retry en VerificationPanel** (AC: 8, 9)
  - [ ] 4.1 Localizar `src/app/(admin)/admin/verification/VerificationPanel.tsx`. Extender el render del payment item para mostrar el badge según `odooSyncStatus`.
  - [ ] 4.2 Crear `src/components/payments/OdooSyncBadge.tsx` con 5 variantes (synced/pending/error/orphan/legacy_linked) usando colores existentes (verde/ámbar/rojo/naranja/azul, tokens del design system).
  - [ ] 4.3 Tooltip de error/orphan con shadcn `Popover` o `Tooltip` (truncado a 200 chars si > 200).
  - [ ] 4.4 Botón "Reintentar sync" visible solo si `odooSyncStatus in ('error', 'orphan')` y `claims.permissions.includes('payments:verify')`. Click invoca `fetch('/api/payments/{id}/retry-sync', { method:'POST' })` con loading state + toast resultado.
  - [ ] 4.5 Test co-locado: render con cada uno de los 5 statuses; click retry mock fetch happy/error path.

- [ ] **Task 5: Env vars + secret manager** (AC: 2)
  - [ ] 5.1 Agregar a `.env.example`: `ODOO_JOURNAL_BANK_DEFAULT_ID`, `ODOO_JOURNAL_CASH_ID`, `ODOO_AUTO_RECONCILE` (= "false")
  - [ ] 5.2 Documentar en `apphosting.yaml` los secrets (sin valor, solo nombres) + actualizar memo en runbook 9.7
  - [ ] 5.3 Resolver IDs reales pidiendo a Paloma o vía `searchRead('account.journal', [['type','=','bank']])` (script de bootstrap si no existe; reuse el patrón de `scripts/audit-odoo-payments.mjs`)

- [ ] **Task 6: Browser smoke + cleanup** (validación pre-commit)
  - [ ] 6.1 Login admin, navegar `/admin/verification`
  - [ ] 6.2 Verificar 1 pago `pending_verification` real → click "Aprobar" → ver toast/UI con "Sincronizado a Odoo #N" + badge verde
  - [ ] 6.3 Inspeccionar Firestore (vía Firebase Console o script `scripts/verify-9-2-smoke.mjs` NUEVO): `odooPaymentId`, `odooSyncStatus='synced'`, `odooSyncedAt`, `odooState='draft'`
  - [ ] 6.4 Inspeccionar Odoo (vía script `scripts/verify-9-2-odoo.mjs` NUEVO): `account.payment` creado con `state='draft'`, `x_firebase_payment_id` correcto, `ir.model.data` con `module='__aroundaplanet__'` apuntando al payment
  - [ ] 6.5 Idempotencia smoke: invocar `POST /api/payments/{id}/retry-sync` 2 veces → NO crear segundo `account.payment`, response retorna mismo `odooPaymentId`
  - [ ] 6.6 Partner-not-found smoke: crear pago de test con `clientName='__NONEXISTENT_TEST_PARTNER_9_2__'`, verificar → badge rojo + tooltip "partner_not_found"
  - [ ] 6.7 Consola del navegador limpia (0 warnings/errors)
  - [ ] 6.8 Cleanup post-smoke: cualquier `account.payment` creado con sufijo `TEST_AROUNDA_*` en memo → rename `_CLEANED_<iso>` + `state='canceled'`. `ir.model.data` con `name` que empiece en `TEST_AROUNDA_*` → rename `_CLEANED_<iso>` (NO unlink, regla negocio)

- [ ] **Task 7: Validaciones pre-commit**
  - [ ] 7.1 `pnpm typecheck` ✓ (0 errores)
  - [ ] 7.2 `pnpm test` ✓ (baseline 1311+ tests, **no regresión**)
  - [ ] 7.3 `pnpm lint` ✓ (0 errores)
  - [ ] 7.4 Commit en castellano siguiendo convención: `feat(epic-9): Story 9.2 — push idempotente Firestore→Odoo en verify`

## Dev Notes

### Patrón obligatorio (NO improvisar)

**El snippet `pushPaymentToOdoo` del spike 9.0b es CONTRATO** — copy-paste exacto, no rediseñar. La razón es que el patrón ya está validado contra:
- Race condition real con `Promise.all` (E3)
- UNIQUE constraint en Postgres (V1, evidencia primaria)
- `res_id=0` permitido + actualizable (V2)
- Las 4 modos de falla con su recovery path documentado

Cualquier desviación abre ventana de duplicado financiero.

### Restricciones firmes (regla de negocio + spike)

1. **NUNCA `action_post`**: el pago queda `state='draft'`. Paloma decide cuándo postearlo.
2. **NUNCA `unlink`** en Odoo (regla negocio Epic 9). Cleanup vía rename `_CLEANED_<iso>` + `state='canceled'`.
3. **NUNCA tocar los 200 pagos legacy** (creados pre-Epic 9). Solo `odooSyncStatus='legacy_linked'` los enlaza vía `odooPaymentId`.
4. **Odoo 18 NO tiene `ref` en account.payment**: usar `memo`. Confirmado en spike 9.0b run 1 que falla con `ref`.
5. **`module='__aroundaplanet__'`** (doble underscore — convención Odoo para integraciones externas). NO usar `'aroundaplanet'`.
6. **`name='payment_{firestoreId}'`** mapping 1:1 con Firestore. NO reemplazar por slug.

### Archivos UPDATE (leer completos antes de tocar)

- `src/app/api/payments/[paymentId]/verify/route.ts` — endpoint actual; agregar invocación a push después del commission hook
- `src/app/api/payments/[paymentId]/verify/route.test.ts` — agregar mocks pushPaymentToOdoo
- `src/app/(admin)/admin/verification/VerificationPanel.tsx` — agregar badge + retry button
- `src/schemas/paymentSchema.ts` — **NO modificar**, los campos `odoo*` ya existen (Story 9.7)
- `apphosting.yaml` — documentar secrets nuevos
- `.env.example` — agregar journal IDs

### Archivos NEW

- `src/lib/odoo/payments-push.ts` + test co-located
- `src/lib/odoo/rate-limited-queue.ts` + test co-located
- `src/app/api/payments/[paymentId]/retry-sync/route.ts` + test co-located
- `src/components/payments/OdooSyncBadge.tsx` + test co-located
- `scripts/verify-9-2-smoke.mjs` (Firestore inspector pos-smoke)
- `scripts/verify-9-2-odoo.mjs` (Odoo inspector pos-smoke)

### OdooClient API disponible

Confirmado en `src/lib/odoo/client.ts`:
- `client.searchRead(model, domain, fields, opts)` — línea 97
- `client.create(model, values)` → number — línea 127
- `client.write(model, ids, values)` → boolean — línea 134
- Singleton via `getOdooClient()` (R-052 cache server-side, dedup in-flight)

### Detección de UNIQUE violation

El mensaje crudo del XML-RPC fault contiene literal `ir_model_data_module_name_uniq_index` y `duplicate key value`. El helper `isUniqueViolation(err)` del snippet (líneas 186-189) busca esos markers. **NO depender del código HTTP** — XML-RPC envuelve todo en fault payload.

### Throttling — cuándo aplicar

- **Verify user-driven (1 click admin)**: 1 flow = 4 calls XML-RPC max. SIN wrapper. Latencia objetivo <2s end-to-end.
- **Batch retry futuro** (botón "Reintentar todos los errores", out-of-scope este sprint pero el wrapper se commitea): usar `enqueueOdooSync(() => pushPaymentToOdoo(...))` para serializar con 2s gap.

### Testing standards (heredado de proyecto)

- Vitest co-located (`payments-push.test.ts` junto a `payments-push.ts`)
- Mock OdooClient con `vi.mock('@/lib/odoo/client')`
- Firestore Admin SDK: usar el mock pattern de `src/lib/firebase/admin.mock.ts` si existe; si no, mock minimal con `vi.fn()`
- E2E NO requerido este sprint (Playwright reservado para Story 9.6 UX sync)

### Hallazgo previo: tests pre-existentes inestables

Sesión 35 detectó:
- `<CommissionList>` TypeError 'variant' (consecuencia de `/api/agents/[agentId]/metrics` 500) — **NO tocar como parte de 9.2**
- `Navbar.test.tsx` 2 fallos pre-existentes (sesión 33) — **NO bloqueantes**

Baseline real esperado: 1311+ tests pass. Documentar el número exacto pre-cambio en el commit message para que dev-story pueda validar "0 regresiones".

### Project Structure Notes

- `src/lib/odoo/` ya existe con `client.ts`, `cache.ts`, `inflightCache.ts`, `models/`, `sync/`. El nuevo `payments-push.ts` vive en la raíz de `src/lib/odoo/`, NO en `src/lib/odoo/sync/` (sync/ es para Story 9.3 pull).
- `src/app/api/payments/[paymentId]/` ya tiene `verify/` (con test). El nuevo `retry-sync/` sigue el mismo patrón.
- Badges UI: el proyecto usa shadcn/ui v4 + Tailwind v4. El componente `Badge` ya existe en `src/components/ui/badge.tsx`. Reutilizarlo extendiéndolo con `variant="success|warning|destructive|info|secondary"` (verificar variantes disponibles antes de inventar nuevas).

### References

- [Source: _bmad-output/implementation-artifacts/spikes/9-0b-findings.md] — **fuente principal**, snippet copy-paste líneas 152-289, throttling 315-330
- [Source: _bmad-output/planning-artifacts/epics.md#Story-9.2] — épica original (líneas 1731-1772)
- [Source: src/schemas/paymentSchema.ts:181-253] — paymentOdooSyncSchema + refinements (ya implementado en 9.7)
- [Source: src/app/api/payments/[paymentId]/verify/route.ts] — endpoint actual a hookear
- [Source: src/lib/odoo/client.ts:97-139] — API OdooClient (searchRead, create, write)
- [Source: _bmad-output/implementation-artifacts/9-7-schema-zod-studio-runbook.md] — custom fields Odoo confirmados en prod
- [Source: _bmad-output/planning-artifacts/research/technical-epic-9-sync-bidireccional-pagos-research-2026-05-12.md#1] — Punto 1 research

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — 2026-05-12

### Debug Log References

- Vitest `--pool=forks` falla con `spawn UNKNOWN` en rutas Windows con `[paymentId]` (issue documentado en MEMORY/sesión 35). Workaround: ejecutar suite con `pnpm vitest run --pool=threads` — pasa limpia.
- typecheck deja error pre-existente `scripts/audit-odoo-payments.ts(5,35): Cannot find module 'dotenv'` (script untracked de auditoría previa, no introducido por 9.2). Resto del codebase typechecks limpio.
- `vi.mock` factory hoists antes que `const` top-level → resolución: usar `vi.hoisted()` para fábricas que referencian mocks.

### Completion Notes List

**Implementación completa de AC1–AC9.** AC10 (reconcile auto) **NO implementado en código**: la env `ODOO_AUTO_RECONCILE` está documentada en `.env.example` + comentada en `apphosting.yaml`, pero `syncVerifiedPaymentToOdoo` no la lee. Comportamiento actual coincide con el default (`false`) del spec — ningún reconcile automático. **Para activar reconcile habrá que extender el orquestador en una story futura** (probable 9.6 UX sync).

**Restricciones del spike respetadas:**
- Snippet 3-call invertido reusado exacto como inner `pushPaymentToOdoo`.
- `memo` (no `ref`) en `account.payment.create`.
- `state='draft'` sin `action_post`.
- `EXTID_MODULE='__aroundaplanet__'`, `name='payment_{firestoreId}'`.
- Custom fields `x_firebase_payment_id`, `x_firebase_agent_uid`, `x_ocr_confidence` integrados en el mismo `create` (no `write` separado).
- Recovery con `res_id=0` + UNIQUE-violation lookup, retry inline `1s→2s→4s` para el `write` final, marca `syncLog/{id}.orphan=true` si los 4 intentos fallan.

**Patch defensivo timezone:** `toIsoDate` usa `Intl.DateTimeFormat('en-CA', {timeZone: 'America/Mexico_City'})` para evitar off-by-one cuando el picker envía hora local MX que se almacena UTC.

**Validaciones pre-commit:**
- `pnpm typecheck` ✓ (1 error pre-existente en script untracked, no relacionado).
- `pnpm vitest run --pool=threads` ✓ — **1341 tests passed**, 0 failed (baseline 1311+ → +30 nuevos en 9.2).
- `pnpm lint` ✓ (0 errores; 33 warnings pre-existentes).

**Pendiente browser smoke (Alek retoma Playwright):**
- Verify 1 pago `pending_verification` real → ver toast/badge "Synced Odoo #N"
- Inspeccionar Firestore con `scripts/verify-9-2-smoke.mjs <paymentId>`
- Inspeccionar Odoo con `scripts/verify-9-2-odoo.mjs <paymentId>` (o `--list-journals` para resolver IDs)
- Reintentar sync idempotente (2 clicks → mismo `odooPaymentId`)
- Pago con cliente inexistente en `res.partner` → badge rojo + tooltip `partner_not_found`
- **Setear `ODOO_JOURNAL_BANK_DEFAULT_ID` y `ODOO_JOURNAL_CASH_ID` reales** en `.env.local` y Secret Manager **antes** del primer push real
- Validar fecha en Odoo coincide con la guardada Firestore para pago registrado >18:00 MX (timezone patch)
- Cleanup posterior: cualquier `account.payment TEST_AROUNDA_*` → rename `_CLEANED_<iso>` + `state='canceled'` (sin unlink)

### File List

**NEW:**
- `src/lib/odoo/payments-push.ts` — orquestador + snippet contrato 3-call
- `src/lib/odoo/payments-push.test.ts` — 15 tests (idempotencia, race, recovery, orphan, partner-not-found, journal resolution, orquestador)
- `src/lib/odoo/rate-limited-queue.ts` — `enqueueOdooSync` con concurrency=1 + min-interval 2s (sin dep `p-limit`)
- `src/app/api/payments/[paymentId]/retry-sync/route.ts` — POST endpoint
- `src/app/api/payments/[paymentId]/retry-sync/route.test.ts` — 6 tests
- `src/components/payments/OdooSyncBadge.tsx` — badge 5 variantes (synced/pending/error/orphan/legacy_linked)
- `src/components/payments/OdooSyncBadge.test.tsx` — 6 tests
- `scripts/verify-9-2-smoke.mjs` — inspector Firestore
- `scripts/verify-9-2-odoo.mjs` — inspector Odoo (account.payment + ir.model.data + --list-journals)

**MODIFIED:**
- `src/app/api/payments/[paymentId]/verify/route.ts` — hook `syncVerifiedPaymentToOdoo` después del commission hook; nunca throw
- `src/app/api/payments/[paymentId]/verify/route.test.ts` — mock `syncVerifiedPaymentToOdoo` + 3 tests del hook
- `src/app/api/payments/route.ts` — GET ahora proyecta `odooPaymentId`, `odooSyncStatus`, `odooJournalName`, `odooLastError`
- `src/app/(admin)/admin/verification/VerificationPanel.tsx` — `<OdooSyncBadge>` en lista + detalle + botón "Reintentar sync" (visible para error/orphan)
- `.env.example` — `ODOO_JOURNAL_BANK_DEFAULT_ID`, `ODOO_JOURNAL_CASH_ID`, `ODOO_AUTO_RECONCILE=false`
- `apphosting.yaml` — bloque comentado con los 3 nuevos para futuro deploy
