# Story 2.2: Public Trip Catalog with Filters

Status: done

## Story

As a **visitante anonimo**,
I want **navegar un catalogo de viajes disponibles con filtros por destino, precio y mes de salida**,
so that **pueda encontrar el viaje perfecto para mis intereses y presupuesto sin necesidad de registrarme**.

## Acceptance Criteria

### AC1: Catalogo renderiza grid de TripCards con datos reales de Firestore

**Given** un visitante navega a `/viajes`
**When** la pagina carga
**Then** ve un grid de TripCard components con:
- Imagen hero real del viaje (heroImages[0] de Firestore, NOT static placeholder)
- Titulo del viaje (odooName)
- Precio en Roboto Mono (odooListPriceCentavos convertido a MXN con formato $XXX,XXX)
- Proxima fecha de salida (nextDepartureDate formateada como "Marzo 2026")
- Destino como badge (odooCategory o tags[0])
**And** la pagina renderiza como SSG con ISR `revalidate: 3600` para SEO (NFR1, NFR18)
**And** el grid es responsive: 1 col mobile, 2 cols tablet (`md:`), 3 cols desktop (`lg:`)
**And** la Floating Navbar incluye link "Viajes" activo apuntando a esta pagina
**And** SOLO se muestran viajes con `isPublished === true`

### AC2: Filtros inline tipo chips sin boton "Aplicar"

**Given** el catalogo esta desplegado
**When** el visitante aplica filtros
**Then** puede filtrar por:
- **Destino**: chips derivados de los valores unicos de `odooCategory` en los viajes cargados
- **Rango de precio**: chips predefinidos (ej: "Hasta $50K", "$50K-$100K", "$100K+")
- **Mes de salida**: chips derivados de los meses unicos de `nextDepartureDate`
**And** los filtros activos muestran como chips con icono X para deseleccionar
**And** los resultados filtrados se actualizan en tiempo real (sin boton "Aplicar", sin page reload)
**And** multiples filtros se combinan con logica AND
**And** el filtrado opera en memoria sobre los datos ya cargados (client-side, <200 trips)

### AC3: Viaje agotado muestra badge "Agotado" y CTA disabled

**Given** un viaje tiene `totalSeatsAvailable === 0` en todas sus departures
**When** aparece en el catalogo
**Then** el TripCard muestra badge "Agotado" superpuesto en la imagen
**And** el CTA "Cotizar" aparece visualmente disabled (color muted, no clickeable)
**And** el viaje agotado SIGUE visible en el grid (no se oculta)

### AC4: Skeleton loading y empty state

**Given** la pagina esta cargando datos
**When** aun no se han obtenido los trips
**Then** muestra grid de skeleton cards que replican la forma de TripCard (imagen 16:9 + lineas de texto)
**And** skeletons usan `animate-pulse` (NUNCA spinner generico, NUNCA pantalla blanca)

**Given** no hay viajes publicados
**When** la pagina carga sin resultados
**Then** muestra un empty state emocional con ilustracion + mensaje + CTA de contacto
**And** NUNCA muestra "No hay datos disponibles"

### AC5: SEO metadata y analytics events

**Given** un visitante llega al catalogo
**When** la pagina renderiza
**Then** tiene metadata SEO correcta (title, description, Open Graph)
**And** dispara `view_item_list` en Firebase Analytics
**And** dispara equivalentes en Meta Pixel (`ViewContent`) y Google Tag Manager

**Given** un visitante hace click en una TripCard
**When** navega al detalle del viaje
**Then** dispara `select_item` en Firebase Analytics con el trip ID
**And** preserva UTMs de URL en sessionStorage para atribucion futura (FR13, FR60)

### AC6: Performance publica

**Given** la pagina del catalogo
**When** se mide con Lighthouse
**Then** LCP < 2.5s (NFR1)
**And** TTI < 3.5s en red 4G (NFR6)
**And** imagenes hero usan `next/image` con WebP y `sizes` prop para responsive
**And** la pagina se sirve desde CDN sin carga de servidor (NFR18)

## Tasks / Subtasks

- [x] **Task 1 — Fuente de datos Firestore para ISR** (AC: #1, #6)
  - [x] 1.1 Crear `src/lib/firebase/trips-public.ts` — funciones server-only para leer trips publicados directamente de Firestore con Admin SDK (NO usar API route que requiere auth)
  - [x] 1.2 Funcion `getPublishedTrips()` que retorne trips con `isPublished === true`, ordenados por `odooName`, excluyendo `odooImageBase64` (campo multi-MB)
  - [x] 1.3 Funcion `getPublishedTripBySlug(slug)` para pagina de detalle (preparacion para Story 2-3)
  - [x] 1.4 Tipo `PublicTrip` — subset de `Trip` con solo los campos necesarios para el catalogo publico (sin campos admin/sync internos)
  - [x] 1.5 Tests unitarios para funciones de lectura (mock Admin SDK) — 7 tests

- [x] **Task 2 — Actualizar TripCard para datos reales** (AC: #1, #3)
  - [x] 2.1 Actualizar `TripCardProps` interface para aceptar `PublicTrip` (compatible con Trip de Firestore, no solo StaticTrip)
  - [x] 2.2 Agregar estado `sold-out`: badge "Agotado" en la imagen + CTA disabled
  - [x] 2.3 Mostrar precio desde `odooListPriceCentavos` (centavos → formato MXN)
  - [x] 2.4 Mostrar proxima fecha de salida formateada (Timestamp → "Marzo 2026")
  - [x] 2.5 Mostrar imagen hero desde `heroImages[0]` con fallback a placeholder WebP
  - [x] 2.6 Mantener backward-compatibility con `StaticTrip` (no romper `/viajes/[slug]` que aun usa static) — TripCard props shape compatible con ambos
  - [x] 2.7 Hover `translateY(-4px)` solo en `lg:` (ya implementado, deshabilitado para sold-out)
  - [x] 2.8 Tests: skeleton loading, sold-out state, variantes, a11y (ARIA labels) — 8 nuevos tests

- [x] **Task 3 — Componente de filtros inline** (AC: #2)
  - [x] 3.1 Crear `src/app/(public)/viajes/CatalogContent.tsx` — Client Component (`'use client'`) que incluye filtros + grid
  - [x] 3.2 Chips de destino: generados dinamicamente de valores unicos de `odooCategory`
  - [x] 3.3 Chips de rango de precio: predefinidos ("Hasta $50K", "$50K-$100K", "Mas de $100K")
  - [x] 3.4 Chips de mes de salida: generados de meses unicos de `nextDepartureDate`
  - [x] 3.5 Filtrado AND en memoria (no fetch al servidor)
  - [x] 3.6 Chips activos con badge accent y X para deseleccionar
  - [x] 3.7 Boton "Limpiar filtros" cuando hay filtros activos
  - [x] 3.8 URL search params sync (filtros persisten en URL via useSearchParams + router.replace)
  - [x] 3.9 Tests: filtrado, combinaciones, deseleccion, empty state post-filtro — 10 tests

- [x] **Task 4 — Pagina del catalogo con ISR** (AC: #1, #4, #5, #6)
  - [x] 4.1 Refactorear `src/app/(public)/viajes/page.tsx` — reemplazar `STATIC_TRIPS` con `getPublishedTrips()` + ISR `revalidate: 3600`
  - [x] 4.2 Page como Server Component, delegar filtros a Client Component hijo (push `'use client'` lo mas abajo posible)
  - [x] 4.3 Grid responsive: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
  - [x] 4.4 Metadata SEO: title, description, Open Graph via `createMetadata()`
  - [x] 4.5 Skeleton loading state via `loading.tsx` + `CatalogSkeleton.tsx`
  - [x] 4.6 Empty state emocional cuando no hay viajes publicados
  - [x] 4.7 UTM capture via `AnalyticsProvider.captureAttribution()` (ya activo en PublicLayout)

- [x] **Task 5 — Analytics events** (AC: #5)
  - [x] 5.1 `view_item_list` event al montar el catalogo via `trackEvent()` (Firebase Analytics + Meta Pixel + GTM)
  - [x] 5.2 `select_item` event al clickear TripCard (con trip ID, nombre, precio, categoria)
  - [x] 5.3 UTM capture ya activo via `AnalyticsProvider` en PublicLayout (captureAttribution en useEffect)
  - [x] 5.4 Reusado `trackEvent` de `src/lib/analytics.ts` (ya dispara a gtag + fbq + dataLayer)

- [x] **Task 6 — Navbar link "Viajes"** (AC: #1)
  - [x] 6.1 Verificado: Navbar ya tiene link "Viajes" → `/viajes` (NAV_LINKS en Navbar.tsx linea 17)
  - [x] 6.2 No requerido (ya existia)
  - [x] 6.3 Tests existentes de Navbar cubren links — 7 tests pasando

- [x] **Task 7 — Tests de integracion y validacion final** (AC: todos)
  - [x] 7.1 `pnpm typecheck` — 0 errores
  - [x] 7.2 `pnpm test` — 834 passed (2 pre-existentes dashboard failures, no regresiones)
  - [x] 7.3 `pnpm build` — build limpio, /viajes como Static con ISR 1h
  - [x] 7.4 ISR verificado: `revalidate: 3600` en page.tsx, build output muestra `1h` TTL
  - [x] 7.5 Performance: next/image con WebP + sizes, SSG+ISR, no client-side data fetching

## Dev Notes

### Arquitectura: SSG + ISR + Client-side Filtering

**La decision critica de esta story es el patron de renderizado:**

```
Server Component (page.tsx)
  ├── fetch datos de Firestore con Admin SDK (build time + ISR revalidate: 3600)
  ├── renderizar metadata SEO
  └── pasar trips como props a:
      └── Client Component (CatalogFilters.tsx) — 'use client'
          ├── filtros inline (chips)
          ├── grid de TripCards
          └── analytics events
```

- **NO usar `/api/trips` route** para el catalogo publico — ese route requiere `requirePermission('trips:read')` (autenticado). Para SSG/ISR necesitamos leer Firestore directamente con Admin SDK en Server Component.
- Crear funcion server-only `getPublishedTrips()` en `src/lib/firebase/trips-public.ts`
- Los filtros son 100% client-side en memoria porque el dataset es pequeno (<200 trips)

### Codebase State — Lo que YA EXISTE (NO recrear)

| Archivo | Estado | Accion requerida |
|---------|--------|-----------------|
| `src/app/(public)/viajes/page.tsx` | Placeholder con STATIC_TRIPS | **REFACTOREAR** — reemplazar datos estaticos con Firestore ISR |
| `src/app/(public)/viajes/[slug]/page.tsx` | Placeholder con STATIC_TRIPS | **NO TOCAR** en esta story (es Story 2-3), pero considerar que comparten datos |
| `src/components/custom/TripCard.tsx` | Funcional con 4 variantes + framer-motion | **EXTENDER** — agregar sold-out state, adaptar props a PublicTrip |
| `src/lib/data/trips.ts` | STATIC_TRIPS hardcoded | **NO ELIMINAR aun** — [slug]/page.tsx aun lo usa hasta Story 2-3 |
| `src/app/api/trips/route.ts` | Admin API con auth | **NO TOCAR** — es para panel admin, no para publico |
| `src/types/trip.ts` | Trip interface completa | **REUSAR** — crear PublicTrip como Pick<Trip, ...> |
| `src/schemas/tripSchema.ts` | Schemas de admin | **REUSAR** lo que aplique |
| `src/app/(public)/layout.tsx` | PublicLayout con Navbar+Footer | **NO TOCAR** |
| `src/components/shared/Navbar.tsx` | Floating navbar | **VERIFICAR** link "Viajes" |

### Conversion de Datos Firestore → UI

```typescript
// Precio: centavos → MXN formateado
const displayPrice = formatCurrency(trip.odooListPriceCentavos) // ya existe en lib/utils

// Fecha: Timestamp → "Marzo 2026"
const displayDate = trip.nextDepartureDate
  ? new Date(trip.nextDepartureDate._seconds * 1000).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  : 'Proximamente'

// Imagen: heroImages[0] o fallback
const heroUrl = trip.heroImages?.[0] ?? '/images/trips/placeholder.webp'

// Sold out: totalSeatsAvailable === 0
const isSoldOut = trip.totalSeatsAvailable === 0 && trip.totalDepartures > 0
```

### Firestore Timestamp Serialization (LECCION DE 2-1a)

En JSON, Firestore Timestamps serializan como `{ _seconds, _nanoseconds }`, NO `{ seconds, nanoseconds }`. Usar helper que maneje ambos formatos:

```typescript
function timestampToDate(ts: { _seconds?: number; seconds?: number }): Date {
  const secs = ts._seconds ?? ts.seconds ?? 0
  return new Date(secs * 1000)
}
```

### TripCard — Cambios Requeridos

El TripCard actual (`src/components/custom/TripCard.tsx`) tiene interface:
```typescript
interface TripCardProps {
  trip: { title: string; slug: string; imageUrl: string; price: number; dates: string; destination: string }
  variant?: 'public' | 'agent' | 'client' | 'compact'
  href?: string
  onClick?: () => void
  className?: string
}
```

Necesita adaptarse para tambien aceptar `PublicTrip` (datos reales de Firestore). Opciones:
- **Opcion A**: Hacer la interface generica y mapear datos en el padre (catalogo pasa props individuales)
- **Opcion B**: Aceptar union type `StaticTrip | PublicTrip` con adaptador interno

**Recomendacion**: Opcion A — el padre mapea los datos al shape existente de TripCard. Asi TripCard permanece como componente presentacional puro. Agregar solo `isSoldOut?: boolean` como prop.

### Design Tokens (del Design System, Story 1.1b)

- **Primary**: `#1B4332` (dark green)
- **Accent**: `#F4A261` (orange) — CTA buttons, badges
- **Background**: `#FAFAF8` (warm white)
- **Muted foreground**: para textos secundarios (fechas, descripciones)
- **Mono font**: Roboto Mono para precios
- **Heading font**: Poppins para titulos
- **Card radius**: `radius-lg` (1rem / 16px)
- **Shadow**: `shadow-sm` para cards, hover eleva a `shadow-md`

### Filtros — Patron Visual

```tsx
// Chip activo
<Badge variant="outline" className="bg-accent/10 border-accent text-primary cursor-pointer gap-1">
  {label} <X className="h-3 w-3" />
</Badge>

// Chip inactivo
<Badge variant="outline" className="cursor-pointer hover:bg-muted transition-colors">
  {label}
</Badge>
```

### Analytics — Helpers Existentes

Verificar `src/lib/analytics/` para helpers de Firebase Analytics, Meta Pixel y GTM. El `AnalyticsProvider` ya esta en PublicLayout. Reusar el patron de eventos de Story 1.2.

### Performance: next/image sizes prop

```tsx
// TripCard hero image en grid catalog
<Image
  src={heroUrl}
  alt={trip.title}
  fill
  className="object-cover"
  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>
```

### Project Structure Notes

- Alineacion con estructura existente: archivos nuevos van en `src/app/(public)/viajes/` y `src/lib/firebase/`
- Tests co-locados: `CatalogFilters.test.tsx` junto a `CatalogFilters.tsx`
- El componente de filtros vive en la carpeta de la ruta, no en components/
- Schemas publicos (si se necesitan) van en `src/schemas/`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2-2]
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md — FR10, FR11, FR13, FR14, FR18, FR19, FR20, FR59-61]
- [Source: _bmad-output/planning-artifacts/prd/non-functional-requirements.md — NFR1, NFR6, NFR17, NFR18]
- [Source: _bmad-output/planning-artifacts/prd/user-journeys.md — Journey 1, Journey 3]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md — SSG+ISR strategy]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md — naming, loading, error boundaries]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md — (public)/ route group]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md — TripCard anatomy]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/core-user-experience.md — catalogo UX]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md — breakpoints]
- [Source: _bmad-output/implementation-artifacts/2-1b-admin-trip-crud-document-uploads.md — previous story]
- [Source: src/types/trip.ts — Trip interface, TripDeparture]
- [Source: src/components/custom/TripCard.tsx — current TripCard implementation]
- [Source: src/app/(public)/viajes/page.tsx — current catalog placeholder]
- [Source: src/app/api/trips/route.ts — admin API route (NOT for public use)]
- [Source: src/lib/data/trips.ts — STATIC_TRIPS to be replaced]
- [Source: CLAUDE.md — architecture rules, naming conventions, rendering strategy]
- [Source: MEMORY.md — lecciones de stories previas, acuerdos de equipo]

## Previous Story Intelligence (2-1b)

### Lecciones Aplicables a 2-2

1. **useEffect deps estables**: Nunca poner objetos/funciones en deps array — usar IDs primitivos (ej: `[tripId]` no `[trip]`)
2. **Zod safeParse obligatorio**: NUNCA `as Type` en datos de Firestore
3. **Firestore docs sin campos editoriales**: Sync solo crea campos odoo*, los editoriales pueden no existir. SIEMPRE normalizar con defaults (tags ?? [], heroImages ?? [], etc.)
4. **POST responses → 201**: Si esta story crea endpoints POST
5. **Client components NO importar firebase-admin**: Extraer helpers client-safe a archivos separados
6. **Firestore composite index**: Si se necesita query con `where()` + `orderBy()` en campos distintos, agregar a `firestore.indexes.json`
7. **Pagination append, no overwrite**: Si se implementa infinite scroll en catalogo
8. **`odooImageBase64` excluir del response**: Es multi-MB, nunca enviarlo al cliente

### Archivos de 2-1b que 2-2 Reutiliza

- `src/types/trip.ts` — Trip, TripDeparture interfaces
- `src/schemas/tripSchema.ts` — Schemas existentes
- `src/lib/utils/slugify.ts` — generateSlug
- `src/lib/firebase/storage.ts` — uploadFile, deleteFile, getPublicUrl
- `src/lib/firebase/admin.ts` — Admin SDK inicializado
- `src/app/api/trips/route.ts` — referencia de como se leen trips (patron de query)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TripCard test: `getByText('Agotado')` multiple matches → fixed with `getAllByText` (badge + CTA both render "Agotado")
- CatalogContent test: `mockTrackEvent` undefined before init → fixed with `vi.hoisted()` pattern
- CatalogContent test: `getByText('Asia')` multiple matches (filter chip + TripCard badge) → fixed with `getAllByText`
- Build failure: Firestore composite index `isPublished + odooName` not available at build time → added try/catch in page.tsx for build resilience
- Deployed Firestore indexes: `firebase deploy --only firestore:indexes`

### Completion Notes List

1. **PublicTrip type** separada de Trip para evitar import de firebase-admin en Client Components
2. **trips-public.ts** usa `import 'server-only'` + Admin SDK directo (no API route autenticada)
3. **TripCard** extendido con `isSoldOut` prop, `TripCardSkeleton`, placeholder image — backward compatible
4. **CatalogContent** combina filtros + grid en un solo Client Component (no CatalogFilters separado)
5. **3 tipos de filtro**: destino (dinamico), precio (predefinido), mes salida (dinamico) — todos como chips
6. **URL params sync**: `destino`, `precio`, `mes` via useSearchParams + router.replace
7. **Analytics**: view_item_list on mount, select_item on card click
8. **SSG + ISR**: revalidate 3600, Server Component fetch con try/catch para build resilience
9. **838 tests pass**, typecheck clean, build clean, lint clean (16 pre-existing warnings)

### Code Review Fixes (5 issues, 5 fixed)

1. **[HIGH] select_item analytics para sold-out** — CatalogContent.tsx: skip handleTripClick para cards sold-out (onClick=undefined en li)
2. **[MEDIUM] Firestore select() projection** — trips-public.ts: .select(...PUBLIC_TRIP_FIELDS) excluye odooImageBase64 y otros campos pesados del wire transfer
3. **[MEDIUM] Filter behavior tests** — CatalogContent.test.tsx: +4 tests (filter by destination, filter by price, AND logic, sold-out no fires select_item)
4. **[MEDIUM] aria-live en results count** — CatalogContent.tsx: aria-live="polite" en conteo de resultados filtrados
5. **[LOW] Dead aria-disabled en span CTA** — TripCard.tsx: removed (siempre undefined en esa rama)

### File List

**New files:**
- `src/lib/firebase/trips-public.ts` — Server-only Firestore reader (getPublishedTrips, getPublishedTripBySlug)
- `src/lib/firebase/trips-public.test.ts` — 7 tests
- `src/app/(public)/viajes/CatalogContent.tsx` — Client Component: filters + grid + analytics
- `src/app/(public)/viajes/CatalogContent.test.tsx` — 14 tests (10 original + 4 code review)
- `src/app/(public)/viajes/CatalogSkeleton.tsx` — Skeleton loading grid
- `src/app/(public)/viajes/loading.tsx` — Next.js loading state

**Modified files:**
- `src/types/trip.ts` — Added PublicTrip interface
- `src/components/custom/TripCard.tsx` — Added isSoldOut, TripCardSkeleton, placeholder image
- `src/components/custom/TripCard.test.tsx` — Added 8 new tests (sold-out, skeleton, placeholder)
- `src/app/(public)/viajes/page.tsx` — Rewritten: static → ISR with Firestore data
- `package.json` — Added server-only dependency
