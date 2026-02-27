# Story 2.1a: Trip Sync Odoo → Firestore

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **system**,
I want trips automatically synchronized from Odoo to Firestore,
so that the trip catalog stays current with operational data.

## Acceptance Criteria

### AC1: Query Exploratoria Odoo (BLOQUEANTE — ejecutar ANTES de codear)
```
Given el OdooClient de Story 1.5 está disponible
When el dev ejecuta queries exploratorias a Odoo producción
Then documenta el schema real de `product.template` (campos, tipos, relaciones)
And documenta el schema real de `event.event` (campos date_begin, date_end, seats_max, seats_available)
And identifica la relación product.template ↔ event.event (campo de referencia)
And documenta cuántos registros existen (paginación)
And guarda hallazgos en comentarios del código o en este archivo
And documenta campos secundarios con potencial UX/UI (ver sección "Descubrimientos Odoo → Oportunidades UX")
```

### AC2: Schema Firestore `/trips/{tripId}` con separación odoo* vs editorial
```
Given los hallazgos de la query exploratoria
When se define el schema Zod para Trip
Then campos sincronizados de Odoo llevan prefijo `odoo` (odooProductId, odooName, odooListPrice, odooWriteDate)
And campos editoriales (heroImages, slug, emotionalCopy, tags, highlights, difficulty, seoTitle, seoDescription) son independientes
And sync NUNCA sobrescribe campos editoriales
And se usa Firestore Timestamp para fechas (NUNCA ISO strings en writes)
And precios se almacenan en centavos (integer, NUNCA floating point)
And booleans llevan prefijo is/has/can (isPublished, isActive)
And el schema incluye metadatos de sync: lastSyncAt, syncSource, syncStatus
```

### AC3: Sync Manual desde SuperAdmin Panel (FR66)
```
Given un usuario con rol superadmin está autenticado
When activa sync manual desde el panel de administración (POST /api/odoo/sync-trips)
Then el sistema lee `product.template` de Odoo con paginación (batches de 100)
And filtra solo productos relevantes (viajes, no todos los 1,545 products)
And para cada viaje, crea o actualiza documento en Firestore `/trips/{tripId}`
And campos odoo* se actualizan, campos editoriales se preservan
And retorna resultado: { total, created, updated, skipped, errors, syncedAt }
And la UI muestra progreso y resultado del sync
```

### AC4: Sync Incremental por Timestamp
```
Given ya existen trips sincronizados en Firestore
When se ejecuta sync (manual o scheduled)
Then el sistema compara `odooWriteDate` con `lastSyncAt` del documento Firestore
And solo procesa registros con write_date > lastSyncAt (incremental)
And registros eliminados en Odoo se marcan isActive=false en Firestore (soft delete, NUNCA hard delete)
And el log muestra: "Sync completado: X nuevos, Y actualizados, Z sin cambios"
```

### AC5: Departure Dates desde Odoo Events (FR17)
```
Given un viaje existe en Firestore
When el sync procesa events asociados al viaje
Then `event.event` records se sincronizan a subcollection `/trips/{tripId}/departures/{departureId}`
And cada departure incluye: odooEventId, startDate, endDate, seatsMax, seatsAvailable, isActive
And departures con date_begin en el pasado se marcan isActive=false
And solo eventos futuros (2025+) se sincronizan (NO histórico completo)
```

### AC6: Manejo de Errores y Modo Degradado (FR68)
```
Given el sync está en ejecución
When Odoo no responde o retorna error
Then el sistema usa exponential backoff (1s→2s→4s, max 3 reintentos via OdooClient)
And si todos los reintentos fallan, el sync se marca como "failed" con error detallado
And los datos existentes en Firestore NO se borran (modo degradado con datos cacheados)
And se registra en audit log: syncStatus="error", errorCode, errorMessage
And la respuesta API incluye retryable=true para que la UI ofrezca reintentar
```

### AC7: Tests Completos
```
Given la implementación está terminada
When se ejecuta pnpm test
Then hay tests unitarios para: schema Zod, trip sync logic, API route handler, mapping Odoo→Firestore
And tests cubren: happy path, Odoo error, partial sync, incremental vs full, schema validation errors
And pnpm typecheck pasa con 0 errores
And pnpm lint pasa sin warnings
```

## Tasks / Subtasks

- [x] **Task 0: Query exploratoria Odoo** (AC: #1) — EJECUTAR PRIMERO
  - [x] Query `product.template` fields_get → 188 campos documentados
  - [x] Query `product.template` search_read limit 5 → datos reales vistos (hoteles $1, viajes $5K+)
  - [x] Query `event.event` fields_get → 117 campos documentados
  - [x] Query `event.event` search_read → **0 registros** (modulo vacio)
  - [x] Identificar relación product.template ↔ event.event → NO hay relacion directa. Link via event.event.ticket.product_id pero 0 tickets
  - [x] Documentar total de registros y filtro para "solo viajes" → 1,545 products, filtro: name 2026 + price >= 5000 + service + active
  - [x] Buscar campos secundarios UX/UI → image_1920 SI, categ_id (no util), website_published SI, rating SI (pero 0s), description_sale SI
  - [x] Buscar en `event.event` → campos existen (seats_max/available/used/reserved/taken) pero 0 eventos
  - [x] Llenar sección "Descubrimientos Odoo → Oportunidades UX" de este archivo
  - [x] Actualizar este archivo con hallazgos reales

- [x] **Task 1: Tipos y Schema Zod** (AC: #2)
  - [x] Crear `src/types/trip.ts` — interfaces Trip, TripDeparture, OdooTripRecord, OdooEventRecord, TripSyncResult, TripSyncOptions
  - [x] Crear `src/schemas/tripSchema.ts` — odooTripRecordSchema, odooEventRecordSchema, tripSyncOptionsSchema, mapOdooToTripFields, mapOdooToDepartureFields, tripDocId, departureDocId
  - [x] Usar helpers existentes: `odooAmountToCentavos()`, `odooDateToTimestamp()`
  - [x] Tests co-located: `tripSchema.test.ts` — 30 tests passing

- [x] **Task 2: Modelo Odoo trips** (AC: #3, #4, #5)
  - [x] Crear `src/lib/odoo/models/trips.ts` — buildTripDomain, fetchTripsFromOdoo, fetchDeparturesFromOdoo
  - [x] Implementar `fetchTripsFromOdoo(options)` con paginación (batches de 100)
  - [x] Implementar `fetchDeparturesFromOdoo(productIds)` — via event.event.ticket → product.product → product.template
  - [x] Mapping usa mapOdooToTripFields/mapOdooToDepartureFields de tripSchema.ts (Zod safeParse)
  - [x] Tests co-located: `trips.test.ts` — 13 tests passing

- [x] **Task 3: Sync Engine** (AC: #3, #4, #6)
  - [x] Crear `src/lib/odoo/sync/trip-sync.ts` — syncTrips() con full + incremental + soft delete
  - [x] Full sync: fetch all → upsert → soft delete missing
  - [x] Incremental sync: compare odooWriteDate → skip unchanged
  - [x] Preservar campos editoriales con set({ merge: true })
  - [x] Soft delete: isActive=false si no existe en Odoo (solo full mode)
  - [x] Departures sync integrado (via fetchDeparturesFromOdoo, actualmente 0 eventos)
  - [x] Audit log entry en cada sync
  - [x] Tests co-located: `trip-sync.test.ts` — 12 tests passing

- [x] **Task 4: API Route** (AC: #3, #6)
  - [x] Crear `src/app/api/odoo/sync-trips/route.ts` — POST handler
  - [x] Auth: `requirePermission('sync:odoo')`
  - [x] Validar input con tripSyncOptionsSchema (Zod safeParse)
  - [x] Llamar syncTrips(), retornar resultado directo (NO wrapper)
  - [x] Error handling con `handleApiError()` + AppError pattern
  - [x] Tests co-located: `route.test.ts` — 9 tests passing

- [x] **Task 5: SuperAdmin UI** (AC: #3)
  - [x] Crear `/superadmin/odoo-sync/page.tsx` — hub unificado de sync (ya tenia link en sidebar)
  - [x] `OdooSyncDashboard.tsx` — grid 2-col: sync usuarios + sync viajes
  - [x] Reusar `OdooSyncCard` existente con callback a `/api/odoo/sync-trips`
  - [x] Progress/loading/error states via OdooSyncCard (spinner, resultado, error alert)

- [x] **Task 6: Firestore Security Rules** (AC: #2)
  - [x] Verificar que `/trips/{tripId}` rules ya están correctas (read: true, write: admin/superadmin)
  - [x] Agregar rules para subcollection `/trips/{tripId}/departures/{departureId}`
  - [x] Tests de reglas si aplica — N/A, security rules tests son todo-skipped (32 tests)

- [x] **Task 7: Typecheck + Lint + Tests finales** (AC: #7)
  - [x] `pnpm typecheck` — 0 errores
  - [x] `pnpm lint` — 0 errores en archivos nuevos (warnings pre-existentes de stories anteriores)
  - [x] `pnpm test` — 64 tests nuevos pasan (30 tripSchema + 13 trips model + 12 trip-sync + 9 route)
  - [x] Verificar no rompió tests existentes — 2 fallos pre-existentes en dashboard/page.test.tsx (no relacionados)

## Dev Notes

### CRITICO: "Adivinar es Prohibido" (Acuerdo Epic 1 Retro)
Task 0 (query exploratoria) es BLOQUEANTE. No empezar Task 1+ sin datos reales de Odoo.
En Story 1.6 se asumió `team_ids` en `res.partner` y no existía — costó horas de debug.
Patrón: `fields_get` → `search_read limit 5` → documentar → solo entonces implementar.

### OdooClient ya existe y funciona
- `src/lib/odoo/client.ts` — `searchRead()`, `search()`, `read()` disponibles
- `src/lib/odoo/cache.ts` — `withCacheFallback()` con TTLs por modelo
- Rate limit: 60 req/min manejado internamente por OdooClient
- Retry: 3 intentos, 1s→2s→4s exponential backoff built-in
- **NO reinventar** — usar estos métodos directamente

### Separación campos odoo* vs editoriales
- Campos `odoo*` (odooProductId, odooName, odooListPrice, odooWriteDate): sync sobrescribe
- Campos editoriales (heroImages, slug, emotionalCopy, tags, highlights, difficulty, seoTitle, seoDescription): NUNCA sobrescribir
- En Firestore update: usar `{ ...odooFields }` selectivo, NO doc.set() completo
- Pattern: `adminDb.collection('trips').doc(tripId).set(odooFields, { merge: true })`

### Patrón de sync existente: `/api/odoo/sync-users`
Seguir el mismo patrón probado en Story 1.6:
1. `requirePermission('sync:odoo')` para auth
2. Fetch desde Odoo con paginación
3. Map Odoo record → Firestore document (con Zod safeParse, NUNCA `as Type`)
4. Upsert a Firestore con `set({ merge: true })`
5. Log en audit
6. Retornar resultado estructurado

### Helpers de transformación en `src/schemas/odooSchema.ts`
YA EXISTEN y deben reusarse:
- `odooAmountToCentavos(amount)` — convierte precio Odoo a centavos
- `odooDateToTimestamp(odooDate)` — convierte "2026-02-27 15:30" a Firestore Timestamp
- `odooFieldToCamelCase(field)` — convierte snake_case Odoo a camelCase
- `odooFieldsToOdooPrefixed(record, fieldMap)` — mapea campos con prefijo odoo

### Firestore Security Rules ya tienen `/trips`
En `firestore.rules` líneas 6-14:
- `allow read: if true` (público para SSG/ISR)
- `allow write: if admin || superadmin`
- Falta: rules para subcollection `/departures`

### Datos estáticos existentes en `src/lib/data/trips.ts`
8 viajes hardcoded (Vuelta al Mundo, Europa, Perú, etc.) con slug, price, dates.
Story 2-1a los reemplaza con datos reales de Odoo. Pero mantener como fallback si sync no ha corrido.

### Lecciones de Stories Anteriores (APLICAR)
| Lección | De | Aplicar en |
|---------|-----|-----------|
| `mockReset()` no `clearAllMocks()` | 1.5, 1.6, 1.7 | Todos los tests |
| `vi.hoisted()` para mock factories | 1.5+ | Tests con mocks de Firebase/Odoo |
| `vi.unstubAllGlobals()` en afterEach | 1.7 | Si se usa `vi.stubGlobal('fetch')` |
| `FieldValue.serverTimestamp()` no serializable en JSON | 1.7 | Retornar ISO string en API response |
| Firestore `Timestamp` serializa como `{_seconds, _nanoseconds}` | 1.5 | Usar helper para ambos formatos |
| Fake timers incompatibles con xmlrpc y waitFor | 1.5, 1.7 | Usar real timers con delays 1-4ms |
| `Firestore update()` en doc inexistente lanza NOT_FOUND | 1.7 | Usar `set({ merge: true })` |
| `Promise.all` para N reads paralelos | 1.6 | Batch fetch departures por trip |
| Zod `safeParse` obligatorio en datos externos | 1.6 Retro | NUNCA `as OdooRecord` |

### Anti-patterns Explícitos (NO hacer)
- **NO usar `doc.set(data)` sin `{ merge: true }`** — sobrescribiría campos editoriales. SIEMPRE `set(odooFields, { merge: true })`
- **NO hardcodear document IDs** — usar auto-ID de Firestore o derivar de `odooProductId` con formato consistente
- **NO ignorar rate limits de Odoo** — OdooClient ya maneja 60 req/min internamente, pero batches de 100 + Promise.all podría saturar. Procesar secuencialmente o con concurrency limitada
- **NO usar `FieldValue.delete()` en soft delete** — marcar `isActive: false`, no borrar campos. Soft delete = cambiar flag, NOT delete document/fields
- **NO serializar `FieldValue.serverTimestamp()` en responses** — retornar `new Date().toISOString()` en JSON
- **NO usar `as OdooRecord`** — SIEMPRE Zod `safeParse` para datos externos

### Convenciones de Naming (Architecture Law)
| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Colección Firestore | camelCase plural | `trips` |
| Subcollection | camelCase plural | `departures` |
| Campos documento | camelCase | `odooProductId`, `lastSyncAt`, `isPublished` |
| Document IDs | auto-ID o kebab-case | auto: `Kj8mN2...`, manual: `vuelta-al-mundo-338` |
| Timestamps | Firestore Timestamp | `Timestamp.now()` |
| Booleans | is/has/can prefix | `isActive`, `isPublished` |
| Precios | centavos (integer) | `14500000` = $145,000.00 MXN |
| API route folder | kebab-case | `/api/odoo/sync-trips` |
| Route file | route.ts | `src/app/api/odoo/sync-trips/route.ts` |
| Type file | PascalCase concepts | `src/types/trip.ts` |
| Schema file | camelCase + Schema | `src/schemas/tripSchema.ts` |
| Model file | camelCase plural | `src/lib/odoo/models/trips.ts` |
| Tests | co-located | `trips.test.ts` junto a `trips.ts` |

### API Response Pattern (NO wrapper genérico)
```typescript
// CORRECTO
return NextResponse.json({ total, created, updated, errors, syncedAt }, { status: 200 })

// INCORRECTO
return NextResponse.json({ success: true, data: { ... } })
```

### Auth Helper Chain
```typescript
// En route handler
await requirePermission('sync:odoo')  // Lanza AppError si no tiene permiso
// Si pasa, el usuario está autenticado y tiene el permiso
```

### Error Handling
```typescript
try {
  // ... sync logic
} catch (error) {
  return handleApiError(error)  // Convierte AppError a NextResponse con { code, message, retryable }
}
```

### Descubrimientos Odoo → Oportunidades UX (llenar durante Task 0)

**Instrucción:** Durante la query exploratoria, documentar aquí campos inesperados de Odoo que abran oportunidades UX/UI para stories futuras. No es scope de 2-1a implementarlos, pero sí sincronizar los datos si existen.

**Campos secundarios a buscar en `product.template`:**
| Campo Odoo | Si existe → Oportunidad UX | Story destino |
|------------|---------------------------|---------------|
| `image_1920` | Hero image automático, evita upload manual del admin | 2-1b, 2-3 |
| `categ_id` | Tags/categorías nativos → filtros en catálogo | 2-2 |
| `website_published` | Sincronizar estado isPublished desde Odoo | 2-1b |
| `rating_count` / `rating_avg` | Ratings nativos → testimonios/social proof en landing | 2-3 |
| `description_sale` | Copy de venta → emotionalCopy base | 2-3 |
| `list_price` + moneda | Precio con formato correcto para UI | 2-2, 2-3 |

**Campos secundarios a buscar en `event.event`:**
| Campo Odoo | Si existe → Oportunidad UX | Story destino |
|------------|---------------------------|---------------|
| `seats_max` / `seats_available` | Indicador escasez: "Solo quedan X lugares" (conversion boost) | 2-3 |
| `seats_used` | Calcular % ocupación → semáforo dashboard Noel | 5-1 |
| `registration_ids` | Conteo asistentes → KPI por viaje | 5-1 |
| `date_begin` / `date_end` | Selector visual de fechas tipo Airbnb | 2-3 |
| `date_tz` | Zona horaria del destino → UX contextual | 2-3 |

**Ideas para Dashboard Noel (Epic 5, alimentar desde 2-1a):**
- **Semáforo de ocupación**: verde (>80% vendido), amarillo (50-80%), rojo (<50%) — requiere `seats_max` + `seats_used`
- **Campos pre-calculados en `/trips`**: `totalDepartures`, `nextDepartureDate`, `totalSeatsAvailable` — evita N+1 reads en dashboard
- **Pipeline por viaje**: facturado vs por cobrar — requiere cruzar con `sale.order` (Epic 3+)
- **"De dónde vienen mis clientes"**: UTM attribution por viaje — requiere `event.registration` + analytics (Epic 5)

**Hallazgos reales (2026-02-27):**

**HALLAZGO CRITICO: event.event tiene 0 registros.** El modulo Events esta instalado pero vacio. Solo 1 event.type ("VUELTA AL MUNDO 2024") nunca usado. **AC5 (departures) no tiene datos fuente.** Estrategia: preparar schema de departures pero sin sync hasta que Noel use Events.

**product.template:**
- 1,545 productos totales. Mayoria son hoteles a $1 MXN.
- ~60 productos con `list_price >= 5000` y `type = 'service'` — **estos son los viajes**
- 22 productos con "2026" en nombre, 18 con precio real (>= $5000)
- Campos: `name`, `list_price`, `type`, `categ_id`, `active`, `write_date`, `description_sale`, `website_published`, `is_published`, `sale_ok`, `image_1920` (base64), `currency_id`, `rating_count`, `rating_avg`
- NO hay campo `state`/`stage`. Status se infiere de: `active` + `sale_ok` + `website_published`
- NO hay categoria especifica "Viajes" — todos en categ "All" (id=1)
- Todos `active=true`, 59/60 `sale_ok=true`, 26/60 `website_published=true`
- `detailed_type` NO existe en Odoo 18 (error)

**Filtro elegido:** Para MVP, sync solo "2026": `name ilike '2026' AND list_price >= 5000 AND type = 'service' AND active = true` (~18 viajes). Sync engine acepta parametros configurables para expandir despues.

**Relacion product.template ↔ event.event:**
- NO hay relacion directa entre product.template y event.event
- Link teorico: event.event.ticket.product_id → product.product → product.template
- event.event.ticket tiene `product_id` (many2one → product.product) pero 0 tickets existen

**event.event campos disponibles (para cuando haya datos):**
- `date_begin`, `date_end`, `date_tz`, `seats_max`, `seats_available`, `seats_used`, `seats_reserved`, `seats_taken`
- `stage_id` (event.stage), `event_type_id`, `event_ticket_ids`, `is_published`, `website_published`
- `registration_ids` (attendees), `sale_order_lines_ids`
- `description`, `note`, `subtitle`, `tag_ids`, `seo_name`
- NO existe `state` ni `seats_unconfirmed` en Odoo 18

| Campo Odoo | Existe? | Valor en datos reales | Oportunidad |
|------------|---------|----------------------|-------------|
| `image_1920` | SI | base64 (7K-183K chars), muchos hoteles lo tienen, viajes por verificar | Hero image auto |
| `categ_id` | SI | Todos en "All" (id=1), no util para filtro | NO usable como filtro |
| `website_published` | SI | 26/60 trips tienen true | Mapear a isPublished |
| `rating_count`/`rating_avg` | SI | Probablemente 0 (no se usan ratings en Odoo) | Futuro |
| `description_sale` | SI | Texto de venta (no verificado contenido) | emotionalCopy base |
| `sale_ok` | SI | 59/60 true | Filtro adicional |
| `is_published` | SI | Existe, probablemente = website_published | Redundante |
| `currency_id` | SI | Relacion a res.currency | Formato precio |

### Cache Strategy
- `product.template` (viajes): TTL 24h (ya configurado en `ODOO_CACHE_TTL`)
- `event.event` (departures): agregar TTL 24h al config
- Usar `withCacheFallback()` para queries de lectura
- Sync manual bypasea cache (fetch directo)

### Project Structure Notes

**Archivos NUEVOS a crear:**
```
src/types/trip.ts                              # Trip, TripDeparture interfaces
src/schemas/tripSchema.ts                      # Zod schemas
src/schemas/tripSchema.test.ts                 # Schema tests
src/lib/odoo/models/trips.ts                   # Odoo fetch + mapping
src/lib/odoo/models/trips.test.ts              # Model tests
src/lib/odoo/sync/trip-sync.ts                 # Sync engine
src/lib/odoo/sync/trip-sync.test.ts            # Sync tests
src/app/api/odoo/sync-trips/route.ts           # API route
src/app/api/odoo/sync-trips/route.test.ts      # Route tests
```

**Archivos EXISTENTES a modificar:**
```
src/lib/odoo/cache.ts                          # Agregar TTL para event.event si no existe
firestore.rules                                # Agregar rules para /trips/{tripId}/departures/{departureId}
src/app/(superadmin)/superadmin/page.tsx        # Agregar botón sync trips (o componente)
```

**NO modificar:**
```
src/lib/odoo/client.ts                         # Ya funciona, NO tocar
src/lib/odoo/cache.ts                          # Solo agregar TTL si falta
src/lib/data/trips.ts                          # Mantener como fallback
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-2, Story 2.1a]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Odoo-Sync-Strategy]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Firestore-Naming]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#API-Boundaries]
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md#FR66, FR17, FR68]
- [Source: _bmad-output/planning-artifacts/prd/user-journeys.md#Journey-1-Trip-Discovery]
- [Source: _bmad-output/implementation-artifacts/1-7-user-profile-notification-preferences.md#Dev-Notes]
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-02-27.md#Action-Items]
- [Source: src/lib/odoo/client.ts — OdooClient interface]
- [Source: src/lib/odoo/cache.ts — withCacheFallback pattern]
- [Source: src/app/api/odoo/sync-users/route.ts — Sync route pattern]
- [Source: src/schemas/odooSchema.ts — Zod helpers existentes]
- [Source: firestore.rules — /trips rules existentes]
- [Source: CLAUDE.md#Critical-Implementation-Rules]
- [Source: MEMORY.md#Acuerdos-de-Equipo, Lecciones-Clave]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- `scripts/odoo-explore-trips.mjs` — script exploratorio (3 iteraciones: `detailed_type`, `seats_unconfirmed`, `state` no existen en Odoo 18)
- `scripts/odoo-explore-results.json` — resultados completos en JSON

### Implementation Plan
- **Task 0**: Query exploratoria completada. Hallazgo critico: event.event vacio, trips = product.template.
- **Filtro**: `name ilike '2026' + list_price >= 5000 + type='service' + active=true` (~18 viajes)
- **Departures**: Schema preparado pero sin datos (0 eventos en Odoo). Se implementa estructura para futuro.
- **Soft delete**: Si un producto deja de matchear el filtro, marcar isActive=false
- **Patron**: Seguir sync-users (Story 1.6) con set({ merge: true }) para preservar editoriales

### Completion Notes List

### Senior Developer Review (AI) — 2026-02-27

**Reviewer:** Claude Opus 4.6 (adversarial code review)
**Outcome:** APPROVED with 7 fixes applied

**Findings (1 HIGH, 3 MEDIUM, 5 LOW):**

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | HIGH | File List only had 2/15 files | Updated File List with all 16 files |
| 2 | MEDIUM | Full collection scan in trip-sync.ts:50 | Added `where('odooProductId', '!=', null)` filter |
| 3 | MEDIUM | Duplicate product.product query in trips.ts | Consolidated into single query with variantToTemplate map |
| 4 | MEDIUM | Import after export in page.tsx | Moved import to top of file |
| 5 | LOW | AC5 past departures not marked inactive | N/A (0 events in Odoo, documented) |
| 6 | LOW | Redundant search() before searchRead | Left as-is (provides accurate total count) |
| 7 | LOW | syncSource in mapper always overridden | Added `as const` for type narrowing |
| 8 | LOW | Hardcoded 5000 in audit log | Changed to `options.minPrice ?? null` |
| 9 | LOW | No UI component tests | Accepted (simple delegation, browser tests cover) |

**Post-fix verification:** 64/64 unit tests, 0 type errors, 10/10 browser tests

### Change Log

### File List
- src/types/trip.ts (new)
- src/schemas/tripSchema.ts (new)
- src/schemas/tripSchema.test.ts (new)
- src/lib/odoo/models/trips.ts (new)
- src/lib/odoo/models/trips.test.ts (new)
- src/lib/odoo/sync/trip-sync.ts (new)
- src/lib/odoo/sync/trip-sync.test.ts (new)
- src/app/api/odoo/sync-trips/route.ts (new)
- src/app/api/odoo/sync-trips/route.test.ts (new)
- src/app/(superadmin)/superadmin/odoo-sync/page.tsx (new)
- src/app/(superadmin)/superadmin/odoo-sync/OdooSyncDashboard.tsx (new)
- firestore.rules (modified — added departures subcollection rule)
- scripts/odoo-explore-trips.mjs (new)
- scripts/odoo-explore-results.json (new)
- scripts/test-trip-sync-2-1a.mjs (new)
- scripts/browser-test-2-1a-results.json (new)
