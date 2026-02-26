# Story 1.5: Odoo Client Abstraction Layer

Status: done

## Story

As a **system administrator**,
I want a reliable, abstracted connection to Odoo via XML-RPC,
So that business data flows between platforms without vendor lock-in and with graceful degradation.

## Acceptance Criteria

### AC1: OdooClient Core (FR64, FR67)

**Given** OdooClient is implemented in `src/lib/odoo/client.ts`
**When** the application needs Odoo data
**Then** it provides methods: `search`, `read`, `create`, `write`, `searchRead`, `readGroup`
**And** all XML-RPC calls go through Route Handlers `/api/odoo/*` — never from client-side code
**And** auth/authorization is validated via `requireAuth()` / `requireRole()` on every API request (NFR14)

### AC2: Resilience & Rate Limiting

**Given** Odoo XML-RPC is called
**When** network issues or rate limits occur
**Then** exponential backoff retry applies: 1s -> 2s -> 4s (max 3 attempts)
**And** rate limiting respects ~60 req/min with sequential queue (NO Promise.all for Odoo calls)
**And** `readGroup` uses kwargs (NOT positional args) for Odoo 18 compatibility
**And** pagination is implemented for datasets >100 records via `offset` + `limit`

### AC3: Data Conventions

**Given** data flows between Odoo and the application
**When** transforming Odoo responses
**Then** all amounts are stored as integer centavos — NEVER floating point (e.g., 145000.00 MXN = 14500000 centavos)
**And** all dates from Odoo `"YYYY-MM-DD HH:mm:ss"` are converted to Firestore `Timestamp`
**And** Odoo-synced fields use prefix `odoo`: `odooWriteDate`, `odooAmountTotal`, `odooOrderId`
**And** error codes use standardized `ODOO_*` pattern

### AC4: Caching & Graceful Degradation (FR68, NFR21)

**Given** Odoo is available
**When** data is read
**Then** results are cached in Firestore with model-specific TTL:
| Modelo Odoo | TTL | Justificacion |
|---|---|---|
| `product.product` (viajes) | 24h | Catalogo estable |
| `res.partner` (contactos) | 1h | Leads activos |
| `sale.order` (pedidos) | 15min | Status de pagos critico |
| `account.move` (facturas) | 1h | Data secundaria |
| KPI aggregations | 5min | Dashboard director |

**Given** Odoo does not respond within 5 seconds
**When** any Odoo-dependent feature is accessed
**Then** cached Firestore data is returned with staleness metadata (`{ data, cachedAt, isStale: true }`)
**And** the error is logged and the rest of the app continues operating (NFR29)

### AC5: Error Handling

**Given** any Odoo operation fails
**When** the error is caught
**Then** AppError pattern is followed: `{ code, message, retryable }`
**And** Route Handlers use `handleApiError()` from `src/lib/errors/handleApiError.ts`
**And** error codes include: `ODOO_AUTH_FAILED`, `ODOO_TIMEOUT`, `ODOO_RATE_LIMITED`, `ODOO_NOT_FOUND`, `ODOO_VALIDATION`, `ODOO_UNAVAILABLE`

## Tasks / Subtasks

- [x] Task 1: Instalar dependencias y configuracion (AC: 1, 2)
  - [x] 1.1 Instalar `xmlrpc` (1.3.2) + `@types/xmlrpc` (1.3.10)
  - [x] 1.2 Crear `src/config/odoo.ts` — constantes UPPER_SNAKE_CASE (TTLs, timeouts, retry config)
  - [x] 1.3 Verificar ODOO_URL, ODOO_DB, ODOO_API_KEY en `.env.local` y `apphosting.yaml`
  - [x] 1.4 Agregar ODOO_USERNAME en `.env.local`

- [x] Task 2: Core OdooClient abstraction (AC: 1, 2, 3)
  - [x] 2.1 Crear `src/lib/odoo/client.ts` — clase OdooClient + singleton `getOdooClient()`
  - [x] 2.2 Implementar `authenticate()` — XML-RPC a `/xmlrpc/2/common`, cachear uid
  - [x] 2.3 Implementar `executeKw()` — wrapper core para execute_kw en `/xmlrpc/2/object`
  - [x] 2.4 Implementar metodos: `search()`, `read()`, `searchRead()`, `create()`, `write()`
  - [x] 2.5 Implementar `readGroup()` con KWARGS (domain en args, fields/groupby/lazy en kwargs)
  - [x] 2.6 Implementar `withRetry()` — exponential backoff 1s->2s->4s, max 3 intentos
  - [x] 2.7 Implementar rate limiter — cola secuencial, max ~60 req/min

- [x] Task 3: Tipos y Zod schemas (AC: 1, 3)
  - [x] 3.1 Crear `src/types/odoo.ts` — OdooConfig, OdooRecord, OdooSearchOptions, OdooCacheEntry
  - [x] 3.2 Crear `src/schemas/odooSchema.ts` — schemas para validar inputs de API y transformaciones
  - [x] 3.3 Helpers de transformacion: `odooAmountToCentavos()`, `odooDateToTimestamp()`, `odooFieldToCamelCase()`, `odooFieldsToOdooPrefixed()`

- [x] Task 4: Cache layer con Firestore (AC: 4)
  - [x] 4.1 Crear `src/lib/odoo/cache.ts` — funciones de cache usando Firestore
  - [x] 4.2 Implementar `getCached(model, cacheKey)` — leer de Firestore, verificar TTL
  - [x] 4.3 Implementar `setCache(model, cacheKey, data)` — escribir con `cachedAt` timestamp
  - [x] 4.4 Implementar `withCacheFallback(model, cacheKey, fetchFn)` — try Odoo, fall back a cache en fallo

- [x] Task 5: Route Handler — API boundary (AC: 1, 5)
  - [x] 5.1 Crear `src/app/api/odoo/search-read/route.ts` — endpoint generico search_read
  - [x] 5.2 Proteger con `requireRole('admin')` (solo admin+ pueden hacer queries directos)
  - [x] 5.3 Validar input con Zod schema (model, domain, fields, limit, offset)
  - [x] 5.4 Retornar data directamente (SIN wrapper `{ success, data }`)
  - [x] 5.5 Manejar errores con `handleApiError()`

- [x] Task 6: Error handling ODOO_* (AC: 5)
  - [x] 6.1 Definir codigos: ODOO_AUTH_FAILED, ODOO_TIMEOUT, ODOO_RATE_LIMITED, ODOO_NOT_FOUND, ODOO_VALIDATION, ODOO_UNAVAILABLE
  - [x] 6.2 Mapear errores XML-RPC (faults) a AppError con codigos correctos
  - [x] 6.3 Asegurar `retryable` correcto: timeout->true, auth->false, rate_limited->true, validation->false

- [x] Task 7: Firestore Security Rules para cache (AC: 4)
  - [x] 7.1 Agregar regla para `odooCache/{model}/{document=**}` — read: authenticated, write: false (solo Admin SDK server-side)

- [x] Task 8: Tests unitarios (AC: todos)
  - [x] 8.1 `client.test.ts` — 22 tests: mock xmlrpc, auth, CRUD, retry, error mapping, singleton
  - [x] 8.2 `cache.test.ts` — 9 tests: TTL, staleness, fallback, graceful degradation
  - [x] 8.3 `route.test.ts` — 6 tests: auth, data return, validations, error propagation
  - [x] 8.4 `odooSchema.test.ts` — 21 tests: schema validation, centavos, dates, camelCase, prefixed

- [x] Task 9: Verificacion final (AC: todos)
  - [x] 9.1 `pnpm typecheck` — zero errores
  - [x] 9.2 `pnpm build` — exitoso con --webpack
  - [x] 9.3 `pnpm test` — 318 tests passing (58 nuevos), 0 failures
  - [x] 9.4 Crear script `scripts/test-odoo-client.mjs` para verificacion manual

## Dev Notes

### Stack Tecnico para esta Story

- **Transporte XML-RPC:** `xmlrpc` npm package (estable, probado, simple)
- **Tipos:** `@types/xmlrpc` (o declaracion local `.d.ts`)
- **Runtime:** Node.js (Route Handlers) — NO Edge Runtime (xmlrpc usa node:http)
- **Cache:** Firestore collection `odooCache/{model}/{documentId}`
- **Validacion:** Zod para datos externos (respuestas Odoo, inputs API)
- **Errores:** AppError existente (`src/lib/errors/AppError.ts`)

### Odoo 18 XML-RPC API

**Endpoints:**
- `/xmlrpc/2/common` — `authenticate(db, username, apiKey, {})` -> retorna uid (int)
- `/xmlrpc/2/object` — `execute_kw(db, uid, apiKey, model, method, [args], {kwargs})`

**Metodos via execute_kw:**
```
search(model, [domain], {offset, limit, order})          -> [ids]
read(model, [ids], {fields})                              -> [{record}]
search_read(model, [domain], {fields, offset, limit, order}) -> [{record}]
read_group(model, [domain], {fields, groupby, lazy})      -> [{group}]  *** KWARGS OBLIGATORIO EN ODOO 18 ***
create(model, [{values}], {})                             -> id
write(model, [ids, {values}], {})                         -> true
```

**Autenticacion:** API key se usa como `password` en la llamada authenticate(). El uid retornado se reutiliza en todas las llamadas subsecuentes.

**Rate limit:** ~60 req/min para Odoo Online SaaS. Las llamadas DEBEN ser secuenciales (no paralelas). Implementar cola FIFO.

**Paginacion:** `{offset: 0, limit: 100}` en kwargs. Maximo recomendado 100 por llamada.

### Patron Singleton (replicar firebase/admin.ts)

```typescript
// src/lib/odoo/client.ts — PATRON OBLIGATORIO
let odooClient: OdooClient | null = null

export function getOdooClient(): OdooClient {
  if (!odooClient) {
    const url = process.env.ODOO_URL
    const db = process.env.ODOO_DB
    const username = process.env.ODOO_USERNAME
    const apiKey = process.env.ODOO_API_KEY
    if (!url || !db || !username || !apiKey) {
      throw new AppError('ODOO_AUTH_FAILED', 'Faltan variables de entorno Odoo', 500, false)
    }
    odooClient = new OdooClient({ url, db, username, apiKey })
  }
  return odooClient
}
```

Referencia: `src/lib/firebase/admin.ts` (ver como inicializa el Admin SDK con ADC en prod y JSON en dev).

### Transformacion de Datos (Odoo -> Firestore)

```typescript
// Montos: float -> centavos (integer)
const amountCents = Math.round(odooRecord.amount_total * 100)
// 145000.50 MXN -> 14500050 centavos

// Fechas: string -> Firestore Timestamp
// Odoo retorna: "2026-02-26 14:30:00" (UTC)
import { Timestamp } from 'firebase-admin/firestore'
const ts = Timestamp.fromDate(new Date(odooDate.replace(' ', 'T') + 'Z'))

// Campos: snake_case -> camelCase con prefijo odoo
// id -> odooOrderId
// write_date -> odooWriteDate
// amount_total -> odooAmountTotal (en centavos)
```

### Route Handler (patron OBLIGATORIO de 1.4b)

```typescript
// src/app/api/odoo/search-read/route.ts
export async function POST(request: NextRequest) {
  try {
    const claims = await requireRole('admin')
    const body = await request.json()
    const { model, domain, fields, limit, offset } = odooSearchReadSchema.parse(body)
    const client = getOdooClient()
    const data = await client.searchRead(model, domain, fields, { limit, offset })
    return NextResponse.json(data)
  } catch (error) {
    return handleApiError(error)
  }
}
```

**Reglas del patron:**
- `requireAuth()` / `requireRole()` SIEMPRE al inicio
- Validar input con Zod ANTES de usar
- Retornar data directo en JSON (SIN `{ success: true, data }`)
- Catch con `handleApiError()` que serializa AppError

### Estructura de Archivos

```
src/
  config/
    odoo.ts                          # ODOO_CACHE_TTL, ODOO_TIMEOUT, ODOO_MAX_RETRIES, etc.
  lib/
    odoo/
      client.ts                      # OdooClient class + getOdooClient() singleton
      client.test.ts                 # Tests unitarios del cliente
      cache.ts                       # Cache Firestore con TTL por modelo
      cache.test.ts                  # Tests del cache
  types/
    odoo.ts                          # OdooConfig, OdooRecord, OdooSearchOptions, OdooCacheEntry
  schemas/
    odooSchema.ts                    # Zod schemas: odooSearchReadSchema, transformaciones
    odooSchema.test.ts               # Tests de schemas
  app/
    api/
      odoo/
        search-read/
          route.ts                   # POST — generic search_read proxy (admin+)
          route.test.ts              # Tests del endpoint
scripts/
  test-odoo-client.mjs              # Script Node para verificacion manual contra Odoo real
```

**Convenciones de naming:**
- Archivos modulo: camelCase (`client.ts`, `cache.ts`)
- Constantes: UPPER_SNAKE_CASE (`ODOO_CACHE_TTL`, `ODOO_MAX_RETRIES`)
- Tipos: PascalCase sin prefijo I (`OdooConfig`, `OdooSearchResult`)
- Schemas: camelCase + Schema suffix (`odooSearchReadSchema`)
- Error codes: UPPER_SNAKE_CASE strings (`'ODOO_TIMEOUT'`, `'ODOO_AUTH_FAILED'`)
- Tests: co-located (`client.test.ts` junto a `client.ts`)
- API routes: kebab-case folders (`/api/odoo/search-read`)

### Constantes de Configuracion

```typescript
// src/config/odoo.ts
export const ODOO_TIMEOUT_MS = 5000           // 5s timeout por llamada
export const ODOO_MAX_RETRIES = 3             // max reintentos
export const ODOO_RETRY_DELAYS = [1000, 2000, 4000]  // backoff 1s->2s->4s
export const ODOO_RATE_LIMIT_PER_MIN = 60     // ~60 req/min

export const ODOO_CACHE_TTL: Record<string, number> = {
  'product.product': 24 * 60 * 60 * 1000,    // 24h — viajes
  'res.partner': 1 * 60 * 60 * 1000,         // 1h — contactos
  'sale.order': 15 * 60 * 1000,              // 15min — pedidos
  'account.move': 1 * 60 * 60 * 1000,        // 1h — facturas
  kpis: 5 * 60 * 1000,                       // 5min — KPIs director
} as const

export const ODOO_XMLRPC_PATHS = {
  COMMON: '/xmlrpc/2/common',
  OBJECT: '/xmlrpc/2/object',
} as const
```

### Variables de Entorno

**Ya configuradas en apphosting.yaml:**
```yaml
ODOO_URL: https://aroundaplanet.odoo.com      # RUNTIME
ODOO_DB: aroundaplanet                          # RUNTIME
ODOO_API_KEY: secret: prod-odoo-api-key         # Cloud Secret Manager, RUNTIME
```

**Verificar/agregar en .env.local:**
```bash
ODOO_URL=https://aroundaplanet.odoo.com
ODOO_DB=aroundaplanet
ODOO_USERNAME=<usuario admin Odoo>
ODOO_API_KEY=<API key generada en Odoo Preferences > Account Security > API Keys>
```

**NUNCA exponer variables Odoo como NEXT_PUBLIC_*.**

### Firestore Security Rules (AGREGAR, no modificar existentes)

```javascript
// Agregar en firestore.rules dentro del match principal
match /odooCache/{model}/{document=**} {
  allow read: if request.auth != null;   // Lectura: cualquier usuario autenticado
  allow write: if false;                 // Escritura: solo server-side (Admin SDK)
}
```

### Testing Requirements

**Mock strategy — NUNCA llamadas reales a Odoo en CI:**
```typescript
vi.mock('xmlrpc', () => ({
  createSecureClient: vi.fn(() => ({
    methodCall: vi.fn()
  }))
}))
```

**Escenarios a cubrir:**
1. Auth exitosa retorna uid; auth fallida lanza ODOO_AUTH_FAILED
2. searchRead envia parametros XML-RPC correctos y retorna datos
3. readGroup usa KWARGS (no positional) — verificar estructura de llamada
4. Retry: verifica 3 intentos con delays 1s->2s->4s en fallo de red
5. Rate limiter: no excede 60 req/min (mock timers)
6. Cache hit: retorna datos cacheados cuando TTL valido
7. Cache miss: llama Odoo, cachea resultado
8. Cache fallback: retorna cache stale cuando Odoo timeout (5s)
9. Error mapping: faults XML-RPC -> AppError con codigos ODOO_* correctos
10. Transformacion datos: floats->centavos, date strings->Timestamp, snake->camel

**Patrones de testing (de stories anteriores):**
- `vi.clearAllMocks()` NO resetea mockReturnValue — usar `mockReset()` o `mockReturnValue(DEFAULT)`
- Pool: `'forks'` para aislamiento cross-file (ya configurado en vitest.config)
- `beforeAll` warmup para modulos con Firebase deps (evitar timeout en fork)
- SIEMPRE verificar ARIA + estados + callbacks en componentes (no aplica aqui, solo server)

### Browser Testing (script Node, NO Playwright MCP)

Crear `scripts/test-odoo-client.mjs` para verificacion manual:
```javascript
// Ejecutar: node scripts/test-odoo-client.mjs
// 1. Conectar a Odoo real (aroundaplanet.odoo.com)
// 2. authenticate() — verificar uid valido
// 3. search_read('res.partner', [...], ['name','email'], {limit: 5})
// 4. read_group('sale.order', [...], ['amount_total:sum'], ['state'])
// 5. Testear error handling (modelo invalido)
// 6. Guardar resultados en scripts/test-odoo-results.json
```

### Inteligencia de Story Anterior (1.4b)

**REUTILIZAR (no recrear):**
- `src/lib/errors/AppError.ts` — clase de errores
- `src/lib/errors/handleApiError.ts` — serializacion a JSON
- `src/lib/auth/requireAuth.ts` — verificacion de session cookie
- `src/lib/auth/requireRole.ts` — verificacion de rol
- `src/lib/auth/requirePermission.ts` — verificacion granular
- `src/lib/auth/authorizeAgent.ts` — aislamiento de agentes

**NO MODIFICAR:**
- `src/lib/auth/*` — cadena de auth completa
- `src/lib/errors/*` — manejo de errores
- `firestore.rules` — solo AGREGAR regla para odooCache
- `storage.rules` — no se toca
- `src/config/roles.ts` — ya completo
- `src/proxy.ts` — ya funcional

**CONSULTAR como referencia de patrones:**
- `src/lib/firebase/admin.ts` — patron singleton initialization
- `src/lib/auth/requireAuth.ts` — patron de Route Handler auth
- `src/schemas/roleSchema.ts` — patron de Zod schema

### Dependencias de Otras Stories

**Story 1.5 es dependencia de:**
- Story 1.6 (SuperAdmin Panel): usa OdooClient para sync usuarios desde `res.partner`
- Story 2.1a (Trip Sync): usa OdooClient para sincronizar viajes desde `product.product`

**Story 1.5 depende de:**
- Story 1.4b (Route Protection): provee AppError, requireAuth/Role, handleApiError (DONE)
- Story 1.3 (Firebase Auth): provee session cookies y Firebase Admin SDK (DONE)

### Project Structure Notes

- `src/lib/odoo/` ya existe (tiene `.gitkeep`) — reemplazar con archivos reales
- No hay conflictos con estructura existente
- Sigue patron feature-adjacent: lib/ para logica de negocio, app/api/ para endpoints
- NO crear `src/features/odoo/` — App Router route groups + lib/ ya organizan por feature

### References

- [PRD FR64] Sistema lee datos de Odoo via XML-RPC: contactos, ordenes, pagos, productos
- [PRD FR67] Sistema opera con capa de abstraccion que desacopla logica de negocio de API Odoo
- [PRD FR68] Modo degradado si Odoo no disponible — datos cacheados con indicador
- [PRD NFR14] API Routes proxy Odoo validan auth en cada request — no endpoints publicos
- [PRD NFR20] Capa proxy abstrae XML-RPC — cambiar ERP solo reemplaza adaptador
- [PRD NFR21] Si Odoo no responde en <5s, sistema usa cache Firestore con indicador "datos de hace X horas"
- [PRD NFR29] Sin single point of failure fuera de Firebase
- [Architecture] src/lib/odoo/client.ts — anti-vendor-lock abstraction layer
- [Architecture] Exponential backoff: 1s->2s->4s, max 3 reintentos
- [Architecture] Cache TTL: trips 24h, contacts 1h, orders 15min, invoices 1h, KPIs 5min
- [Architecture] Naming: camelCase fields, ODOO_* error codes, kebab-case API routes
- [Architecture] Odoo sync: event-driven writes + polling (sync engine para stories futuras)
- [Story 1.4b] AppError pattern, Route Handler structure, auth chain, testing patterns
- [Odoo 18 External API] https://www.odoo.com/documentation/18.0/developer/reference/external_api.html
- [Odoo 18 ORM Changelog] https://www.odoo.com/documentation/18.0/developer/reference/backend/orm/changelog.html

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- TypeScript: `unknown[]` not assignable to `OdooDomain` → fixed with `as OdooDomain` cast in route.ts
- TypeScript: xmlrpc callback type `Error | null` vs `Object` → changed to `object | null` with instanceof guard
- cache.test.ts: "Cannot access 'mockCollection' before initialization" → fixed with `vi.hoisted()`
- client.test.ts: retry tests timing out with fake timers → removed fake timers, used fast mock retry delays [1,2,4]ms
- ESLint: `Function` type in test callbacks → replaced with `(...args: unknown[]) => void`
- ESLint: unused `mockDoc` in cache.test.ts → kept as internal `_mockDoc` in hoisted block, removed from destructure

### Completion Notes List
- 60 nuevos tests (23 client + 10 cache + 6 route + 21 schema) — total proyecto 320
- readGroup usa KWARGS (no positional) para compatibilidad Odoo 18
- Rate limiter implementado como cola secuencial con min interval
- Cache Firestore en `odooCache/{model-slug}/entries/{cacheKey}` con TTL por modelo
- Graceful degradation: retorna datos stale cuando Odoo no responde + console.error logging
- xmlrpc@1.3.2 + @types/xmlrpc@1.3.10 instalados
- Script de test manual en `scripts/test-odoo-client.mjs`
- Route handler usa withCacheFallback para respetar TTL por modelo

### Code Review Fixes (2026-02-26)
- [H1] ODOO_DEFAULT_PAGE_SIZE: importada y usada en client.ts (eliminados magic numbers)
- [H2] ODOO_USERNAME: agregado a apphosting.yaml como secret
- [H3] Logging: console.error agregado en cache.ts withCacheFallback catch block
- [H4] Rate limiter test: agregado test que verifica cola secuencial con llamadas concurrentes
- [M1] Cache validation: reemplazado `as` cast con isValidCacheEntry runtime check
- [M2] Dynamic import: cambiado a static import de AppError en cache.ts
- [M3] pnpm-lock.yaml: documentado en File List
- [M4] Route handler: ahora usa withCacheFallback para cachear resultados
- [M5] authenticate() race condition: agregado authPromise lock para evitar llamadas concurrentes

### File List
- `src/config/odoo.ts` (NEW) — constantes de configuracion Odoo
- `src/types/odoo.ts` (NEW) — tipos TypeScript para integracion Odoo
- `src/schemas/odooSchema.ts` (NEW) — Zod schemas + helpers de transformacion
- `src/schemas/odooSchema.test.ts` (NEW) — 21 tests
- `src/lib/odoo/client.ts` (NEW) — OdooClient class + singleton
- `src/lib/odoo/client.test.ts` (NEW) — 23 tests
- `src/lib/odoo/cache.ts` (NEW) — cache Firestore con TTL + runtime validation
- `src/lib/odoo/cache.test.ts` (NEW) — 10 tests
- `src/app/api/odoo/search-read/route.ts` (NEW) — Route Handler POST con cache
- `src/app/api/odoo/search-read/route.test.ts` (NEW) — 6 tests
- `firestore.rules` (MODIFIED) — regla odooCache agregada
- `.env.local` (MODIFIED) — ODOO_USERNAME agregado
- `apphosting.yaml` (MODIFIED) — ODOO_USERNAME secret agregado
- `scripts/test-odoo-client.mjs` (NEW) — script de test manual
- `package.json` (MODIFIED) — xmlrpc + @types/xmlrpc
- `pnpm-lock.yaml` (MODIFIED) — lockfile actualizado
