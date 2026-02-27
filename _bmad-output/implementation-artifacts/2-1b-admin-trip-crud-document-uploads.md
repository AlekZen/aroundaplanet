# Story 2.1b: Admin Trip CRUD & Document Uploads

Status: ready-for-dev

## Story

As an **Admin/SuperAdmin**,
I want to manage trips from the platform with rich content and documents,
So that the catalog is complete and clients have access to trip materials.

## Acceptance Criteria

### AC1: Trip List with Filters
**Given** an Admin is logged in and navigates to `/admin/trips`
**When** the page loads
**Then** they see a table (desktop) / card list (mobile) of all trips from Firestore `/trips`
**And** each row shows: trip name, price, published status, departure count, last sync date
**And** inline chip filters: Todos | Publicados | Borradores | Con Salidas
**And** search by trip name (in-memory, <200 docs)
**And** skeleton loading states on initial load

### AC2: Edit Trip Editorial Fields (FR18)
**Given** an Admin clicks "Editar" on a trip
**When** the edit form opens (full page at `/admin/trips/[tripId]`)
**Then** they can edit editorial fields: heroImages, emotionalCopy, slug, tags, highlights, difficulty, seoTitle, seoDescription
**And** Odoo-synced fields (odooName, odooListPriceCentavos, etc.) are displayed read-only with lock icon
**And** `slug` auto-generates from `odooName` (kebab-case) on first edit, admin can override
**And** changes auto-save with debounce (500ms) per section
**And** toast feedback: "Viaje actualizado" / error with retry
**And** editorial completeness indicator shows progress (e.g., "4/7 campos completados")
**And** trips with 0 editorial fields show motivational empty state: "Este viaje necesita tu toque creativo"

### AC3: Publish/Unpublish Trips (FR16)
**Given** an Admin views a trip
**When** they toggle the publish status
**Then** the `isPublished` field updates in Firestore
**And** published trips appear in the public catalog, unpublished do not
**And** confirmation dialog before unpublishing a currently-published trip

### AC4: Hero Image Upload (FR18)
**Given** an Admin is editing a trip
**When** they upload hero images
**Then** images are uploaded to Firebase Storage at `trips/{tripId}/hero/{filename}`
**And** client-side validation: WebP/JPG/PNG, max 5MB per image, max 5 images
**And** server-side validation mirrors client rules
**And** image URLs stored in `heroImages: string[]` in Firestore trip document (ordered array, position 0 = hero principal for TripCard/landing)
**And** drag-and-drop reorder supported to control which image is the hero principal
**And** preview shown immediately (object URL), replaced with Storage URL on upload complete
**And** delete existing images supported

### AC5: Document Upload (FR53)
**Given** an Admin is editing a trip
**When** they upload documents (contracts, itineraries, vouchers)
**Then** PDFs are uploaded to Firebase Storage at `trips/{tripId}/documents/{filename}`
**And** client-side validation: PDF only, max 10MB, max 10 documents per trip
**And** document metadata stored in Firestore trip document: `documents: Array<{name, url, type, uploadedAt}>`
**And** documents can be deleted by admin
**And** these documents are what clients download in Story 7.2

### AC6: Departure Date Management (FR17)
**Given** an Admin is editing a trip
**When** they manage departure dates
**Then** they see existing departures from `/trips/{tripId}/departures` subcollection
**And** they can create new departures manually: startDate, endDate, seatsMax
**And** they can edit seatsMax on existing departures
**And** they can deactivate departures (isActive=false)
**And** departures synced from Odoo show "Odoo" badge and sync fields are read-only
**Note:** event.event is currently empty in Odoo. Manual departure creation enables business operations until Noel populates Odoo Events.

### AC7: API Routes for Trip CRUD
**Given** API routes exist
**When** called with proper auth
**Then:**
- `GET /api/trips` — list trips with pagination (cursor-based), search, filters. Auth: requirePermission('trips:read')
- `GET /api/trips/[tripId]` — single trip with departures. Auth: requirePermission('trips:read')
- `PATCH /api/trips/[tripId]` — update editorial fields. Auth: requirePermission('trips:edit'). Zod validation. NEVER touch odoo* fields.
- `POST /api/trips/[tripId]/images` — upload hero image. Auth: requirePermission('trips:edit'). FormData.
- `DELETE /api/trips/[tripId]/images/[imageId]` — delete hero image. Auth: requirePermission('trips:edit')
- `POST /api/trips/[tripId]/documents` — upload document. Auth: requirePermission('trips:edit'). FormData.
- `DELETE /api/trips/[tripId]/documents/[documentId]` — delete document. Auth: requirePermission('trips:edit')
- `POST /api/trips/[tripId]/departures` — create departure. Auth: requirePermission('trips:edit')
- `PATCH /api/trips/[tripId]/departures/[departureId]` — update departure. Auth: requirePermission('trips:edit')

### AC8: Tests
- Unit tests for: Zod schemas, API route handlers, storage helpers, UI components
- Coverage: CRUD happy paths, validation errors, auth denied, file upload/delete, departure CRUD
- `pnpm typecheck` passes with 0 errors
- `pnpm lint` passes without warnings

## Tasks / Subtasks

- [x] Task 1: Firebase Storage helpers + storage.rules (AC4, AC5)
  - [x] Create `src/lib/firebase/storage.ts` — GENERIC helpers: uploadFile(path, buffer, contentType), deleteFile(path), getPublicUrl(path), validateFile()
  - [x] Helpers are path-agnostic (caller constructs full path) for reuse in Epic 3 (payment receipts)
  - [x] Validate file type + size server-side (pass allowed types/max size as params)
  - [x] Updated `storage.rules` — added trips section: public read, admin/superadmin write, 10MB max
  - [x] Tests co-located: `storage.test.ts` — 12 tests
  - [x] Added `TripDocument` interface + `syncSource: 'odoo' | 'manual'` to TripDeparture

- [x] Task 2: Zod schemas for editorial updates (AC2, AC6)
  - [x] tripEditorialUpdateSchema (strict, slug kebab-case, SEO limits, difficulty nullable)
  - [x] tripDepartureCreateSchema (ISO dates, endDate > startDate refine, seatsMax 1-1000)
  - [x] tripDepartureUpdateSchema (strict, seatsMax + isActive optional)
  - [x] tripListQuerySchema (filter enum, coerce pageSize, search max 100)
  - [x] generateSlug helper (NFD normalize, diacritics removal, kebab-case)
  - [x] Tests co-located: extended `tripSchema.test.ts` — 64 total tests (+40 new)

- [x] Task 3: API Routes — Trip CRUD (AC7)
  - [x] GET /api/trips — list with cursor pagination + search + filters
  - [x] GET /api/trips/[tripId] — single trip with departures (Promise.all)
  - [x] PATCH /api/trips/[tripId] — editorial update (strict schema, never odoo*)
  - [x] POST /api/trips/[tripId]/images — hero image upload (max 5, 5MB)
  - [x] DELETE /api/trips/[tripId]/images/[imageId] — hero image delete
  - [x] POST /api/trips/[tripId]/documents — PDF upload (max 10, 10MB)
  - [x] DELETE /api/trips/[tripId]/documents/[documentId] — document delete
  - [x] POST /api/trips/[tripId]/departures — manual departure create (syncSource: 'manual')
  - [x] PATCH /api/trips/[tripId]/departures/[departureId] — update (Odoo fields read-only)
  - [x] Tests co-located: 8 test files, 68 tests

- [x] Task 4: Admin Trip List Page (AC1)
  - [x] `src/app/(admin)/admin/trips/page.tsx` — Server Component shell
  - [x] `src/app/(admin)/admin/trips/TripListPanel.tsx` — Client Component
  - [x] Desktop table + mobile cards
  - [x] Chip filters: Todos | Publicados | Borradores | Con Salidas
  - [x] Debounced search + skeleton loading + empty/error states
  - [x] Tests: `TripListPanel.test.tsx` — 8 tests

- [x] Task 5: Admin Trip Edit Page (AC2, AC3, AC4, AC5, AC6)
  - [x] `src/app/(admin)/admin/trips/[tripId]/page.tsx` — Server Component shell
  - [x] `src/app/(admin)/admin/trips/[tripId]/TripEditPanel.tsx` — Client Component
  - [x] Info Basica: slug auto-gen, emotionalCopy, difficulty
  - [x] Hero images: upload/preview/delete (next/image, position 0 = principal)
  - [x] Editorial completeness indicator + empty state
  - [x] SEO: seoTitle (70 max), seoDescription (160 max), tags, highlights
  - [x] Departures: list + create manual + toggle active
  - [x] Documents: upload PDF / delete
  - [x] Publish/unpublish toggle with confirmation dialog
  - [x] Auto-save with useAutoSave hook
  - [x] Odoo data sidebar (read-only with badge)
  - [x] Tests: `TripEditPanel.test.tsx` — 9 tests

- [x] Task 6: Firestore Security Rules update (AC4, AC5)
  - [x] storage.rules already had trips section from Task 1
  - [x] Public read, admin/superadmin write, 10MB max

- [x] Task 7: Typecheck + Lint + Tests finales (AC8)
  - [x] `pnpm typecheck` — 0 errors
  - [x] `pnpm lint` — 0 errors on new files
  - [x] 161 new tests pass (12 storage + 40 schemas + 68 API + 17 UI + 24 existing)
  - [x] Pre-existing dashboard test failures (2) not related to this story

## Dev Notes

### CRITICO: "Adivinar es Prohibido" (Acuerdo Epic 1 Retro)
No aplica query exploratoria Odoo para esta story — todo el CRUD es sobre campos editoriales en Firestore. Odoo sync ya esta resuelto en 2-1a.

### Trip Types YA EXISTEN — NO reinventar
`src/types/trip.ts` define Trip con campos editoriales:
```typescript
// Campos editoriales (NUNCA sobrescritos por sync)
heroImages: string[]
slug: string
emotionalCopy: string
tags: string[]
highlights: string[]
difficulty: 'easy' | 'moderate' | 'challenging' | null
seoTitle: string
seoDescription: string
```
Agregar campo `documents` al tipo Trip:
```typescript
documents: Array<{ name: string; url: string; type: string; uploadedAt: string }>
```

### Patron CRUD a seguir: UsersPanel (Story 1.6)
El patron probado en produccion:
1. **Container component** (TripListPanel.tsx): fetch state + callbacks
2. **Table component**: desktop view con sort/filter
3. **Card list**: mobile view alternativo
4. **Edit via Sheet (mobile) o page (desktop)**: form con secciones
5. **API fetch pattern**: `useCallback + fetch + setState`
6. **Auto-save**: `useAutoSave()` hook con debounce 500ms

### Patron de File Upload: profile-photo (Story 1.7)
Seguir exactamente el patron de `src/app/api/users/[uid]/profile-photo/route.ts`:
1. Client: validate type+size → preview (objectURL) → FormData POST
2. Server: requirePermission → validate → Buffer.from(arrayBuffer) → bucket.file().save() → makePublic() → update Firestore
3. Delete: bucket.file().delete() → remove URL from Firestore array

### Firebase Storage helpers NO EXISTEN — crear GENERICO
`src/lib/firebase/storage.ts` no existe. Crear helpers GENERICOS (reutilizables en Epic 3 para comprobantes de pago):
- `uploadFile(storagePath, buffer, contentType)` — upload + makePublic + return URL
- `deleteFile(storagePath)` — delete from Storage
- `getPublicUrl(storagePath)` — public URL construction
- Paths son strings completos, el caller construye: `trips/${tripId}/hero/${filename}`
Pattern: `https://storage.googleapis.com/{bucket}/{storagePath}`
**NO crear helpers trip-specific** — mantener generico para reuso futuro.

### storage.rules NO EXISTE — crear desde cero
El archivo `storage.rules` no existe en el repo. Crear con:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /trips/{tripId}/{allPaths=**} {
      allow read: if true;  // CDN publico
      allow write: if request.auth != null
                   && ('admin' in request.auth.token.roles
                       || 'superadmin' in request.auth.token.roles);
    }
    match /users/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
Desplegar con `firebase deploy --only storage`.

### API Route Structure (kebab-case folders, REST semantics)
```
src/app/api/trips/
  route.ts                    — GET list
  [tripId]/
    route.ts                  — GET single, PATCH editorial
    images/
      route.ts                — POST upload
      [imageId]/
        route.ts              — DELETE
    documents/
      route.ts                — POST upload
      [documentId]/
        route.ts              — DELETE
    departures/
      route.ts                — POST create
      [departureId]/
        route.ts              — PATCH update
```

### Auth Permissions ya existen en seed
Permisos en Firestore `/config/permissions/roles/{role}`:
- `trips:read` — Admin, Director, SuperAdmin
- `trips:create` — Admin, SuperAdmin
- `trips:edit` — Admin, SuperAdmin
Verificar que estos permisos estan en el seed. Si no, agregarlos.

### Departure Management — event.event VACIO
Hallazgo de Story 2-1a: event.event tiene 0 registros en Odoo. Departures subcollection esta preparada pero vacia.
Estrategia para 2-1b:
- Permitir crear departures MANUALES directamente en Firestore
- Departures manuales: `syncSource: 'manual'` (vs `syncSource: 'odoo'` para synced)
- Cuando Noel use Odoo Events, sync de 2-1a creara departures con `syncSource: 'odoo'`
- Admin puede editar seatsMax de departures manuales, pero no de Odoo-synced
- **IMPORTANTE**: `TripDeparture.syncSource` en `src/types/trip.ts` actualmente solo acepta `'odoo'`. Extender a `'odoo' | 'manual'`

### RoleSidebar ya tiene "Viajes" link
`src/components/custom/RoleSidebar.tsx` ya define:
```typescript
{ href: '/admin/trips', label: 'Viajes' }
```
La pagina `/admin/trips` no existe aun — crearla es parte de esta story.

### Naming Conventions (Architecture Law)
| Elemento | Convencion | Ejemplo |
|----------|-----------|---------|
| Page component | PascalCase | `TripListPanel.tsx`, `TripEditPanel.tsx` |
| API route | kebab-case folder | `/api/trips/[tripId]/images` |
| Schema | camelCase + Schema | `tripEditorialUpdateSchema` |
| Tests | co-located | `TripListPanel.test.tsx` next to `TripListPanel.tsx` |
| Constants | UPPER_SNAKE_CASE | `MAX_HERO_IMAGES`, `MAX_DOCUMENT_SIZE` |
| Handlers | handle* | `handlePublishToggle`, `handleImageUpload` |
| Callback props | on* | `onTripUpdated`, `onImageDeleted` |

### Anti-patterns Explicitos (NO hacer)
- **NO tocar campos odoo*** en PATCH — solo campos editoriales
- **NO usar doc.set() sin merge** — usar update() para editoriales o set({ merge: true })
- **NO subir imagenes al cliente** — FormData POST a API route, server sube a Storage
- **NO hardcodear permisos** — usar requirePermission() con permission strings
- **NO crear barrel exports** — importar directo
- **NO usar as Type** — SIEMPRE Zod safeParse para datos de request
- **NO usar Spinner generico** — Skeleton con pulse que replica forma del contenido
- **NO usar FieldValue.serverTimestamp() en response** — retornar ISO string

### Lecciones de Stories Anteriores (APLICAR)
| Leccion | Aplicar en |
|---------|-----------|
| mockReset() no clearAllMocks() | Todos los tests |
| vi.hoisted() para mock factories | Tests con mocks de Firebase |
| vi.unstubAllGlobals() en afterEach | Si se usa vi.stubGlobal |
| FieldValue.serverTimestamp() no serializable | API responses: ISO string |
| Firestore Timestamp serializa como {_seconds, _nanoseconds} | Helper para ambos formatos |
| Firestore update() en doc inexistente lanza NOT_FOUND | Verificar .exists antes |
| Promise.all para N reads paralelos | Fetch departures + trip en paralelo |
| Zod safeParse obligatorio en datos externos | NUNCA as TripUpdate |
| Fake timers incompatibles con waitFor | Usar real timers |
| jsdom no aplica CSS media queries | getAllByText en vez de getByText |
| className uppercase es solo visual | onChange toUpperCase() para slug |

### Project Structure Notes

**Archivos NUEVOS a crear:**
```
src/lib/firebase/storage.ts
src/lib/firebase/storage.test.ts
src/app/api/trips/route.ts
src/app/api/trips/route.test.ts
src/app/api/trips/[tripId]/route.ts
src/app/api/trips/[tripId]/route.test.ts
src/app/api/trips/[tripId]/images/route.ts
src/app/api/trips/[tripId]/images/route.test.ts
src/app/api/trips/[tripId]/images/[imageId]/route.ts
src/app/api/trips/[tripId]/images/[imageId]/route.test.ts
src/app/api/trips/[tripId]/documents/route.ts
src/app/api/trips/[tripId]/documents/route.test.ts
src/app/api/trips/[tripId]/documents/[documentId]/route.ts
src/app/api/trips/[tripId]/documents/[documentId]/route.test.ts
src/app/api/trips/[tripId]/departures/route.ts
src/app/api/trips/[tripId]/departures/route.test.ts
src/app/api/trips/[tripId]/departures/[departureId]/route.ts
src/app/api/trips/[tripId]/departures/[departureId]/route.test.ts
src/app/(admin)/admin/trips/page.tsx
src/app/(admin)/admin/trips/TripListPanel.tsx
src/app/(admin)/admin/trips/TripListPanel.test.tsx
src/app/(admin)/admin/trips/[tripId]/page.tsx
src/app/(admin)/admin/trips/[tripId]/TripEditPanel.tsx
src/app/(admin)/admin/trips/[tripId]/TripEditPanel.test.tsx
```

**Archivos EXISTENTES a modificar:**
```
src/types/trip.ts — Agregar campo documents al tipo Trip
src/schemas/tripSchema.ts — Agregar schemas editoriales + departure + query
src/schemas/tripSchema.test.ts — Tests para nuevos schemas
storage.rules — Agregar rules para trips Storage paths (si no existe, crear)
```

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-2, Story 2.1b]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Firestore-Security-Rules]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#API-Routes]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md]
- [Source: src/types/trip.ts — Trip type with editorial fields]
- [Source: src/schemas/tripSchema.ts — Existing Zod schemas]
- [Source: src/components/custom/RoleSidebar.tsx — "Viajes" nav item]
- [Source: src/app/api/users/[uid]/profile-photo/route.ts — File upload pattern]
- [Source: src/app/(superadmin)/superadmin/users/ — CRUD pattern reference]
- [Source: src/lib/odoo/sync/trip-sync.ts — Sync engine (2-1a)]
- [Source: CLAUDE.md#Critical-Implementation-Rules]
- [Source: MEMORY.md#Acuerdos-de-Equipo, Lecciones-Clave]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed AppError parameter order in storage.ts (status/retryable swapped)
- Fixed Blob→File in storage tests (FormDataEntryValue type)
- Fixed TripDeparture.odooEventId null guard in trip-sync.ts
- Fixed `as` cast → `as unknown as` in 8 test handleApiError mocks
- Fixed next/image mock in TripEditPanel test
- Fixed switch role query in unpublish dialog test

### Completion Notes List

- 161 new tests, 0 type errors, 0 lint errors
- Pre-existing: 2 dashboard test failures (unrelated)
- Drag-and-drop reorder for hero images not implemented (would need dnd-kit library)
- Image reorder can be done via PATCH heroImages array directly

### File List

**New files (28):**
- `src/lib/firebase/storage.ts` — Generic Firebase Storage helpers
- `src/lib/firebase/storage.test.ts` — 12 tests
- `src/app/api/trips/route.ts` — GET list
- `src/app/api/trips/route.test.ts` — 11 tests
- `src/app/api/trips/[tripId]/route.ts` — GET single + PATCH editorial
- `src/app/api/trips/[tripId]/route.test.ts` — 12 tests
- `src/app/api/trips/[tripId]/images/route.ts` — POST upload hero
- `src/app/api/trips/[tripId]/images/route.test.ts` — 6 tests
- `src/app/api/trips/[tripId]/images/[imageId]/route.ts` — DELETE hero
- `src/app/api/trips/[tripId]/images/[imageId]/route.test.ts` — 5 tests
- `src/app/api/trips/[tripId]/documents/route.ts` — POST upload doc
- `src/app/api/trips/[tripId]/documents/route.test.ts` — 7 tests
- `src/app/api/trips/[tripId]/documents/[documentId]/route.ts` — DELETE doc
- `src/app/api/trips/[tripId]/documents/[documentId]/route.test.ts` — 6 tests
- `src/app/api/trips/[tripId]/departures/route.ts` — POST create departure
- `src/app/api/trips/[tripId]/departures/route.test.ts` — 9 tests
- `src/app/api/trips/[tripId]/departures/[departureId]/route.ts` — PATCH departure
- `src/app/api/trips/[tripId]/departures/[departureId]/route.test.ts` — 13 tests
- `src/app/(admin)/admin/trips/page.tsx` — Trip list page
- `src/app/(admin)/admin/trips/TripListPanel.tsx` — Trip list client component
- `src/app/(admin)/admin/trips/TripListPanel.test.tsx` — 8 tests
- `src/app/(admin)/admin/trips/[tripId]/page.tsx` — Trip edit page
- `src/app/(admin)/admin/trips/[tripId]/TripEditPanel.tsx` — Trip edit client component
- `src/app/(admin)/admin/trips/[tripId]/TripEditPanel.test.tsx` — 9 tests

**Modified files (5):**
- `src/types/trip.ts` — Added TripDocument, syncSource on TripDeparture, odooEventId nullable
- `src/schemas/tripSchema.ts` — Added 4 schemas + generateSlug + documents omit
- `src/schemas/tripSchema.test.ts` — Added 40 new tests for editorial schemas
- `src/lib/odoo/sync/trip-sync.ts` — null guard for odooEventId
- `storage.rules` — Added trips section (public read, admin write)
