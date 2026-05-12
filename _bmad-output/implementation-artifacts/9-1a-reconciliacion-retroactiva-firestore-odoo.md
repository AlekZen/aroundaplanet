# Story 9.1a: Reconciliación Retroactiva Firestore↔Odoo (read-only Odoo)

Status: superseded — ver `9-1-reconciliacion-retroactiva-dedup-odoo.md` (2026-05-12: PARTE A + PARTE B consolidadas tras confirmar que los custom fields del runbook 9.7 ya existen en Odoo producción; se usa `x_dup_status` selection field en lugar de tags)

> **Tipo:** Feature (Medium) — Alcance reducido vs Story 9.1 original
> **Bloquea:** Story 9.2 (push) — pero solo en lo relativo a tener external_id mapping previo de pagos ya enlazados
> **Bloqueada por:** Story 9.7 (schema Zod — DONE)
> **Diferida explícitamente:** PARTE B (dedup 17 internos Odoo) — ver sección "Alcance excluido" abajo

## Story

As an **admin (Paloma)**,
I want una pantalla `/admin/payments/reconciliation` que cruce los 31 pagos Firestore con los 200 `account.payment` legacy de Odoo y me permita confirmar (uno a uno) los matches high/medium/low,
so that el sistema arranca con pagos enlazados retroactivamente vía `odooPaymentId` sin tocar Odoo (cero writes), preparando el terreno para Story 9.2 (push idempotente) sin riesgo de duplicar.

## Contexto

Sesión 35 (2026-05-12) auditó datos reales:
- **31 pagos Firestore** (todos test 2026-05-11) vs **200 `account.payment` Odoo** (60 d reales).
- Cross-match con heurística `partner+amount±$1+date±3d` produjo:
  - **16 matches high-confidence**
  - **12 matches medium**
  - **3 matches low**
  - **0 Firestore-only** sin candidato
  - **175 Odoo-only** sin Firestore (no se tocan en esta story)
- Output concreto: `scripts/audit-output/cross-match-result.json`.

Story 9.1 original del Epic 9 incluía además PARTE B (dedup 17 duplicados internos Odoo + tags `dup-canonico`/`dup-secundario` + custom field `x_canonical_payment_id`). **Esta parte se difiere** porque verificación 2026-05-12 confirmó que los custom fields y tags definidos en runbook 9.7 (`x_firebase_payment_id`, `x_firebase_agent_uid`, `x_canonical_payment_id`, `dup-canonico`, `dup-secundario`) **todavía NO existen en Odoo**. Sin ellos, PARTE B no puede ejecutarse de forma segura. Se trackeará en una nueva Story 9.1b cuando Paloma haya completado el setup del runbook.

Esta story (9.1a) cumple SOLO la mitad Firestore↔Odoo del Story 9.1 original — read-only contra Odoo, todas las escrituras en Firestore.

## Alcance excluido (explícitamente)

- **Dedup interno Odoo** (17 clusters `account.payment` duplicados): diferido a Story 9.1b.
- **Tags Odoo** (`dup-canonico`, `dup-secundario`): no se crean ni asignan.
- **Custom fields Odoo** (`x_canonical_payment_id`, etc.): no se setean.
- **Folder dedup Documents** (26 clusters): Story 9.5.
- **Cualquier write a Odoo**: la story es 100 % read-only contra XML-RPC. Todas las escrituras viven en Firestore.

## Acceptance Criteria

### AC1: Endpoint `GET /api/admin/payments/reconciliation`

**Given** un usuario autenticado con rol `admin` o `superadmin`
**When** ejecuta `GET /api/admin/payments/reconciliation?status=pending&agentId=...&tripId=...`
**Then** el endpoint:
1. Lee la colección `payments` de Firestore (filtrada opcionalmente por `agentId`, `tripId`).
2. Lee `account.payment` de Odoo vía `OdooClient.searchRead` con dominio `[('state','in',['draft','in_process','paid'])]` (sin escribir).
3. Cruza ambos sets con la heurística `partner + amount±$1 + date±3d` (Jaccard sobre `partner_name` normalizado, |Δamount| ≤ 100 centavos, |Δdate| ≤ 3 días).
4. Clasifica cada pago Firestore en uno de 4 buckets:
   - `high` — partner=1.0 ∧ amountDiff=0 ∧ dateDiff≤1
   - `medium` — partner≥0.6 ∧ amountDiff≤$1 ∧ dateDiff≤3
   - `low` — al menos 2 de 3 criterios sin llegar a medium
   - `none` — sin candidato
5. Excluye automáticamente los pagos Firestore que ya tienen `odooPaymentId !== null` (ya enlazados).
6. Filtro `status` admite `pending` (no enlazados) o `matched` (ya enlazados, vista de auditoría).
7. Responde JSON directo (sin wrapper) con shape validado por Zod:
   ```ts
   {
     generatedAt: string,            // ISO
     summary: { high: number, medium: number, low: number, none: number, matched: number },
     buckets: {
       high: ReconciliationCandidate[],
       medium: ReconciliationCandidate[],
       low: ReconciliationCandidate[],
       none: FirestorePaymentSummary[],
     }
   }
   ```
**And** `ReconciliationCandidate` incluye, lado a lado, los campos comparables: `firestoreId`, `firestorePayment` (subset: partner, clientName, agentName, amount, paymentDate, paymentMethod), `odooId`, `odooPayment` (subset: partner_id, partner_name, amount, date, journal_id, journal_name, state, ref), `diff: { amountDiff, dateDiff, partnerJaccard }`, `confidence: 'high'|'medium'|'low'`, `reasons: string[]`, `warnings: string[]` (ver AC4).
**And** si el caller NO es admin/superadmin, responde `403` con `AppError { code: 'forbidden', message, retryable: false }`.

### AC2: Endpoint `POST /api/admin/payments/reconciliation/[firestorePaymentId]/confirm`

**Given** admin autenticado, body `{ odooPaymentId: number, confidence: 'high'|'medium'|'low', notes?: string }`
**When** se llama el endpoint con un `firestorePaymentId` válido
**Then** la transacción Firestore (`runTransaction`):
1. Verifica que `payments/{firestorePaymentId}` existe y tiene `odooPaymentId === null`.
2. Setea `payments/{firestorePaymentId}` con:
   - `odooPaymentId = body.odooPaymentId`
   - `linkedAt = serverTimestamp()`
   - `linkedBy = auth.uid`
3. Crea documento `paymentReconciliationLog/{autoId}` con shape:
   ```ts
   {
     firestorePaymentId: string,
     odooPaymentId: number,
     confidence: 'high'|'medium'|'low',
     action: 'linked',
     adminUid: string,
     adminEmail: string | null,
     notes: string | null,
     createdAt: Timestamp,
   }
   ```
**And** NO se ejecuta ningún XML-RPC a Odoo durante el confirm.
**And** responde `200` con `{ firestorePaymentId, odooPaymentId, linkedAt }`.
**And** si el pago ya tiene `odooPaymentId !== null`, responde `409` con `AppError { code: 'already_linked', retryable: false }`.
**And** si `odooPaymentId` ya está enlazado a otro `firestorePaymentId`, responde `409` con `AppError { code: 'odoo_id_taken', retryable: false }` (uniqueness check vía query `where('odooPaymentId', '==', body.odooPaymentId)` dentro de la transacción).

### AC3: Endpoint `POST /api/admin/payments/reconciliation/[firestorePaymentId]/reject`

**Given** admin autenticado, body `{ odooPaymentId: number, reason: string }`
**When** Paloma descarta un match propuesto
**Then** se crea log en `paymentReconciliationLog/{autoId}` con `action: 'rejected'`, `firestorePaymentId`, `odooPaymentId`, `reason`, `adminUid`, `createdAt`.
**And** el pago Firestore permanece sin `odooPaymentId`.
**And** NO se escribe en Odoo.
**And** el candidato se filtra en futuras llamadas GET (`paymentReconciliationLog` se consulta por `firestorePaymentId+odooPaymentId+action='rejected'` y se excluyen pares ya rechazados).

### AC4: Warning de `clientName` faltante

**Given** un pago Firestore con `clientName === null` o `clientName === ''`
**When** entra al bucket `none` o aparece como candidato low
**Then** se incluye en `warnings: ['missing_clientName']`
**And** la UI muestra un banner naranja con texto: *"Resolver clientName desde orders.contactName antes de matchear"* y deshabilita el botón "Confirmar match" para ese pago.
**And** la UI ofrece un link a la página de orders del cliente (si `orderId` existe).
**And** el filtro UI "Listos para matchear" excluye pagos con esta warning.

### AC5: UI `/admin/payments/reconciliation`

**Given** admin navega a `/admin/payments/reconciliation`
**When** la pantalla carga (Server Component que pre-fetcha el GET inicial; los confirms son Client Components con `revalidatePath`)
**Then** veo:
- **Header**: contadores por bucket (`16 high · 12 medium · 3 low · 0 sin match · N enlazados`).
- **Filtros**: dropdown `status` (`pending` default, `matched`), dropdown `agentId` (opciones desde colección `odooAgents`), dropdown `tripId` (opciones desde trips publicados).
- **3 secciones plegables** (`<Accordion>`): "High Confidence", "Medium", "Low" — colapsables por default a `low`.
- Por cada candidato: **2 columnas lado a lado** (`<Card>` izquierda Firestore, `<Card>` derecha Odoo) con campos comparables visualmente (monto, fecha, partner, método/journal, agente).
- **Badges** con `confidence` y `reasons` (ej. `partner✓(jac=1.00)`).
- **Botón "Confirmar match"** (`<Button variant='default'>`) y **"No es match"** (`<Button variant='outline'>`).
- **Skeleton** durante carga (regla `NEVER spinner` del CLAUDE.md).
- **Error boundary** específico del route group `(admin)`.
- Al confirmar/rechazar, optimistic update + toast con `sonner` (consistente con resto de admin).

### AC6: Auditoría visible

**Given** admin filtra por `status=matched`
**When** la pantalla carga
**Then** veo los pagos ya enlazados con: `firestoreId`, `odooPaymentId`, `linkedAt`, `linkedBy (email)`, `confidence al confirmar`, y botón "Ver log" que abre modal con todas las entradas de `paymentReconciliationLog` para ese par.
**And** la lista enlazada es read-only — NO hay opción de "desenlazar" en esta story (decisión negocio: requiere proceso explícito futuro).

### AC7: Seguridad

**Given** Firestore Security Rules
**When** un cliente no-admin intenta escribir `payments/{id}.odooPaymentId` o leer `paymentReconciliationLog`
**Then** la operación se rechaza por rules.
**And** los endpoints validan claims `roles` server-side (no confían en el cliente).
**And** `paymentReconciliationLog` solo es lectura/escritura para admin/superadmin (rule explícita).

### AC8: Tests

**Given** el código nuevo
**When** se ejecuta `pnpm test`
**Then** los siguientes archivos co-located cubren:
- `src/app/api/admin/payments/reconciliation/route.test.ts` — GET con OdooClient mockeado: produce buckets correctos, respeta filtros, excluye enlazados, valida 403.
- `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/confirm/route.test.ts` — transacción exitosa, 409 already_linked, 409 odoo_id_taken, log creado.
- `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/reject/route.test.ts` — log creado, no toca payment doc.
- `src/lib/payments/reconciliationMatch.test.ts` — función pura de scoring (Jaccard partner, amountDiff, dateDiff) — al menos 8 casos: match perfecto, partner abreviado, fecha 3d, monto $1 off, none, etc.
- Reuso del fixture `scripts/audit-output/cross-match-result.json` como entrada de uno de los tests para sanity-check end-to-end.
**And** suite total se mantiene en ≥1227 tests pasando (no regresión).

### AC9: Browser smoke real

**Given** dev en local con Firebase emulators apagados y `.env.local` apuntando a producción Odoo (read-only OK) y Firestore dev
**When** el dev:
1. `pnpm dev`
2. Login con cuenta admin (`ocompudoc@gmail.com` u otra con rol admin)
3. Navega a `/admin/payments/reconciliation`
4. Confirma 1 match high-confidence de ejemplo (real de la cola de 16)
5. Verifica en Firebase Console que `payments/{firestoreId}.odooPaymentId` se actualizó y existe `paymentReconciliationLog/{logId}` con la entrada
6. Recarga la página y confirma que ese match desaparece del bucket "pending"
**Then** los 6 pasos pasan sin errores de consola y sin tocar Odoo (verificable vía network tab: no XML-RPC `create`/`write`).
**And** se documenta el resultado en `_bmad-output/implementation-artifacts/9-1a-reconciliacion-retroactiva-firestore-odoo.md` sección "Dev Agent Record" + screenshot opcional.

### AC10: Validaciones finales

**Given** la story se considera DONE
**When** se ejecuta:
- `pnpm typecheck` → 0 errores
- `pnpm lint` → 0 errores
- `pnpm test` → todos pasan (≥1227)
- Browser smoke AC9 → 6/6 pasos OK
**Then** se actualiza `_bmad-output/implementation-artifacts/sprint-status.yaml`:
- `9-1-reconciliacion-retroactiva-dedup-odoo` permanece `backlog` (porque cubre PARTE A+B)
- Se agrega entrada nueva `9-1a-reconciliacion-retroactiva-firestore-odoo: done`
- Se agrega entrada nueva `9-1b-dedup-interno-odoo: backlog` (placeholder para PARTE B)
**And** se actualiza memoria del proyecto con el estado.

## Tasks / Subtasks

- [ ] **Task 1 — Función pura de scoring** (AC1, AC8)
  - [ ] Crear `src/lib/payments/reconciliationMatch.ts` con `scoreMatch(fs, odoo): { confidence, reasons, diff }` (puro, sin I/O)
  - [ ] Crear `reconciliationMatch.test.ts` co-located con ≥8 casos
- [ ] **Task 2 — Zod schemas reconciliación** (AC1, AC2, AC3)
  - [ ] Extender `src/schemas/paymentSchema.ts` (o nuevo `src/schemas/reconciliationSchema.ts`) con `reconciliationCandidateSchema`, `reconciliationLogSchema`, `reconciliationConfirmBodySchema`, `reconciliationRejectBodySchema`
  - [ ] Tests co-located
- [ ] **Task 3 — Endpoint GET** (AC1, AC4, AC7)
  - [ ] `src/app/api/admin/payments/reconciliation/route.ts` (Next.js 16 App Router)
  - [ ] Validar rol admin/superadmin vía claim check
  - [ ] OdooClient.searchRead con paginación segura (200 actuales, dejar margen 500)
  - [ ] Filtrado en memoria por `agentId`/`tripId` post-fetch (Firestore side); por `state` Odoo side
  - [ ] Cruce + bucketing + warnings
  - [ ] Test con OdooClient mockeado
- [ ] **Task 4 — Endpoint POST confirm** (AC2, AC7)
  - [ ] `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/confirm/route.ts`
  - [ ] `runTransaction` con uniqueness check
  - [ ] Test happy path + 2 paths 409
- [ ] **Task 5 — Endpoint POST reject** (AC3, AC7)
  - [ ] `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/reject/route.ts`
  - [ ] Test creación de log
- [ ] **Task 6 — Firestore Security Rules** (AC7)
  - [ ] Regla en `firestore.rules` para `paymentReconciliationLog` (admin/superadmin RW; resto deny)
  - [ ] Regla update `payments/{id}` permite setear `odooPaymentId/linkedAt/linkedBy` solo a admin/superadmin
  - [ ] Smoke test manual con emulator si está disponible (no obligatorio en esta story)
- [ ] **Task 7 — UI página** (AC5, AC6)
  - [ ] `src/app/(admin)/admin/payments/reconciliation/page.tsx` Server Component
  - [ ] `ReconciliationTable.tsx` Client Component co-located para confirms/rejects
  - [ ] `ReconciliationCard.tsx` con 2 columnas lado a lado (Firestore vs Odoo)
  - [ ] Skeleton de carga
  - [ ] Filtros con shadcn `Select`
  - [ ] Toasts con `sonner`
- [ ] **Task 8 — Link en sidebar admin**
  - [ ] Agregar entrada "Reconciliación pagos" en `AdminSidebar` con permission gate
- [ ] **Task 9 — Browser smoke + docs** (AC9, AC10)
  - [ ] Ejecutar smoke completo, anotar resultados en sección "Dev Agent Record"
  - [ ] Actualizar `sprint-status.yaml` con entradas nuevas
  - [ ] Actualizar memoria del proyecto (`memory/MEMORY.md`)
- [ ] **Task 10 — Validaciones cierre** (AC10)
  - [ ] `pnpm typecheck` ✓
  - [ ] `pnpm lint` ✓
  - [ ] `pnpm test` ≥1227 pasando

## Dev Notes

### Patrones del proyecto a respetar

- **Cero writes a Odoo** — `OdooClient` solo se usa para `searchRead`; cualquier `create`/`write` en este código es bug.
- `camelCase` collections Firestore; `paymentReconciliationLog` es plural conforme convención.
- Currency en centavos enteros (`payments/{id}.amount` ya está en centavos — confirmar al cruzar).
- Timestamps Firebase, NUNCA ISO strings en writes (en API responses sí se serializan a ISO).
- Zod `safeParse` en bordes externos (respuesta Odoo) — NUNCA `as Type`.
- API routes retornan JSON directo sin wrapper `{success, data}`.
- App Router con Server Components default; `'use client'` solo en `ReconciliationTable` por interactividad.
- Skeleton (`<Skeleton />` shadcn) para loading, NUNCA spinner.
- Error boundary por route group ya existe en `(admin)`.

### Restricciones de negocio

- **NO se desenlazan pagos** en esta story (`odooPaymentId` setteado no se puede limpiar desde UI — solo via consola si emergencia).
- **NO se crea `ir.model.data` para legacy** — esta story no llega tan lejos; queda para Story 9.2 cuando el push real arranque.
- 8 de 31 pagos Firestore tienen `clientName` faltante (denormalización pendiente). UI lo flaggea como warning y bloquea su matcheo hasta resolver (ver AC4).
- Heurística fija: `partner+amount±$1+date±3d` — no se expone como configurable en esta iteración.
- Cero modificaciones a `account.payment` en Odoo (no tags, no custom fields, no state).

### Decisión clave: por qué PARTE B (dedup interno Odoo) NO entra aquí

Verificación 2026-05-12 (este chat) confirmó que custom fields `x_canonical_payment_id`, `x_firebase_payment_id`, etc., y tags `dup-canonico`/`dup-secundario` **NO existen aún en Odoo producción** (definidos en runbook 9.7 pero pendientes de aplicar por Paloma + dev). Sin esos campos:
- No se puede taggear el canónico.
- No se puede setear `x_canonical_payment_id` en los secundarios.
- Cualquier intento de dedup ahora sería "marcar canónico mentalmente" sin persistencia auditable.

PARTE B se trackea como Story 9.1b (nuevo backlog item) — desbloqueada cuando AC3 + AC4 del runbook 9.7 estén aplicados en producción.

### Source tree

**Nuevos archivos:**
- `src/lib/payments/reconciliationMatch.ts` + `.test.ts`
- `src/schemas/reconciliationSchema.ts` + `.test.ts` (o extensión en paymentSchema.ts — a decidir por dev)
- `src/app/api/admin/payments/reconciliation/route.ts` + `.test.ts`
- `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/confirm/route.ts` + `.test.ts`
- `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/reject/route.ts` + `.test.ts`
- `src/app/(admin)/admin/payments/reconciliation/page.tsx`
- `src/app/(admin)/admin/payments/reconciliation/ReconciliationTable.tsx`
- `src/app/(admin)/admin/payments/reconciliation/ReconciliationCard.tsx`

**Modificados:**
- `firestore.rules` — reglas para `paymentReconciliationLog` y `payments` (campo `odooPaymentId`)
- `src/components/admin/AdminSidebar.tsx` (o equivalente) — entrada de navegación
- `src/schemas/paymentSchema.ts` — si conviene agregar `linkedAt`, `linkedBy`, `odooPaymentId` al schema existente (verificar que ya están desde Story 9.7)

**Sin cambios:**
- `src/lib/odoo/client.ts` — solo se consume `searchRead`.
- Cualquier ruta agente/cliente.

### Testing standards

- Vitest unit/integration co-located.
- OdooClient mockeado en todos los tests (fixtures inline pequeños; uno usa `cross-match-result.json` real para integración).
- Cobertura: cada AC con al menos 1 test directo.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` antes de marcar DONE.
- Browser smoke real (AC9) NO se automatiza con Playwright en esta story — manual, documentado.

## Referencias

- **Spec base:** `_bmad-output/planning-artifacts/epics.md` — Epic 9 Story 9.1 (PARTE A es subset)
- **Research técnico:** `_bmad-output/planning-artifacts/research/technical-epic-9-sync-bidireccional-pagos-research-2026-05-12.md`
- **Spike 9.0b:** `_bmad-output/implementation-artifacts/spikes/9-0b-findings.md` (entender patrón, esta story NO escribe a Odoo)
- **Auditoría sesión 35:** `memory/session-35-payments-sync-audit.md`
- **Matches concretos:** `scripts/audit-output/cross-match-result.json`
- **Schema canónico (Story 9.7 DONE):** `src/schemas/paymentSchema.ts`
- **Convenciones:** `CLAUDE.md` sección "Critical Implementation Rules"

## Project Structure Notes

- La pantalla vive en `src/app/(admin)/admin/payments/reconciliation/` — alineado con route group `(admin)` y layout existente.
- `paymentReconciliationLog` es colección nueva top-level Firestore — convención camelCase plural.
- Considerar follow-up no-bloqueante: `scripts/verify-9-7-runbook.mjs` ya está en el repo (sesión 36) — útil para validar runbook 9.7 antes de habilitar Story 9.1b.

## Dev Agent Record

### Agent Model Used

(se completa al implementar)

### Debug Log References

### Completion Notes List

- [ ] Función pura `scoreMatch` cubierta con ≥8 tests
- [ ] Endpoint GET produce buckets correctos contra fixture real
- [ ] Endpoint confirm bloquea doble-enlace (409 already_linked + 409 odoo_id_taken)
- [ ] UI muestra 16 high / 12 medium / 3 low en pre-prod con datos reales
- [ ] Firestore Security Rules aplicadas y testeadas manualmente
- [ ] Browser smoke real 6/6 OK
- [ ] sprint-status.yaml actualizado con entradas 9-1a (done) y 9-1b (backlog)
- [ ] Memoria proyecto actualizada con nota de Story 9.1a DONE

### File List

- `src/lib/payments/reconciliationMatch.ts` (NEW)
- `src/lib/payments/reconciliationMatch.test.ts` (NEW)
- `src/schemas/reconciliationSchema.ts` (NEW)
- `src/schemas/reconciliationSchema.test.ts` (NEW)
- `src/app/api/admin/payments/reconciliation/route.ts` (NEW)
- `src/app/api/admin/payments/reconciliation/route.test.ts` (NEW)
- `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/confirm/route.ts` (NEW)
- `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/confirm/route.test.ts` (NEW)
- `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/reject/route.ts` (NEW)
- `src/app/api/admin/payments/reconciliation/[firestorePaymentId]/reject/route.test.ts` (NEW)
- `src/app/(admin)/admin/payments/reconciliation/page.tsx` (NEW)
- `src/app/(admin)/admin/payments/reconciliation/ReconciliationTable.tsx` (NEW)
- `src/app/(admin)/admin/payments/reconciliation/ReconciliationCard.tsx` (NEW)
- `firestore.rules` (MOD)
- `src/components/admin/AdminSidebar.tsx` (MOD — o equivalente)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MOD)
