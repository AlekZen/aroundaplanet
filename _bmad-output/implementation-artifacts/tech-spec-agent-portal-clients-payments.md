---
title: 'Portal Agente — Gestion de Clientes, Inscripciones y Pagos'
slug: 'agent-portal-clients-payments'
created: '2026-03-31'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
adversarial_review: 'completed — 14 findings, all addressed'
tech_stack: ['Next.js 16.1.6', 'Firebase Firestore', 'Firebase Storage', 'Odoo XML-RPC', 'Vitest', 'Tailwind v4', 'shadcn/ui']
files_to_modify:
  - 'firestore.rules'
  - 'firestore.indexes.json'
  - 'src/schemas/contactSchema.ts (NEW)'
  - 'src/app/api/agent-contacts/route.ts (NEW)'
  - 'src/app/api/agent-contacts/[contactId]/route.ts (NEW)'
  - 'src/app/api/agent-contacts/route.test.ts (NEW)'
  - 'src/schemas/orderSchema.ts'
  - 'src/app/api/orders/route.ts'
  - 'src/app/(agent)/agent/clients/AgentClientList.tsx'
  - 'src/app/(agent)/agent/clients/page.tsx'
code_patterns:
  - 'Sheet mobile + Dialog desktop para formularios'
  - 'requireAuth() + claims.agentId para aislamiento'
  - 'camelCase Firestore collections, Timestamp para fechas, centavos para montos'
  - 'AppError pattern para errores API'
  - 'Zod safeParse para validacion'
test_patterns:
  - 'Vitest + @testing-library/react para componentes'
  - 'vi.hoisted() para mock chains de Firestore'
  - 'Mock requireAuth/requirePermission para API tests'
  - 'Tests co-located con source files'
---

# Tech-Spec: Portal Agente — Gestion de Clientes, Inscripciones y Pagos

**Creado:** 2026-03-31
**Review adversarial:** Completado — 14 hallazgos, todos integrados

## Overview

### Problema

El agente no puede gestionar su cartera desde la plataforma: no puede crear clientes, inscribirlos a viajes, ni registrar pagos con comprobante. Todo depende de Odoo o del admin. Actualmente el panel de agente muestra clientes de Odoo (solo lectura) pero no permite crear contactos nuevos, asociarlos a viajes, ni subir comprobantes de pago.

### Solucion

Crear una coleccion `agentContacts` en Firestore con campos alineados a `res.partner` de Odoo. Agregar UI de gestion en el panel del agente (crear contacto, inscribir a viaje, registrar pago). Reutilizar `PaymentRegistrationForm` existente para la subida de comprobantes con OCR.

### Alcance

**Incluido:**
- Crear contacto/cliente (campos alineados a res.partner: name, email, phone, mobile, city)
- Contacto puede existir sin viaje asociado
- Inscribir contacto a un viaje (crear orden en Firestore)
- Registrar pagos con comprobante desde detalle de cliente (reusar PaymentRegistrationForm)
- Convivencia: clientes Odoo + clientes plataforma en la misma vista

**Fuera de alcance:**
- Inyeccion directa a Odoo (requiere admin/superadmin — futuro)
- Comisiones (Story 4-2)
- Notificaciones (Epic 6)
- Editar/eliminar clientes o pagos existentes
- Sync bidireccional automatico Odoo a Firestore

## Contexto para Desarrollo

### Patrones del Codebase

- **API routes**: kebab-case folders, camelCase params, AppError pattern para errores
- **Auth**: `requireAuth()` para rutas protegidas, `claims.agentId` para aislamiento de agente
- **Firestore**: camelCase collections/fields, `Timestamp` para fechas, centavos para montos (integer)
- **UI**: Sheet (mobile) + Dialog (desktop) para formularios modales, Skeleton para loading
- **Componentes**: un archivo por componente, `'use client'` lo mas bajo posible
- **Validacion**: Zod schemas en `src/schemas/`, safeParse obligatorio
- **Tests**: Vitest + @testing-library/react, co-located, `vi.hoisted()` para mock chains Firestore

### Archivos de Referencia

| Archivo | Proposito | Accion |
| ---- | ------- | --- |
| `src/app/(agent)/agent/clients/AgentClientList.tsx` | Lista clientes Odoo + ClientDetailSheet | MODIFICAR |
| `src/app/(agent)/agent/clients/page.tsx` | Resolucion agentId (3 capas con fallback) | VERIFICAR |
| `src/components/custom/PaymentRegistrationForm.tsx` | Form pago con OCR, upload, multistep | REUSAR (acepta orderId string) |
| `src/app/api/payments/route.ts` | POST /api/payments — ya soporta agentes | REUSAR |
| `src/app/api/payments/upload/route.ts` | Subida comprobante a Storage | REUSAR |
| `src/app/api/payments/ocr/route.ts` | OCR con Gemini Flash Lite | REUSAR |
| `src/app/api/orders/route.ts` | POST /api/orders | MODIFICAR (agentContactId) |
| `src/schemas/orderSchema.ts` | createOrderSchema | MODIFICAR (agentContactId) |
| `src/app/api/agents/[agentId]/clients/route.ts` | GET clientes Odoo | REFERENCIA |
| `src/app/(agent)/agent/catalog/AgentCatalogContent.tsx` | Catalogo viajes agente | REFERENCIA |
| `firestore.rules` | Reglas de seguridad | MODIFICAR (agregar agentContacts) |
| `firestore.indexes.json` | Indices compuestos | MODIFICAR (agregar 2 indices) |

### Decisiones Tecnicas

1. **Coleccion `agentContacts/{contactId}`** — top-level con campo `agentId`, campos alineados a `res.partner` de Odoo
2. **Pagos solo sobre ordenes Firestore** — ordenes Odoo son historial informativo sin boton de pago
3. **"Inscribir a viaje" = crear orden Firestore** — via POST /api/orders con `agentContactId`
4. **Convivencia visual** — badge "Odoo" (verde) vs "Plataforma" (azul) en la lista unificada
5. **PaymentRegistrationForm sin modificar** — verificado que acepta `orderId` como string
6. **ClientDetailSheet recibe `agentId`** — para scope de seguridad en acciones
7. **`agentId` en ordenes = `claims.uid`** (F3) — NO usar `claims.agentId` string al crear ordenes; la API de pagos compara `order.agentId === claims.uid`
8. **Tipo `UnifiedClient` con discriminated union** (F4) — `source: 'odoo' | 'platform'`, key React = `${source}-${id}`
9. **`/api/trips/published` es intencionalmente publico** (F6) — la seguridad del flujo de inscripcion recae en POST /api/orders que usa `tryAuth()`
10. **Degradacion parcial** (F12) — si el fetch de contactos plataforma falla, mostrar solo clientes Odoo con banner de advertencia, no error total
11. **Modelo a largo plazo** (F10) — `agentContacts` es la fuente de verdad para contactos plataforma. Cuando admin inyecte a Odoo, se actualiza `odooPartnerId` en el doc existente (no se migra ni se duplica). Las reglas Firestore permiten que admin/superadmin haga update de `odooPartnerId`

## Plan de Implementacion

### Tareas

#### Fase 0: Infraestructura (antes de cualquier codigo)

- [ ] **Tarea 0a: Agregar reglas Firestore para `agentContacts`** (F1)
  - Archivo: `firestore.rules`
  - Accion: Agregar bloque:
    ```
    match /agentContacts/{contactId} {
      allow read: if request.auth.token.agentId == resource.data.agentId
                  || hasAnyRole(['admin', 'director', 'superadmin']);
      allow write: if false; // Solo Admin SDK via API routes
    }
    ```
  - Notas: Escritura via Admin SDK solamente. Admin/superadmin puede actualizar `odooPartnerId` en el futuro

- [ ] **Tarea 0b: Agregar indices Firestore compuestos** (F8)
  - Archivo: `firestore.indexes.json`
  - Accion: Agregar dos indices:
    1. `agentContacts`: `(agentId ASC, name ASC)`
    2. `orders`: `(agentContactId ASC, createdAt DESC)`
  - Notas: Sin estos indices las queries fallan en produccion con error 400

#### Fase 1: Modelo de Datos y API (backend primero)

- [ ] **Tarea 1: Crear schema de contacto**
  - Archivo: `src/schemas/contactSchema.ts` (NUEVO)
  - Accion: Crear Zod schema `createContactSchema` con campos: `name` (required, min 2), `email` (optional, email format), `phone` (optional), `mobile` (optional), `city` (optional)
  - Crear tipo `AgentContact` con los campos del documento Firestore: los del schema + `id`, `agentId`, `source: 'platform'`, `odooPartnerId: number | null`, `createdAt`, `updatedAt`
  - Crear tipo `UnifiedClient` como discriminated union (F4):
    ```ts
    type UnifiedClient = {
      id: string           // partnerId (Odoo) o contactId (plataforma)
      name: string
      email: string | null
      phone: string | null
      city: string | null
      source: 'odoo' | 'platform'
      orderCount: number
      totalAmount: number  // en MXN (no centavos) para display
      orders: UnifiedOrder[]
    }
    ```
  - Notas: No incluir `agentId` en el schema de creacion — se toma de `claims.agentId` server-side. AC 1 simplificado: solo nombre es requerido, campos adicionales son opcionales (F7)

- [ ] **Tarea 2: Crear API POST/GET /api/agent-contacts**
  - Archivo: `src/app/api/agent-contacts/route.ts` (NUEVO)
  - Accion POST:
    1. `requireAuth()` — verificar sesion
    2. Extraer `claims.agentId` — si no existe, 403
    3. `createContactSchema.safeParse(body)` — validar
    4. Crear doc en `agentContacts` con `agentId` de claims, `source: 'platform'`, `odooPartnerId: null`, timestamps
    5. Retornar `{ contactId, ...contactData }` con status 201
  - Accion GET:
    1. `requireAuth()` + extraer `claims.agentId`
    2. Si admin/superadmin y query param `?agentId=X`: validar que X pertenece a un usuario con rol `agente` (F2)
    3. Query: `agentContacts.where('agentId', '==', agentId).orderBy('name')`
    4. Retornar `{ contacts: AgentContact[], total: number }`
  - Notas: Usar mismo patron que `src/app/api/orders/route.ts`

- [ ] **Tarea 3: API GET /api/agent-contacts/[contactId] (ordenes de contacto)**
  - Archivo: `src/app/api/agent-contacts/[contactId]/route.ts` (NUEVO)
  - Accion GET:
    1. `requireAuth()` + verificar `claims.agentId`
    2. Leer doc `agentContacts/{contactId}` — verificar que `agentId` coincide (o admin/superadmin)
    3. Query `orders.where('agentContactId', '==', contactId).orderBy('createdAt', 'desc')`
    4. Batch-fetch trip names (patron de `/api/my-orders`)
    5. Fetch pagos: `payments.where('orderId', 'in', orderIds)` en batches de 30 (F5)
    6. Retornar `{ contact, orders[], payments[] }`
  - Notas: DEBE implementarse ANTES de Tarea 8 — la lista unificada depende de este endpoint (F11)

- [ ] **Tarea 4: Tests de API agent-contacts**
  - Archivo: `src/app/api/agent-contacts/route.test.ts` (NUEVO)
  - Accion: Tests siguiendo patron de `src/app/api/agents/[agentId]/orders/route.test.ts`:
    - POST: happy path (201), sin agentId (403), body invalido (400), nombre muy corto (400)
    - GET: happy path con contactos, lista vacia, sin agentId (403), admin con agentId invalido (400) (F2)
  - Notas: Mock Firestore con `vi.hoisted()`, mock `requireAuth`

- [ ] **Tarea 5: Agregar `agentContactId` al schema y API de ordenes**
  - Archivo: `src/schemas/orderSchema.ts`
  - Accion: Agregar `agentContactId: z.string().optional()` al `createOrderSchema`
  - Archivo: `src/app/api/orders/route.ts`
  - Accion: Incluir `agentContactId: agentContactId ?? null` en el documento de orden creado
  - Notas: Campo informativo para vincular orden a contacto. No afecta logica existente

#### Fase 2: UI del Agente (frontend)

- [ ] **Tarea 6: Componente CreateContactSheet**
  - Archivo: `src/app/(agent)/agent/clients/AgentClientList.tsx` (componente interno)
  - Accion: Crear componente `CreateContactSheet`:
    - Props: `{ isOpen, onClose, agentId, onCreated }`
    - Mobile: Sheet. Desktop: Dialog
    - Campos: Nombre (required), Email, Telefono, Celular, Ciudad
    - Submit: POST /api/agent-contacts
    - Exito: toast + cerrar + llamar `onCreated()` para refrescar lista
  - Notas: Seguir patron de `ConversionForm.tsx` (Sheet mobile / Dialog desktop)

- [ ] **Tarea 7: Componente EnrollInTripSheet**
  - Archivo: `src/app/(agent)/agent/clients/AgentClientList.tsx` (componente interno)
  - Accion: Crear componente `EnrollInTripSheet`:
    - Props: `{ isOpen, onClose, contact: { name, phone, contactId }, agentId, onEnrolled }`
    - Fetch GET /api/trips/published para listar viajes disponibles (endpoint publico intencionalmente — F6)
    - Mostrar viajes en lista con nombre + precio
    - Al seleccionar viaje: POST /api/orders con `tripId`, `contactName: contact.name`, `contactPhone: contact.phone`, `agentContactId: contact.contactId`, y **`agentId: agentId`** (que es `claims.uid`, NO `claims.agentId` — F3)
    - Exito: toast "Cliente inscrito al viaje" + cerrar
  - Notas: No requiere selector de departures. Verificar que `PaymentRegistrationForm` acepta `orderId` string sin transformacion (F9) — confirmado que si

- [ ] **Tarea 8: Integrar acciones en ClientDetailSheet**
  - Archivo: `src/app/(agent)/agent/clients/AgentClientList.tsx`
  - Accion: Modificar `ClientDetailSheet`:
    1. Agregar prop `agentId: string`
    2. Agregar boton "Inscribir a Viaje" debajo de la info de contacto → abre `EnrollInTripSheet`
    3. En cada OrderCard de ordenes **Firestore** (no Odoo): agregar boton "Registrar Pago" → abre `PaymentRegistrationForm`
    4. Estado nuevo: `enrollOpen`, `paymentOpen`, `paymentOrderId`
  - Notas: Las ordenes de Odoo NO tienen boton de pago (son read-only). Distinguir por `source` del `UnifiedClient`

- [ ] **Tarea 9: Fusionar contactos plataforma + Odoo en la lista**
  - Archivo: `src/app/(agent)/agent/clients/AgentClientList.tsx`
  - Accion:
    1. Fetch contactos plataforma: GET /api/agent-contacts en paralelo con fetch Odoo
    2. Para contactos plataforma: fetch ordenes via GET /api/agent-contacts/{contactId} (Tarea 3)
    3. Normalizar a `UnifiedClient[]` con discriminated union (`source: 'odoo' | 'platform'`)
    4. Key React: `${client.source}-${client.id}` (F4)
    5. Badge visual: "Odoo" (verde) / "Plataforma" (azul)
    6. Si fetch de contactos plataforma falla: mostrar solo Odoo + banner advertencia (F12), NO error total
    7. Sort final client-side por nombre (F14)
  - Notas: Tarea 3 DEBE estar lista antes de esta tarea (F11)

- [ ] **Tarea 10: Boton "Nuevo Cliente" en la cabecera**
  - Archivo: `src/app/(agent)/agent/clients/AgentClientList.tsx`
  - Accion: Agregar boton "Nuevo Cliente" junto al boton "Actualizar"
    - Clic abre `CreateContactSheet`
    - Despues de crear: refrescar lista (re-fetch ambas fuentes)
  - Estado nuevo en AgentClientList: `isCreateOpen: boolean`

### Criterios de Aceptacion

#### Crear contacto

- [ ] AC 1: Given un agente autenticado, when hace clic en "Nuevo Cliente" y llena al menos el nombre, then se crea un documento en `agentContacts` con `agentId` del agente y `source: 'platform'`
- [ ] AC 2: Given un agente autenticado, when intenta crear contacto sin nombre, then el formulario muestra error de validacion y no envia
- [ ] AC 3: Given un usuario sin rol agente, when intenta POST /api/agent-contacts, then recibe 403

#### Inscribir a viaje

- [ ] AC 4: Given un agente viendo el detalle de un contacto, when hace clic en "Inscribir a Viaje" y selecciona un viaje publicado, then se crea una orden en Firestore con `agentId` = UID del agente (no claims.agentId string), `agentContactId`, `contactName` del contacto, y `amountTotalCents` del viaje
- [ ] AC 5: Given un contacto recien inscrito a un viaje, when el agente vuelve al detalle del contacto, then la orden nueva aparece en la lista de ordenes del contacto
- [ ] AC 6: Given un viaje sin departures disponibles, when el agente inscribe un contacto, then la orden se crea correctamente sin `departureId`

#### Registrar pago

- [ ] AC 7: Given un agente viendo ordenes de un contacto plataforma, when hace clic en "Registrar Pago" en una orden activa, then se abre PaymentRegistrationForm con la orden preseleccionada
- [ ] AC 8: Given el agente subiendo un comprobante de pago (imagen), when el OCR detecta datos, then el formulario se pre-llena con monto, fecha y metodo de pago extraidos
- [ ] AC 9: Given un pago registrado exitosamente, when el agente cierra el formulario, then el detalle del contacto se refresca mostrando el pago pendiente de verificacion

#### Lista unificada

- [ ] AC 10: Given un agente con clientes en Odoo y contactos en plataforma, when abre "Mis Clientes", then ambos aparecen en una sola lista con badges visuales que indican el origen
- [ ] AC 11: Given un contacto plataforma sin ordenes, when aparece en la lista, then muestra "0" ordenes y puede ser seleccionado para ver su detalle
- [ ] AC 12: Given ordenes de Odoo en el detalle de un cliente Odoo, when el agente las ve, then NO aparece boton "Registrar Pago" (son read-only)
- [ ] AC 13: Given que el fetch de contactos plataforma falla (timeout/error), when el agente abre "Mis Clientes", then los clientes de Odoo se muestran normalmente con un banner de advertencia sobre contactos plataforma no disponibles (F12)

## Contexto Adicional

### Dependencias

| Dependencia | Estado | Notas |
| --- | --- | --- |
| Firebase Storage | Listo | Usado por /api/payments/upload |
| PaymentRegistrationForm | Listo | Reutilizar sin modificar, acepta orderId string |
| POST /api/orders (departureId opcional) | Listo | Implementado sesion 26 |
| POST /api/payments (soporte agentes) | Listo | Compara order.agentId === claims.uid |
| GET /api/trips/published | Listo | Publico, para selector de viajes |
| Inscripcion instantanea (sesion 26) | Listo | Patron a seguir para enroll desde agente |

### Estrategia de Testing

| Tipo | Que testear | Herramienta |
| --- | --- | --- |
| Unit API | POST/GET /api/agent-contacts — auth, validacion, CRUD, admin bypass (F2) | Vitest + mock Firestore |
| Unit API | GET /api/agent-contacts/[contactId] — auth, ordenes, pagos batch | Vitest + mock Firestore |
| Unit API | POST /api/orders con agentContactId | Vitest (agregar caso al test existente) |
| Unit UI | CreateContactSheet — render, validacion, submit | Vitest + testing-library |
| Manual | Flujo completo: crear contacto → inscribir viaje → registrar pago → verificar en admin | Browser manual |

### Notas

- **Riesgo alto**: La fusion de listas Odoo+Firestore puede ser lenta si hay muchos contactos. Mitigado: fetch en paralelo, merge client-side, degradacion parcial (F12)
- **Limitacion conocida**: No se puede editar ni eliminar contactos creados (fuera de alcance)
- **Modelo largo plazo** (F10): `agentContacts` es la fuente de verdad para contactos plataforma. La inyeccion a Odoo actualiza `odooPartnerId` en el doc existente (no duplica ni migra). Reglas Firestore permiten que admin/superadmin haga update
- **Orden de tareas** (F11): Tarea 3 (API ordenes contacto) DEBE completarse antes de Tarea 9 (fusion de listas)
- **agentId en ordenes** (F3): SIEMPRE usar `claims.uid` como valor de `agentId` al crear ordenes via EnrollInTripSheet. La API de pagos compara `order.agentId === claims.uid`
- **Sort final** (F14): El sort definitivo es client-side post-merge. El backend puede retornar sin orden especifico
