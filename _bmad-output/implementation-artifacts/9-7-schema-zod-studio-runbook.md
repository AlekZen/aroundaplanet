# Story 9.7: Schema Zod canónico + Custom fields Odoo Studio + Runbook operativo

Status: done

> **Tipo:** Foundation (Small)
> **Bloquea:** Story 9.2 (push), Story 9.3 (pull) — ambas consumen el schema
> **Bloqueada por:** ninguna (puede correr en paralelo con 9.0a y 9.0b)

## Story

As a **developer y admin (Paloma)**,
I want un Zod schema canónico de `Payment` con matriz field-ownership completa + custom fields creados via Odoo Studio + runbook reproducible,
so that las Stories 9.2-9.6 tienen contratos claros, sin sorpresas de tipo en runtime, y el deploy del Epic 9 es auditable.

## Contexto

Sesión 36 research definió la matriz field-ownership (Punto 8) y los custom fields Odoo necesarios (Punto 2). Esta story codifica esas decisiones en:

1. **Zod schema canónico** `paymentSchema` en `src/schemas/paymentSchema.ts` con sub-objetos LWW para campos editables en ambos lados.
2. **Cola de conflictos** `paymentConflicts/{paymentId}` con su propio Zod schema, alimentada por Story 9.3.
3. **Custom fields Odoo** creados manualmente via Studio (Paloma + dev) en `account.payment`, `documents.folder`.
4. **Tags Odoo** creados para dedup (`dup-canonico`, `dup-secundario`, `folder-canonico`, `folder-duplicado`, `aroundaplanet_comprobante`).
5. **Automation Rule + Webhook** configurada en Odoo Studio para Story 9.3 pull-via-push.
6. **Runbook operativo** con screenshots + comandos verificables, para reproducir el setup en sandbox antes de producción.

Esta es story Foundation — no entrega UI ni Cloud Functions, pero todas las stories siguientes la requieren.

## Acceptance Criteria

### AC1: Zod schema canónico `paymentSchema`

**Given** existe `src/schemas/paymentSchema.ts`
**When** se ejecuta `pnpm typecheck`
**Then** el schema valida la estructura completa de un Payment con:

**Firestore-owned (siempre desde Firestore):**
- `firestoreId: string` (uuid o nanoid)
- `agentId: string`, `agentName: string`
- `clientId: string`, `clientName: string`, `clientPhone: string | null`
- `status: 'pending_verification' | 'verified' | 'rejected' | 'info_requested'`
- `paymentMethod: 'cash' | 'bank_transfer' | 'card' | 'check' | 'other'`
- `receiptUrl: string | null`
- `ocrData: { confidence: number, extracted: Record<string, unknown> } | null`
- `verifiedBy: string | null`, `verifiedAt: Timestamp | null`
- `rejectionReason: string | null`
- `createdAt: Timestamp`, `updatedAt: Timestamp`

**LWW (editables en ambos lados, con sub-objeto tracking):**
- `amount: { value: number /* centavos */, writtenAt: Timestamp, source: 'firestore' | 'odoo' }`
- `paymentDate: { value: Timestamp, writtenAt: Timestamp, source: 'firestore' | 'odoo' }`
- `memo: { value: string, writtenAt: Timestamp, source: 'firestore' | 'odoo' }`

**Odoo mirror (read-only desde Firestore, escrito solo por sync pull):**
- `odooPaymentId: number | null`
- `odooState: 'draft' | 'in_process' | 'paid' | 'canceled' | 'rejected' | null`
- `odooJournalId: number | null`, `odooJournalName: string | null`
- `odooReconciled: boolean`
- `odooReconciledAt: Timestamp | null`
- `odooInvoiceId: number | null`
- `odooAttachmentIds: number[]` (default `[]`)
- `odooCanceledAt: Timestamp | null`
- `odooLastSyncAt: Timestamp | null`

**Bridge (sync metadata):**
- `linkedAt: Timestamp | null`, `linkedBy: string | null`
- `syncErrors: Array<{ at: Timestamp, error: string, retryCount: number }>` (default `[]`)

**And** se exporta `type Payment = z.infer<typeof paymentSchema>` para uso en TS.
**And** existe `paymentParseResult` helper que llama `paymentSchema.safeParse(data)` (cumple regla "NUNCA `as Type` en datos externos").

### AC2: Zod schema `paymentConflictSchema`

**Given** existe `src/schemas/paymentConflictSchema.ts`
**When** Story 9.3 detecta concurrent writes
**Then** persiste en `paymentConflicts/{paymentId}` un doc con shape:
```typescript
{
  paymentId: string,
  field: 'memo' | 'paymentDate' | 'amount',
  firestoreValue: unknown,
  odooValue: unknown,
  firestoreWrittenAt: Timestamp,
  odooWrittenAt: Timestamp,
  detectedAt: Timestamp,
  resolvedAt: Timestamp | null,
  resolvedBy: string | null,
  resolution: 'firestore' | 'odoo' | null,
}
```
**And** el schema valida y tipa correctamente.

### AC3: Custom fields Odoo Studio (deploy manual)

**Given** Paloma (con dev acompañante) abre Odoo Studio
**When** ejecuta los pasos del runbook
**Then** quedan creados los siguientes campos en producción:

**En `account.payment`:**
- `x_firebase_payment_id` — Char(80), indexed=True, ayuda="ID de Firestore para idempotencia del sync"
- `x_firebase_agent_uid` — Char(80), indexed=True, ayuda="UID del agente Firebase que reportó/verificó el pago"
- `x_canonical_payment_id` — Many2one('account.payment'), ayuda="Si este pago es duplicado interno, apunta al canónico (Story 9.1)"
- `x_is_canonical_duplicate` — Boolean, ayuda="True si Paloma marcó este pago como canónico de un cluster de duplicados"

**En `documents.folder` (o el modelo que Odoo Online use para folders de Documents):**
- `x_canonical_folder_id` — Many2one al mismo modelo, ayuda="Si este folder es duplicado, apunta al folder canónico (Story 9.5)"
- `x_is_canonical_folder` — Boolean

**And** verifico via XML-RPC `search_read('ir.model.fields', [('model','=','account.payment'),('name','like','x_firebase')])` que retorna los 4 campos con estado `manual`.

### AC4: Tags Odoo

**Given** existe el modelo de tags (`documents.tag` para Documents, `account.payment.category` o equivalente si existe en `account.payment`)
**When** se ejecuta el runbook
**Then** existen los siguientes tags/labels:
- `aroundaplanet_comprobante` (sobre attachments/documents)
- `dup-canonico` (sobre account.payment via custom field booleano o tag si aplica)
- `dup-secundario`
- `folder-canonico`
- `folder-duplicado`

**And** se documenta en runbook si se usaron tags `documents.tag` o si se cae a custom fields booleanos por limitación de Odoo Online.

### AC5: Automation Rule + Webhook saliente

**Given** Paloma abre Odoo Studio → Automations → New
**When** crea una Automation Rule en `account.payment`
**Then** la rule está configurada con:
- **Model:** `account.payment`
- **Trigger:** On Save (Update)
- **Apply on:** filtro que detecta cambios en `state`, `journal_id`, `reconciled`, o `move_id`
- **Action:** Webhook (POST)
- **URL:** placeholder configurable `{{ODOO_WEBHOOK_URL}}` (resuelve a `https://aroundaplanet--arounda-planet.us-east4.hosted.app/api/odoo/webhook/payment` en producción)
- **Headers:** `X-Odoo-Signature: {{computed_hmac}}` (firma con `ODOO_WEBHOOK_SECRET` env)
- **Body:** payload con `id`, `state`, `journal_id`, `amount`, `partner_id`, `x_firebase_payment_id`, `write_date`

**And** verifico que se dispara en sandbox creando un cambio de prueba y revisando logs del endpoint stub (puede ser webhook.site para validación inicial).
**And** documento el body exacto que Odoo envía (importante para diseñar el handler en Story 9.3).

### AC6: Runbook operativo

**Given** existe `_bmad-output/runbooks/epic-9-odoo-studio-setup.md`
**When** un dev nuevo lo sigue desde cero en sandbox
**Then** puede reproducir TODO el setup sin asistencia, incluyendo:
- Login Odoo Studio (URL, credenciales referenciadas por env, no inline)
- Pasos UI numerados con screenshot por cada cambio (capturas en `_bmad-output/runbooks/assets/epic-9/*.png`)
- Comando XML-RPC de verificación post-cada-paso (ej. `search_read` confirmando que el field existe)
- Sección "Rollback" con pasos para deshacer si algo sale mal (sin `unlink` de datos productivos — solo de custom fields/automations recién creados)
- Sección "Mapping `paymentMethod` → `journal_id`" con tabla a llenar con Paloma (efectivo→{id}, transferencia→{id}, tarjeta→{id})
- Sección "Env vars requeridas" con lista: `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`, `ODOO_WEBHOOK_SECRET`, `ODOO_DEFAULT_BANK_JOURNAL_ID`, `ODOO_DEFAULT_CASH_JOURNAL_ID`

**And** el runbook está versionado en git (commit explícito antes de marcar story DONE).

### AC7: Tests del schema

**Given** existe `src/schemas/paymentSchema.test.ts`
**When** se ejecuta `pnpm test paymentSchema`
**Then** los tests cubren:
- ✅ Parse de un payment válido completo
- ✅ Parse de un payment Firestore-only (sin campos `odoo*`) — `odooPaymentId: null` se acepta
- ✅ Parse falla si `status` tiene valor inválido
- ✅ Parse falla si `amount.value` no es entero (debe ser centavos)
- ✅ Parse del shape LWW: `amount: { value, writtenAt, source }` válido
- ✅ Parse falla si `source` no es `'firestore' | 'odoo'`
- ✅ `paymentConflictSchema` parse válido + inválido
- ✅ `safeParse` retorna `{ success: false, error }` con shape esperado (no `throw`)

**And** existe `src/schemas/paymentConflictSchema.test.ts` con cobertura análoga.
**And** todos los tests pasan localmente y en CI.

### AC8: Documentación de mapeos en código

**Given** existe `src/lib/odoo/paymentMappings.ts`
**When** un dev de Story 9.2 lo importa
**Then** encuentra:
- `paymentMethodToOdooJournalId: Record<PaymentMethod, number | null>` — con valores cargados desde env (no hardcoded)
- `odooStateToFirestoreMirror(state: OdooPaymentState): Partial<Payment>` — helper de mapeo para Story 9.3
- `validateJournalMapping()` — función que verifica env vars al boot, lanza error si faltan

**And** se exporta el tipo `PaymentMethod` derivado del paymentSchema (single source of truth).

## Tasks / Subtasks

- [ ] **Task 1 — paymentSchema.ts** (AC1)
  - [ ] Crear `src/schemas/paymentSchema.ts`
  - [ ] Definir todos los campos (Firestore-owned, LWW, Odoo mirror, Bridge)
  - [ ] Exportar tipo `Payment` con `z.infer`
  - [ ] Exportar helper `paymentParseResult`
- [ ] **Task 2 — paymentConflictSchema.ts** (AC2)
  - [ ] Crear `src/schemas/paymentConflictSchema.ts`
  - [ ] Definir shape con campos del AC2
  - [ ] Exportar tipo `PaymentConflict`
- [ ] **Task 3 — Tests Zod** (AC7)
  - [ ] Crear `paymentSchema.test.ts` co-located
  - [ ] Crear `paymentConflictSchema.test.ts` co-located
  - [ ] Cubrir cada caso de AC7
  - [ ] `pnpm test` pasa
- [ ] **Task 4 — paymentMappings.ts** (AC8)
  - [ ] Crear `src/lib/odoo/paymentMappings.ts`
  - [ ] Implementar `paymentMethodToOdooJournalId` leyendo env vars
  - [ ] Implementar `odooStateToFirestoreMirror`
  - [ ] Implementar `validateJournalMapping`
  - [ ] Co-located test que valida `validateJournalMapping` falla si faltan envs
- [ ] **Task 5 — Custom fields Odoo Studio** (AC3) — requiere acceso Odoo + Paloma
  - [ ] Crear los 4 campos en `account.payment` via Studio UI
  - [ ] Crear los 2 campos en `documents.folder` (o equivalente)
  - [ ] Verificar via XML-RPC search_read
  - [ ] Capturar screenshots para runbook
- [ ] **Task 6 — Tags Odoo** (AC4)
  - [ ] Crear los 5 tags (o caer a custom fields booleanos si Odoo Online no permite tags en `account.payment`)
  - [ ] Documentar decisión en runbook
- [ ] **Task 7 — Automation Rule webhook** (AC5)
  - [ ] Crear Automation Rule en sandbox Odoo
  - [ ] Configurar trigger, condición, action (webhook POST)
  - [ ] Testear contra webhook.site para validar payload
  - [ ] Documentar body exacto en runbook
- [ ] **Task 8 — Runbook** (AC6)
  - [ ] Crear `_bmad-output/runbooks/epic-9-odoo-studio-setup.md`
  - [ ] Documentar TODOS los pasos con screenshots
  - [ ] Sección Rollback
  - [ ] Sección Mapping (tabla a llenar con Paloma)
  - [ ] Sección Env vars
  - [ ] Commit explícito del runbook + assets
- [ ] **Task 9 — Typecheck + lint** (AC1, AC7)
  - [ ] `pnpm typecheck` pasa con 0 errores
  - [ ] `pnpm lint` pasa
  - [ ] Validar que los schemas se exportan correctamente

## Dev Notes

### Patrones del proyecto a respetar

- Zod schemas en `src/schemas/` (regla CLAUDE.md — NUNCA inline validation)
- camelCase en field names Firestore (regla CLAUDE.md)
- Currency en centavos enteros (NUNCA floating point — regla CLAUDE.md)
- Firestore Timestamps, NUNCA ISO strings en writes
- Booleanos con prefijo `is/has/can` cuando aplica (ej. `isCanonical`)
- Tests co-located (no `__tests__/`)
- NO barrel exports

### Restricciones de negocio

- Custom fields Odoo se crean **manual via Studio** (no programático via XML-RPC) — decisión research Punto 2.
- El setup de Studio es **idempotente** — el runbook debe poderse correr 2 veces sin romper nada (si el campo ya existe, solo verificar).
- Webhook URL configurable por env, NUNCA hardcoded a producción.
- Tags vs Custom fields: priorizar tags si Odoo Online lo permite en `account.payment`; si no, fallback a custom field booleano (documentar en runbook).

### Source tree

**Nuevos archivos (código):**
- `src/schemas/paymentSchema.ts` + `.test.ts`
- `src/schemas/paymentConflictSchema.ts` + `.test.ts`
- `src/lib/odoo/paymentMappings.ts` + `.test.ts`

**Nuevos archivos (docs):**
- `_bmad-output/runbooks/epic-9-odoo-studio-setup.md`
- `_bmad-output/runbooks/assets/epic-9/*.png` (screenshots)

**Sin cambios:**
- `src/lib/odoo/client.ts` — solo se consume.
- Cualquier API route — esta story no toca runtime productivo.

### Testing standards

- Vitest unit tests co-located.
- Cobertura: cada AC7 caso es un `test()`. Mínimo 10 tests entre los dos schemas.
- Lint: 0 errores ESLint.
- Typecheck: 0 errores TS.

## Referencias

- **Research técnico (Puntos 2, 3, 5, 8):** `_bmad-output/planning-artifacts/research/technical-epic-9-sync-bidireccional-pagos-research-2026-05-12.md`
- **Epic 9 Story 9.7 narrativa:** `_bmad-output/planning-artifacts/epics.md`
- **Convenciones Firestore + Zod:** `CLAUDE.md` (sección "Critical Implementation Rules")
- **OdooClient existente:** `src/lib/odoo/client.ts`

### Sources

- [Custom Fields in Odoo — Dasolo](https://www.dasolo.ai/blog/odoo-data-api-5/custom-fields-odoo-guide-131)
- [Automation rules — Odoo 18.0 docs](https://www.odoo.com/documentation/18.0/applications/studio/automated_actions.html)
- [Webhooks — Odoo 18.0 docs](https://www.odoo.com/documentation/18.0/applications/studio/automated_actions/webhooks.html)

## Project Structure Notes

- Los schemas viven en `src/schemas/` (regla firme del proyecto, NO en `src/features/...`).
- El runbook + assets viven en `_bmad-output/runbooks/` — esto es nueva convención para Epic 9 (validar con Alek si prefiere otra ubicación, ej. `docs/runbooks/`).
- Validar que `Timestamp` viene de Firebase Admin SDK (server) y Firestore SDK (client) — el schema debe aceptar ambos shapes o normalizar.

## Dev Agent Record

### Agent Model Used

(se completa al implementar)

### Debug Log References

### Completion Notes List

- [ ] Schema Zod completo + tests pasando
- [ ] Mappings codificados con env vars
- [ ] Custom fields Odoo creados en sandbox + verificados via XML-RPC
- [ ] Automation Rule probada contra webhook.site
- [ ] Runbook completo con screenshots + commit en git
- [ ] Stories 9.2 y 9.3 desbloqueadas (anotar en sprint-status)

### File List

- `src/schemas/paymentSchema.ts` (NEW)
- `src/schemas/paymentSchema.test.ts` (NEW)
- `src/schemas/paymentConflictSchema.ts` (NEW)
- `src/schemas/paymentConflictSchema.test.ts` (NEW)
- `src/lib/odoo/paymentMappings.ts` (NEW)
- `src/lib/odoo/paymentMappings.test.ts` (NEW)
- `_bmad-output/runbooks/epic-9-odoo-studio-setup.md` (NEW)
- `_bmad-output/runbooks/assets/epic-9/*.png` (NEW)
