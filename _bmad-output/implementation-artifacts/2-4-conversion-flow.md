# Story 2.4: Conversion Flow (Quote / Reserve)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **visitante**,
I want to request a quote or reserve a spot on a trip by selecting a departure date and submitting a conversion form,
So that I can start my booking process and the agency captures me as a lead.

## Acceptance Criteria (BDD)

### AC1: Formulario de Conversion se Abre desde CTA

**Given** a visitor is on a trip landing page (`/viajes/{slug}`)
**When** they click "Cotizar Ahora" (desktop) or "Cotizar" (mobile sticky) on TripStickyCTA
**Then** a conversion form opens as Sheet (mobile, slide-up 85vh) or Dialog (desktop, 440px centered)
**And** the form shows trip name, price (Roboto Mono), and a departure date selector
**And** a `begin_checkout` event fires in Firebase Analytics + Meta Pixel + GTM (FR59, FR61)

**Given** the visitor clicks "Apartar Lugar" on a specific departure in TripDepartures
**When** the form opens
**Then** that departure date is pre-selected in the selector

### AC2: Auth Gate — Redirect si No Autenticado

**Given** the visitor is NOT logged in
**When** they click any conversion CTA
**Then** form state (tripId, departureId) is saved to `sessionStorage` key `pendingQuote`
**And** the visitor is redirected to `/login?returnUrl=/viajes/{slug}?cotizar=true&salida={departureId}`
**And** after successful login/register, they return to the trip landing and the form auto-opens with pre-selected departure

**Given** the visitor IS logged in
**When** they click any conversion CTA
**Then** the form opens directly without redirect

### AC3: Creacion de Orden en Firestore

**Given** an authenticated user submits the conversion form with a selected departure
**When** the system processes the submission
**Then** `POST /api/orders` creates a document at `/orders/{orderId}` with:
  - `userId`: authenticated user's UID
  - `agentId`: from sessionStorage `ref` param (if present), else `null`
  - `tripId`: Firestore trip document ID
  - `departureId`: selected departure document ID
  - `status`: `'Interesado'`
  - `amountTotalCents`: trip's `odooListPriceCentavos` (read server-side, NOT from client)
  - `amountPaidCents`: `0`
  - `utmSource`, `utmMedium`, `utmCampaign`: from sessionStorage (if present)
  - `createdAt`, `updatedAt`: `FieldValue.serverTimestamp()`
**And** the API returns `201` with `{ orderId, status, tripId, departureId, amountTotalCents }`

### AC4: Validaciones Server-Side

**Given** the API receives a POST request
**When** validation runs
**Then** it rejects:
  - Unauthenticated requests → 401 `AUTH_REQUIRED`
  - Missing/invalid fields (Zod) → 400 `VALIDATION_ERROR`
  - Trip not found or not published → 404 `TRIP_NOT_FOUND`
  - Departure not found or not active → 404 `DEPARTURE_NOT_FOUND`
  - Departure with 0 seats available → 409 `DEPARTURE_SOLD_OUT`

### AC5: Order State Machine (Contrato Central)

**Given** the order state machine is defined
**Then** the valid states are:
  - `Interesado` — orden recien creada (Story 2-4 solo crea este estado)
  - `Confirmado` — al menos un pago verificado (Epic 3)
  - `En Progreso` — viaje activo, fecha salida alcanzada (automatico)
  - `Completado` — viaje terminado (automatico)
  - `Cancelado` — cancelado por admin o cliente

**And** valid transitions are:
  - `Interesado → Confirmado` (manual: primer pago verificado)
  - `Interesado → Cancelado` (manual: admin o cliente)
  - `Confirmado → En Progreso` (automatico: fecha salida)
  - `Confirmado → Cancelado` (manual: admin)
  - `En Progreso → Completado` (automatico: fecha fin)

**Note:** Story 2-4 SOLO crea ordenes en estado `Interesado`. Las transiciones se implementan en stories futuras (Epic 3+). La state machine se define en codigo para que los types y validaciones esten listos.

### AC6: Analytics Events

**Given** the conversion flow executes
**Then** these events fire:
  - `begin_checkout` al abrir el formulario (ya existe en TripStickyCTA — preservar)
  - `select_item` al seleccionar departure (ya existe en TripDepartures — preservar)
  - `generate_lead` al crear la orden exitosamente (NUEVO: con trip_id, agent_id, utm_source)

### AC7: Firestore Security Rules para /orders

**Given** the `/orders` collection exists
**Then** security rules enforce:
  - Read: owner (`userId == request.auth.uid`) OR roles `admin`/`director`/`superadmin`
  - Write: `false` (todas las escrituras via Admin SDK en Route Handler)
  - Delete: `false`

### AC8: Feedback UX Post-Submission

**Given** the order is created successfully
**When** the API returns 201
**Then** a success toast appears: "Tu cotizacion fue registrada — te contactaremos pronto"
**And** the form closes automatically
**And** the user stays on the trip landing page

**Given** the API returns an error
**When** the error is displayed
**Then** a persistent error toast shows: "No pudimos procesar tu solicitud — intenta de nuevo" with "Reintentar" button
**And** the form stays open with data preserved

## Scope Boundaries

### IN SCOPE
- ConversionForm component (responsive Sheet/Dialog)
- ConversionFlow wrapper (state management + auth redirect)
- POST /api/orders route handler
- Order schema (Zod) + types (TypeScript)
- Firestore Security Rules for `/orders`
- Refactor TripStickyCTA (callback prop instead of Link)
- Refactor TripDepartures (callback prop instead of Link)
- Update trip landing page.tsx to integrate ConversionFlow
- Attribution capture (UTM + ref from sessionStorage → order document)
- Analytics event `generate_lead` on order creation
- Order State Machine definition (types + valid transitions)

### OUT OF SCOPE (deferred)
- Odoo write-through to `sale.order` (no esta en los AC — se sincronizara en Epic 3 o story futura de sync)
- Boton "Copiar Mi Link" para agentes (Story 2-5)
- Cola de leads sin agente en panel admin (Story 2-5)
- Dashboard de analytics/atribucion (Story 2-6)
- Flujo de pagos (Epic 3)
- Notificaciones push/WhatsApp de nuevo lead (Epic 6 — solo se registra el domain event en el documento)
- Portal "Mis Viajes" del cliente (Epic 7, Story 7-1)
- Decremento de `seatsAvailable` (se gestiona via Odoo sync, no al crear orden Interesado)

## Tasks / Subtasks

- [x] **Task 1: Order Schema & Types** (AC: 3, 5)
  - [x] 1.1 Crear `src/schemas/orderSchema.ts` — Zod puro (SIN imports de firebase-admin). Incluir: `createOrderSchema` (input del form), `ORDER_STATUSES` const array, `VALID_TRANSITIONS` map, `orderStatusSchema`
  - [x] 1.2 Crear `src/types/order.ts` — `Order`, `OrderStatus`, `CreateOrderRequest`, `CreateOrderResponse` interfaces
  - [x] 1.3 Tests co-located para schema: valid data, missing fields, invalid status, transitions map

- [x] **Task 2: POST /api/orders Route Handler** (AC: 3, 4)
  - [x] 2.1 Crear `src/app/api/orders/route.ts` con `requireAuth()` + Zod `safeParse`
  - [x] 2.2 Verificar trip existe y `isPublished === true` (query Firestore con Admin SDK)
  - [x] 2.3 Verificar departure existe, `isActive === true`, `seatsAvailable > 0`
  - [x] 2.4 Leer `odooListPriceCentavos` del trip server-side (NUNCA confiar en valor del client)
  - [x] 2.5 Crear documento en `/orders/{orderId}` con `FieldValue.serverTimestamp()`
  - [x] 2.6 Retornar 201 con `{ orderId, status, tripId, departureId, amountTotalCents }`
  - [x] 2.7 Tests co-located: 201 success, 401 unauth, 400 validation, 404 trip/departure not found, 409 sold out, attribution capture

- [x] **Task 3: ConversionForm Component** (AC: 1, 8)
  - [x] 3.1 Crear `src/app/(public)/viajes/[slug]/ConversionForm.tsx` — `'use client'`
  - [x] 3.2 Responsive: `Sheet` en mobile (`<lg`), `Dialog` en desktop (`lg+`) — CSS media query (Opcion A)
  - [x] 3.3 Trip summary card (nombre h3, precio Roboto Mono, duracion)
  - [x] 3.4 Departure date `Select` con opciones de departures disponibles (seats > 0), cada opcion muestra fecha + "X lugares"
  - [x] 3.5 CTA "Confirmar Cotizacion" — disabled sin departure seleccionada, loading state al submit
  - [x] 3.6 Texto legal: "Al confirmar, aceptas nuestros terminos y condiciones"
  - [x] 3.7 Fetch POST /api/orders on submit, handle success (toast + close) y error (toast persistent + retry)
  - [x] 3.8 Disparar `generate_lead` analytics event on success
  - [x] 3.9 Empty state si 0 departures: "Sin salidas disponibles — contactanos" con link WhatsApp
  - [x] 3.10 Tests co-located: render, departure selector, submit flow, loading state, success toast, error toast, empty state

- [x] **Task 4: ConversionFlow Wrapper** (AC: 1, 2)
  - [x] 4.1 Crear `src/app/(public)/viajes/[slug]/ConversionFlow.tsx` — `'use client'`
  - [x] 4.2 Manage state: `isOpen`, `selectedDepartureId` con useState
  - [x] 4.3 Auth check con `useAuthStore()`: si autenticado → abrir form; si no → guardar en sessionStorage + redirect `/login?returnUrl=...`
  - [x] 4.4 Auto-open desde URL params: `useSearchParams()` detecta `?cotizar=true`, lee `?salida=xxx`
  - [x] 4.5 Wrap en `<Suspense>` (useSearchParams requiere Suspense boundary)
  - [x] 4.6 Renderiza internamente: `<TripDepartures>` + `<TripStickyCTA>` + `<ConversionForm>`
  - [x] 4.7 Tests co-located: auth redirect, auto-open from params, departure preselection, open/close flow

- [x] **Task 5: Refactor TripStickyCTA** (AC: 1)
  - [x] 5.1 Agregar prop `onQuoteClick: () => void`
  - [x] 5.2 Reemplazar `<Link href="/login">` con `<button onClick={onQuoteClick}>`
  - [x] 5.3 Preservar `begin_checkout` analytics event (ya existe)
  - [x] 5.4 Actualizar tests existentes: verificar callback en vez de Link href

- [x] **Task 6: Refactor TripDepartures** (AC: 1)
  - [x] 6.1 Agregar prop `onSelectDeparture: (departureId: string) => void`
  - [x] 6.2 Reemplazar `<Link href="/login">` con `<button onClick={() => onSelectDeparture(dep.id)}>`
  - [x] 6.3 Preservar `select_item` analytics event (ya existe)
  - [x] 6.4 Actualizar tests existentes: verificar callback en vez de Link href

- [x] **Task 7: Update Trip Landing page.tsx** (AC: 1, 2)
  - [x] 7.1 Importar `ConversionFlow` y reemplazar renders individuales de TripDepartures + TripStickyCTA
  - [x] 7.2 Pasar props serializables (tripId, tripName, tripSlug, tripPrice, tripDuration, departures)
  - [x] 7.3 Suspense boundary dentro de ConversionFlow (DeparturesSkeleton)
  - [x] 7.4 No existen tests de page.tsx que requieran actualizacion

- [x] **Task 8: Firestore Security Rules** (AC: 7)
  - [x] 8.1 Agregar match `/orders/{orderId}` en `firestore.rules`
  - [x] 8.2 Read: `request.auth.uid == resource.data.userId` OR admin/director/superadmin roles
  - [x] 8.3 Write/Delete: `false` (Admin SDK only)
  - [x] 8.4 No se necesita composite index — queries simples por userId

- [x] **Task 9: Attribution Capture** (AC: 3, 6)
  - [x] 9.1 En ConversionFlow, leer de sessionStorage: `attribution_utm_source`, `attribution_utm_medium`, `attribution_utm_campaign`, `attribution_ref` (agentId)
  - [x] 9.2 Pasar como campos opcionales en el body del POST /api/orders
  - [x] 9.3 Almacenar en el documento de la orden

- [x] **Task 10: Typecheck + Build Validation** (AC: all)
  - [x] 10.1 `pnpm typecheck` — 0 errores
  - [x] 10.2 `pnpm test` — 951 passed, 0 regresiones (2 pre-existentes en dashboard), 57 tests nuevos
  - [x] 10.3 `pnpm build` — build limpio, SSG de `/viajes/[slug]` sigue funcionando con ISR

## Dev Notes

### Arquitectura del Flujo de Conversion

```
Trip Landing (Server Component, SSG+ISR)
  ├── TripHero (Server) — sin cambios
  ├── TripInfo (Server) — sin cambios
  ├── TripDescription (Server) — sin cambios
  ├── <Suspense fallback={<DeparturesSkeleton />}>
  │   └── ConversionFlow (Client) — NUEVO wrapper
  │       ├── TripDepartures (Client) — REFACTORED: onSelectDeparture callback
  │       ├── TripStickyCTA (Client) — REFACTORED: onQuoteClick callback
  │       └── ConversionForm (Client) — NUEVO: Sheet mobile / Dialog desktop
  │           ├── Trip Summary Card (read-only)
  │           ├── Departure Date Select
  │           ├── CTA "Confirmar Cotizacion"
  │           └── Legal text
  ├── TripTestimonials (Server) — sin cambios
  └── TripAnalytics (Client) — sin cambios
```

### Patron ConversionFlow (Client Component Wrapper)

ConversionFlow es necesario porque page.tsx es Server Component y no puede tener estado. Este wrapper Client Component:
1. Recibe `trip` (subset serializable) y `departures` del Server Component parent
2. Maneja estado de apertura del form (`isOpen`) y departure seleccionado
3. Lee `useSearchParams()` para auto-open post-login redirect (necesita Suspense)
4. Lee `useAuthStore()` para decidir entre abrir form o redirect a login
5. Renderiza los 3 componentes interactivos que necesitan comunicarse

### Patron Auth Redirect con returnUrl

```
Usuario NO autenticado clicks CTA
  → sessionStorage.setItem('pendingQuote', JSON.stringify({ tripId, departureId }))
  → router.push(`/login?returnUrl=${encodeURIComponent(`/viajes/${slug}?cotizar=true&salida=${depId}`)}`)
  → Login exitoso
  → router.push(validateReturnUrl(returnUrl))
  → Trip landing carga con ?cotizar=true&salida=xxx
  → ConversionFlow lee searchParams, auto-abre form con departure preseleccionado
```

Usar `validateReturnUrl()` de `src/lib/utils/validateReturnUrl.ts` (ya existe, valida que empiece con `/`).

### Responsive Sheet / Dialog

Dos opciones de implementacion (elegir la mas simple):

**Opcion A — CSS Media Query (recomendada):** Renderizar ambos (Sheet + Dialog) y mostrar/ocultar con `className="lg:hidden"` / `className="hidden lg:block"`. Mas simple, no requiere hook de resize.

**Opcion B — useMediaQuery hook:** Un solo render condicional. Requiere hook que detecte viewport. Riesgo de hydration mismatch en SSR.

Recomendacion: **Opcion A** porque evita hydration issues y es el patron ya usado en TripDepartures (cards mobile + table desktop via CSS).

### Precio Server-Side (Seguridad)

CRITICO: El `amountTotalCents` de la orden se lee del trip document en Firestore dentro del Route Handler. El client NUNCA envia el precio. Esto previene manipulacion de precios.

```typescript
// En POST /api/orders:
const tripDoc = await adminDb.collection('trips').doc(parsed.data.tripId).get()
const amountTotalCents = tripDoc.data()?.odooListPriceCentavos ?? 0
```

### sessionStorage Keys para Attribution

Los UTM params ya se capturan en Story 1.2 (public landing pages) y se almacenan en sessionStorage. Keys existentes a leer:

```typescript
// Keys probables (verificar en src/lib/analytics.ts o components/AnalyticsProvider):
sessionStorage.getItem('utm_source')
sessionStorage.getItem('utm_medium')
sessionStorage.getItem('utm_campaign')
sessionStorage.getItem('ref') // agentId from ?ref= param
```

Si estos keys NO existen aun en el codigo, crear un helper `getAttributionData()` en `src/lib/utils/attribution.ts` que los lea de sessionStorage y URL params.

### No Decrementar seatsAvailable

Una orden `Interesado` es una expresion de interes, NO una reserva confirmada. Los seats se gestionan via Odoo sync (Story 2-1a). No decrementar `seatsAvailable` al crear orden. Solo hacer soft-check de `seatsAvailable > 0` como validacion.

### Order State Machine — Solo Definicion

Story 2-4 SOLO crea ordenes en estado `Interesado`. La state machine se define como tipos y constantes en `src/schemas/orderSchema.ts` y `src/types/order.ts` para que esten listos para stories futuras. NO implementar transiciones de estado en esta story.

### Project Structure Notes

**Archivos nuevos:**
```
src/schemas/orderSchema.ts              # Zod schemas (PURO, sin firebase-admin)
src/types/order.ts                      # TypeScript interfaces
src/app/api/orders/route.ts             # POST handler
src/app/api/orders/route.test.ts        # Tests co-located
src/app/(public)/viajes/[slug]/ConversionForm.tsx       # Form component
src/app/(public)/viajes/[slug]/ConversionForm.test.tsx  # Tests
src/app/(public)/viajes/[slug]/ConversionFlow.tsx       # Wrapper component
src/app/(public)/viajes/[slug]/ConversionFlow.test.tsx  # Tests
```

**Archivos modificados:**
```
src/app/(public)/viajes/[slug]/TripStickyCTA.tsx       # Add onQuoteClick prop
src/app/(public)/viajes/[slug]/TripStickyCTA.test.tsx  # Update tests
src/app/(public)/viajes/[slug]/TripDepartures.tsx      # Add onSelectDeparture prop
src/app/(public)/viajes/[slug]/TripDepartures.test.tsx # Update tests
src/app/(public)/viajes/[slug]/page.tsx                # Integrate ConversionFlow
firestore.rules                                         # Add /orders rules
```

**Alineacion con estructura del proyecto:**
- Schemas en `src/schemas/` — cumple convencion
- Types en `src/types/` — cumple convencion
- API en `src/app/api/orders/` — kebab-case, cumple convencion
- Components feature-adjacent en `src/app/(public)/viajes/[slug]/` — cumple App Router pattern
- Tests co-located con source — cumple convencion (NUNCA `__tests__/`)

### Patrones de Codigo Existentes a Seguir

**API Route Handler (de `src/app/api/trips/[tripId]/departures/route.ts`):**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'

export async function POST(request: NextRequest) {
  try {
    const claims = await requireAuth()
    const body = await request.json()
    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Datos invalidos', retryable: false },
        { status: 400 }
      )
    }
    // ... Firestore logic ...
    return NextResponse.json({ orderId: docRef.id, ... }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

**Schema pattern (de `src/schemas/profileSchema.ts`):**
```typescript
import { z } from 'zod'
export const createOrderSchema = z.object({ ... })
export type CreateOrderFormData = z.infer<typeof createOrderSchema>
```

**Auth store usage (de `src/stores/useAuthStore.ts`):**
```typescript
const { isAuthenticated, isLoading, profile } = useAuthStore()
```

**Analytics (de `src/lib/analytics.ts`):**
```typescript
trackEvent('generate_lead', { trip_id: tripId, agent_id: agentId ?? 'sin_asignar', utm_source: utmSource })
```

**Firestore Rules pattern (de `firestore.rules`):**
```
match /orders/{orderId} {
  allow read: if request.auth != null
              && (request.auth.uid == resource.data.userId
                  || 'admin' in request.auth.token.roles
                  || 'director' in request.auth.token.roles
                  || 'superadmin' in request.auth.token.roles);
  allow write: if false;
  allow delete: if false;
}
```

### Testing Requirements

**Patron de testing establecido en Story 2-3:**
- `vi.hoisted()` para variables mock en `vi.mock()` factories
- `getAllByText()` para texto duplicado en responsive views
- Mock firebase analytics: `vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))`
- `fireEvent` para interacciones (no user-event)
- jsdom NO aplica media queries — `getAllByText` para elementos en ambas vistas

**Tests nuevos estimados:**
| Archivo | Tests aprox | Que cubre |
|---------|-------------|-----------|
| `orderSchema.test.ts` | 8-10 | Schema validation, transitions map, invalid states |
| `route.test.ts` | 8-10 | 201 success, 401, 400, 404x2, 409, attribution |
| `ConversionForm.test.tsx` | 10-12 | Render, selector, submit, loading, success, error, empty state |
| `ConversionFlow.test.tsx` | 8-10 | Auth redirect, auto-open, preselect, open/close |
| `TripStickyCTA.test.tsx` | Updates | Callback prop, analytics preserved |
| `TripDepartures.test.tsx` | Updates | Callback prop, analytics preserved |

**Total estimado:** ~40-50 tests nuevos/actualizados

**Criterio de validacion final:**
- `pnpm typecheck` — 0 errores
- `pnpm test` — 0 regresiones + todos tests nuevos passing
- `pnpm build` — build limpio, SSG `/viajes/[slug]` funciona
- Tests cubren: happy path, auth redirect, validation errors, sold-out, empty states

### Lecciones de Stories Anteriores (APLICAR)

| Leccion | Aplicacion en 2-4 |
|---------|-------------------|
| `vi.hoisted()` obligatorio para mock variables | Todos los test files con vi.mock() |
| useSearchParams() necesita Suspense | ConversionFlow wrapeado en Suspense |
| POST debe retornar 201 | Route handler retorna 201 |
| Zod safeParse obligatorio, NUNCA `as Type` | En route handler y form validation |
| Firestore docs sin campos opcionales: normalizar con defaults | Attribution fields pueden no existir |
| Client components NO importar firebase-admin | orderSchema.ts sin imports de firebase-admin |
| FieldValue.serverTimestamp() no serializable en JSON response | Excluir de response, retornar ISO string |
| getAllByText para texto duplicado desktop+mobile | Tests de ConversionForm responsive |
| Fake timers + waitFor = deadlock | Usar real timers con timeout mayor |
| vi.stubGlobal + afterEach unstubAllGlobals | Si se usa fetch mock en route tests |
| validateReturnUrl() para URLs seguras | En redirect a login |

### Dependencias Existentes (NO agregar nuevas librerias)

Todo lo necesario ya esta instalado:
- `zod` — validacion
- `react-hook-form` + `@hookform/resolvers` — form handling
- `@/components/ui/sheet` — Sheet (shadcn/ui)
- `@/components/ui/dialog` — Dialog (shadcn/ui)
- `@/components/ui/select` — Select (shadcn/ui)
- `@/components/ui/button` — Button (shadcn/ui)
- `@/components/ui/toast` — Toast/Sonner (verificar cual usa el proyecto)
- `firebase-admin/firestore` — Firestore Admin SDK
- `next/navigation` — useRouter, useSearchParams

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4] — AC originales, Order State Machine
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md#FR12] — Seleccion fecha salida
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md#FR13] — Captura ref agente
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md#FR59] — Eventos conversion analytics
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md#FR60] — UTM parameters
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md#FR61] — Meta Pixel / GTM
- [Source: _bmad-output/planning-artifacts/prd/user-journeys.md#Journey1] — Flujo Diego visitante→cliente
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md] — API patterns, data model
- [Source: _bmad-output/planning-artifacts/ux-design-specification/] — Form UX, Sheet/Dialog, feedback states
- [Source: src/app/(public)/viajes/[slug]/TripStickyCTA.tsx] — CTA actual con Link a /login
- [Source: src/app/(public)/viajes/[slug]/TripDepartures.tsx] — Departures con Link a /login
- [Source: src/app/(public)/viajes/[slug]/page.tsx] — Server Component landing, SSG+ISR
- [Source: src/schemas/profileSchema.ts] — Patron schema Zod
- [Source: src/app/api/trips/[tripId]/departures/route.ts] — Patron route handler
- [Source: src/lib/auth/requireAuth.ts] — Auth helper
- [Source: src/lib/errors/AppError.ts] — Error pattern
- [Source: src/lib/utils/validateReturnUrl.ts] — Validacion returnUrl
- [Source: src/lib/analytics.ts] — trackEvent pattern
- [Source: src/stores/useAuthStore.ts] — Auth store
- [Source: firestore.rules] — Security rules pattern
- [Source: _bmad-output/implementation-artifacts/2-3-trip-landing-page.md] — Previous story intelligence

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- TripDepartures Link import: removido accidentalmente, restaurado para empty state /contacto link
- Dashboard page.test.tsx: 2 tests pre-existentes fallando (no relacionados con Story 2-4)

### Completion Notes List
- Task 1: Order schema Zod puro + types TypeScript. 24 tests (schema validation, transitions, statuses, phone codes, contact fields)
- Task 2: POST /api/orders con requireAuth, Zod safeParse, validaciones server-side (trip published, departure active, seats>0), precio server-side, contactName+contactPhone. 17 tests
- Task 3: ConversionForm responsive (Sheet mobile / Dialog desktop via CSS Opcion A). Trip summary, contactName field, phone with country code selector (19 paises hispanohablantes, MX default), departure Select, submit con toast success/error, empty state WhatsApp. 16 tests
- Task 4: ConversionFlow wrapper con useAuthStore, useSearchParams, auto-open post-login, Suspense boundary. 9 tests
- Task 5: TripStickyCTA refactored — Link→Button, onQuoteClick callback, backward compat. 7 tests
- Task 6: TripDepartures refactored — Link→Button, onSelectDeparture callback, backward compat. 13 tests
- Task 7: page.tsx updated — ConversionFlow reemplaza renders individuales de TripDepartures + TripStickyCTA
- Task 8: Firestore rules /orders — read owner+admin/director/superadmin, write/delete false
- Task 9: Attribution via getAttributionData() desde sessionStorage (attribution_ref, attribution_utm_*)
- Task 10: typecheck 0 errors, 965 tests passed (71 nuevos), build limpio con SSG
- Post-review fix: Agregados campos contactName + contactPhone con selector de pais (19 paises hispanohablantes). Texto legal corregido (no menciona T&C inexistentes). Verificado en browser test con Firestore write real

### File List

**New files:**
- src/schemas/orderSchema.ts
- src/schemas/orderSchema.test.ts
- src/types/order.ts
- src/app/api/orders/route.ts
- src/app/api/orders/route.test.ts
- src/app/(public)/viajes/[slug]/ConversionForm.tsx
- src/app/(public)/viajes/[slug]/ConversionForm.test.tsx
- src/app/(public)/viajes/[slug]/ConversionFlow.tsx
- src/app/(public)/viajes/[slug]/ConversionFlow.test.tsx

**Modified files:**
- src/app/(public)/viajes/[slug]/TripStickyCTA.tsx
- src/app/(public)/viajes/[slug]/TripStickyCTA.test.tsx
- src/app/(public)/viajes/[slug]/TripDepartures.tsx
- src/app/(public)/viajes/[slug]/TripDepartures.test.tsx
- src/app/(public)/viajes/[slug]/page.tsx
- firestore.rules
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/2-4-conversion-flow.md

## Change Log

- 2026-02-28: Story 2-4 implementation complete — Conversion Flow (Quote/Reserve) with 10 tasks, 57 new tests, 0 regressions
- 2026-02-28: Post-review enhancement — Added contactName + contactPhone with country code selector (19 Hispanic countries). Fixed legal text. 14 additional tests (71 total new). Browser tested: order saved with contactName="Diego Martinez", contactPhone="+523411234567" in Firestore

## Status

Status: review
