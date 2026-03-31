---
title: 'Comisiones y Métricas de Negocio del Agente'
slug: 'agent-commissions-metrics'
created: '2026-03-31'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
adversarial_review: 'done — 14 hallazgos integrados'
tech_stack: ['Next.js 16', 'Firestore', 'Zustand', 'Zod', 'shadcn/ui', 'Tailwind v4']
files_to_modify:
  - 'src/schemas/commissionSchema.ts (NUEVO)'
  - 'src/types/commission.ts (NUEVO)'
  - 'src/app/api/commissions/route.ts (NUEVO)'
  - 'src/app/api/commissions/[commissionId]/route.ts (NUEVO)'
  - 'src/app/api/agents/[agentId]/metrics/route.ts (NUEVO)'
  - 'src/app/api/payments/[paymentId]/verify/route.ts (MODIFICAR — hook comisión)'
  - 'src/app/api/auth/claims/route.ts (MODIFICAR — commissionRate en bootstrap)'
  - 'src/app/(agent)/agent/dashboard/page.tsx (REESCRIBIR — métricas reales)'
  - 'src/app/(agent)/agent/dashboard/CommissionList.tsx (NUEVO — F13)'
  - 'src/app/(admin)/admin/commissions/page.tsx (NUEVO)'
  - 'src/lib/auth/seedPermissions.ts (MODIFICAR — agregar commissions:manage)'
  - 'firestore.indexes.json (MODIFICAR — índices compuestos)'
code_patterns:
  - 'requireAuth() → claims con agentId y roles'
  - 'authorizeAgent() para isolation + AGENT_OVERRIDE_ROLES bypass'
  - 'AppError(code, message, status, retryable) + handleApiError()'
  - 'Admin SDK (adminDb) para todas las escrituras'
  - 'Zod safeParse obligatorio en datos externos'
  - 'Montos en centavos (integer), nunca floating point'
  - 'Timestamps de Firestore, nunca ISO strings en escrituras'
test_patterns:
  - 'Vitest con vi.mock/vi.hoisted para Firebase y Auth'
  - 'Tests co-located: archivo.test.ts junto al archivo fuente'
  - 'mockRequirePermission / mockGet / mockUpdate para Firestore'
  - 'expect.objectContaining() para assertions parciales'
---

# Tech-Spec: Comisiones y Métricas de Negocio del Agente

**Created:** 2026-03-31

## Overview

### Problem Statement

Los agentes de AroundaPlanet no tienen visibilidad sobre sus comisiones ni métricas de negocio. El dashboard "Mi Negocio" (`/agent/dashboard`) es un placeholder con skeleton cards. No existe infraestructura para calcular, almacenar ni mostrar comisiones. Los agentes no pueden saber cuánto han ganado, cuántos clientes tienen activos, ni el estado de sus pagos pendientes.

### Solution

Implementar el modelo de comisiones en Firestore (`/agents/{agentId}/commissions/`), hook automático en la verificación de pagos para crear registros de comisión, APIs para consultar comisiones, dashboard "Mi Negocio" con métricas reales, y vista admin básica para aprobar/gestionar comisiones. La tasa de comisión es configurable por agente desde SuperAdmin.

### Scope

**In Scope:**
- Schema Zod y tipos TypeScript para comisiones
- Campo `commissionRate` en documento `/agents/{agentId}`
- Permiso `commissions:manage` para admin/superadmin (F2)
- API `GET /api/commissions` — listar comisiones (agente ve las suyas, admin ve todas)
- API `PATCH /api/commissions/[commissionId]` — admin cambia status (con verificación cruzada — F1)
- API `GET /api/agents/[agentId]/metrics` — métricas agregadas del agente
- Hook idempotente en `PATCH /api/payments/[paymentId]/verify` para crear comisión (F3)
- Dashboard "Mi Negocio" con métricas reales basadas en pagos verificados (F7)
- Vista admin para ver y aprobar comisiones (cambiar status `pending` → `approved` → `paid`)
- UI responsiva: cards mobile, tabla desktop
- Componente `CommissionList.tsx` separado (F13)

**Out of Scope:**
- Comparativa vs periodo anterior (requiere histórico)
- Exportar comisiones a CSV
- Integración con Odoo para conciliación de comisiones
- Batch histórico para generar comisiones de órdenes/pagos pasados
- Notificaciones al agente cuando comisión cambia de status
- UI para editar `commissionRate` por agente (se edita directo en Firestore por ahora)

## Context for Development

### Codebase Patterns

**Auth y aislamiento de agente:**
- `requireAuth()` retorna `claims` con `uid`, `roles[]`, `agentId?`
- `authorizeAgent(claims.agentId, claims.roles, targetAgentId)` valida aislamiento; `AGENT_OVERRIDE_ROLES` (`admin`, `director`, `superadmin`) bypasean
- Todas las escrituras via Admin SDK (`adminDb`), nunca client-side
- Errores con `AppError(code, message, status, retryable)` + `handleApiError()`

**Formato de respuestas API:**
- POST → `201` con documento creado (timestamps como `null`)
- GET lista → `200` con `{ items: [...], total: number }`
- PATCH → `200` con objeto actualizado parcial (F8)
- Error → `{ code, message, retryable }` con status HTTP apropiado

**Firestore:**
- Subcollections de agente bajo `/agents/{agentId}/...` con wildcard rule `{document=**}`
- Montos SIEMPRE en centavos (integer), NUNCA floating point
- Timestamps de Firestore, NUNCA ISO strings en escrituras

**Frontend — acceso a agentId (F9):**
- Usar `useAuthStore(s => s.claims)` para obtener `claims.agentId`
- Si `claims` es null o `agentId` es undefined: mostrar estado de error "No se encontró tu perfil de agente" con enlace a soporte
- NO renderizar skeleton indefinidamente — siempre resolver a contenido o error

### Files to Reference

| File | Propósito |
| ---- | --------- |
| `src/app/api/payments/[paymentId]/verify/route.ts` | Hook point: después de línea 77 (`paymentRef.update`), cuando `action === 'verify'`. Datos: `paymentSnap.data()` con `orderId`, `agentId`, `amountCents` |
| `src/app/api/agent-contacts/route.ts` | Patrón de referencia: API agent-scoped con GET list + POST |
| `src/app/api/agent-contacts/[contactId]/route.ts` | Patrón de referencia: GET detalle con ownership check |
| `src/lib/auth/authorizeAgent.ts` | Helper de aislamiento de agente |
| `src/lib/auth/requireAuth.ts` | Auth middleware que retorna claims |
| `src/lib/auth/requirePermission.ts` | Auth middleware con validación de permiso específico |
| `src/lib/errors/AppError.ts` | Clase de error estándar |
| `src/schemas/paymentSchema.ts` | Referencia: Payment statuses, verify schema |
| `src/app/(agent)/agent/dashboard/page.tsx` | Placeholder actual — reemplazar con métricas reales |
| `src/app/(agent)/layout.tsx` | Layout agente con 5 tabs BottomNav |
| `src/app/api/auth/claims/route.ts` | Bootstrap de `/agents/{agentId}` doc (líneas 77-90) — agregar `commissionRate` default |
| `src/lib/auth/seedPermissions.ts` | Permisos — agregar `commissions:manage` (F2) |
| `firestore.rules` | Wildcard rule existente: `match /agents/{agentId}/{document=**}` cubre subcollections |
| `src/types/order.ts` | Order type con `agentId`, `amountTotalCents`, `amountPaidCents` |
| `src/stores/useAuthStore.ts` | Zustand store con `claims` — usar para obtener `agentId` en frontend (F9) |

### Technical Decisions

1. **Almacenamiento**: Subcollection `/agents/{agentId}/commissions/` — aprovecha wildcard rule existente. Admin queries usan collection group query (`collectionGroup('commissions')`).

2. **Cálculo de comisión**: `commissionAmountCents = Math.round(payment.amountCents * agent.commissionRate)` donde `commissionRate` es decimal (ej. `0.10` = 10%). Se calcula sobre el monto del PAGO verificado, no sobre el total de la orden.

3. **Status flow**: `pending` (creada automáticamente) → `approved` (admin confirma) → `paid` (admin marca como desembolsada). Agente solo ve comisiones con status `approved` o `paid`.

4. **Tasa de comisión**: Campo `commissionRate` en `/agents/{agentId}` doc. Default `0.10` (10%). Configurable por SuperAdmin (editando directamente el doc en Firestore por ahora — UI de edición fuera de scope).

5. **Firestore rules**: La wildcard rule existente `match /agents/{agentId}/{document=**}` ya cubre lectura para agente dueño + admin/director/superadmin. Escritura de comisiones solo via Admin SDK (bypass rules). NO se necesitan reglas adicionales.

6. **Dashboard métricas**: Se calculan server-side via `GET /api/agents/[agentId]/metrics`. "Ventas del Mes" se calcula sobre **pagos verificados** del mes, NO sobre `amountTotalCents` de órdenes (F7). Esto refleja ingreso real a caja.

7. **Hook en verify — idempotencia (F3)**: ANTES de crear comisión, verificar que NO exista ya una comisión con el mismo `paymentId` en la subcollection del agente. Si ya existe → skip. Esto previene duplicados si un pago se re-procesa.

8. **Permisos (F2)**: Crear nuevo permiso `commissions:manage` en `seedPermissions.ts`. Asignar a `admin: true` y `superadmin: true`. Director tiene `commissions:readAll: true` pero `commissions:manage: false` (solo lectura). El PATCH usa `requirePermission('commissions:manage')`.

9. **PATCH sin `agentId` en body (F1)**: El PATCH recibe solo `{ status, commissionAmountCents? }`. Para localizar el documento, hacer collection group query: `collectionGroup('commissions').where(FieldPath.documentId(), '==', commissionId)`. Validar que el documento existe. Extraer `agentId` del path del documento encontrado. Esto elimina el vector de escalada de privilegios.

10. **Period (F11)**: El campo `period` se calcula como `YYYY-MM` de la fecha original del pago (`paymentData.date`), no del momento de verificación. Si `paymentData.date` no existe, fallback al momento de verificación.

## Implementation Plan

### Fase 0 — Schema, tipos, permisos e índices (sin UI, sin API)

- [ ] **Tarea 0.1**: Crear schema y tipos de comisiones
  - Archivo: `src/schemas/commissionSchema.ts` (NUEVO)
  - Acción: Definir `COMMISSION_STATUSES` (`pending`, `approved`, `paid`), `commissionStatusSchema`, `updateCommissionStatusSchema` (para admin PATCH: `{ status: z.enum(['approved', 'paid']), commissionAmountCents: z.number().int().positive().optional() }`). Exportar tipos.
  - Campos del documento:
    ```
    paymentId: string        // Pago que originó la comisión (UNIQUE por agente — F3)
    orderId: string          // Orden asociada
    agentId: string          // Agente beneficiario (denormalizado del path para queries)
    clientName: string       // Denormalizado del payment doc
    tripName: string         // Denormalizado del payment doc
    paymentAmountCents: int  // Monto del pago verificado
    commissionRate: number   // Tasa aplicada (ej. 0.10)
    commissionAmountCents: int // Math.round(paymentAmountCents * commissionRate)
    status: CommissionStatus // pending | approved | paid
    period: string           // YYYY-MM de la fecha del pago original (F11)
    createdAt: Timestamp
    updatedAt: Timestamp
    approvedBy: string | null // UID del admin que aprobó
    approvedAt: Timestamp | null
    paidAt: Timestamp | null
    ```
  - Archivo: `src/types/commission.ts` (NUEVO)
  - Acción: Definir `Commission` interface y `AgentMetrics`:
    ```typescript
    interface AgentMetrics {
      verifiedSalesCents: number     // Suma de pagos verificados del mes (F7)
      activeClients: number          // Órdenes activas con userId/contactName distintos
      pendingCommissionsCents: number // Comisiones status=pending (solo admin ve)
      earnedCommissionsCents: number  // Comisiones status=approved + paid
    }
    ```

- [ ] **Tarea 0.2**: Agregar permiso `commissions:manage` (F2)
  - Archivo: `src/lib/auth/seedPermissions.ts` (MODIFICAR)
  - Acción: Agregar `'commissions:manage': false` a cliente, agente y director. Agregar `'commissions:manage': true` a admin y superadmin. Este permiso autoriza aprobar y cambiar status de comisiones.

- [ ] **Tarea 0.3**: Agregar índices compuestos en Firestore (F6)
  - Archivo: `firestore.indexes.json` (MODIFICAR)
  - Acción: Agregar índices para collection group `commissions`:
    - `(agentId ASC, status ASC, createdAt DESC)` — listar comisiones de agente filtradas por status
    - `(agentId ASC, period ASC, createdAt DESC)` — filtrar por periodo
    - `(status ASC, createdAt DESC)` — admin filtra por status global
  - Agregar índice para colección `payments`:
    - `(agentId ASC, status ASC, createdAt DESC)` — métricas de ventas verificadas
  - Nota: Deployar con `firebase deploy --only firestore:indexes` ANTES de testear en producción.

- [ ] **Tarea 0.4**: Agregar `commissionRate` default al bootstrap de agente
  - Archivo: `src/app/api/auth/claims/route.ts` (MODIFICAR)
  - Acción: En el bloque de bootstrap (líneas 77-90), agregar `commissionRate: 0.10` al `set()` del documento `/agents/{agentId}`. Solo se ejecuta si `!agentDoc.exists`, así que no sobrescribe tasas ya configuradas (F5).

### Fase 1 — Backend: APIs y hook de comisiones

- [ ] **Tarea 1.1**: Hook idempotente de creación de comisión en verificación de pago (F3)
  - Archivo: `src/app/api/payments/[paymentId]/verify/route.ts` (MODIFICAR)
  - Acción: Después de `await paymentRef.update(updateData)` (línea 77), cuando `action === 'verify'`:
    1. Leer `paymentData` de `paymentSnap.data()`
    2. Si `paymentData.agentId` es null/undefined → skip (no hay agente asignado)
    3. **Deduplicación (F3)**: Query `/agents/{agentId}/commissions` where `paymentId == currentPaymentId` limit 1. Si ya existe → skip con `console.info` y continuar
    4. Leer documento `/agents/{paymentData.agentId}` para obtener `commissionRate` (default `0.10` si campo no existe o doc no existe)
    5. **Validar rate (F14)**: Si `commissionRate <= 0` o `commissionRate > 1` → skip con `console.warn`
    6. **Validar monto (F14)**: Si `paymentData.amountCents <= 0` → skip
    7. Calcular `commissionAmountCents = Math.round(paymentData.amountCents * commissionRate)`
    8. Crear documento en `/agents/{agentId}/commissions/{auto-id}` con:
       - Todos los campos de Tarea 0.1
       - `agentId` denormalizado en el doc (para collection group queries)
       - `period` = `YYYY-MM` de `paymentData.date` (F11), fallback a fecha actual
    9. Envolver TODO en `try/catch` — si falla, `console.error` pero NO fallar la verificación (fire-and-forget)
  - Tests (F14 — expandidos): Agregar al `route.test.ts` existente:
    - "creates commission when verifying payment with agentId"
    - "skips commission when payment has no agentId"
    - "skips commission when commission already exists for paymentId (idempotency)"
    - "skips commission when agent doc has no commissionRate (uses default 0.10)"
    - "skips commission when paymentAmountCents is 0"
    - "completes payment verification even when commission creation throws"

- [ ] **Tarea 1.2**: API para listar comisiones
  - Archivo: `src/app/api/commissions/route.ts` (NUEVO)
  - Acción: `GET /api/commissions`
    - Auth: `requireAuth()` — si es agente, filtra por `claims.agentId`; si es admin/director/superadmin, puede filtrar por query param `?agentId=X`
    - Query: Collection group `commissions` con filtro `agentId` + ordenado por `createdAt DESC`
    - Query params opcionales: `?status=pending&period=2026-03`
    - **Agentes solo ven comisiones con status `approved` o `paid`** (NUNCA `pending`) — agregar filtro `status in ['approved', 'paid']` automáticamente si caller es agente
    - Respuesta: `{ commissions: Commission[], total: number }` — `200`
  - Tests: `route.test.ts` — agent sees only own approved/paid, admin sees all statuses, period filter, agentId filter

- [ ] **Tarea 1.3**: API para actualizar status de comisión (admin) (F1, F2, F8)
  - Archivo: `src/app/api/commissions/[commissionId]/route.ts` (NUEVO)
  - Acción: `PATCH /api/commissions/[commissionId]`
    - Auth: `requirePermission('commissions:manage')` (F2) — solo admin y superadmin
    - Body: `updateCommissionStatusSchema` — `{ status: 'approved' | 'paid', commissionAmountCents?: number }`
    - **Localizar documento sin `agentId` en body (F1)**: Usar `adminDb.collectionGroup('commissions')` con query por document ID. Extraer `agentId` del path del doc encontrado (`doc.ref.parent.parent.id`). Esto elimina el vector de escalada.
    - Validar transición estricta: `pending` → `approved`, `approved` → `paid`. Cualquier otra → 409
    - Si `status === 'approved'`: setear `approvedBy = claims.uid`, `approvedAt = serverTimestamp()`
    - Si `status === 'paid'`: setear `paidAt = serverTimestamp()`
    - Si se incluye `commissionAmountCents` y status actual es `pending`: actualizar monto (admin puede ajustar SOLO antes de aprobar)
    - Si se incluye `commissionAmountCents` y status actual NO es `pending`: ignorar (no se puede cambiar monto después de aprobado)
    - **Respuesta (F8)**: `200` con `{ commissionId, agentId, status, commissionAmountCents, approvedBy, approvedAt, paidAt }`
  - Tests: valid transition pending→approved, valid transition approved→paid, invalid transition paid→approved (409), amount adjustment on pending, amount ignored on approved, doc not found (404), unauthorized (403)

- [ ] **Tarea 1.4**: API de métricas del agente (F4, F7)
  - Archivo: `src/app/api/agents/[agentId]/metrics/route.ts` (NUEVO)
  - Acción: `GET /api/agents/[agentId]/metrics`
    - Auth: `requireAuth()` + `authorizeAgent()` (agente solo sus métricas, admin cualquiera)
    - Queries (en paralelo con `Promise.all`):
      1. **Ventas verificadas del mes (F7)**: `payments` where `agentId == X` and `status == 'verified'` and `createdAt >= inicioMes` → sumar `amountCents`
      2. **Clientes activos (F4)**: `orders` where `agentId == X` and `status in ['Interesado', 'Confirmado', 'En Progreso']` → fetch docs, extraer `userId` (o `contactName` si guest), deduplicar en memoria con `Set`. Limitar query a 500 docs máximo para evitar degradación.
      3. **Comisiones pendientes**: Collection group `commissions` where `agentId == X` and `status == 'pending'` → sumar `commissionAmountCents`
      4. **Comisiones ganadas**: Collection group `commissions` where `agentId == X` and `status in ['approved', 'paid']` → sumar `commissionAmountCents`
    - Respuesta: `AgentMetrics` object — `200`
  - Tests: métricas correctas con datos mock, aislamiento de agente, mes vacío retorna ceros

### Fase 2 — UI: Dashboard del agente (F9, F13)

- [ ] **Tarea 2.1**: Reescribir dashboard "Mi Negocio"
  - Archivo: `src/app/(agent)/agent/dashboard/page.tsx` (REESCRIBIR)
  - Acción: Componente `'use client'` que:
    1. Lee `claims` de `useAuthStore(s => s.claims)` (F9)
    2. Si `!claims?.agentId`: mostrar Card de error "No se encontró tu perfil de agente. Contacta a soporte." — NO skeleton infinito (F9)
    3. Fetch `GET /api/agents/{claims.agentId}/metrics` al montar
    4. Muestra 4 cards en grid 2x2 (mobile) / 4 columnas (desktop) usando `Card` de shadcn/ui:
       - "Ventas Verificadas" → `verifiedSalesCents` formateado como moneda MXN
       - "Clientes Activos" → `activeClients` como número
       - "Comisiones Pendientes" → `pendingCommissionsCents` formateado (nota: agente no ve pending en lista, pero sí ve el total como métrica de "en proceso")
       - "Comisiones Ganadas" → `earnedCommissionsCents` formateado como moneda MXN
    5. Montos en `font-mono`
    6. Skeleton pulse mientras carga (NUNCA spinner)
    7. Si falla fetch: Card de error con botón "Reintentar"
    8. Renderizar `<CommissionList />` debajo del grid (F13)

- [ ] **Tarea 2.2**: Componente CommissionList separado (F13)
  - Archivo: `src/app/(agent)/agent/dashboard/CommissionList.tsx` (NUEVO)
  - Acción: Componente `'use client'` que:
    1. Fetch `GET /api/commissions` (filtra automáticamente por agente auth)
    2. Mobile: Cards con badge de status (`approved` = verde "Aprobada", `paid` = azul "Pagada")
    3. Desktop: Tabla con columnas: Cliente, Viaje, Monto Pago, Comisión, Status, Fecha
    4. Cada fila muestra: `clientName`, `tripName`, `paymentAmountCents` formateado, `commissionAmountCents` formateado, badge status, `createdAt` formateado
    5. Si no hay comisiones: empty state "Aún no tienes comisiones. Cuando se verifiquen pagos de tus clientes, aparecerán aquí."
    6. Skeleton pulse mientras carga

### Fase 3 — UI: Vista admin de comisiones

- [ ] **Tarea 3.1**: Página admin de gestión de comisiones
  - Archivo: `src/app/(admin)/admin/commissions/page.tsx` (NUEVO)
  - Acción: Página `'use client'` con:
    1. Fetch `GET /api/commissions` (admin ve todas, incluyendo `pending`)
    2. Filtros: selector de status (`Todos`, `Pendientes`, `Aprobadas`, `Pagadas`), selector de periodo (YYYY-MM)
    3. Tabla con columnas: Agente, Cliente, Viaje, Monto Pago, Comisión, Status, Acciones
    4. Acciones por fila:
       - Si `pending`: input editable de monto comisión + botón "Aprobar" (PATCH con `status: 'approved'`)
       - Si `approved`: botón "Marcar Pagada" (PATCH con `status: 'paid'`)
       - Si `paid`: sin acciones (status final)
    5. Confirmación antes de cada acción (Dialog de shadcn/ui)
    6. Toast de éxito/error después de cada acción
    7. Refetch de lista después de cada acción exitosa
    8. Skeleton pulse mientras carga

- [ ] **Tarea 3.2**: Agregar link de comisiones en navegación admin
  - Archivo: Buscar configuración de sidebar/nav admin (probablemente en `src/app/(admin)/layout.tsx` o similar)
  - Acción: Agregar entrada "Comisiones" con ícono `DollarSign` (de lucide-react) y href `/admin/commissions`

### Acceptance Criteria

- [ ] AC1: Given un admin verifica un pago con `agentId` asignado, when el pago se marca como `verified`, then se crea automáticamente un documento de comisión en `/agents/{agentId}/commissions/` con status `pending`, monto calculado como `Math.round(amountCents * commissionRate)`, y todos los campos denormalizados.

- [ ] AC2: Given un admin verifica un pago SIN `agentId`, when el pago se marca como `verified`, then NO se crea comisión y el flujo de verificación completa normalmente.

- [ ] AC3: Given un agente accede a `/agent/dashboard`, when la página carga, then ve 4 métricas reales en grid: ventas verificadas del mes, clientes activos, comisiones pendientes, comisiones ganadas — con montos formateados en pesos y font-mono.

- [ ] AC4: Given un agente consulta sus comisiones, when la API responde, then solo ve comisiones con status `approved` o `paid` — NUNCA ve comisiones `pending`.

- [ ] AC5: Given un admin accede a `/admin/commissions`, when la página carga, then ve todas las comisiones de todos los agentes (incluyendo `pending`) con filtros de status y periodo.

- [ ] AC6: Given un admin aprueba una comisión pendiente, when cambia status a `approved`, then `approvedBy` se setea al UID del admin, `approvedAt` al timestamp del servidor, y el agente puede ver esa comisión en su dashboard.

- [ ] AC7: Given un admin intenta retroceder una comisión de `paid` a `approved`, when envía el PATCH, then la API retorna 409 con error de transición inválida.

- [ ] AC8: Given un admin ajusta el monto de comisión de una comisión `pending`, when envía PATCH con `commissionAmountCents` nuevo y `status: 'approved'`, then el monto se actualiza junto con el cambio de status.

- [ ] AC9: Given un agente intenta acceder a métricas de otro agente, when envía GET con agentId ajeno, then la API retorna 403 (aislamiento de agente).

- [ ] AC10: Given la creación de comisión falla por error de Firestore, when el hook se ejecuta, then el pago se verifica normalmente (fire-and-forget) y el error se loguea en console.

- [ ] AC11 (F3): Given un pago ya verificado se re-procesa, when el hook intenta crear comisión, then detecta que ya existe una comisión con ese `paymentId` y skip sin crear duplicado.

- [ ] AC12 (F1): Given un admin envía PATCH a `/api/commissions/[commissionId]`, when el API localiza el documento, then usa collection group query por document ID — NUNCA acepta `agentId` del body del request.

- [ ] AC13 (F9): Given un usuario con rol agente accede al dashboard pero `claims.agentId` es null/undefined, when la página renderiza, then muestra error descriptivo "No se encontró tu perfil de agente" — NUNCA skeleton infinito.

## Additional Context

### Dependencies

- **Epic 3 (Payment Verification)**: El hook de comisiones depende de que `PATCH /api/payments/[paymentId]/verify` funcione. Ya implementado y testeado.
- **Story 4-1 (Agent Clients)**: Órdenes con `agentId` ya existen. Ya funcional.
- **Bootstrap de agente**: El doc `/agents/{agentId}` se crea automáticamente al asignar rol agente. Se modifica para incluir `commissionRate: 0.10`.
- **Firestore indexes**: Deployar con `firebase deploy --only firestore:indexes` ANTES de testear en producción.
- **seedPermissions**: Agregar `commissions:manage` y re-ejecutar seed si es necesario.
- **No hay dependencias externas nuevas**: Todo con librerías ya instaladas.

### Testing Strategy

**Unit tests (Vitest, co-located):**
- `src/schemas/commissionSchema.test.ts` — validación de schemas (status válidos/inválidos, campos requeridos, monto positivo)
- `src/app/api/commissions/route.test.ts` — GET: agent isolation, admin override, status filter para agente (solo approved/paid), period filter
- `src/app/api/commissions/[commissionId]/route.test.ts` — PATCH: valid transitions, invalid transitions (409), amount adjustment on pending, amount ignored on approved, doc not found (404), unauthorized (403)
- `src/app/api/agents/[agentId]/metrics/route.test.ts` — cálculo correcto con pagos verificados (F7), aislamiento, mes vacío → ceros
- `src/app/api/payments/[paymentId]/verify/route.test.ts` — AGREGAR 6 tests al archivo existente (F14):
  - creates commission with agentId
  - skips without agentId
  - idempotency (F3)
  - default commissionRate
  - skip on zero amount
  - verify completes even if commission throws

**Manual testing:**
1. Asignar rol agente → verificar doc con `commissionRate: 0.10`
2. Crear orden con agentId → registrar pago → verificar → comisión aparece en Firestore con status `pending`
3. Verificar mismo pago dos veces → NO comisión duplicada (F3)
4. Verificar pago SIN agentId → NO comisión
5. `/agent/dashboard` → 4 métricas reales con "Ventas Verificadas" (no total órdenes — F7)
6. `/admin/commissions` → aprobar comisión → agente la ve
7. Marcar como pagada → agente ve status actualizado
8. Intentar retroceder status → error 409

### Notes

- Odoo tiene modelo `x_comisiones` con 0 registros — nunca usado. Comisiones 100% en Firestore.
- Payment doc contiene `agentId`, `agentName`, `tripName` denormalizados — se copian a la comisión.
- La wildcard rule `match /agents/{agentId}/{document=**}` cubre `commissions`. NO se necesitan reglas adicionales.
- Collection group queries requieren que no exista otra colección `commissions` en otro path. Verificar con `firebase firestore:indexes` antes de implementar.
- Hook fire-and-forget: comisión es side-effect, nunca bloquea verificación de pago.
- `commissionRate` default 0.10 (10%). Edición vía Firestore console por ahora — UI de edición fuera de scope.
- (F10) Si en el futuro se necesitan collection group queries desde el cliente, agregar regla `match /{path=**}/commissions/{commissionId}` en `firestore.rules`.
- (F12) Auditoría de aprobaciones de comisiones: fuera de scope de este spec. Considerar agregar en una story de auditoría general. Por ahora, los campos `approvedBy` y `approvedAt` dan trazabilidad básica de quién aprobó.

### Hallazgos Adversarial Integrados

| ID | Severidad | Fix |
|----|-----------|-----|
| F1 | Crítica | PATCH localiza doc via collection group query, NO acepta agentId en body |
| F2 | Crítica | Nuevo permiso `commissions:manage` para admin/superadmin. Director solo lectura |
| F3 | Crítica | Deduplicación por `paymentId` antes de crear comisión |
| F4 | Alta | Clientes activos: fetch con limit 500, dedup en memoria con Set |
| F5 | Media | commissionRate solo se setea en bootstrap (doc nuevo), no sobrescribe existente |
| F6 | Alta | Índices compuestos corregidos: (agentId, status, createdAt) y (agentId, period, createdAt) |
| F7 | Alta | "Ventas del Mes" basada en pagos verificados, no amountTotalCents de órdenes |
| F8 | Media | PATCH responde 200 con objeto parcial del documento actualizado |
| F9 | Media | Frontend usa useAuthStore, maneja agentId null con error descriptivo |
| F10 | Baja | Documentado como nota para evolución futura |
| F11 | Media | `period` usa fecha del pago original, no del momento de verificación |
| F12 | Alta | Trazabilidad básica con `approvedBy`/`approvedAt`. Auditoría completa fuera de scope |
| F13 | Media | `CommissionList.tsx` extraído como componente separado |
| F14 | Alta | 6 tests para el hook (vs 2 originales): idempotencia, rate inválido, monto cero, etc. |
