---
title: 'Conversion Flow 2.0 — Guest Checkout + UX Improvements'
slug: 'conversion-flow-2-0'
created: '2026-02-28'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16', 'Firebase Auth', 'Firestore', 'Zod', 'shadcn/ui', 'Tailwind v4', 'sonner']
files_to_modify:
  - 'src/types/order.ts'
  - 'src/config/whatsapp.ts (NEW)'
  - 'src/lib/auth/tryAuth.ts (NEW)'
  - 'src/lib/orders/linkGuestOrders.ts (NEW)'
  - 'src/app/api/orders/route.ts'
  - 'src/app/api/auth/session/route.ts'
  - 'src/app/(public)/viajes/[slug]/ConversionFlow.tsx'
  - 'src/app/(public)/viajes/[slug]/ConversionForm.tsx'
  - 'src/app/(public)/viajes/[slug]/TripDepartures.tsx'
  - 'src/app/(public)/privacy/page.tsx (NEW)'
  - 'src/app/(public)/terms/page.tsx (NEW)'
code_patterns:
  - 'AppError pattern: { code, message, retryable }'
  - 'vi.hoisted() for mock variables in vi.mock() factories'
  - 'getAllByText() for responsive Sheet+Dialog dual rendering'
  - 'vi.stubGlobal + afterEach vi.unstubAllGlobals()'
  - 'Firestore chainable mock: collection→doc→get→data()'
  - 'tryAuth() = optional auth wrapper (new pattern)'
  - 'guestToken via crypto.randomUUID() for anonymous order claiming'
test_patterns:
  - 'Co-located tests (*.test.tsx next to component)'
  - 'vi.hoisted() + vi.mock() factory pattern'
  - 'vi.stubGlobal(fetch/sessionStorage) + afterEach cleanup'
  - 'getAllByText for Sheet+Dialog dual renders in jsdom'
  - 'setupFirestoreMocks() helper for route tests'
---

# Tech-Spec: Conversion Flow 2.0 — Guest Checkout + UX Improvements

**Created:** 2026-02-28

## Overview

### Problem Statement

El flujo de conversion actual requiere login obligatorio antes de cotizar un viaje. Esto crea friccion significativa: un visitante que llego motivado desde Instagram o un link de agente debe registrarse/loguearse antes de poder expresar interes. Ademas faltan elementos clave de conversion: terminos legales, social proof (ocupacion en tiempo real), urgencia visual (ultimos lugares), canal alternativo WhatsApp, y la mecanica para vincular datos capturados como anonimo con una cuenta futura.

### Solution

Implementar un flujo hibrido robusto:
1. **Guest checkout**: Permitir cotizar sin cuenta — el formulario captura nombre + telefono + departure sin requerir auth
2. **Login opcional post-cotizacion**: Ofrecer crear cuenta despues para dar seguimiento a su cotizacion desde el dashboard
3. **Linkeo anonimo→cuenta**: Al registrarse, vincular automaticamente las orders huerfanas via guestToken
4. **Mejoras de conversion**: Social proof, urgencia, WhatsApp alternativo, T&C basicas

### Scope

**En Scope:**
- Remover auth gate del formulario de cotizacion (ConversionFlow.tsx)
- Guest orders: userId nullable en schema, guestToken para claim posterior
- Linkeo anonimo→cuenta via guestToken en /api/auth/session
- Paginas basicas de Terminos y Condiciones + Aviso de Privacidad
- Urgencia visual mejorada: "Solo quedan X — reserva ya" + countdown si sale en <30 dias
- WhatsApp CTA alternativo con mensaje pre-llenado
- Post-cotizacion: pantalla de confirmacion con CTA "Crear cuenta" + "WhatsApp"
- Anti-spam basico: rate limit por IP en route handler para guests

**Fuera de Scope:**
- Email service / transactional emails (Epic 6)
- Flujo de pagos (Epic 3)
- A/B testing engine (solo hooks de eventos)
- Notificaciones push/WhatsApp automaticas (Epic 6)
- Dashboard de cliente "Mis Viajes" (Epic 7)
- reCAPTCHA (solo si spam se vuelve problema)

## Context for Development

### Codebase Patterns

- Architecture Law: 28 naming conventions non-negotiable (CLAUDE.md)
- Zod safeParse obligatorio para datos externos
- Server Components por default; `'use client'` pushed as low as possible
- AppError pattern: `{ code, message, retryable }`
- Orders state machine: Interesado → Confirmado → En Progreso → Completado | Cancelado
- Firestore writes via Admin SDK ONLY (rules `allow write: if false` en orders)
- `requireAuth()` siempre lanza AppError si no hay sesion — nuevo `tryAuth()` retorna null
- Dual render Sheet (mobile) + Dialog (desktop) — `getAllByText()` obligatorio en tests
- WhatsApp solo via links `wa.me` — no hay API client

### Files to Reference

| File | Purpose | Action |
| ---- | ------- | ------ |
| `src/types/order.ts` | Order, CreateOrderRequest, etc. | MODIFY: userId nullable, guestToken field |
| `src/config/whatsapp.ts` | **NEW**: WhatsApp config constants | CREATE |
| `src/lib/auth/tryAuth.ts` | **NEW**: Optional auth helper | CREATE |
| `src/lib/orders/linkGuestOrders.ts` | **NEW**: Link guest orders to account | CREATE |
| `src/app/api/orders/route.ts` | POST /api/orders | MODIFY: tryAuth(), userId nullable, guestToken, rate limit |
| `src/app/api/auth/session/route.ts` | POST /api/auth/session | MODIFY: hook linkGuestOrders() |
| `src/app/(public)/viajes/[slug]/ConversionFlow.tsx` | Orquestador: auth gate, analytics, state | MODIFY: remover auth gate, eliminar pendingQuote |
| `src/app/(public)/viajes/[slug]/ConversionForm.tsx` | Formulario Sheet/Dialog | MODIFY: agregar paso success, WhatsApp link, T&C link |
| `src/app/(public)/viajes/[slug]/TripDepartures.tsx` | Cards/tabla de salidas | MODIFY: urgencia mejorada, countdown |
| `src/app/(public)/privacy/page.tsx` | **NEW**: Aviso de Privacidad | CREATE (SSG) |
| `src/app/(public)/terms/page.tsx` | **NEW**: Terminos y Condiciones | CREATE (SSG) |

### Technical Decisions

1. **Hibrido sin login**: Cotizar sin cuenta, login opcional post-cotizacion
2. **guestToken > telefono para linkeo**: `crypto.randomUUID()` server-side, retornado una vez al cliente, guardado en localStorage. Mas robusto que telefono (evita variantes de formato)
3. **PRD Journey 1 modificado**: Login ya no es prerequisito para cotizar
4. **Anti-spam ligero**: Rate limit por IP (max 5 orders/hora sin auth) via simple Firestore count
5. **Legal pages minimas**: Contenido estatico MVP, no legalese completo
6. **WhatsApp con contexto**: Link `wa.me` con `?text=` pre-llenado con nombre del viaje

## Implementation Plan

### Tasks

Ordenados por dependencia (foundation primero, UI al final).

- [x] Task 1: Actualizar tipos de Order para guest support
  - File: `src/types/order.ts`
  - Action: Cambiar `userId: string` a `userId: string | null`. Agregar `guestToken: string | null` al interface `Order`. Agregar `guestToken` a `CreateOrderResponse`.
  - Notes: `CreateOrderRequest` NO cambia — userId viene del server, no del body del cliente. guestToken lo genera el server.

- [x] Task 2: Crear constantes de WhatsApp
  - File: `src/config/whatsapp.ts` (NEW)
  - Action: Extraer `WHATSAPP_CONTACT_NUMBER = '523331741585'` de ConversionForm.tsx a config compartido. Agregar helper `buildWhatsAppUrl(phone: string, text?: string): string` que construye `https://wa.me/{phone}?text={encodedText}`.
  - Notes: Reutilizable en ConversionForm (empty state), pantalla de confirmacion, y futuras integraciones.

- [x] Task 3: Crear helper tryAuth()
  - File: `src/lib/auth/tryAuth.ts` (NEW)
  - Action: Wrapper de requireAuth() que retorna `AuthClaims | null` en vez de lanzar. Implementacion: `try { return await requireAuth() } catch { return null }`. Exportar tipo `AuthClaims` si no esta ya exportado.
  - Notes: NO modifica requireAuth.ts. Es un nuevo helper que lo wrappea. Usado en rutas donde auth es opcional.

- [x] Task 4: Crear linkGuestOrders()
  - File: `src/lib/orders/linkGuestOrders.ts` (NEW)
  - Action: Funcion `linkGuestOrders(userId: string, guestToken: string | null): Promise<number>`. Busca en Firestore: `where('guestToken', '==', guestToken).where('userId', '==', null)`. Actualiza cada match con `{ userId, guestToken: null, updatedAt: FieldValue.serverTimestamp() }`. Retorna count de orders linkeadas.
  - Notes: Si guestToken es null o vacio, retorna 0 sin query. Necesita composite index: `guestToken ASC, userId ASC`. Operacion idempotente — re-ejecutar no causa dano.

- [x] Task 5: Modificar POST /api/orders para guest support
  - File: `src/app/api/orders/route.ts`
  - Action:
    1. Reemplazar `requireAuth()` con `tryAuth()` (import de `src/lib/auth/tryAuth`)
    2. `userId: claims?.uid ?? null`
    3. Generar `guestToken: claims ? null : crypto.randomUUID()` (solo para guests)
    4. Agregar `guestToken` al orderData y al response
    5. Rate limit para guests: antes de crear, contar orders recientes (ultima hora) por IP header (`x-forwarded-for`). Si > 5, lanzar `AppError('RATE_LIMITED', 'Demasiadas solicitudes', 429, true)`
  - Notes: Orders de usuarios autenticados NO tienen rate limit ni guestToken. El response ahora incluye `guestToken: string | null`.

- [x] Task 6: Modificar POST /api/auth/session para account linking
  - File: `src/app/api/auth/session/route.ts`
  - Action:
    1. Aceptar campo opcional `guestToken` en el body del request (agregar Zod schema inline o extraer a schemas/)
    2. Despues de `initUserClaims(decodedToken.uid)`, llamar `await linkGuestOrders(decodedToken.uid, guestToken)`
    3. Import linkGuestOrders desde `src/lib/orders/linkGuestOrders`
  - Notes: Si guestToken es null/undefined, linkGuestOrders retorna 0 — no-op. El body actual solo envia `{ idToken }`, ahora acepta `{ idToken, guestToken? }`.

- [x] Task 7: Remover auth gate de ConversionFlow
  - File: `src/app/(public)/viajes/[slug]/ConversionFlow.tsx`
  - Action:
    1. Eliminar `import { useAuthStore } from '@/stores/useAuthStore'`
    2. Eliminar `const { isAuthenticated, isLoading } = useAuthStore()`
    3. En `handleQuoteClick()`: eliminar bloque `if (!isAuthenticated) { ... router.push('/login...') }`. Solo queda: analytics + `setIsFormOpen(true)`. Eliminar `if (isLoading) return`.
    4. En `handleSelectDeparture()`: eliminar bloque `if (!isAuthenticated) { ... router.push('/login...') }`. Solo queda: analytics + set state + `setIsFormOpen(true)`. Eliminar `if (isLoading) return`.
    5. En useEffect auto-open: eliminar guard `isAuthenticated`. Cambiar a: `if (shouldOpen) { ... setIsFormOpen(true) }`. Eliminar `sessionStorage.removeItem('pendingQuote')`.
    6. Eliminar `import { useRouter } from 'next/navigation'` y `const router = useRouter()` si ya no se usan.
    7. Limpiar imports no usados.
  - Notes: `useSearchParams` se sigue necesitando para `?cotizar=true&salida=X`. El `Suspense` boundary se mantiene.

- [x] Task 8: Agregar pantalla de confirmacion post-submit en ConversionForm
  - File: `src/app/(public)/viajes/[slug]/ConversionForm.tsx`
  - Action:
    1. Agregar estado `formStep: 'form' | 'success'` (default: `'form'`)
    2. Al submit exitoso (en handleSubmit, despues del toast.success): guardar `guestToken` de la response en localStorage (`localStorage.setItem('guestOrderToken', data.guestToken)`), cambiar a `setFormStep('success')` en vez de `onClose()`.
    3. Crear nuevo bloque `successContent` que muestra:
       - Icono de check verde + "Tu cotizacion fue registrada"
       - Mensaje: "Te contactaremos pronto por WhatsApp"
       - CTA primario: "Crear cuenta para dar seguimiento" → link a `/register?returnUrl=/mis-viajes`
       - CTA secundario: "Contactar por WhatsApp" → `buildWhatsAppUrl(WHATSAPP_CONTACT_NUMBER, 'Hola, cotice el viaje {tripName}')`
       - Boton terciario: "Cerrar" → `onClose()`
    4. Renderizar `formStep === 'form' ? formContent : successContent` en Sheet/Dialog.
    5. Importar `WHATSAPP_CONTACT_NUMBER` y `buildWhatsAppUrl` de `src/config/whatsapp.ts`.
    6. Resetear `formStep` a `'form'` cuando el modal se cierre (en onClose wrapper).
    7. Actualizar texto legal: "Al confirmar, aceptas nuestros [Terminos y Condiciones](/terms) y [Aviso de Privacidad](/privacy)" con links funcionales.
  - Notes: El guestToken solo se guarda en localStorage para guests (si la response tiene guestToken !== null). Para usuarios autenticados, no se guarda. El CTA "Crear cuenta" solo se muestra si el usuario NO esta autenticado (agregar prop `isAuthenticated` al form, pasado desde ConversionFlow).

- [x] Task 9: Mejorar urgencia en TripDepartures
  - File: `src/app/(public)/viajes/[slug]/TripDepartures.tsx`
  - Action:
    1. En `getOccupancyInfo()`, para el caso `pctAvailable < 0.2`: cambiar texto de `'Quedan ${dep.seatsAvailable}'` a `'Solo ${dep.seatsAvailable} lugar${dep.seatsAvailable === 1 ? '' : 'es'} — reserva ya!'`
    2. Agregar nueva funcion `getCountdownText(startDate: string): string | null` que retorna "Sale en X dias" si la fecha es < 30 dias en el futuro, null si no.
    3. Renderizar el countdown text debajo de la fecha en mobile cards y desktop table (solo si no es null).
    4. Usar clase `text-sm text-orange-600 font-medium` para el countdown.
  - Notes: El countdown es un calculo client-side simple basado en `new Date(startDate) - new Date()`. No requiere datos adicionales del server.

- [x] Task 10: Crear paginas legales (Privacy + Terms)
  - File: `src/app/(public)/privacy/page.tsx` (NEW)
  - File: `src/app/(public)/terms/page.tsx` (NEW)
  - Action:
    1. Crear Server Components SSG con contenido estatico basico.
    2. Privacy: "Aviso de Privacidad" con secciones: Datos que recopilamos, Como los usamos, Con quien los compartimos, Tus derechos, Contacto.
    3. Terms: "Terminos y Condiciones" con secciones: Uso del servicio, Cotizaciones, Pagos, Cancelaciones, Responsabilidad limitada, Contacto.
    4. Usar metadata `createMetadata()` para SEO.
    5. Contenido en espanol, tono profesional pero accesible (no legalese extremo).
    6. Layout: heading + prose sections con spacing consistente (`prose prose-green` o clases manuales).
  - Notes: Contenido es MVP — puede refinarse con abogado despues. Lo importante es que los links del footer funcionen y el formulario pueda referenciarlos.

- [x] Task 11: Enviar guestToken en login/register para account linking
  - File: `src/app/(auth)/login/page.tsx` o `src/lib/auth/AuthInitializer.tsx` (verificar cual hace el POST a /api/auth/session)
  - Action:
    1. Al hacer POST a `/api/auth/session`, incluir `guestToken: localStorage.getItem('guestOrderToken')` en el body.
    2. Despues del POST exitoso, limpiar: `localStorage.removeItem('guestOrderToken')`.
  - Notes: Esto conecta el cliente con el server-side linkGuestOrders(). Si no hay guestToken en localStorage, se envia null — no-op en el server.

- [x] Task 12: Actualizar ConversionFlow para pasar isAuthenticated al form
  - File: `src/app/(public)/viajes/[slug]/ConversionFlow.tsx`
  - Action:
    1. Re-agregar `useAuthStore` (solo para leer `isAuthenticated`, no como gate).
    2. Pasar `isAuthenticated` como prop a `<ConversionForm>`.
    3. En ConversionForm, usar para mostrar/ocultar CTA "Crear cuenta" en pantalla success.
  - Notes: El auth store ya no bloquea — solo se usa para personalizar la pantalla post-submit.

- [x] Task 13: Actualizar tests
  - Files: Todos los archivos `.test.tsx` y `.test.ts` de los componentes/rutas modificados
  - Action:
    1. **ConversionFlow.test.tsx**: Eliminar tests de redirect a login (3 tests). Simplificar mock de useAuthStore. Agregar test: "opens form without auth when CTA clicked". Agregar test: "opens form from URL params without auth".
    2. **ConversionForm.test.tsx**: Agregar test de pantalla success post-submit (verifica "Tu cotizacion fue registrada", CTAs de crear cuenta y WhatsApp). Agregar test: "saves guestToken to localStorage on guest submit". Agregar test: "shows create account CTA only for unauthenticated users". Actualizar texto legal assertion.
    3. **orders/route.test.ts**: Agregar tests para guest orders (userId null, guestToken present). Agregar test de rate limit (429 cuando > 5 orders/hora). Actualizar mock de requireAuth a tryAuth.
    4. **auth/session route test**: Agregar test para linkGuestOrders hook (verifica que se llama con guestToken del body).
    5. **TripDepartures.test.tsx**: Agregar test para texto urgencia mejorado ("Solo X lugar"). Agregar test para countdown text.
    6. **linkGuestOrders.test.ts** (NEW): Test happy path (links orders), test no-op con null token, test idempotencia.
    7. **tryAuth.test.ts** (NEW): Test retorna claims cuando autenticado, retorna null cuando no.
  - Notes: Patron establecido: vi.hoisted(), getAllByText() para dual render, setupFirestoreMocks(). Total estimado: ~15 tests nuevos, ~5 eliminados, ~8 modificados.

- [x] Task 14: Agregar composite index de Firestore
  - File: `firestore.indexes.json`
  - Action: Agregar composite index para `orders` collection: `guestToken ASC, userId ASC`.
  - Notes: Necesario para la query en linkGuestOrders(). Desplegar con `firebase deploy --only firestore:indexes`. Tarda ~3-5 min en construirse.

### Acceptance Criteria

**Guest Checkout (core):**
- [x] AC1: Given un visitante NO autenticado en la landing de un viaje, when hace click en "Cotizar Ahora" o "Apartar Lugar", then el formulario de cotizacion se abre directamente SIN redirigir a login.
- [x] AC2: Given un visitante NO autenticado con el formulario abierto, when llena nombre + telefono + fecha de salida y confirma, then se crea una orden en Firestore con `userId: null` y `guestToken: <uuid>`, y el response retorna 201 con guestToken.
- [x] AC3: Given un visitante que completo su cotizacion como guest, when ve la pantalla de confirmacion, then ve: mensaje de exito, CTA "Crear cuenta para seguimiento", CTA "WhatsApp", y boton "Cerrar".
- [x] AC4: Given un usuario YA autenticado, when completa una cotizacion, then la orden se crea con `userId: <uid>` y `guestToken: null`, y la pantalla success NO muestra "Crear cuenta".

**Account Linking:**
- [x] AC5: Given un visitante que cotizo como guest (tiene guestToken en localStorage), when se registra o logea, then el POST a /api/auth/session incluye el guestToken, y las orders huerfanas con ese token se actualizan con su nuevo userId.
- [x] AC6: Given un usuario que se logea SIN guestToken en localStorage, when se hace POST a /api/auth/session, then linkGuestOrders es no-op (retorna 0).

**Rate Limiting:**
- [x] AC7: Given un visitante NO autenticado que ha creado 5 orders en la ultima hora, when intenta crear otra, then recibe HTTP 429 con `{ code: 'RATE_LIMITED', retryable: true }`.
- [x] AC8: Given un usuario autenticado, when crea orders, then NO se aplica rate limit.

**Urgencia / Social Proof:**
- [x] AC9: Given una salida con <20% de disponibilidad, when se renderiza en TripDepartures, then muestra "Solo X lugar(es) — reserva ya!" en badge rojo.
- [x] AC10: Given una salida que sale en menos de 30 dias, when se renderiza, then muestra "Sale en X dias" debajo de la fecha.

**WhatsApp Alternativo:**
- [x] AC11: Given un visitante en la pantalla de confirmacion post-cotizacion, when hace click en "Contactar por WhatsApp", then se abre wa.me con el numero correcto y un mensaje pre-llenado con el nombre del viaje.

**Legal Pages:**
- [x] AC12: Given un visitante que hace click en "Terminos y Condiciones" en el footer o en el formulario, when la pagina carga, then ve contenido legal basico con secciones de uso, cotizaciones, pagos, cancelaciones.
- [x] AC13: Given un visitante que hace click en "Aviso de Privacidad" en el footer, when la pagina carga, then ve contenido sobre datos recopilados, uso, derechos.

**Texto Legal en Form:**
- [x] AC14: Given un visitante viendo el formulario de cotizacion, when lee el texto legal al fondo, then dice "Al confirmar, aceptas nuestros Terminos y Condiciones y Aviso de Privacidad" con links funcionales a /terms y /privacy.

**URL Params:**
- [x] AC15: Given un visitante que llega a `/viajes/slug?cotizar=true&salida=dep-1`, when la pagina carga, then el formulario se abre automaticamente con la salida preseleccionada SIN requerir auth.

## Additional Context

### Dependencies

- `crypto.randomUUID()` para guestToken — built-in en Node.js, sin dependencia extra
- Story 2-5 (Agent Attribution): `?ref=agentId` persiste en sessionStorage → se envia en el body del order. Complementa este spec pero es independiente.
- Story 2-6 (Analytics): eventos GA4/Meta Pixel para funnel de conversion. Complementa pero independiente.
- Composite index Firestore para `guestToken + userId` en collection `orders`.

### Testing Strategy

**Unit Tests (Vitest, co-located):**
- `tryAuth.test.ts`: 2 tests (returns claims, returns null)
- `linkGuestOrders.test.ts`: 4 tests (happy path, null token, no matches, idempotent)
- `ConversionFlow.test.tsx`: ~10 tests (eliminar 3 de redirect, agregar 3 de guest flow)
- `ConversionForm.test.tsx`: ~18 tests (agregar 4 de success screen, guestToken, T&C links)
- `orders/route.test.ts`: ~22 tests (agregar 5 de guest, rate limit)
- `auth/session/route.test.ts`: agregar 2 tests de linkGuestOrders hook
- `TripDepartures.test.tsx`: agregar 2 tests de urgencia/countdown

**Manual Testing (Browser):**
1. Abrir landing de viaje sin estar logueado → click Cotizar → verificar que form se abre sin redirect
2. Llenar form como guest → submit → verificar pantalla success con CTAs
3. Verificar orden en Firestore: userId=null, guestToken presente
4. Registrar cuenta → verificar que orden se linkea (userId actualizado, guestToken=null)
5. Verificar rate limit: crear 6 orders rapido → 6ta da 429
6. Verificar /terms y /privacy cargan con contenido
7. Verificar texto legal con links funcionales en el form
8. Verificar urgencia visual en salidas con <20% disponibilidad

**Total estimado: ~60 tests unitarios** (actualmente ~45 en archivos afectados).

### Notes

**Riesgos:**
- **Spam sin auth**: Rate limit por IP es basico — proxies/VPNs pueden evadirlo. reCAPTCHA v3 es el siguiente paso si el spam se materializa.
- **Contenido legal MVP**: Paginas de T&C y Privacy necesitan revision de abogado eventualmente. El contenido generado es punto de partida razonable.
- **guestToken en localStorage**: Se pierde si el usuario limpia storage o cambia de dispositivo antes de registrarse. Alternativa futura: linkeo por telefono como fallback.

**Futuro (fuera de scope pero considerar):**
- Email de confirmacion de cotizacion (Epic 6)
- "Personas viendo esta salida" en tiempo real (requiere Firestore counter o Analytics)
- Multi-step wizard mas elaborado (datos personales → seleccion → confirmacion → pago)
- A/B testing de variantes de CTA (requiere engine de feature flags)
- Linkeo fallback por telefono si guestToken se pierde

## Review Notes
- Adversarial review completed: 14 findings total
- 7 fixed (F1, F4, F5, F6, F7, F11, F14), 7 dismissed (noise/pre-existing/by-design)
- Resolution approach: auto-fix all real findings, 0 tech debt
- Key fixes: returnUrl slug bug (F6), price $0 validation (F5), form reset on close (F14), guestToken optimistic clear (F4), rate limit .count() + IP validation (F1), linkGuestOrders .limit(10) (F7), hydration-safe countdown (F11)

**Orden de implementacion sugerido como sub-stories:**
1. **Sub-story A (foundation)**: Tasks 1-6 — tipos, helpers, API changes
2. **Sub-story B (UI)**: Tasks 7-9, 12 — ConversionFlow sin auth, success screen, urgencia
3. **Sub-story C (legal + linking)**: Tasks 10-11, 14 — paginas legales, client linking, index
4. **Sub-story D (tests)**: Task 13 — todos los tests
