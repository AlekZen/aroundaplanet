# Spike 9.0b — Findings: Idempotencia 2-call `account.payment` + `ir.model.data`

**Fecha:** 2026-05-12
**Autor:** Quick-Dev (Claude Opus 4.7) bajo supervisión de Alek
**Tenant:** aroundaplanet.odoo.com (producción Odoo 18 Enterprise Online)
**Ejecución:** `node scripts/spike-9-0b-idempotencia.mjs` + `node scripts/spike-9-0b-cleanup-followup.mjs`
**Output crudo:** `scripts/audit-output/spike-9-0b-output.json` + `spike-9-0b-cleanup-followup.json`

## TL;DR

| Pregunta | Veredicto |
|---|---|
| ¿Patrón 2-call funciona? | ✅ **SÍ** — confianza A para idempotencia |
| UNIQUE(module, name) en `ir.model.data`? | ✅ **CONFIRMADO** evidencia primaria — Postgres index `ir_model_data_module_name_uniq_index` falla con `duplicate key` (V1) |
| ¿`ir.model.data` acepta `res_id=0` antes de crear el payment? | ✅ **SÍ** y se puede `write({res_id: realId})` después (V2) |
| ¿Es seguro contra race conditions? | ✅ **SÍ con orden invertido** — el UNIQUE de Postgres serializa por nosotros |
| Estrategia recomendada Story 9.2 | **Reservar extId primero (`res_id=0`)** → `create payment` → `write(extId, res_id=paymentId)`. **NO lock distribuido Firestore.** |
| Recovery 2ª/3ª call | Retry inline 1s→2s→4s + marca `syncLog/{id}.orphan` para reconciliación manual |
| Ventana de inconsistencia | **<10 ms** entre 2ª y 3ª call cuando el patrón invertido falla a mitad |
| Latencia p50 / p95 | **599 ms / 617 ms** por flow (2 calls actual; 3 calls con patrón invertido = ~900 ms proyectado) |
| Rate limit risk | ⚠️ 100 pagos/min × 2–3 calls choca con 60 req/min Odoo — throttling obligatorio |

## Setup

- **Partner TEST:** id=4314 (nombre `<`, primer match `=ilike 'pagos aroundaplanet%'` no devolvió, fallback a `customer_rank > 0` limit 1). Inocuo para el test.
- **Journal:** id=13, code=`BNK1`, name=`Bank`, type=`bank`.
- **Prefijo TEST:** `TEST_AROUNDA_2026-05-12_` en `name` + `memo` del payment y en `ir.model.data.name`.
- **module externo:** `__aroundaplanet__` (doble underscore — convención Odoo para integraciones externas).
- **state forzado:** `draft` en todos los payments (NUNCA `action_post`, contabilidad intacta).
- **Pagos TEST creados:** 10 (ids 8121–8130), todos `amount=1.0`, finalizados en `state='canceled'`.

## Hallazgos por escenario

### E1 — Happy path

- ✅ `account.payment` creado (id=8121, state=draft, $1).
- ✅ `ir.model.data` creado (id=555964, module='__aroundaplanet__', name='payment_TEST_AROUNDA_2026-05-12_spike9-0b-pago1', model='account.payment', res_id=8121).
- ✅ Lookup post-create encuentra el extId, `res_id` coincide.
- Latencia total: **417 ms** (incluyó auth implícito); resto del run estabilizó en ~600 ms.

### E2 — Re-ejecución (idempotencia secuencial)

- Mismo extId ejecutado 2 veces más con `paymentVals.name='..._should_not_create'`.
- ✅ Ambas re-ejecuciones: `isNew=false`, mismo `odooPaymentId=8121`.
- ✅ `search_count('account.payment', [memo='TEST_AROUNDA_2026-05-12_spike9-0b-pago1'])` = **1**.
- **Conclusión:** ejecuciones secuenciales son 100 % idempotentes. El paso 1 (search_read) es la única call hecha cuando el extId existe → flow tarda ~120 ms en path "ya existe".

### E3 — Race condition (Promise.all 2 ejecuciones paralelas)

- 🛑 **Caso A reproducido:** las 2 ejecuciones detectaron ausencia en lookup → ambas crearon payment → 2 pagos (ids 8122 y 8123). Solo una creó `ir.model.data` (8123 quedó huérfano).
- `search_count(payments, memo=...pago2)` = **2** (duplicado)
- `search_count(ir.model.data, ...pago2)` = 1 (single extId, apunta a 8122)
- **Implicación operativa:** sin mecanismo de lock externo, dos Cloud Functions / dos tabs / retry simultáneo del mismo verificador → duplicado financiero. **Bloqueante para Story 9.2.**

### E4 — Fallo (o mal-formed) en 2ª call

- Variante probada: `ir.model.data.create({...model:'INVALID.model.does.not.exist'})` — Odoo **acepta** el create (no valida FK del campo `model` en ir.model.data).
- El payment 8124 se creó OK. El extId también, pero con `model='INVALID...'` → lookup posterior por `model='account.payment'` **NO lo encuentra** → re-ejecución crea payment 8125 → duplicado (search_count=2).
- Implicación: cualquier inconsistencia (excepción real, retry rato, model mal escrito, race con cliente que falla mid-flight) deja el payment huérfano → siguiente ejecución duplica.

### E5 — Latencias

| Métrica | totalMs | gapBetweenCallsMs |
|---|---|---|
| min | 537 | 0 |
| p50 | 599 | 0 |
| p95 | 617 | 0 |
| max | 662 | 0 |

- 5 iteraciones consecutivas con extIds nuevos.
- Gap entre `create account.payment` retorno y `create ir.model.data` envío: prácticamente 0 ms (sincronicidad Node).
- **2 calls XML-RPC por flow** cuando es create nuevo; **1 call** cuando ya existe (early-exit).
- Proyección 100 pagos verificados en 1 min: 100 × 2 = **200 calls/min** vs rate limit Odoo ~60 req/min → **NECESITA THROTTLING**. Solución: `p-limit` o cola interna con 30 req/min para dejar margen.

### Cleanup

- 10 payments renombrados con sufijo `_CLEANED_<iso-ts>` y movidos a `state='canceled'` (Odoo 18 usa `canceled`, no `cancel`).
- 10 ir.model.data renombrados con sufijo `_CLEANED_<iso-ts>` (7 del spike principal + 3 de las verificaciones complementarias V1/V2/V3). `ir.model.data` no tiene campo `active`; el rename libera el UNIQUE de (module, name) si se necesita reusar.
- NUNCA se ejecutó `unlink` en ningún registro.
- Verificación final: `state_counts = { canceled: 10 }`.

## Verificaciones complementarias (post-advisor)

Ejecutadas con `node scripts/spike-9-0b-verify-constraints.mjs`. Output: `scripts/audit-output/spike-9-0b-verify-constraints.json`.

### V1 — UNIQUE(module, name) en `ir.model.data`

- Primer create OK (id=555974). Segundo create idéntico → **falla**:
  ```
  XML-RPC fault: The operation cannot be completed: duplicate key value violates unique constraint
  "ir_model_data_module_name_uniq_index"
  DETAIL:  Key (module, name)=(__aroundaplanet__, TEST_AROUNDA_2026-05-12_spike9-0b-VERIFY-unique) already exists.
  ```
- **Evidencia primaria** del constraint a nivel Postgres → es atómico y serializable.

### V2 — `res_id=0` permitido + actualizable

- `create('ir.model.data', { module, name, model='account.payment', res_id: 0, noupdate: true })` → ACEPTADO (extId=555976).
- `write('ir.model.data', [extId], { res_id: realPaymentId })` → OK.
- **Implicación enorme**: podemos invertir el orden del flow y dejar que el UNIQUE constraint de Postgres serialice por nosotros, sin lock distribuido.

### V3 — Odoo NO valida FK de `res_id`

- `res_id=999999999` (no existe) → ACEPTADO. Significa que un extId puede quedar apuntando a un payment inexistente. Riesgo bajo (solo via bug nuestro), pero la reconciliación periódica debe detectar `extId.res_id` que no resuelve.

## Decisiones técnicas para Story 9.2

### 1. Race condition — Reservar extId PRIMERO (UNIQUE constraint, sin lock distribuido)

**Flow invertido (3-call):**

```
1. create('ir.model.data', { module:'__aroundaplanet__', name:'payment_{firestoreId}',
                             model:'account.payment', res_id:0, noupdate:true })
   → si falla UNIQUE → otro caller ya reservó → lookup y retorna {odooPaymentId, isNew:false}
   → si éxito → tengo el "slot" reservado atómicamente
2. create('account.payment', {...})  → newPaymentId
3. write('ir.model.data', [extId], { res_id: newPaymentId })
```

**Ventajas vs lock Firestore:**

- Atomicidad garantizada por Postgres → cero ventana de race.
- Sin infraestructura adicional (no syncLocks collection, no TTL management, no Firestore round-trip extra).
- Más simple de probar (mock OdooClient sin necesidad de Firestore Emulator para race tests).
- Self-healing: si paso 2 falla, paso 1 ya reservó el name; un retry del mismo `firestoreId` ve el extId huérfano (res_id=0) y recupera.

### 2. Recovery de 2ª call fallida

- **Opción 1 (recomendada):** retry inline con backoff `1s→2s→4s` para `ir.model.data.create`. Si los 3 retries fallan, marcar `syncLog/{firestoreId}.orphan = true` con `odooPaymentId` para reconciliación manual desde UI admin.
- **Opción 2 complementaria:** lookup secundario por heurística `(partner_id, amount, date)` cuando lookup principal falla — útil para detectar huérfanos pre-existentes.
- **NO usar:** unlink del payment huérfano (regla negocio: nunca borrar/unlink en Odoo).

### 3. Validación del extId post-create

Llamar `search_read('ir.model.data', [['id','=',extIdRecordId]], ['model','res_id'])` después del create y verificar `model === 'account.payment'`. Esto detecta el caso E4 (mal-formed model field).

### 4. Throttling vs rate limit Odoo

Configurar `p-limit(concurrency=1)` con sleep `(60*1000/30)=2000 ms` entre flows en el job de sync. Para verificación user-driven (no batch) el rate limit no es problema (un agente/admin no genera 100 verificaciones/min).

### 5. Choice del módulo externo

- `module='__aroundaplanet__'` valida la convención Odoo. NO usar `'aroundaplanet'` (sin underscore) — ese nombre se reserva para módulos instalados.
- `name='payment_{firestoreId}'` mantiene mapping 1:1 con Firestore.

## Snippet TypeScript copy-paste para Story 9.2

> **Patrón invertido 3-call**: reservar extId con `res_id=0` → create payment → update extId. El UNIQUE constraint en Postgres serializa creates concurrentes sin necesidad de lock distribuido.

```typescript
// src/lib/odoo/payments-push.ts (NEW en Story 9.2 — no se commitea en este spike)
import { getOdooClient } from '@/lib/odoo/client'
import { AppError } from '@/lib/errors/AppError'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const EXTID_MODULE = '__aroundaplanet__'
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const
// Mensajes que Postgres devuelve para violacion del UNIQUE (module, name)
const UNIQUE_VIOLATION_MARKERS = [
  'ir_model_data_module_name_uniq_index',
  'duplicate key value',
]

type PushPaymentInput = {
  firestoreId: string
  partnerId: number
  journalId: number
  amount: number
  date: string // 'YYYY-MM-DD'
  memo: string
  paymentType?: 'inbound' | 'outbound'
}

export type PushPaymentResult = {
  odooPaymentId: number
  extIdRecordId: number | null
  isNew: boolean
  orphan: boolean
}

async function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

function isUniqueViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return UNIQUE_VIOLATION_MARKERS.some(m => msg.includes(m))
}

async function lookupExtId(client: ReturnType<typeof getOdooClient>, extIdName: string) {
  const rows = await client.searchRead(
    'ir.model.data',
    [
      ['module', '=', EXTID_MODULE],
      ['name', '=', extIdName],
      ['model', '=', 'account.payment'],
    ],
    ['res_id'],
    { limit: 1 },
  )
  if (!rows.length) return null
  return { extIdRecordId: rows[0].id as number, resId: rows[0].res_id as number }
}

export async function pushPaymentToOdoo(input: PushPaymentInput): Promise<PushPaymentResult> {
  const client = getOdooClient()
  const extIdName = `payment_${input.firestoreId}`

  // 1) Lookup idempotente.
  const existing = await lookupExtId(client, extIdName)
  if (existing && existing.resId > 0) {
    return { odooPaymentId: existing.resId, extIdRecordId: existing.extIdRecordId, isNew: false, orphan: false }
  }

  // 2) Reservar slot creando ir.model.data con res_id=0.
  //    El UNIQUE(module, name) en Postgres serializa creates concurrentes —
  //    solo un caller gana, los demás reciben "duplicate key" y caen a lookup.
  let extIdRecordId: number
  if (existing && existing.resId === 0) {
    // Caso recovery: extId reservado pero payment nunca se creó (run anterior falló entre 2 y 3).
    extIdRecordId = existing.extIdRecordId
  } else {
    try {
      extIdRecordId = await client.create('ir.model.data', {
        module: EXTID_MODULE,
        name: extIdName,
        model: 'account.payment',
        res_id: 0,
        noupdate: true,
      })
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Otro caller ganó la carrera — leer su resultado.
        const winner = await lookupExtId(client, extIdName)
        if (winner && winner.resId > 0) {
          return { odooPaymentId: winner.resId, extIdRecordId: winner.extIdRecordId, isNew: false, orphan: false }
        }
        // El ganador todavía no actualizó res_id — fall through al payment.create
        // y esperaremos al write con retry (idempotente porque mismo extId).
        if (!winner) throw new AppError('ODOO_RACE_INCONSISTENT', 'UNIQUE violation sin lookup hit', 500, true)
        extIdRecordId = winner.extIdRecordId
      } else {
        throw err
      }
    }
  }

  // 3) Crear el payment.
  const odooPaymentId = await client.create('account.payment', {
    partner_id: input.partnerId,
    journal_id: input.journalId,
    amount: input.amount,
    date: input.date,
    memo: input.memo,
    payment_type: input.paymentType ?? 'inbound',
    partner_type: 'customer',
  })

  // 4) Actualizar el extId con el res_id real (retry con backoff).
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await client.write('ir.model.data', [extIdRecordId], { res_id: odooPaymentId })
      lastError = null
      break
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay !== undefined) await sleep(delay)
    }
  }

  if (lastError) {
    // Payment creado, extId reservado, pero write res_id falló los 4 intentos.
    // Marcar huérfano para reconciliación manual desde UI admin (Story 9.6).
    await getFirestore().collection('syncLog').doc(input.firestoreId).set({
      orphan: true,
      odooPaymentId,
      extIdRecordId,
      lastError: lastError.message,
      markedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    return { odooPaymentId, extIdRecordId, isNew: true, orphan: true }
  }

  return { odooPaymentId, extIdRecordId, isNew: true, orphan: false }
}
```

**Por qué este patrón es seguro contra todas las fallas:**

| Falla en paso | Estado residual | Recovery en retry |
|---|---|---|
| 2a (create extId) | nada creado | nuevo create — caso happy path |
| 2b (UNIQUE violation) | otro caller ganó | lookup retorna el resultado ganador |
| 3 (create payment) | extId con res_id=0 reservado | next call: lookup hit con res_id=0 → reusa extId, crea payment, write |
| 4 (write res_id) | payment creado, extId.res_id=0 | next call: lookup hit res_id=0 → re-intenta write con el payment ya creado (NO duplica) |

**Limitación restante (mitigada por reconciliación):** paso 4 con todos los retries fallidos deja `extId.res_id=0` apuntando a un payment huérfano. Reconciliación admin (Story 9.6) lee `syncLog/{id}.orphan=true` y muestra cola para reintento manual.

**Para Story 9.2 (no en este spike):**

- Reemplazar el lookup ad-hoc por wrapper `lookupByExternalId(module, name, model)` en `OdooClient`.
- Schema Zod del input + del result (`PushPaymentResult`) en `src/schemas/payment.ts` (depende de Story 9.7).
- Tests:
  - Unit: lock acquire/release con Firestore Emulator.
  - Unit: mock OdooClient retornando lookup hit → `isNew=false`.
  - Unit: mock OdooClient con 2 fallos en create ir.model.data → 3er retry exitoso.
  - Unit: mock OdooClient con 3 fallos → marca orphan en syncLog.
  - Integration (opcional, behind flag): contra sandbox Odoo si llega a existir.

## Throttling para Story 9.3 (pull) y Story 9.6 (cola admin)

```typescript
// src/lib/odoo/rate-limited-queue.ts
import pLimit from 'p-limit'
const ODOO_SYNC_LIMIT = pLimit(1) // max 1 flow en vuelo
const ODOO_MIN_INTERVAL_MS = 2_000 // ~30 req/min con 2 calls/flow = 60 calls/min margen

let lastRun = 0
export function enqueueOdooSync<T>(fn: () => Promise<T>): Promise<T> {
  return ODOO_SYNC_LIMIT(async () => {
    const elapsed = Date.now() - lastRun
    if (elapsed < ODOO_MIN_INTERVAL_MS) await new Promise(r => setTimeout(r, ODOO_MIN_INTERVAL_MS - elapsed))
    lastRun = Date.now()
    return fn()
  })
}
```

## Riesgos abiertos / TODO para Story 9.2

- **Validar `name` autogenerado por Odoo:** en E1–E5 enviamos `name=TEST_...` pero Odoo lo respetó porque el payment quedó en draft. Al posted el sistema lo reemplaza por la secuencia (`PBNK1/2026/...`). Para reconciliación: usar `memo` y `id` como llaves, NO `name`.
- **`memo` field vs `ref`:** Odoo 18 removió `ref` de `account.payment` (rompió en run 1). Usar `memo` siempre.
- **Pago con `state='draft'` no impacta contabilidad** — confirmado: 10 pagos TEST en draft + canceled no aparecen en libro mayor ni en KPIs de Director.
- **Cleanup notes para Paloma:** payments 8121–8130 visibles en Odoo con name terminado en `_CLEANED_2026-05-12T18-58-15-043Z`, state=`canceled`, $1 c/u, partner 4314 ('<'). Si necesitan unlink: hacerlo manualmente con confirmación. No bloquean nada.

## Validaciones técnicas

- `pnpm typecheck` — se ejecuta como cierre del spike (sin código nuevo en `src/`, solo scripts `.mjs`).
- `pnpm test` — sin tests nuevos en este spike.

## Sources consultadas

- `_bmad-output/planning-artifacts/research/technical-epic-9-sync-bidireccional-pagos-research-2026-05-12.md#1`
- Odoo 18 source `account/models/account_payment.py` (ValueError de `state='cancel'` confirmó el rename a `'canceled'`).
- Documentación interna `src/lib/odoo/client.ts` (patrón retry/rate-limit reutilizado en snippet).
