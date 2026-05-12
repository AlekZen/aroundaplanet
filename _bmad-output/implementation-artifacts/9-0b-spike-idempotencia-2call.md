# Story 9.0b (Spike B): Validar idempotencia 2-call `create account.payment` + `ir.model.data`

Status: ready-for-dev

> **Tipo:** Technical Spike (timebox: 1 día / 8h)
> **Bloquea:** Story 9.2 (Push Firestore→Odoo idempotente)
> **Bloqueada por:** ninguna (puede correr en paralelo con 9.0a y 9.7)

## Story

As a **developer (Alek/Quick-Dev)**,
I want to validar empíricamente que el patrón 2-call (`create account.payment` + `create ir.model.data`) es idempotente, robusto a re-intentos y manejable cuando la 2ª call falla,
so that Story 9.2 puede implementar el push Firestore→Odoo con un patrón confirmado sin riesgo de duplicar pagos en la contabilidad.

## Contexto del Spike

El research técnico (Punto 1) identificó que la idempotencia se logra usando `ir.model.data` como external_id lookup antes de crear `account.payment`. Confianza **B** porque XML-RPC NO ofrece transacción atómica para 2 calls separados — si la 2ª call falla, queda un `account.payment` huérfano sin external_id, lo que rompe la idempotencia futura.

**Patrón a validar:**

```
1. search_read('ir.model.data', [('module','=','__aroundaplanet__'), ('name','=','payment_{firestoreId}'), ('model','=','account.payment')])
2a. Si existe → retornar res_id existente (idempotente, exit)
2b. Si NO existe:
    - create('account.payment', {...})  → newPaymentId
    - create('ir.model.data', {module, name, model, res_id: newPaymentId, noupdate: True})
```

**Escenarios a probar:**

- E1: Happy path (no existe external_id → crear ambos → verificar)
- E2: Re-ejecución (mismo firestoreId 3 veces consecutivas → NO duplica)
- E3: Race condition simulada (2 ejecuciones paralelas con mismo firestoreId)
- E4: Fallo de la 2ª call (`account.payment` creado pero `ir.model.data` falla) → estrategia de recovery
- E5: Latencias y rate limit (medir tiempo total + posición vs 60 req/min)

> **Restricción operativa:** Si no hay sandbox, usar producción con prefijo `TEST_AROUNDA_2026-05-12_B_` en partner+payment+external_id (`name='TEST_AROUNDA_2026-05-12_B_payment_001'`). Cleanup obligatorio con confirmación explícita Alek al final.

## Acceptance Criteria

### AC1: Setup del entorno + fixtures

**Given** Alek confirma sandbox/producción
**When** se inicia el spike
**Then** documento en `_bmad-output/planning-artifacts/spikes/9.0b-idempotencia-2call-findings.md`: tenant, fecha, autor, IDs creados

**Given** se necesitan fixtures
**When** preparo el entorno
**Then** creo `res.partner` TEST + journal disponible identificado (preferir bank journal default) + 3 firestoreIds simulados: `TEST_AROUNDA_2026-05-12_B_payment_001`, `_002`, `_003`

### AC2: Escenario E1 — Happy path

**Given** no existe `ir.model.data` con `module='__aroundaplanet__'` y `name='payment_TEST_AROUNDA_2026-05-12_B_payment_001'`
**When** ejecuto el patrón 2-call:
```python
# Step 1: lookup
existing = models.execute_kw(db, uid, password,
    'ir.model.data', 'search_read',
    [[('module','=','__aroundaplanet__'),
      ('name','=','payment_TEST_AROUNDA_2026-05-12_B_payment_001'),
      ('model','=','account.payment')]],
    {'fields': ['res_id'], 'limit': 1})

# Step 2: create payment + external_id
if not existing:
    payment_id = models.execute_kw(db, uid, password,
        'account.payment', 'create', [{
            'partner_id': test_partner_id,
            'amount': 100.0,
            'journal_id': bank_journal_id,
            'date': '2026-05-12',
            'ref': 'TEST_AROUNDA_2026-05-12_B_payment_001',
        }])
    extid = models.execute_kw(db, uid, password,
        'ir.model.data', 'create', [{
            'module': '__aroundaplanet__',
            'name': 'payment_TEST_AROUNDA_2026-05-12_B_payment_001',
            'model': 'account.payment',
            'res_id': payment_id,
            'noupdate': True,
        }])
```
**Then** documento:
- Tiempo total del flow (ms)
- IDs retornados (`payment_id`, `extid`)
- Verificación post: `search_read('ir.model.data', ...)` retorna 1 registro con `res_id == payment_id`
- Verificación cross: `read('account.payment', [payment_id], ['name','state','amount'])` retorna el pago correcto

### AC3: Escenario E2 — Re-ejecución (idempotencia)

**Given** el flow de AC2 ya corrió exitosamente para `payment_001`
**When** ejecuto el MISMO patrón 2-call otras 2 veces consecutivas con el mismo firestoreId
**Then** en cada ejecución:
- Step 1 (search_read) retorna el registro existente
- Step 2 NO se ejecuta (early exit)
- Retorna el mismo `res_id` original
**And** verifico con `search_count('account.payment', [('ref','=','TEST_AROUNDA_2026-05-12_B_payment_001')])` que solo hay 1 pago (no duplicó)

### AC4: Escenario E3 — Race condition

**Given** no existe external_id para `payment_002`
**When** lanzo 2 ejecuciones paralelas del patrón con el mismo firestoreId (usando `Promise.all` con 2 calls XML-RPC concurrentes)
**Then** documento qué pasó:
- Caso A: ambas ejecuciones detectan ausencia en Step 1 → ambas crean payment → quedan 2 pagos duplicados (mal — necesitamos mitigación)
- Caso B: Odoo serializa internamente y solo una crea el external_id, la otra falla con constraint
- Caso C: una crea ambos, la otra detecta el external_id en Step 1
**And** documento la estrategia de mitigación si es Caso A:
- Pre-creación lock distribuido en Firestore (`syncLocks/{firestoreId}` con TTL)
- O retry con detección post-create vía lookup forzado

### AC5: Escenario E4 — Fallo de 2ª call

**Given** el `account.payment` se crea exitosamente
**When** simulo fallo de la 2ª call (forzar error en `ir.model.data.create` pasando `model='invalid.model'` o con typo)
**Then** documento:
- El `account.payment` queda huérfano (sin external_id)
- Una 2ª ejecución del patrón con el mismo firestoreId NO encuentra el external_id → INTENTA crear de nuevo el payment → duplicado en Odoo
**And** documento estrategia de recovery validada:
- **Opción 1:** Retry con backoff 1s→2s→4s del `ir.model.data.create` antes de salir de la función (mejor)
- **Opción 2:** Lookup secundario por heurística (`partner_id` + `amount` + `date` + `ref`) si Step 1 falla
- **Opción 3:** Marcar firestoreId en `syncLog/{firestoreId}` con `orphan: true` para reconciliación manual

### AC6: Escenario E5 — Latencias y rate limit

**Given** los 4 escenarios anteriores fueron probados
**When** mido el flow happy path 10 veces consecutivas con firestoreIds diferentes
**Then** documento:
- Latencia promedio por flow (ms)
- Latencia p50, p95, p99
- Calls XML-RPC por flow (esperado: 2 si no existe, 1 si existe)
- Proyección: si hacemos sync de 100 pagos verificados en 1 minuto, ¿chocamos con rate limit 60 req/min? (calc: 100 × 2 = 200 calls/min → SÍ choca, necesitamos throttling)

### AC7: Reporte final con código TypeScript para 9.2

**Given** los 5 escenarios fueron probados
**When** finalizo el spike
**Then** `findings.md` contiene:
- **Conclusión binaria sobre race condition:** ¿necesitamos lock distribuido Firestore o el comportamiento natural de Odoo es suficiente?
- **Estrategia de recovery firme para fallo 2ª call:** opción 1, 2 o combinación
- **Snippet TypeScript** para Story 9.2 usando `OdooClient`:
  ```typescript
  async function pushPaymentToOdoo(
    firestorePayment: Payment,
    odooContext: { partnerId: number; journalId: number }
  ): Promise<{ odooPaymentId: number; isNew: boolean }> {
    const externalIdName = `payment_${firestorePayment.firestoreId}`;
    // ...código probado en spike, con retry backoff y race mitigation
  }
  ```
- **Throttling strategy:** si rate limit es un riesgo real, definir cómo Cloud Function debe batch/throttle (p.ej. p-limit con 30 calls/min para dejar margen)

### AC8: Cleanup TEST data

**Given** el spike termina
**When** preparo limpieza
**Then** muestro a Alek la lista completa: IDs de partner, payments, ir.model.data, syncLog entries
**And** espero confirmación explícita
**And** ejecuto `unlink` en orden: `ir.model.data` → `account.payment` → `res.partner`
**And** verifico cada paso con `search_count` retornando 0
**And** documento el log de cleanup

## Tasks / Subtasks

- [ ] **Task 1 — Setup** (AC1)
  - [ ] Confirmar sandbox/producción con Alek
  - [ ] Crear `_bmad-output/planning-artifacts/spikes/9.0b-idempotencia-2call-findings.md` con frontmatter
  - [ ] Crear `scripts/spike-9-0b-idempotencia.mjs` con auth XML-RPC reutilizando patrón de OdooClient
  - [ ] Crear `res.partner` TEST + identificar `journal_id` válido (bank_default)
- [ ] **Task 2 — E1 Happy path** (AC2)
  - [ ] Implementar función `pushPaymentIdempotent(firestoreId)` en el script
  - [ ] Ejecutar para `payment_001`
  - [ ] Verificar persistencia con search_read post-create
  - [ ] Documentar latencias
- [ ] **Task 3 — E2 Idempotencia** (AC3)
  - [ ] Re-ejecutar `pushPaymentIdempotent('payment_001')` 2 veces más
  - [ ] Verificar que retorna mismo `res_id`
  - [ ] Verificar con `search_count` que solo hay 1 payment
- [ ] **Task 4 — E3 Race condition** (AC4)
  - [ ] Lanzar 2 ejecuciones paralelas con `Promise.all` para `payment_002`
  - [ ] Capturar resultado de ambas y `search_count` final
  - [ ] Documentar caso (A/B/C) y mitigación necesaria
- [ ] **Task 5 — E4 Fallo 2ª call** (AC5)
  - [ ] Simular fallo intencional en `ir.model.data.create`
  - [ ] Verificar que queda `account.payment` huérfano
  - [ ] Implementar retry con backoff para 2ª call
  - [ ] Validar que retry recupera el caso
- [ ] **Task 6 — E5 Latencias + rate limit** (AC6)
  - [ ] Loop 10x con firestoreIds nuevos
  - [ ] Medir y persistir p50/p95/p99
  - [ ] Calcular proyección 100 pagos/min vs rate limit 60
  - [ ] Documentar estrategia de throttling si aplica
- [ ] **Task 7 — Snippet TS para 9.2** (AC7)
  - [ ] Escribir `pushPaymentToOdoo` en TypeScript con `OdooClient`
  - [ ] Incluir retry backoff, race mitigation, error handling con `AppError`
  - [ ] Incluir tipos Zod-compatible (sin importar el schema final de 9.7 — solo placeholder)
  - [ ] Pegar snippet en findings.md
- [ ] **Task 8 — Cleanup** (AC8)
  - [ ] Listar todos los IDs TEST creados (ir.model.data + payments + partners)
  - [ ] Confirmar con Alek
  - [ ] Ejecutar unlink en orden inverso (ir.model.data primero)
  - [ ] Verificar limpieza completa
  - [ ] Documentar log

## Dev Notes

### Restricciones de negocio

- **NUNCA `unlink` en producción** salvo registros TEST con prefijo `TEST_AROUNDA_2026-05-12_B_`, con confirmación Alek explícita.
- **Prefijo de external_id obligatorio:** `module='__aroundaplanet__'` (doble underscore + nombre del proyecto). NO usar `module='aroundaplanet'` ni `module='custom'` — el `__` indica datos generados por integración (convención Odoo).
- El spike NO debe modificar ningún `account.payment` o `ir.model.data` existente — solo crear nuevos TEST.

### Patrones del proyecto

- TypeScript estricto, Zod safeParse donde aplique (snippet final).
- AppError pattern para errores XML-RPC.
- Retries con backoff exponencial 1s→2s→4s (max 3) — mismo que ya usa `OdooClient`.
- NO inline secrets, NO console.log de tokens.

### Source tree

**Nuevos:**
- `scripts/spike-9-0b-idempotencia.mjs`
- `_bmad-output/planning-artifacts/spikes/9.0b-idempotencia-2call-findings.md` (deliverable)

**Sin cambios:**
- `src/lib/odoo/client.ts` — solo se consume.

### Testing standards

- No aplica testing automatizado al spike.
- El snippet TS final de AC7 debe ir con test plan documentado para Story 9.2.

## Referencias

- **Research técnico (Punto 1):** `_bmad-output/planning-artifacts/research/technical-epic-9-sync-bidireccional-pagos-research-2026-05-12.md#1-idempotencia-via-irmodeldata`
- **Epic 9 Story 9.0b narrativa:** `_bmad-output/planning-artifacts/epics.md`
- **OdooClient:** `src/lib/odoo/client.ts`

### Sources

- [Importing External IDs via XML-RPC — Odoo forum](https://www.odoo.com/forum/help-1/importing-external-ids-via-web-servicesxmlrpc-97542)
- [External IDs and Namespaces — Cybrosys](https://www.cybrosys.com/odoo/odoo-books/odoo-16-development/data-management/external-ids-and-namespaces/)
- [External API — Odoo 18.0 docs](https://www.odoo.com/documentation/18.0/developer/reference/external_api.html)

## Project Structure Notes

- `scripts/spike-9-0b-*.mjs` es código exploratorio; puede archivarse en `scripts/audit-output/` post-spike.
- El snippet TS final NO se commitea a `src/` en este spike — eso lo hace Story 9.2 con Zod schema + tests.

## Dev Agent Record

### Agent Model Used

(se completa al implementar)

### Debug Log References

### Completion Notes List

- [ ] Spike ejecutado dentro de 1 día (8h)
- [ ] 5 escenarios probados (E1-E5)
- [ ] findings.md con conclusión binaria sobre race + estrategia recovery + snippet TS
- [ ] TEST data limpio con confirmación Alek
- [ ] Story 9.2 actualizada con decisiones técnicas antes de ready-for-dev

### File List

- `scripts/spike-9-0b-idempotencia.mjs` (NEW)
- `_bmad-output/planning-artifacts/spikes/9.0b-idempotencia-2call-findings.md` (NEW)
- `_bmad-output/planning-artifacts/epics.md` (UPDATE — anotar decisión en Story 9.2)
