---
title: 'Rediseño Panel Mis Clientes — Agrupación por Viaje/Cliente'
slug: 'agent-clients-grouping'
created: '2026-03-31'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
adversarial_review: '14 hallazgos (3 critical, 5 high, 4 medium, 1 low) — 10 reales integrados'
tech_stack: ['Next.js 16 App Router', 'React 19', 'TypeScript', 'Tailwind v4', 'shadcn/ui (radix)', 'Zustand']
files_to_modify:
  - 'src/schemas/contactSchema.ts'
  - 'src/app/(agent)/agent/clients/AgentClientList.tsx'
  - 'src/app/api/agent-contacts/[contactId]/route.ts'
code_patterns:
  - 'UnifiedClient[] unifica Odoo + plataforma, con UnifiedOrder[] por cliente'
  - 'UnifiedOrder NO tiene tripId actualmente — mapping lo descarta via cast explícito (F1)'
  - 'Odoo orders NO tienen concepto de trip — solo orderName (S00123)'
  - 'Vista responsiva: tabla desktop (hidden md:block) + cards mobile (md:hidden)'
  - 'Sheets para detalle, crear contacto, inscribir a viaje'
  - 'Búsqueda: filtra por name, email, city (case-insensitive substring)'
  - 'Trips solo se cargan al abrir EnrollInTripSheet (lazy fetch /api/trips/published)'
  - 'CreateContactSheet NO tiene selector de viaje'
test_patterns:
  - 'No existen tests para este componente — crear co-ubicados'
  - 'Funciones puras de agrupación testear unitariamente'
---

# Tech-Spec: Rediseño Panel Mis Clientes — Agrupación por Viaje/Cliente

**Created:** 2026-03-31

## Overview

### Problem Statement

La vista actual de "Mis Clientes" en el portal del agente es una lista plana que no refleja la relación muchos-a-muchos entre clientes y viajes. Un cliente puede estar inscrito en múltiples viajes y un viaje puede tener múltiples clientes. El agente no puede responder rápidamente "¿qué clientes tengo en el viaje X?" ni "¿en qué viajes está el cliente Y?".

### Solution

Agregar un toggle de agrupación (tabs segmented) con dos modos:
- **Por Viaje** (default): cada viaje como sección expandible con sus clientes dentro
- **Por Cliente**: cada cliente como sección expandible con sus viajes dentro

Requiere un cambio menor en el schema (`tripId` en `UnifiedOrder`), arreglar el cast explícito que descarta `tripId`, y refactorizar el componente principal para soportar las dos vistas agrupadas.

### Scope

**In Scope:**
- Toggle tabs segmented ("Por Viaje" | "Por Cliente") junto a controles existentes
- Vista agrupada con secciones colapsables (Accordion)
- Info visible en cada fila: nombre, contacto, status pago, monto, fecha
- Mantener funcionalidad existente (buscar, actualizar, nuevo cliente, detalle en sheet)
- "Nuevo Cliente": agregar selector de viaje opcional
- Agregar `tripId` a `UnifiedOrder` type y arreglar cast + mapping de platform orders
- Instalar shadcn Accordion
- Búsqueda extendida: incluir nombre de viaje en modo "Por Viaje" (F8)
- Guard en API `[contactId]` para orders sin `tripId` (F2)

**Out of Scope:**
- Nuevas acciones más allá de las existentes
- Cambios a la vista de detalle (sheet lateral)
- Paginación o virtualización (volumen actual <500 clientes por agente)
- Agrupar órdenes Odoo por viaje (no tienen `tripId`)

## Context for Development

### Codebase Patterns

**Componente principal:** `AgentClientList.tsx` (930 líneas) con 4 sub-componentes internos:
- `CreateContactSheet` (líneas 88–221): formulario de crear contacto, sin selector de viaje
- `EnrollInTripSheet` (líneas 223–380): inscribir contacto existente a viaje, carga trips lazy
- `ClientDetailSheet` (líneas 382–600): detalle de cliente con órdenes y acciones
- Renderizado principal (líneas 600–930): búsqueda, lista, tabla/cards

**Data flow:**
1. `fetchClients()` carga Odoo clients + platform contacts en paralelo
2. Los datos se unifican en `UnifiedClient[]` con `UnifiedOrder[]` por cliente
3. `UnifiedOrder` actualmente tiene: `orderId, orderName, amountTotal, dateOrder, source, paymentState?, amountResidual?, status?, amountPaidCents?, amountTotalCents?`
4. **Falta `tripId`**: el API `/api/agent-contacts/[contactId]` SÍ devuelve `tripId` en cada order, pero el mapping en línea ~652 lo descarta
5. **(F1) CRITICAL**: El mapping usa un **cast TypeScript explícito** que excluye `tripId`. Agregar `tripId?` al type `UnifiedOrder` NO basta — hay que actualizar también el cast en el mapping para incluir `tripId` en el tipo casteado
6. **Odoo orders**: no tienen `tripId` ni concepto de viaje — solo `orderName` (ej: "S00123")

**Trips:** `PublishedTrip { id, odooName, odooListPriceCentavos, odooCurrencyCode }` vía `/api/trips/published`. El `id` coincide con `order.tripId` en Firestore.

**Búsqueda:** filtra `unifiedClients[]` por `name`, `email`, `city` (case-insensitive substring, sin debounce).

**Tabs instalado:** shadcn `Tabs` con variantes `default` (pill) y `line` (underline).

**Accordion:** NO instalado — requiere `npx shadcn@latest add accordion`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/app/(agent)/agent/clients/AgentClientList.tsx` | Componente principal (930 líneas) — refactorizar |
| `src/schemas/contactSchema.ts` | Tipos `UnifiedClient`, `UnifiedOrder` — agregar `tripId?` |
| `src/app/api/agent-contacts/[contactId]/route.ts` | API que devuelve `tripId` — agregar guard para undefined (F2) |
| `src/app/api/trips/published/route.ts` | API de viajes publicados |
| `src/app/api/orders/route.ts` | API para crear orden (inscripción a viaje) |
| `src/components/ui/tabs.tsx` | shadcn Tabs (ya instalado) |
| `src/components/ui/accordion.tsx` | shadcn Accordion — **INSTALAR en Task 1** |

### Technical Decisions

1. **`tripId?: string` en `UnifiedOrder`** + arreglar cast explícito en mapping (F1). Odoo orders → `tripId: undefined`.
2. **shadcn Accordion** (`type="multiple"`) para secciones colapsables — permite múltiples abiertas simultáneamente.
3. **Tabs variante `default`** (pill-style) para el toggle de agrupación.
4. **Funciones puras de agrupación**: `groupByTrip()` y `groupByClient()` — testables unitariamente, sin side effects.
5. **Trips fetch al montar con fallback (F3)**: levantar fetch al componente principal. Si falla, `tripMap` queda vacío y los headers muestran tripId como fallback. `EnrollInTripSheet` recibe trips por prop pero conserva retry propio si el array está vacío.
6. **Órdenes Odoo sin trip**: en modo "Por Viaje" → grupo "Sin viaje asignado" al final. En modo "Por Cliente" → se muestran con badge "Odoo".
7. **Extraer sub-componentes**: `GroupedByTripView` y `GroupedByClientView` en archivos separados.
8. **(F5) Montos en MXN, no centavos**: `UnifiedOrder.amountTotal` está en MXN. Los totales de grupo deben ser en MXN también. Nombrar campo `totalAmount` (NO `totalAmountCents`).
9. **(F8) Búsqueda extendida**: en modo "Por Viaje", también filtrar por nombre de viaje (`tripName`) además de nombre/email/ciudad del cliente.

### Adversarial Review Findings (integrados)

| ID | Severidad | Integrado en |
|----|-----------|-------------|
| F1 | Critical | Task 2 — arreglar cast explícito, no solo agregar al type |
| F2 | Critical | Task 2 — agregar `.filter(Boolean)` en API para orders sin tripId |
| F3 | Critical | Task 3 — fallback si fetch de trips falla; EnrollInTripSheet retry |
| F4 | High | Task 4 — `TripGroup.clients[].orders: UnifiedOrder[]` (plural, no singular) |
| F5 | High | Task 4 — campo `totalAmount` en MXN, no `totalAmountCents` |
| F6 | High | Task 8 — post-fallo: cerrar sheet + toast error + llamar onCreated() |
| F7 | High | AC12 — estado vacío documentado |
| F8 | High | Task 7 — búsqueda incluye tripName en modo "Por Viaje" |
| F10 | Medium | Task 5/6 — DOM explícito: `AccordionContent > div.hidden.md:block + div.md:hidden` |
| F11 | Medium | Task 7 — skeleton: 3 Skeleton rectangulares genéricos, no Accordion falsos |
| F13 | Medium | Nota: UnifiedOrder sin Zod schema — fuera de scope, documentado como deuda |
| F14 | Low | Task 8 — Select muestra "Cargando viajes..." mientras trips está vacío |

## Implementation Plan

### Tasks

- [x] **Task 1: Instalar shadcn Accordion**
  - Comando: `npx shadcn@latest add accordion`
  - Archivo generado: `src/components/ui/accordion.tsx`
  - Verificar: importar y que compile sin errores

- [x] **Task 2: Agregar `tripId` a `UnifiedOrder` + guard en API**
  - Archivo: `src/schemas/contactSchema.ts`
  - Acción: Agregar `tripId?: string` al type `UnifiedOrder`
  - Archivo: `src/app/(agent)/agent/clients/AgentClientList.tsx`
  - Acción: **(F1)** Encontrar el cast explícito en la línea ~652 que define el tipo de `detail`. Agregar `tripId: string` al cast type. Luego en el mapping del objeto, agregar `tripId: o.tripId`
  - Archivo: `src/app/api/agent-contacts/[contactId]/route.ts`
  - Acción: **(F2)** En la línea donde se construye `tripIds` con `[...new Set(docs.map(d => d.data().tripId as string))]`, filtrar undefined/null: `[...new Set(docs.map(d => d.data().tripId).filter((id): id is string => typeof id === 'string'))]`
  - Nota: Odoo orders no tienen `tripId` — dejar como `undefined` implícitamente

- [x] **Task 3: Levantar fetch de trips al componente principal**
  - Archivo: `src/app/(agent)/agent/clients/AgentClientList.tsx`
  - Acción: Agregar `useState<PublishedTrip[]>([])` y fetch de `/api/trips/published` en `useEffect` al montar (en paralelo con `fetchClients`)
  - Acción: Crear `tripMap` derivado con `useMemo`: `{ [trip.id]: trip.odooName }`
  - Acción: Pasar `trips` como prop a `EnrollInTripSheet` y `CreateContactSheet`
  - **(F3)** Fallback: si el fetch falla, `tripMap` queda vacío. Los headers de grupo mostrarán `tripId` como texto (ej: "abc123") en lugar de nombre bonito. `EnrollInTripSheet` conserva lógica de retry propio: si recibe `trips` vacío Y `isOpen`, hace su propio fetch como antes

- [x] **Task 4: Implementar funciones de agrupación**
  - Archivo: `src/app/(agent)/agent/clients/grouping.ts` (nuevo)
  - Acción: Crear funciones puras exportadas:

  ```typescript
  interface TripGroup {
    tripId: string | null        // null = "Sin viaje asignado"
    tripName: string
    clients: {
      client: UnifiedClient
      orders: UnifiedOrder[]     // (F4) PLURAL — múltiples órdenes del mismo viaje
    }[]
    totalAmount: number          // (F5) MXN, NO centavos
  }

  interface ClientGroup {
    client: UnifiedClient
    trips: {
      tripId: string | null
      tripName: string
      orders: UnifiedOrder[]
    }[]
    totalAmount: number          // (F5) MXN
  }

  function groupByTrip(
    clients: UnifiedClient[],
    tripMap: Record<string, string>
  ): TripGroup[]

  function groupByClient(
    clients: UnifiedClient[],
    tripMap: Record<string, string>
  ): ClientGroup[]
  ```

  - `groupByTrip`: itera `clients[].orders[]`, agrupa por `tripId ?? null`. Un cliente aparece en múltiples grupos si tiene órdenes en múltiples viajes. **(F4)** Si un cliente tiene múltiples órdenes del mismo viaje, todas van al array `orders[]` del mismo entry. Órdenes sin `tripId` → grupo `null` / "Sin viaje asignado". Ordenar por nombre de viaje, "Sin viaje" al final.
  - `groupByClient`: cada `UnifiedClient` es un grupo. Dentro, `orders[]` se agrupan por `tripId` en sub-secciones. Ordenar clientes por nombre.
  - **(F5)** Sumar `order.amountTotal` (MXN) para `totalAmount`. NO usar centavos.

- [x] **Task 5: Crear `GroupedByTripView`**
  - Archivo: `src/app/(agent)/agent/clients/GroupedByTripView.tsx` (nuevo)
  - Acción: Componente `'use client'` que recibe `tripGroups: TripGroup[]` y `onClientClick: (client: UnifiedClient) => void`
  - UI: `Accordion type="multiple"` con un `AccordionItem` por grupo de viaje
    - Header: nombre del viaje + `Badge` con cantidad de clientes + monto total formateado MXN
    - **(F10)** Content DOM: `<AccordionContent>` contiene dos divs:
      - `<div className="hidden md:block">` → tabla con headers: Cliente, Contacto, Status, Monto, Fuente
      - `<div className="md:hidden">` → cards verticales con la misma info
    - Click en cliente → `onClientClick`
  - Si `tripGroups` está vacío → no renderizar nada (el padre maneja empty state)

- [x] **Task 6: Crear `GroupedByClientView`**
  - Archivo: `src/app/(agent)/agent/clients/GroupedByClientView.tsx` (nuevo)
  - Acción: Componente `'use client'` que recibe `clientGroups: ClientGroup[]` y `onClientClick: (client: UnifiedClient) => void`
  - UI: `Accordion type="multiple"` con un `AccordionItem` por cliente
    - Header: nombre del cliente + `Badge` con cantidad de viajes + monto total MXN
    - **(F10)** Content DOM: mismo patrón dual div para tabla/cards
      - Tabla/cards muestran: nombre viaje, status, monto, fecha, badge fuente
    - Click en header del Accordion → `onClientClick`
  - Si `clientGroups` está vacío → no renderizar nada

- [x] **Task 7: Integrar toggle de agrupación en `AgentClientList`**
  - Archivo: `src/app/(agent)/agent/clients/AgentClientList.tsx`
  - Acción: Agregar `useState<'trip' | 'client'>('trip')` para modo de agrupación
  - Acción: Agregar `Tabs` con `TabsList` + 2 `TabsTrigger` ("Por Viaje", "Por Cliente") en la barra de controles, junto al buscador y botones existentes
  - Acción: **(F8)** Extender búsqueda: en modo `'trip'`, también filtrar por `tripName` — para cada cliente, si alguno de sus `orders` tiene un `tripName` (vía `tripMap[order.tripId]`) que matchea la búsqueda, incluir al cliente
  - Acción: Aplicar búsqueda ANTES de agrupar → `useMemo` para `filteredClients` → luego `groupByTrip(filtered, tripMap)` o `groupByClient(filtered, tripMap)`
  - Acción: Renderizar `GroupedByTripView` o `GroupedByClientView` según modo activo
  - Acción: Pasar `onClientClick` para abrir `ClientDetailSheet`
  - **(F7)** Empty state: si `filteredClients` tiene 0 resultados, mostrar Card con "No se encontraron clientes con ese filtro" (mismo estilo que empty state actual)
  - **(F11)** Skeleton: mientras `loading`, mostrar 3 `Skeleton` rectangulares (`h-16 w-full`) genéricos — NO Accordion falsos

- [x] **Task 8: Agregar selector de viaje opcional a `CreateContactSheet`**
  - Archivo: `src/app/(agent)/agent/clients/AgentClientList.tsx` (dentro de `CreateContactSheet`)
  - Acción: Agregar prop `trips: PublishedTrip[]` al componente
  - Acción: Agregar `Select` con opciones: "Sin viaje" (default) + lista de trips
  - **(F14)** Si `trips` está vacío, mostrar "Cargando viajes..." como placeholder disabled
  - Acción: Si se selecciona un viaje, después de crear contacto exitosamente (`POST /api/agent-contacts`), hacer `POST /api/orders` con `{ tripId, contactName, agentContactId }`
  - **(F6)** Post-fallo de inscripción: cerrar el sheet, llamar `onCreated()` (para refrescar la lista con el contacto nuevo), mostrar toast de error "Contacto creado pero la inscripción al viaje falló. Puedes inscribirlo desde el detalle del cliente."
  - UI: `Select` entre los campos de city y el botón de enviar

- [x] **Task 9: Tests unitarios para funciones de agrupación**
  - Archivo: `src/app/(agent)/agent/clients/grouping.test.ts` (nuevo)
  - Tests para `groupByTrip`:
    - Cliente con 1 orden platform (tiene tripId) → aparece en el grupo correcto
    - Cliente con 2 órdenes en viajes distintos → aparece en ambos grupos
    - **(F4)** Cliente con 2 órdenes del MISMO viaje → ambas en `orders[]` del mismo entry
    - Cliente Odoo (sin tripId) → aparece en "Sin viaje asignado"
    - Lista vacía → retorna array vacío
    - Ordenamiento: viajes con nombre alfabético, "Sin viaje" al final
    - **(F5)** `totalAmount` suma correctamente en MXN (no centavos)
  - Tests para `groupByClient`:
    - Cliente con órdenes de 2 viajes → sub-grupos correctos
    - Cliente sin órdenes → trips array vacío
    - Ordenamiento por nombre de cliente

### Acceptance Criteria

- [x] **AC1:** Given el panel "Mis Clientes", when la página carga, then se muestra un toggle tabs con "Por Viaje" seleccionado por defecto y los clientes agrupados por viaje en secciones colapsables.

- [x] **AC2:** Given el toggle en "Por Viaje", when el agente cambia a "Por Cliente", then la vista se reorganiza mostrando cada cliente como sección con sus viajes dentro, sin recargar datos del servidor.

- [x] **AC3:** Given modo "Por Viaje", when hay clientes platform con `tripId`, then aparecen agrupados bajo el nombre del viaje correspondiente con badge de cantidad de clientes y monto total en MXN.

- [x] **AC4:** Given modo "Por Viaje", when hay órdenes Odoo (sin `tripId`), then aparecen agrupados bajo "Sin viaje asignado" al final de la lista.

- [x] **AC5:** Given cualquier modo de agrupación, when el agente escribe en el buscador, then los resultados se filtran por nombre/email/ciudad del cliente. En modo "Por Viaje" también filtra por nombre de viaje.

- [x] **AC6:** Given una sección colapsable, when el agente hace click en el header, then la sección se expande/colapsa con animación. Múltiples secciones pueden estar abiertas simultáneamente (Accordion type="multiple").

- [x] **AC7:** Given modo "Por Viaje" en mobile (<768px), when la vista carga, then cada cliente dentro del grupo se muestra como card en lugar de fila de tabla.

- [x] **AC8:** Given el formulario "Nuevo Cliente", when el agente lo abre, then hay un selector de viaje opcional. Si los viajes aún cargan, el selector muestra "Cargando viajes...". Si selecciona un viaje, al guardar se crea el contacto Y se inscribe al viaje automáticamente.

- [x] **AC9:** Given el formulario "Nuevo Cliente" con viaje seleccionado, when la creación del contacto es exitosa pero la inscripción al viaje falla, then el sheet se cierra, el contacto aparece en la lista (se llamó onCreated), y se muestra un toast de error indicando que la inscripción falló con instrucciones para inscribir desde el detalle.

- [x] **AC10:** Given modo "Por Cliente", when el agente hace click en un cliente, then se abre el sheet de detalle existente sin cambios.

- [x] **AC11:** Given las funciones `groupByTrip` y `groupByClient`, when se ejecutan los tests unitarios, then todos pasan cubriendo: cliente multi-viaje, cliente multi-orden mismo viaje, cliente Odoo sin trip, lista vacía, ordenamiento, y totalAmount en MXN.

- [x] **AC12:** Given cualquier modo de agrupación, when la búsqueda no produce resultados, then se muestra un empty state con mensaje "No se encontraron clientes con ese filtro" en lugar de un Accordion vacío.

## Additional Context

### Dependencies

- **Instalar**: shadcn Accordion (`npx shadcn@latest add accordion`)
- **Existentes**: shadcn Tabs, Select, Sheet, Card, Badge, Button, Skeleton
- **API existente**: `/api/trips/published` (lista de viajes)
- **API existente**: `/api/agent-contacts/[contactId]` (devuelve tripId — agregar guard F2)
- **API existente**: `POST /api/orders` (inscripción a viaje)

### Testing Strategy

- **Unit tests** (co-ubicados): `grouping.test.ts` para funciones puras `groupByTrip()` y `groupByClient()`
- **Browser testing manual**:
  - Toggle entre modos → datos se reorganizan sin flicker
  - Búsqueda en ambos modos → grupos se recalculan (incluyendo búsqueda por trip name)
  - Búsqueda sin resultados → empty state
  - Expandir/colapsar secciones → animación suave, múltiples abiertas
  - Responsive: verificar tabla (desktop) vs cards (mobile) en ambos modos
  - Crear cliente con viaje → contacto + orden creados
  - Crear cliente con viaje, simular fallo de orden → sheet se cierra, contacto en lista, toast error

### Notes

- **Riesgo mitigado (F1)**: el cast explícito en la línea ~652 es la trampa más peligrosa. Task 2 documenta explícitamente que hay que arreglarlo — un dev que solo agregue al type pensará que funciona.
- **Deuda técnica (F13)**: `UnifiedOrder` no tiene Zod schema — los datos del API se castean sin safeParse. Fuera de scope de este spec pero debería abordarse en un cleanup futuro.
- **Datos Odoo históricos**: la mayoría de clientes son de Odoo (sin `tripId`). En modo "Por Viaje", el grupo "Sin viaje asignado" será el más grande inicialmente.
- **Performance**: con <500 clientes por agente, la agrupación client-side no necesita optimización más allá del `useMemo` para `filteredClients` y los grupos derivados.
- **Futuro** (out of scope): acciones masivas, drag-and-drop entre viajes, exportar lista por viaje.
