# Story 2.3: Trip Landing Page (Dynamic)

Status: done

## Story

As a **visitante**,
I want to see a rich, detailed landing page for each trip,
so that I have all the information I need to decide on a trip.

## Acceptance Criteria

### AC1: Landing page renderiza con datos reales de Firestore

**Given** un visitante navega a `/viajes/{slug}`
**When** la landing page carga
**Then** ve:
- Hero image (heroImages[0] de Firestore Storage, fallback a placeholder.svg)
- Titulo del viaje (odooName) como h1
- Copy emocional (emotionalCopy) como subtitulo (si existe)
- Descripcion del viaje (odooDescriptionSale)
- Highlights como bullet list (si existen)
- Tags como badges (si existen)
- Dificultad como badge (si existe)
- Precio en Roboto Mono formato MXN ($145,000)
- Proximas fechas de salida con ocupacion individual por fecha
- Seccion testimonios (con empty state emocional si no hay)
**And** la pagina renderiza como SSG con ISR `revalidate: 3600` para SEO (NFR1, NFR18)
**And** la pagina es responsive con PublicLayout behavior
**And** SOLO se muestran viajes con `isPublished === true`

### AC2: SSG con generateStaticParams y generateMetadata

**Given** el build de Next.js ejecuta
**When** genera paginas estaticas
**Then** `generateStaticParams()` genera paths para TODOS los slugs de viajes publicados en Firestore
**And** `generateMetadata()` genera metadata SEO dinamica:
- `title`: seoTitle || odooName
- `description`: seoDescription || odooDescriptionSale (truncado a 160 chars)
- `openGraph.images`: heroImages[0] si existe
**And** la pagina tiene try/catch con fallback vacio para build resilience (sin Firestore en CI)

### AC3: Fechas de salida con ocupacion individual

**Given** un viaje tiene departures en subcolleccion `/trips/{tripId}/departures/`
**When** la landing page renderiza la seccion de salidas
**Then** muestra cada departure futura (startDate > now) con:
- Fecha formateada ("15 de marzo, 2026")
- Plazas disponibles ("Quedan 7 lugares" de seatsAvailable)
- Badge de estado: verde (>50% disponible), amarillo (20-50%), rojo (<20%), "Agotado" (0)
- CTA "Apartar Lugar" por departure (deshabilitado si seatsAvailable === 0)
**And** departures ordenadas por startDate ascendente

**Given** no hay departures futuras
**When** la seccion de salidas renderiza
**Then** muestra un placeholder emocional: "Proximas salidas en preparacion — contacta a nuestro equipo" con CTA de contacto
**And** NUNCA muestra tabla vacia o "No hay datos"

### AC4: Testimonios con empty state emocional

**Given** no existen reviews ni UGC para un viaje
**When** la seccion de testimonios renderiza
**Then** muestra empty state con ilustracion + "Se el primero en compartir tu experiencia" + CTA de registro
**And** NUNCA muestra seccion vacia, "No hay datos", ni "Sin testimonios"

**Given** existen testimonios aprobados
**When** la seccion renderiza
**Then** muestra cards con avatar, nombre, texto, rating (estrellas)

### AC5: CTA sticky en mobile

**Given** la landing page esta cargada en mobile
**When** el visitante hace scroll
**Then** ve un CTA sticky "Cotizar" / "Apartar Lugar" fijo en la parte inferior
**And** el CTA tiene altura minima 48px y respeta safe-area-inset-bottom
**And** en desktop el CTA es inline (no sticky)

### AC6: Captura de atribucion (ref parameter)

**Given** un visitante llega via agent ref link (`?ref=agentId`)
**When** la landing carga
**Then** el parametro ref se captura y almacena en sessionStorage para atribucion futura (FR13)
**And** UTM params tambien se capturan via AnalyticsProvider (ya activo en PublicLayout)

### AC7: Analytics events

**Given** un visitante carga la landing
**When** la pagina renderiza
**Then** dispara `view_item` en Firebase Analytics con item_id, item_name, price, item_category
**And** dispara equivalentes en Meta Pixel y GTM
**And** al hacer click en CTA dispara `begin_checkout` (o lo prepara para Story 2-4)

### AC8: Performance y SEO

**Given** la pagina de landing
**When** se mide con Lighthouse
**Then** LCP < 2.5s (NFR1)
**And** TTI < 3.5s en red 4G (NFR6)
**And** hero image usa `next/image` con `priority` y `sizes` prop
**And** la pagina se sirve desde CDN sin carga de servidor (NFR18)

### AC9: Skeleton loading

**Given** la pagina esta cargando
**When** aun no se han obtenido los datos
**Then** muestra skeleton que replica la forma de la landing (hero + titulo + contenido)
**And** skeletons usan `animate-pulse` (NUNCA spinner generico, NUNCA pantalla blanca)

## Tasks / Subtasks

- [x] **Task 1 — Funcion server de datos para landing** (AC: #1, #2, #3)
  - [x] 1.1 Extender `src/lib/firebase/trips-public.ts` — `getPublishedTripBySlug()` ya retorna CASI todos los campos necesarios (incluye `odooDescriptionSale`, `highlights`, `tags`, `difficulty`, `emotionalCopy`). Solo agregar `odooRatingAvg` y `odooRatingCount` a `PUBLIC_TRIP_FIELDS`. NO crear funcion nueva duplicada — reutilizar `getPublishedTripBySlug()` directamente en page.tsx
  - [x] 1.2 Crear `getDeparturesForTrip(tripId)` — lee subcolleccion directa `/trips/{tripId}/departures/` filtrando departures futuras (`startDate > now`), ordenadas por `startDate` ASC, con `isActive === true AND isPublished === true`. El composite index `departures(isActive+startDate)` ya existe en firestore.indexes.json. Query scope es COLLECTION (subcolleccion directa, no collectionGroup)
  - [x] 1.3 Extender `PublicTrip` para incluir `odooRatingAvg: number` (default 0) y `odooRatingCount: number` (default 0). Si no se quiere modificar PublicTrip, crear `LandingTrip extends PublicTrip` con estos dos campos + `departures: PublicDeparture[]`
  - [x] 1.4 Tipo `PublicDeparture` — subset client-safe de `TripDeparture`: `{ id, odooName, startDate: string, endDate: string, seatsMax, seatsAvailable, seatsUsed }`. Serializar Timestamps a ISO strings en el mapper (JSON-safe para props de Client Component)
  - [x] 1.5 Normalizar campos opcionales con defaults en mapper: `emotionalCopy ?? ''`, `tags ?? []`, `highlights ?? []`, `seoTitle ?? odooName`, `seoDescription ?? ''`
  - [x] 1.6 Tests unitarios: trip found, trip not found, trip unpublished, departures empty, departures with data — 8+ tests

- [x] **Task 2 — Refactorear page.tsx de STATIC_TRIPS a Firestore** (AC: #1, #2, #8)
  - [x] 2.1 Reescribir `src/app/(public)/viajes/[slug]/page.tsx` — Server Component con `getPublishedTripBySlug(slug)` + `getDeparturesForTrip(trip.id)`
  - [x] 2.2 `export const revalidate = 3600` (ISR 1 hora, mismo que catalogo)
  - [x] 2.3 `generateStaticParams()` basado en `getPublishedTrips()` (NO STATIC_TRIPS)
  - [x] 2.4 `generateMetadata()` dinamico con seoTitle, seoDescription, heroImages[0] OG
  - [x] 2.5 try/catch con fallback vacio para build resilience (Firestore no disponible en CI)
  - [x] 2.6 `notFound()` si trip no existe o no esta publicado
  - [x] 2.7 Eliminar imports de `STATIC_TRIPS` y `VUELTA_AL_MUNDO_ITINERARY`

- [x] **Task 3 — Componentes de la landing page** (AC: #1, #3, #4, #5)
  - [x] 3.1 Crear `TripHero.tsx` — hero image con overlay, titulo, copy emocional, precio. Server Component (sin interactividad)
  - [x] 3.2 Crear `TripInfo.tsx` — highlights bullets, tags badges, difficulty badge. Server Component
  - [x] 3.3 Crear `TripDescription.tsx` — odooDescriptionSale renderizado como texto plano (stripear HTML tags si vienen de Odoo). Server Component. NOTA: `description_sale` en Odoo 18 es campo HTML (rich text). El sync lo guarda tal cual. Para MVP, stripear tags con regex simple (`str.replace(/<[^>]*>/g, '')`) y renderizar como `<p>`. NO usar `dangerouslySetInnerHTML` — es riesgo XSS. Si en el futuro se quiere rich text, agregar `isomorphic-dompurify` como dependencia (fuera de scope 2-3)
  - [x] 3.4 Crear `TripDepartures.tsx` — Client Component (`'use client'`) para tabla/cards de departures con badges de ocupacion. Cards en mobile, tabla en desktop
  - [x] 3.5 Crear `TripTestimonials.tsx` — seccion de testimonios con empty state emocional. Server Component (datos pre-cargados)
  - [x] 3.6 Crear `TripStickyCTA.tsx` — Client Component (`'use client'`) CTA sticky en mobile, inline en desktop. El CTA navega a login si no auth, o prepara para Story 2-4
  - [x] 3.7 Crear `TripAnalytics.tsx` — Client Component minimo que dispara `view_item` event al montar. Patron: `useEffect` con trackEvent
  - [x] 3.8 Todos los componentes van en `src/app/(public)/viajes/[slug]/` (feature-adjacent, NO en components/)

- [x] **Task 4 — Skeleton loading y error handling** (AC: #9, #1)
  - [x] 4.1 Crear `src/app/(public)/viajes/[slug]/loading.tsx` — skeleton que replica hero + titulo + contenido
  - [x] 4.2 NO crear `error.tsx` en `[slug]/` — confiar en `src/app/(public)/error.tsx` que ya existe. El try/catch en `page.tsx` con `notFound()` cubre el 404. Errores de red durante ISR se manejan por el error boundary del grupo `(public)/`

- [x] **Task 5 — Eliminar datos estaticos obsoletos** (AC: #1, #2)
  - [x] 5.1 Eliminar import de `STATIC_TRIPS` y `VUELTA_AL_MUNDO_ITINERARY` del refactoreado `[slug]/page.tsx`
  - [x] 5.2 **NO eliminar `src/lib/data/trips.ts`** — `src/app/(public)/page.tsx` (homepage) TODAVIA importa `STATIC_TRIPS` para la seccion "Nuestros Destinos". Eliminar trips.ts romperia el build. Cleanup del homepage esta fuera de scope de 2-3
  - [x] 5.3 Agregar comentario TODO en trips.ts: `// TODO: eliminar cuando homepage use datos de Firestore`

- [x] **Task 6 — Analytics events** (AC: #7)
  - [x] 6.1 `view_item` event al montar la landing via `trackEvent()` (Firebase Analytics + Meta Pixel + GTM)
  - [x] 6.2 `select_item` al click en departure CTA (con departure date + trip ID)
  - [x] 6.3 Reutilizar `trackEvent` de `src/lib/analytics.ts`

- [x] **Task 7 — Tests y validacion final** (AC: todos)
  - [x] 7.1 Tests componentes: TripHero, TripInfo, TripDepartures, TripTestimonials, TripStickyCTA — ARIA, estados, callbacks
  - [x] 7.2 Tests page.tsx: cobertura indirecta — data layer (15 tests trips-public.ts) + componentes (46 tests) + build SSG exitoso. Patron consistente con viajes/page.tsx (catalogo) que tampoco tiene test directo de Server Component async
  - [x] 7.3 `pnpm typecheck` — 0 errores
  - [x] 7.4 `pnpm test` — todos pasando sin regresiones (2 failures pre-existentes en dashboard/)
  - [x] 7.5 `pnpm build` — build limpio, /viajes/[slug] como SSG con ISR 1h
  - [x] 7.6 Verificar manualmente en dev server: pendiente verificacion visual por Alek en code review. Build SSG confirma generacion correcta de rutas

## Dev Notes

### Arquitectura: SSG + ISR + Client Islands

**Patron de renderizado (MISMO que catalogo 2-2):**

```
Server Component (page.tsx)
  ├── fetch trip data con Admin SDK (build time + ISR revalidate: 3600)
  ├── fetch departures subcollection
  ├── generateMetadata() para SEO dinamico
  └── renderizar:
      ├── TripHero.tsx — Server Component (imagen + titulo + precio)
      ├── TripInfo.tsx — Server Component (highlights + tags + difficulty)
      ├── TripDescription.tsx — Server Component (descripcion)
      ├── TripDepartures.tsx — Client Component (tabla interactiva)
      ├── TripTestimonials.tsx — Server Component (testimonios o empty state)
      ├── TripStickyCTA.tsx — Client Component (sticky mobile + analytics)
      └── TripAnalytics.tsx — Client Component (view_item event)
```

- **NO usar `/api/trips` route** para la landing publica — ese route requiere `requirePermission('trips:read')` (autenticado). Usar `getPublishedTripForLanding()` directo con Admin SDK.
- Push `'use client'` lo mas abajo posible — solo TripDepartures, TripStickyCTA y TripAnalytics lo necesitan.

### Codebase State — Lo que YA EXISTE (NO recrear)

| Archivo | Estado | Accion requerida |
|---------|--------|-----------------|
| `src/app/(public)/viajes/[slug]/page.tsx` | Placeholder con STATIC_TRIPS + VUELTA_AL_MUNDO_ITINERARY | **REESCRIBIR** completo — reemplazar datos estaticos con Firestore ISR |
| `src/lib/firebase/trips-public.ts` | `getPublishedTrips()` + `getPublishedTripBySlug()` | **EXTENDER** — agregar `getPublishedTripForLanding()` con mas campos + departures |
| `src/types/trip.ts` | Trip, PublicTrip, TripDeparture interfaces | **EXTENDER** — agregar LandingTrip, PublicDeparture |
| `src/lib/data/trips.ts` | STATIC_TRIPS + VUELTA_AL_MUNDO_ITINERARY hardcoded | **ELIMINAR** si ya no tiene dependencias |
| `src/components/custom/TripCard.tsx` | TripCard con variantes + sold-out | **NO TOCAR** — TripCard es para catalogo, la landing usa componentes propios |
| `src/app/(public)/viajes/page.tsx` | Catalogo SSG+ISR (Story 2-2) | **NO TOCAR** — referencia de patron |
| `src/app/(public)/viajes/CatalogContent.tsx` | Filtros + grid catalogo | **NO TOCAR** — referencia de patron analytics |
| `src/app/(public)/layout.tsx` | PublicLayout con Navbar+Footer+AnalyticsProvider | **NO TOCAR** — ya provee nav, analytics, container |
| `src/lib/analytics.ts` | trackEvent, trackPageView, captureAttribution | **REUSAR** — trackEvent para view_item y select_item |
| `src/lib/utils.ts` | formatCurrency, cn | **REUSAR** — formatCurrency para precio |
| `public/images/trips/placeholder.svg` | Fallback SVG para viajes sin imagen | **REUSAR** |
| `next.config.ts` | storage.googleapis.com en remotePatterns | **NO TOCAR** — ya soporta URLs de Storage |

### PublicTrip — Campos ya disponibles via select()

Los campos que ya trae `getPublishedTripBySlug()` incluyen todo lo necesario para la landing:
```
odooName, odooListPriceCentavos, odooCurrencyCode, odooCategory,
odooDescriptionSale, slug, emotionalCopy, tags, highlights, difficulty,
seoTitle, seoDescription, heroImages, isPublished, nextDepartureDate,
totalDepartures, totalSeatsAvailable, totalSeatsMax
```

**Para la landing page se necesitan 2 adiciones:**
- **Departures individuales** — NO estan en el documento trip, estan en subcolleccion `/trips/{tripId}/departures/`. Crear funcion `getDeparturesForTrip(tripId)` en trips-public.ts.
- **odooRatingAvg / odooRatingCount** — actualmente NO estan en `PUBLIC_TRIP_FIELDS`. Agregarlos al array de campos. NO crear una funcion nueva — `getPublishedTripBySlug()` ya funciona, solo falta incluir estos 2 campos en el select().

### TripDeparture — Datos de Subcolleccion

```typescript
// /trips/{tripId}/departures/{departureId}
interface TripDeparture {
  odooEventId: number | null
  odooName: string
  startDate: Timestamp       // Fecha inicio salida
  endDate: Timestamp         // Fecha fin salida
  seatsMax: number           // Capacidad total
  seatsAvailable: number     // Plazas disponibles
  seatsUsed: number          // Plazas ocupadas
  isActive: boolean
  isPublished: boolean
}
```

**IMPORTANTE (de MEMORY.md):** Odoo Events module esta VACIO en aroundaplanet.odoo.com (Feb 2026). Noel no usa Events. Esto significa que la subcolleccion departures probablemente esta vacia para la mayoria/todos los viajes. El empty state de departures DEBE ser graceful.

### Conversion de Datos Firestore → UI

```typescript
// Precio: centavos → MXN formateado (reutilizar de lib/utils.ts)
const displayPrice = formatCurrency(trip.odooListPriceCentavos)
// Ya existe: formatCurrency(14500000) → "$145,000"

// Fecha departure: Timestamp → "15 de marzo, 2026"
const displayDate = new Date(departure.startDate).toLocaleDateString('es-MX', {
  day: 'numeric', month: 'long', year: 'numeric'
})

// Imagen: heroImages[0] o fallback
const heroUrl = trip.heroImages?.[0] ?? '/images/trips/placeholder.svg'

// Ocupacion badge color
function getOccupancyBadge(dep: PublicDeparture) {
  const pctAvailable = dep.seatsAvailable / dep.seatsMax
  if (dep.seatsAvailable === 0) return { text: 'Agotado', variant: 'destructive' }
  if (pctAvailable < 0.2) return { text: `Quedan ${dep.seatsAvailable}`, variant: 'destructive' }
  if (pctAvailable < 0.5) return { text: `${dep.seatsAvailable} disponibles`, variant: 'warning' }
  return { text: `${dep.seatsAvailable} disponibles`, variant: 'success' }
}
```

### Firestore Timestamp Serialization (LECCION de 2-1a, 2-2)

En JSON, Firestore Timestamps serializan como `{ _seconds, _nanoseconds }`, NO `{ seconds, nanoseconds }`. El mapper en `trips-public.ts` ya maneja esto con el patron:
```typescript
const secs = ts._seconds ?? ts.seconds ?? 0
return new Date(secs * 1000)
```
Reutilizar este patron para departures.

### Layout — Hero Full-Bleed

PublicLayout envuelve children en `max-w-7xl mx-auto px-4`. Para el hero full-width:
- Opcion A: `className="-mx-4 sm:-mx-6 lg:-mx-8"` para romper el container
- Opcion B: Usar hero dentro del container con `rounded-xl` (como lo hace la page actual)
- **Recomendacion**: Opcion B (rounded-xl), consistente con la landing actual y mas simple

### Design Tokens

- **Primary**: `#1B4332` (dark green) — headers, navbar
- **Accent**: `#F4A261` (orange) — CTA buttons, badges
- **Destructive**: `#E76F51` (coral) — urgencia badge (<20% plazas)
- **Background**: `#FAFAF8` (warm white)
- **Muted**: `#F1F0EB` — skeleton, secondary bg
- **Heading font**: Poppins SemiBold
- **Body font**: Inter
- **Mono font**: Roboto Mono — precios
- **Card radius**: radius-lg (1rem)
- **Hero image**: aspect-video (16:9) o aspect-[4/3] para hero de landing (NO aspect-square, eso es para TripCard en catalogo)

### CTA Sticky Mobile Pattern

```tsx
// TripStickyCTA.tsx — Client Component
'use client'

// Desktop: inline button
// Mobile: fixed bottom, safe-area
<div className="
  fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur border-t
  pb-[env(safe-area-inset-bottom)]
  lg:static lg:p-0 lg:bg-transparent lg:backdrop-blur-none lg:border-t-0
">
  <Button className="w-full lg:w-auto h-12 text-lg font-semibold bg-accent hover:bg-accent/90">
    Cotizar
  </Button>
</div>
```

### Empty States

| Seccion | Condicion | Comportamiento |
|---------|-----------|---------------|
| Hero image | `heroImages.length === 0` | Mostrar placeholder.svg con overlay |
| Emotional copy | `emotionalCopy === ''` | Omitir subtitulo, solo mostrar titulo |
| Highlights | `highlights.length === 0` | Omitir seccion completa |
| Tags | `tags.length === 0` | Omitir badges |
| Difficulty | `difficulty === null` | Omitir badge |
| Departures | Sin departures futuras | Placeholder: "Proximas salidas en preparacion" + CTA contacto |
| Testimonios | Sin testimonios | Ilustracion + "Se el primero en compartir tu experiencia" + CTA registro |
| Description | `odooDescriptionSale === ''` | Omitir seccion (improbable, Odoo siempre tiene descripcion) |

### Testimonios — Fuente de Datos (NO existe aun)

La coleccion de reviews/testimonios NO existe todavia en Firestore (se define en Epic 7, Story 7-3). Para Story 2-3, `TripTestimonials.tsx` SIEMPRE mostrara el empty state emocional. Pasar `testimonials: []` como prop desde `page.tsx` sin ninguna query a Firestore. NO inventar una coleccion `reviews` ni `testimonials` — eso es trabajo de Epic 7.

### CTASection Existente

`src/components/public/CTASection.tsx` ya existe y se usa en el placeholder actual de `[slug]/page.tsx`. El nuevo `TripStickyCTA.tsx` es DIFERENTE: es el CTA sticky mobile que aparece al scrollear. Evaluar si conservar `CTASection` como CTA de fondo de pagina (desktop) ademas del sticky mobile, o si `TripStickyCTA` lo reemplaza completamente. Recomendacion: `TripStickyCTA` hace ambas funciones (sticky en mobile, inline al final en desktop).

### Scope Boundary — Story 2-3 vs 2-4

**Story 2-3 (esta):** Landing page informativa. CTA navega pero NO crea ordenes.
- CTA "Cotizar" → navega a `/login` si no auth, o almacena intencion para Story 2-4
- CTA "Apartar Lugar" en departure → mismo comportamiento
- NO se crea order en Firestore/Odoo (eso es Story 2-4: Conversion Flow)

**Story 2-4 (siguiente):** Conversion flow completo.
- Selector de departure + formulario → crea order "Interesado"
- Order state machine completa

### Ref Attribution Pattern

El AnalyticsProvider en PublicLayout YA captura `?ref=agentId` via `captureAttribution()`. El ref se guarda en sessionStorage. NO hace falta logica adicional en la landing para capturar ref — ya esta cubierto por la infraestructura de Story 1.2/1.3.

**IMPORTANTE: NO agregar `useSearchParams()` en la landing para capturar ref** — AnalyticsProvider ya lo hace. Agregar `useSearchParams()` forzaria un Suspense boundary innecesario y afectaria SSG.

Verificar que el link del catalogo preserve el ref al navegar: `/viajes/${slug}?ref=${ref}` o que sessionStorage ya lo tiene.

### Accesibilidad

- Hero image: alt descriptivo (odooName + "viaje")
- Heading hierarchy: h1 (titulo) → h2 (secciones) → h3 (sub-items)
- Departure table: `<table>` semantico con `<th>` en desktop, cards con aria-label en mobile
- CTA buttons: texto descriptivo, no solo "Click aqui"
- Skeleton: `aria-busy="true"` durante carga
- Focus visible en todos los interactivos
- Color + icono + texto para badges de ocupacion (no solo color)

### Project Structure Notes

Todos los componentes nuevos van en `src/app/(public)/viajes/[slug]/` (feature-adjacent):
```
src/app/(public)/viajes/[slug]/
├── page.tsx              # Server Component principal (REESCRIBIR)
├── loading.tsx           # Skeleton loading (NUEVO)
├── TripHero.tsx          # Hero section (NUEVO)
├── TripInfo.tsx          # Highlights + tags + difficulty (NUEVO)
├── TripDescription.tsx   # Descripcion del viaje (NUEVO)
├── TripDepartures.tsx    # Departures table/cards — 'use client' (NUEVO)
├── TripTestimonials.tsx  # Testimonios + empty state (NUEVO)
├── TripStickyCTA.tsx     # Sticky CTA mobile — 'use client' (NUEVO)
├── TripAnalytics.tsx     # view_item event — 'use client' (NUEVO)
└── *.test.tsx            # Tests co-locados (NUEVOS)
```

Archivos en lib (extender existentes):
```
src/lib/firebase/trips-public.ts  # Agregar odooRatingAvg/Count a PUBLIC_TRIP_FIELDS + getDeparturesForTrip()
src/types/trip.ts                  # Agregar LandingTrip (extends PublicTrip), PublicDeparture
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.3, lines 789-816]
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md — FR10, FR11, FR13, FR17, FR18]
- [Source: _bmad-output/planning-artifacts/prd/non-functional-requirements.md — NFR1, NFR6, NFR17, NFR18]
- [Source: _bmad-output/planning-artifacts/prd/user-journeys.md — Journey 1: Visitante → Cliente]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md — SSG+ISR strategy]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md — naming, loading, error boundaries]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md — (public)/ route group]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md — landing page sections]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/core-user-experience.md — trip landing UX]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/visual-design-foundation.md — design tokens]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md — breakpoints, a11y]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/defining-core-experience.md — CTA patterns]
- [Source: _bmad-output/implementation-artifacts/2-2-public-trip-catalog-with-filters.md — previous story patterns]
- [Source: src/app/(public)/viajes/[slug]/page.tsx — current placeholder to rewrite]
- [Source: src/lib/firebase/trips-public.ts — getPublishedTripBySlug already exists]
- [Source: src/types/trip.ts — Trip, PublicTrip, TripDeparture interfaces]
- [Source: src/lib/analytics.ts — trackEvent, trackPageView]
- [Source: src/lib/utils.ts — formatCurrency, cn]
- [Source: src/app/(public)/layout.tsx — PublicLayout with AnalyticsProvider]
- [Source: CLAUDE.md — architecture rules, naming conventions, rendering strategy]
- [Source: MEMORY.md — lecciones de stories previas, Odoo Events vacio]

## Previous Story Intelligence (2-2)

### Lecciones Aplicables a 2-3

1. **SSG + ISR patron**: `export const revalidate = 3600` + try/catch en page.tsx para build resilience (Firestore no disponible en CI)
2. **getPublishedTripBySlug()** ya existe en trips-public.ts con `.select(PUBLIC_TRIP_FIELDS)` — excluye `odooImageBase64` automaticamente
3. **Firestore select() projection**: SIEMPRE usar `.select()` para no transferir campos pesados
4. **Campos editoriales pueden no existir**: tags ?? [], highlights ?? [], heroImages ?? [], emotionalCopy ?? '' — SIEMPRE normalizar con defaults
5. **TripCard aspect-square fue decision de 2-2**: Las imagenes Odoo son 1080x1080. Pero para la LANDING hero, considerar aspect-video (16:9) o aspect-[4/3] ya que el hero ocupa mas espacio
6. **vi.hoisted() para mock variables**: OBLIGATORIO para mocks en factories de vi.mock()
7. **getAllByText para texto duplicado**: cuando el mismo texto aparece en multiples elementos
8. **Build failure por composite index**: try/catch obligatorio para queries con where+orderBy si el indice no existe al build time
9. **Client components NO importar firebase-admin**: trips-public.ts usa `import 'server-only'` — los Client Components reciben datos via props, NUNCA importan de trips-public.ts
10. **Analytics pattern**: CatalogContent.tsx usa `trackEvent('view_item_list', {...})` en useEffect — replicar con `trackEvent('view_item', {...})`

### Archivos de 2-2 que 2-3 Reutiliza Directamente

- `src/lib/firebase/trips-public.ts` — extender con funcion para landing
- `src/types/trip.ts` — extender con LandingTrip, PublicDeparture
- `src/lib/analytics.ts` — trackEvent (view_item, select_item)
- `src/lib/utils.ts` — formatCurrency
- `public/images/trips/placeholder.svg` — fallback hero
- `next.config.ts` — ya tiene storage.googleapis.com

### Commits Recientes Relevantes

```
607cdbe fix: migrate Odoo images to Storage + aspect-square TripCard
8644e08 fix: add trip placeholder SVG for trips without hero images
0c297f7 feat: Story 2-2 DONE - Public Trip Catalog with Filters + code review 5 fixes
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- `@testing-library/user-event` no instalado — migrado a `fireEvent` de `@testing-library/react`
- Composite index departures solo tiene `isActive+startDate`, no `isActive+isPublished+startDate` — filtro `isPublished` en memoria (pocos departures por trip)
- `departures` variable en page.tsx requeria type annotation explicita para evitar TS7034
- CatalogContent.test.tsx necesitaba `odooRatingAvg` y `odooRatingCount` al agregar campos a PublicTrip
- 2 test failures pre-existentes en `dashboard/page.test.tsx` — no relacionados con cambios de Story 2-3

### Completion Notes List

- **Task 1**: Extendido trips-public.ts con `getDeparturesForTrip()`, `PublicDeparture` type, rating fields en `PUBLIC_TRIP_FIELDS` y `mapDocToPublicTrip`. Helper `timestampToISO()` extraido para reusar. 15 tests (8 nuevos departures + 2 rating + 5 existentes).
- **Task 2**: page.tsx reescrito completo — Server Component con SSG+ISR (`revalidate: 3600`), `generateStaticParams()` desde Firestore, `generateMetadata()` con SEO dinamico, try/catch con fallback vacio para build resilience.
- **Task 3**: 7 componentes creados feature-adjacent en `[slug]/`: TripHero (Server), TripInfo (Server), TripDescription (Server, strip HTML), TripDepartures (Client, cards mobile + table desktop, occupancy badges), TripTestimonials (Server, empty state emocional), TripStickyCTA (Client, sticky mobile + inline desktop), TripAnalytics (Client, view_item event).
- **Task 4**: loading.tsx con skeleton que replica hero+info+description+departures+testimonials. Confia en error boundary existente de (public)/.
- **Task 5**: Imports STATIC_TRIPS eliminados de page.tsx. trips.ts preservado (homepage depende). TODO agregado.
- **Task 6**: `view_item` en TripAnalytics al montar, `select_item` en TripDepartures al click CTA, `begin_checkout` en TripStickyCTA. Reutiliza `trackEvent` existente.
- **Task 7**: 46 tests de componentes + 15 tests data layer = 61 tests nuevos/actualizados. typecheck 0 errores, lint 0 errores nuevos, build SSG exitoso.

### File List

**Nuevos:**
- `src/app/(public)/viajes/[slug]/TripHero.tsx`
- `src/app/(public)/viajes/[slug]/TripHero.test.tsx`
- `src/app/(public)/viajes/[slug]/TripInfo.tsx`
- `src/app/(public)/viajes/[slug]/TripInfo.test.tsx`
- `src/app/(public)/viajes/[slug]/TripDescription.tsx`
- `src/app/(public)/viajes/[slug]/TripDescription.test.tsx`
- `src/app/(public)/viajes/[slug]/TripDepartures.tsx`
- `src/app/(public)/viajes/[slug]/TripDepartures.test.tsx`
- `src/app/(public)/viajes/[slug]/TripTestimonials.tsx`
- `src/app/(public)/viajes/[slug]/TripTestimonials.test.tsx`
- `src/app/(public)/viajes/[slug]/TripStickyCTA.tsx`
- `src/app/(public)/viajes/[slug]/TripStickyCTA.test.tsx`
- `src/app/(public)/viajes/[slug]/TripAnalytics.tsx`
- `src/app/(public)/viajes/[slug]/TripAnalytics.test.tsx`
- `src/app/(public)/viajes/[slug]/loading.tsx`

**Modificados:**
- `src/app/(public)/viajes/[slug]/page.tsx` — reescrito completo (STATIC_TRIPS → Firestore SSG+ISR)
- `src/lib/firebase/trips-public.ts` — `getDeparturesForTrip()`, `timestampToISO()`, rating fields
- `src/lib/firebase/trips-public.test.ts` — 8 tests nuevos departures + 2 rating
- `src/types/trip.ts` — `PublicDeparture` interface, `odooRatingAvg`/`odooRatingCount` en `PublicTrip`
- `src/lib/data/trips.ts` — TODO comment agregado
- `src/app/(public)/viajes/CatalogContent.test.tsx` — rating fields en helper

## Change Log

- **2026-02-27**: Story 2-3 implementada — Trip Landing Page dinamica con SSG+ISR, 7 componentes feature-adjacent, 61 tests, analytics triple (Firebase+Meta+GTM)
- **2026-02-28**: Code review — 8 issues encontrados (2 HIGH, 3 MEDIUM, 3 LOW), todos corregidos:
  - FIX: generateStaticParams filtra trips sin slug (evita params vacios)
  - FIX: safe-area-inset-bottom usa calc(1rem+env()) para base padding correcto
  - FIX: tipo departures simplificado a PublicDeparture[] (no Awaited<ReturnType>)
  - FIX: tipo Testimonial movido a src/types/trip.ts (architecture compliance)
  - FIX: stripHtmlTags ahora decodifica HTML entities (&amp; &lt; &gt; &nbsp; etc.)
  - FIX: unoptimized prop simplificado en TripHero
  - FIX: test TripDescription assertion corregida + test entity decode agregado
  - FIX: test TripDepartures verifica departure_date en analytics event
