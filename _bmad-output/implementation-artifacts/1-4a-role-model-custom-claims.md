# Story 1.4a: Role Model & Custom Claims

Status: done

## Story

As a **SuperAdmin**,
I want an additive role system with granular permissions defined in Firestore,
so that each user has the correct roles and the system can enforce access control.

## Acceptance Criteria

### AC1: Rol Cliente como Base Inmutable

**Given** el sistema de roles esta implementado
**When** un usuario se registra (email o Google)
**Then** recibe custom claims en JWT con `roles: ['cliente']`
**And** el campo `roles` en Firestore `/users/{uid}` contiene `['cliente']`
**And** el rol `cliente` NUNCA puede ser removido de ningun usuario (FR2)

### AC2: Custom Claims en JWT

**Given** un SuperAdmin asigna roles a un usuario via `/api/auth/claims`
**When** los roles cambian (ej: agregar `agente`)
**Then** `adminAuth.setCustomUserClaims(uid, { roles, agentId? })` se ejecuta
**And** `adminAuth.revokeRefreshTokens(uid)` se ejecuta para forzar re-auth inmediata
**And** el JWT del usuario contiene `roles: string[]` y opcionalmente `agentId: string`
**And** el cambio se refleja en segundos (no 1h) gracias a la revocacion de tokens
**And** el campo `roles` en Firestore `/users/{uid}` se actualiza en sync con los claims
**And** la fuente de verdad son los claims JWT — Firestore es copia de sync

### AC3: Permisos Granulares en Firestore

**Given** el sistema se inicializa
**When** se ejecuta `pnpm seed:permissions`
**Then** existen 5 documentos en `/config/permissions/{role}` con permisos granulares predefinidos (FR6)
**And** los permisos son leidos por el servidor con cache en memoria TTL 5min (best-effort por instancia Cloud Run)
**And** los permisos son actualizables en Firestore sin redeployment
**And** cada permiso tiene formato `resource:action` (ej: `payments:verify`, `trips:write`)
**And** `firestore.rules` protege `/config/**` con read solo para usuarios autenticados, write deshabilitado desde cliente

### AC4: API de Gestion de Claims (SuperAdmin Only)

**Given** existe la ruta `/api/auth/claims`
**When** un SuperAdmin envia POST con `{ uid, roles, agentId? }`
**Then** los custom claims se actualizan en Firebase Auth
**And** `adminAuth.revokeRefreshTokens(uid)` fuerza re-auth del usuario afectado
**And** el documento `/users/{uid}` se actualiza con los nuevos roles
**And** la request se valida con Zod (roles validos, agentId solo si `agente` en roles)
**And** si `agentId` se provee, se valida que existe en Firestore `/agents/{agentId}`
**And** el caller se verifica con `adminAuth.verifySessionCookie(cookie, true)` (checkRevoked)
**And** retorna 403 `INSUFFICIENT_ROLE` si el caller no tiene rol `superadmin`
**When** cualquier usuario autenticado envia GET
**Then** recibe sus propios claims actuales `{ roles, agentId? }`

### AC5: Navegacion Multi-Rol

**Given** un usuario tiene multiples roles (ej: Cliente + Agente)
**When** hace login y el AuthInitializer sincroniza
**Then** el store contiene `claims: { roles: ['cliente', 'agente'], agentId: 'xxx' }`
**And** el Navbar muestra opciones de navegacion para TODOS sus roles activos, ordenados por `ROLE_PRIORITY`
**And** un hook `useRoleNavigation()` retorna las rutas disponibles segun roles (FR2)
**And** el Navbar muestra CTA "Iniciar Sesion" para no-autenticados o links por rol para autenticados

## Tasks / Subtasks

- [x] **Task 1**: Extender tipos y schemas (AC: 1,2)
  - [x] 1.1 Agregar `agentId?: string` a `UserProfile` en `src/types/user.ts`
  - [x] 1.2 Crear `UserClaims` interface en `src/types/user.ts` con `roles`, `agentId?`, `adminLevel?` (futuro, no funcional aun)
  - [x] 1.3 Actualizar `userProfileSchema.ts` con campo `agentId` opcional y `.refine()` que valide agentId solo si `agente` en roles
  - [x] 1.4 Crear `src/schemas/roleSchema.ts` con `setRolesSchema` (refine: agentId requerido si agente en roles) y `userClaimsSchema`

- [x] **Task 2**: Custom claims management (AC: 2,4)
  - [x] 2.1 Agregar `export const adminDb = getFirestore(adminApp)` en `src/lib/firebase/admin.ts`
  - [x] 2.2 Crear `src/lib/auth/claims.ts` — `getUserClaims(uid)`, `setUserClaims(uid, claims)`
  - [x] 2.3 Logica de inmutabilidad: `cliente` siempre presente en roles array (validar antes de setear)
  - [x] 2.4 Sync: claims primero (`setCustomUserClaims`), luego Firestore update (`adminDb.doc('users/uid').update({ roles })`)
  - [x] 2.5 Despues de `setCustomUserClaims()`, llamar `adminAuth.revokeRefreshTokens(uid)` para cerrar ventana de permisos obsoletos

- [x] **Task 3**: Sistema de permisos (AC: 3)
  - [x] 3.1 Crear `src/lib/auth/permissions.ts` — `getPermissions(roles)`, `hasPermission(roles, permission)`
  - [x] 3.2 Cache en memoria con TTL 5min (Map con timestamp). NOTA: cache es por instancia Cloud Run — con `minInstances: 1` es efectivo en produccion, en dev puede no funcionar. Aceptable para MVP
  - [x] 3.3 Merge de permisos multi-rol (union aditiva — si CUALQUIER rol tiene el permiso, el resultado es `true`)
  - [x] 3.4 Actualizar `firestore.rules`: agregar regla minima `/config/{document=**}` — read solo si `request.auth != null`, write `false`

- [x] **Task 4**: Seed data de permisos (AC: 3)
  - [x] 4.1 Crear `src/lib/auth/seedPermissions.ts` — exporta funcion `runSeed()` y constante `PERMISSION_MATRIX`
  - [x] 4.2 Definir matriz de 5 roles con 21 permisos granulares (ver tabla en Dev Notes)
  - [x] 4.3 Crear `scripts/seed-permissions.ts` que importa `runSeed()` y ejecuta con Firebase Admin SDK (`adminDb`). NO exponer como API route
  - [x] 4.4 Agregar `"seed:permissions": "tsx scripts/seed-permissions.ts"` a `package.json` scripts
  - [x] 4.5 Seed debe ser idempotente — usar `set({ merge: true })` para no borrar customizaciones en produccion

- [x] **Task 5**: API route claims (AC: 4)
  - [x] 5.1 Crear `src/app/api/auth/claims/route.ts` — GET (propios claims) + POST (superadmin sets claims)
  - [x] 5.2 Validacion Zod en POST body con `setRolesSchema`
  - [x] 5.3 Verificar caller es superadmin: `verifySessionCookie(cookie, true)` + `Array.isArray()` guard
  - [x] 5.4 Validar que `agentId` existe en Firestore `/agents/{agentId}` antes de setear claims (si se provee)
  - [x] 5.5 POST llama `setUserClaims()` de `claims.ts` (que incluye revokeRefreshTokens)

- [x] **Task 6**: Set initial claims en registro (AC: 1)
  - [x] 6.1 Modificar `/api/auth/session` POST en `route.ts`: despues de `adminAuth.verifyIdToken(idToken)`, verificar si usuario ya tiene claims
  - [x] 6.2 Usar `adminAuth.getUser(uid)` para leer claims existentes del usuario
  - [x] 6.3 Si `customClaims.roles` es undefined o vacio, llamar `adminAuth.setCustomUserClaims(uid, { roles: ['cliente'] })`
  - [x] 6.4 IDEMPOTENTE: si claims ya existen con roles mayores (ej: `['cliente','agente']`), NO sobreescribir
  - [x] 6.5 NO tocar `createUserProfile()` en `firestore.ts` — es codigo cliente, no puede llamar Admin SDK

- [x] **Task 7**: Actualizar useAuthStore con claims (AC: 5)
  - [x] 7.1 Agregar `claims: UserClaims | null` al store
  - [x] 7.2 Action `setClaims(claims: UserClaims | null)`
  - [x] 7.3 Helpers derivados: `hasRole(role)` selector — lee de `claims.roles`
  - [x] 7.4 Actualizar `reset()` para incluir `claims: null`

- [x] **Task 8**: Actualizar AuthInitializer para leer claims (AC: 2,5)
  - [x] 8.1 Usar `user.getIdTokenResult()` (NO `getIdToken()`) — retorna `IdTokenResult` con `.claims` ya parseado
  - [x] 8.2 Extraer claims: `{ roles: result.claims.roles ?? ['cliente'], agentId: result.claims.agentId }`
  - [x] 8.3 Llamar `setClaims()` en el store
  - [x] 8.4 Conservar `user.getIdToken()` SOLO para el POST a `/api/auth/session` (necesita string JWT)
  - [x] 8.5 Despues de session POST (que setea initial claims), forzar refresh: `await user.getIdToken(true)` y luego `getIdTokenResult()` de nuevo para obtener claims recien seteados en primera sesion

- [x] **Task 9**: Hook useRoleNavigation (AC: 5)
  - [x] 9.1 Crear `src/hooks/useRoleNavigation.ts`
  - [x] 9.2 Retorna items de navegacion filtrados por roles del usuario
  - [x] 9.3 Agregar `ROLE_PRIORITY` a `src/config/roles.ts`: `{ superadmin: 5, director: 4, admin: 3, agente: 2, cliente: 1 }`
  - [x] 9.4 Ordenar items por `ROLE_PRIORITY` descendente (mayor privilegio primero)
  - [x] 9.5 Agregar `ROLE_NAVIGATION_MAP` a `src/config/roles.ts` con rutas por rol

- [x] **Task 10**: Actualizar Navbar para multi-rol (AC: 5)
  - [x] 10.1 Navbar importa `useRoleNavigation()` y `useAuthStore`
  - [x] 10.2 No autenticado: muestra CTA "Iniciar Sesion" (sin cambio)
  - [x] 10.3 Autenticado sin roles adicionales: muestra opciones de Cliente
  - [x] 10.4 Multi-rol: muestra todas las secciones disponibles ordenadas por ROLE_PRIORITY
  - [x] 10.5 NOTA: Links como `/agent/dashboard` llevaran a 404 hasta Story 1.4b+ — es esperado, NO agregar placeholders

- [x] **Task 11**: Tests (AC: todos)
  - [x] 11.1 `src/lib/auth/claims.test.ts` — setUserClaims, getUserClaims, inmutabilidad cliente, revokeRefreshTokens, agentId condicional, sync Firestore (16 tests)
  - [x] 11.2 `src/lib/auth/permissions.test.ts` — cache hit/miss/expiry, merge multi-rol, hasPermission, getPermissions (7 tests)
  - [x] 11.3 `src/schemas/roleSchema.test.ts` — roles validos/invalidos, agentId requerido si agente, refine (9 tests)
  - [x] 11.4 `src/app/api/auth/claims/route.test.ts` — GET claims, POST superadmin, POST 403, validation errors, agentId validation, clearPermissionCache (9 tests)
  - [x] 11.5 `src/hooks/useRoleNavigation.test.ts` — all 5 roles, multi-role, priority ordering, empty roles (9 tests)
  - [x] 11.6 Actualizar `src/stores/useAuthStore.test.ts` — setClaims, hasRole, reset incluye claims (6 tests)
  - [x] 11.7 Actualizar `src/components/shared/Navbar.test.tsx` — no-auth CTA, skeleton loading, logout click, aria-current, multi-rol nav (7 tests)
  - [x] 11.8 `src/lib/auth/seedPermissions.test.ts` — PERMISSION_MATRIX structure, runSeed writes, merge flag (8 tests)

- [x] **Task 12**: Verificacion final (AC: todos)
  - [x] 12.1 `pnpm typecheck` — 0 errores
  - [x] 12.2 `pnpm test` — 203 passing (146 existentes + 57 nuevos)
  - [x] 12.3 `pnpm lint` — 0 warnings
  - [x] 12.4 `pnpm build` — exitoso
  - [x] 12.5 Validacion manual minima:
    - Ejecutar `pnpm seed:permissions` y verificar 5 documentos en Firestore Console
    - Registrar usuario de prueba → verificar claims `['cliente']` en Firebase Auth Console
    - GET `/api/auth/claims` con sesion activa → recibir `{ roles: ['cliente'] }`
    - POST `/api/auth/claims` sin superadmin → recibir 403
    - Verificar Navbar muestra CTA correcto segun estado auth

## Dev Notes

### Decision Arquitectonica: Admin Endpoint, NO Cloud Function

El epics dice "Cloud Function or admin endpoint". Se elige **admin endpoint** (API route de Next.js) porque:
- Cloud Functions son Epic 5.4 y 6.4 — no existen aun
- API routes de Next.js corren en el mismo Cloud Run (App Hosting)
- Menos latencia (no cold start separado)
- Misma auth infrastructure (session cookies)

### Arquitectura de Claims vs Permisos (Critico)

Dos capas complementarias, NO redundantes:

| Capa | Donde | Que contiene | Para que |
|------|-------|-------------|----------|
| **Custom Claims** | JWT token (Firebase Auth) | `roles: string[]`, `agentId?: string` | Decisiones rapidas: routing, Firestore Rules, basic auth |
| **Permisos Firestore** | `/config/permissions/{role}` | Permisos granulares `resource:action` | Logica de negocio fina: can verify payments, can edit trips |

**Fuente de verdad: Claims JWT.** Firestore `/users/{uid}.roles` es copia de sync para consultas y UI.

Orden de operaciones al cambiar roles:
1. `adminAuth.setCustomUserClaims(uid, newClaims)` — PRIMERO (fuente de verdad)
2. `adminAuth.revokeRefreshTokens(uid)` — fuerza re-auth inmediata
3. `adminDb.doc('users/uid').update({ roles })` — SEGUNDO (copia sync)

Si paso 3 falla, el sistema es consistente (claims son correctos). Si paso 1 falla, nada mas se ejecuta.

### Regla: `claims.roles` vs `profile.roles`

| Uso | Fuente | Por que |
|-----|--------|---------|
| Decisiones de UI en tiempo real | `claims.roles` (del store) | Sin round-trip, siempre actualizado |
| Display de datos del perfil | `profile.roles` (Firestore) | Para mostrar info de perfil |
| Firestore Security Rules | `request.auth.token.roles` (JWT) | Source of truth en server |
| Fallback si claims es null | `profile.roles ?? ['cliente']` | Usuario recien registrado, claims aun no seteados |

El helper `hasRole(role)` lee de `claims.roles`, NUNCA de `profile.roles`.

### Token Refresh y Revocacion (CRITICO)

`adminAuth.revokeRefreshTokens(uid)` cierra la ventana de permisos obsoletos de ~59 min a segundos:
- Invalida todos los refresh tokens del usuario
- El siguiente request server-side con `verifySessionCookie(cookie, true)` falla → fuerza re-login
- `onIdTokenChanged` detecta el cambio y fuerza `getIdToken(true)` → obtiene token con nuevos claims

**Consecuencia UX:** Despues de un cambio de roles, el usuario es forzado a re-autenticarse en su proxima navegacion hacia ruta protegida. Esto es el comportamiento correcto y seguro.

### Patron: Verificar Caller SuperAdmin en API Routes

Este patron se establece en Story 1.4a y sera reutilizado en todas las API routes protegidas:

```typescript
// En /api/auth/claims/route.ts — POST handler
const cookieStore = await cookies()
const sessionCookie = cookieStore.get('__session')?.value
if (!sessionCookie) {
  return NextResponse.json({ code: 'AUTH_REQUIRED', message: 'Sesion requerida', retryable: false }, { status: 401 })
}

// CRITICO: checkRevoked=true valida que no se hayan revocado los tokens del caller
const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)

// Custom claims no son campos tipados en DecodedIdToken — safe guard con Array.isArray
const callerRoles = Array.isArray(decoded.roles) ? (decoded.roles as string[]) : undefined
if (!callerRoles?.includes('superadmin')) {
  return NextResponse.json({ code: 'INSUFFICIENT_ROLE', message: 'Se requiere rol superadmin', retryable: false }, { status: 403 })
}
```

**NUNCA verificar roles desde Firestore `/users/{uid}.roles`** — un usuario podria modificar su propio documento si las rules lo permiten. Los claims del JWT son la fuente de verdad firmada por Firebase.

### Patron: Claims en Token Decodificado (Sin Round-Trip)

Firebase Auth almacena custom claims en el ID token. Para leerlos en el cliente:

```typescript
// CORRECTO: getIdTokenResult() retorna claims parseados
const result = await user.getIdTokenResult()
const claims: UserClaims = {
  roles: (result.claims.roles as string[]) ?? ['cliente'],
  agentId: result.claims.agentId as string | undefined,
}

// INCORRECTO: getIdToken() retorna string JWT opaco
// NO intentar decodificar manualmente con atob() o jwt-decode
```

En el servidor (API routes con session cookie):
```typescript
const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
const roles = (decoded as Record<string, unknown>).roles as string[] ?? ['cliente']
```

### Patron: Initial Claims en Registro

Flujo completo de registro con claims (Story 1.3 + 1.4a):
1. `registerWithEmail()` crea Firebase user — SIN claims aun
2. `createUserProfile()` escribe a Firestore con `roles: ['cliente']` (client-side, NO toca Admin SDK)
3. `AuthInitializer` dispara `onIdTokenChanged` → POST a `/api/auth/session`
4. **NUEVO en 1.4a:** `/api/auth/session` POST verifica si usuario tiene claims. Si no tiene, setea `{ roles: ['cliente'] }`
5. `AuthInitializer` fuerza refresh: `await user.getIdToken(true)` → `getIdTokenResult()` → claims disponibles

`createUserProfile()` en `firestore.ts` es codigo CLIENTE — no puede llamar Firebase Admin SDK. La logica de claims init vive en el servidor (`/api/auth/session` POST).

La operacion es IDEMPOTENTE: si el usuario ya tiene claims (ej: superadmin asigno roles antes del primer login), NO se sobreescriben.

### Cache de Permisos en Memoria — Limitaciones Cloud Run

```typescript
// Cache es por instancia de Cloud Run (apphosting.yaml: max=10 instancias)
// Cada instancia tiene su propio Map — cambios de permisos tardan hasta 5min en propagarse
// Con minInstances: 1 y cambios infrecuentes de permisos, es aceptable para MVP
// Para escala: migrar a Firestore onSnapshot o Redis
const PERMISSION_CACHE = new Map<string, { data: Record<string, boolean>; expiresAt: number }>()
const PERMISSION_CACHE_TTL = 5 * 60 * 1000 // 5 minutos
```

NO over-engineer con Redis o cache distribuido. El sistema de permisos rara vez cambia (matriz 21 permisos x 5 roles). El peor caso es 5 minutos de stale data en una instancia.

### Modelo de 5 Roles Aditivos

Roles son aditivos. `cliente` es la base inmutable:

```
SuperAdmin = superadmin + admin + cliente (hereda admin capabilities)
Director   = director + admin(read-only) + cliente
Admin      = admin + cliente
Agente     = agente + cliente (+ agentId obligatorio)
Cliente    = cliente (base, siempre presente)
```

Cada usuario tiene un ARRAY de roles en claims. Un agente que es tambien admin tendra: `roles: ['cliente', 'agente', 'admin']`.

El merge de permisos es **aditivo puro**: si CUALQUIER rol tiene el permiso, el resultado es `true`. NO hay revocacion de permisos. Si se necesita restringir, se quita el rol completo.

### Matriz de Permisos por Rol (Seed Data)

```
Permiso               | cliente | agente | admin | director | superadmin
--------------------- | ------- | ------ | ----- | -------- | ----------
trips:read            |    Y    |   Y    |   Y   |    Y     |     Y
trips:write           |    N    |   N    |   Y   |    N     |     Y
orders:readOwn        |    Y    |   Y    |   Y   |    Y     |     Y
orders:readAll        |    N    |   N    |   Y   |    Y     |     Y
orders:create         |    Y    |   Y    |   Y   |    N     |     Y
payments:readOwn      |    Y    |   Y    |   Y   |    Y     |     Y
payments:readAll      |    N    |   N    |   Y   |    Y     |     Y
payments:verify       |    N    |   N    |   Y   |    N     |     Y
payments:reject       |    N    |   N    |   Y   |    N     |     Y
clients:readOwn       |    N    |   Y    |   N   |    N     |     N
clients:readAll       |    N    |   N    |   Y   |    Y     |     Y
commissions:readOwn   |    N    |   Y    |   N   |    N     |     N
commissions:readAll   |    N    |   N    |   N   |    Y     |     Y
analytics:read        |    N    |   N    |   N   |    Y     |     Y
kpis:read             |    N    |   N    |   N   |    Y     |     Y
users:read            |    N    |   N    |   Y   |    N     |     Y
users:manage          |    N    |   N    |   N   |    N     |     Y
config:manage         |    N    |   N    |   N   |    N     |     Y
notifications:config  |    Y    |   Y    |   Y   |    Y     |     Y
referrals:create      |    N    |   Y    |   N   |    N     |     N
sync:odoo             |    N    |   N    |   N   |    N     |     Y
```

### NO en Scope (Story 1.4b)

Estos items los implementa Story 1.4b, NO esta story:
- `proxy.ts` route protection (verificar JWT claims en cada request protegido)
- `requireRole()` y `requirePermission()` helpers para Route Handlers
- Firestore Security Rules completas con validacion de `request.auth.token.roles` (esta story solo agrega regla minima para `/config/**`)
- Firebase Storage Rules con uid-based folders
- Redireccion automatica por rol en proxy
- Dashboard por rol (redirect al dashboard correspondiente segun ROLE_PRIORITY)

**Nota boundary:** `useRoleNavigation` retornara rutas como `/agent/dashboard`, `/admin/dashboard`. Estas rutas llevaran a 404 hasta 1.4b+. Es esperado — NO agregar placeholder pages.

### Convenciones de Naming (CLAUDE.md Law)

| Concepto | Convencion | Ejemplo |
|----------|-----------|---------|
| Types/Interfaces | PascalCase, NO prefix `I` | `UserClaims`, `Permission` |
| Constants | UPPER_SNAKE_CASE | `VALID_ROLES`, `PERMISSION_CACHE_TTL`, `ROLE_PRIORITY` |
| Zod schemas | camelCase + `Schema` suffix | `setRolesSchema`, `userClaimsSchema` |
| Hooks | camelCase + `use` prefix | `useRoleNavigation` |
| API folders | kebab-case | `/api/auth/claims/` |
| Firestore fields | camelCase | `agentId`, `isActive`, `createdAt` |
| Booleans | is/has/can prefix | `isActive`, `hasPermission`, `canVerify` |

### Error Codes para Auth/Roles

Usar `AppError` pattern (ya existe en `src/lib/firebase/errors.ts`):

```typescript
AUTH_REQUIRED          → 401  (sin token o session cookie)
INSUFFICIENT_ROLE      → 403  (rol insuficiente para la operacion)
INVALID_ROLE           → 400  (rol no existe en VALID_ROLES)
CLAIMS_UPDATE_FAILED   → 500  (Firebase Admin error, retryable: true)
AGENT_ID_REQUIRED      → 400  (rol agente asignado sin agentId)
AGENT_NOT_FOUND        → 400  (agentId no existe en Firestore /agents/{agentId})
PERMISSION_DENIED      → 403  (permiso granular insuficiente)
```

Retornar data directamente en JSON. NO wrapper `{ success: true, data: ... }`.

### Project Structure Notes

Archivos nuevos/modificados de esta story:

```
src/
├── types/user.ts              ← MODIFICAR (agregar agentId, UserClaims, adminLevel?)
├── config/roles.ts            ← MODIFICAR (agregar ROLE_PRIORITY, ROLE_NAVIGATION_MAP)
├── schemas/
│   ├── userProfileSchema.ts   ← MODIFICAR (agregar agentId con refine)
│   └── roleSchema.ts          ← NUEVO
│   └── roleSchema.test.ts     ← NUEVO
├── lib/
│   ├── firebase/admin.ts      ← MODIFICAR (agregar export adminDb)
│   └── auth/
│       ├── claims.ts              ← NUEVO
│       ├── claims.test.ts         ← NUEVO
│       ├── permissions.ts         ← NUEVO
│       ├── permissions.test.ts    ← NUEVO
│       ├── seedPermissions.ts     ← NUEVO
│       └── seedPermissions.test.ts ← NUEVO
├── hooks/
│   ├── useRoleNavigation.ts       ← NUEVO
│   └── useRoleNavigation.test.ts  ← NUEVO
├── stores/useAuthStore.ts         ← MODIFICAR (agregar claims, setClaims, hasRole, reset)
├── components/shared/
│   ├── AuthInitializer.tsx    ← MODIFICAR (getIdTokenResult, setClaims, forceRefresh)
│   └── Navbar.tsx             ← MODIFICAR (multi-rol nav via useRoleNavigation)
├── app/api/auth/
│   ├── session/route.ts       ← MODIFICAR (set initial claims idempotente)
│   └── claims/
│       ├── route.ts           ← NUEVO
│       └── route.test.ts      ← NUEVO
scripts/
└── seed-permissions.ts        ← NUEVO (ejecutable con pnpm seed:permissions)
firestore.rules                ← MODIFICAR (agregar regla minima /config/**)
package.json                   ← MODIFICAR (agregar script seed:permissions)
```

**Regla:** Tests co-located. NUNCA `__tests__/`. NO barrel exports.

### Archivos Existentes Relevantes

| Archivo | Rol | Modificar? | Detalle |
|---------|-----|-----------|---------|
| `src/lib/firebase/admin.ts` | Firebase Admin SDK setup | SI | Agregar `export const adminDb = getFirestore(adminApp)` |
| `src/lib/firebase/client.ts` | Firebase client SDK | NO | |
| `src/lib/firebase/auth.ts` | Auth helpers (login, register, etc) | NO | |
| `src/lib/firebase/firestore.ts` | Firestore CRUD user profile | NO | `createUserProfile` es client-side, NO toca Admin SDK |
| `src/lib/firebase/errors.ts` | Error messages Firebase auth | POSIBLE | Agregar error codes de roles si se consolida ahi |
| `src/lib/utils/validateReturnUrl.ts` | Open redirect protection | NO | |
| `src/proxy.ts` | Route proxy (skeleton) | NO | Es Story 1.4b |
| `firestore.rules` | Security rules | SI | Solo agregar regla minima `/config/**` |

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 1, Story 1.4a lines 582-604]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md — Authentication & Security section]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md — Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md — API Boundaries, Directory Structure]
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md — FR2, FR3, FR5, FR6, FR7]
- [Source: _bmad-output/planning-artifacts/prd/non-functional-requirements.md — NFR9, NFR10, NFR13, NFR14]
- [Source: _bmad-output/planning-artifacts/prd/user-journeys.md — Journey 3 (Lupita Agente), Journey 5 (Noel Director), Journey 6 (Alek SuperAdmin)]
- [Source: CLAUDE.md — Critical Implementation Rules, 28 naming conventions]

### Previous Story Intelligence (Story 1.3)

**Patrones establecidos que DEBEN continuarse:**
1. **Firebase Auth v12 modular imports** — NUNCA compat/namespaced
2. **Zustand pure state** — store NO contiene logica Firebase. Logica en `lib/`
3. **AuthInitializer como sibling** — `onIdTokenChanged`, returns null, colocado en `layout.tsx`
4. **Session cookie `__session`** — HTTP-only, 14 dias, API route 204 No Content
5. **Zod schemas en `src/schemas/`** — NUNCA inline. Runtime validation con `safeParse`
6. **Tests co-located** — `pool: 'forks'` en vitest, `beforeAll` warmup para modulos pesados
7. **Error handling** — `getFirebaseErrorMessage()`, consolidado en `errors.ts`
8. **Open redirect protection** — `validateReturnUrl()` en todos los redirects
9. **Firestore timestamps** — `serverTimestamp()` para creates/updates, NUNCA `new Date()`
10. **Google popup-blocked** — catch `auth/popup-blocked`, NO redirect fallback

**Code Review lessons de Story 1.3 (EVITAR repetir):**
- `vi.clearAllMocks()` NO resetea `mockReturnValue` → usar `mockReturnValue(DEFAULT)` en beforeEach
- `setUser()` DESPUES de `getUserProfile()` — evitar race condition isAuthenticated antes de profile
- Firestore `data() as Type` es inseguro → siempre Zod `safeParse`
- API routes sin cuerpo → `new NextResponse(null, { status: 204 })`, no wrapper JSON
- Consolidar funciones duplicadas cross-page → extraer a `lib/` o `components/shared/`

**Dependencias ya instaladas (NO reinstalar):**
- `zustand@5.0.11`, `react-hook-form@7.71.2`, `zod@4.3.6`
- `firebase@12.9.0`, `firebase-admin@13.6.1`
- `next@16.1.6`, `@testing-library/react`, `vitest`

### Git Intelligence

```
Ultimos commits:
d69ad06 feat: Story 1.3 DONE - Firebase Auth, registration, login, forgot-password + code review fixes
4a4ffab fix: dynamic [slug] route for all trips + nested <a> hydration fix
cb815fd feat: Story 1.2 DONE - Public landing pages with real branding and analytics
ae7ecf6 feat: Story 1.1b DONE - Design system, layouts, 9 custom components, 96 tests
e57b506 fix: code review 1.1a - .gitkeep dirs, page to (public), firebase-admin deps, maskable icons
```

**Patron de commits:** `feat:` para stories completadas, `fix:` para correcciones post-review. Mensaje en ingles, descriptivo.

**146 tests passing actualmente.** No romper tests existentes.

### Testing Requirements

**Tests requeridos (co-located, vitest):**

| Archivo | Que testear | Min tests |
|---------|-----------|-----------|
| `claims.test.ts` | setUserClaims, getUserClaims, inmutabilidad cliente, revokeRefreshTokens, agentId, sync | 7 |
| `permissions.test.ts` | getPermissions, cache hit/miss/expiry, merge multi-rol, hasPermission | 7 |
| `roleSchema.test.ts` | roles validos/invalidos, agentId requerido si agente, refine | 5 |
| `route.test.ts` (claims API) | GET claims, POST superadmin, POST 403, validation errors, agentId not found | 6 |
| `useRoleNavigation.test.ts` | single-role nav, multi-role nav, priority ordering, empty roles | 4 |
| `useAuthStore.test.ts` | setClaims, hasRole, reset incluye claims | 3 |
| `Navbar.test.tsx` | no-auth CTA, cliente-only nav, multi-rol nav, role ordering | 4 |

**Total: ~36 tests nuevos minimo**

**Patrones de testing (de Story 1.3):**
- `beforeAll` warmup para modulos con Firebase deps
- `vi.mock('firebase-admin/auth')` para mock `setCustomUserClaims`, `revokeRefreshTokens`
- `vi.mock('@/lib/firebase/admin')` para mock adminAuth y adminDb
- `pool: 'forks'` ya configurado (no cambiar)
- Verify ARIA roles y labels en componentes
- Tests de API routes: mock `cookies()`, mock `adminAuth.verifySessionCookie`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Dashboard page test timeout: fixed with `beforeAll` warmup pattern (consistent with Story 1.3 lessons)
- Dashboard page test duplicate elements: fixed `getByRole` → `getAllByRole` (Navbar now also renders logout)
- Navbar test timeout: fixed by mocking `firebase/app` and `firebase/auth` + `beforeAll` warmup

### Completion Notes List

- All 12 tasks completed
- 57 new tests (203 total, up from 146)
- typecheck: 0 errors
- lint: 0 errors, 0 warnings
- build: successful
- Navbar updated for multi-role navigation with useRoleNavigation hook
- Permission matrix: 21 permissions x 5 roles seeded to Firestore
- Claims API: GET (own claims) + POST (SuperAdmin only, with Zod validation)
- AuthInitializer: force refresh after session POST to get fresh claims immediately
- Existing dashboard test fixed for compatibility with new Navbar auth-awareness

### Code Review Fixes Applied (19 issues, 0 tech debt)

**CRITICAL (2):**
- C1: AuthInitializer race condition — added `cancelled` flag in useEffect to prevent stale closures
- C2: `tsx` missing from devDependencies — installed tsx@4.21.0

**HIGH (7):**
- H1: `setUserClaims` now uses `FieldValue.delete()` to remove agentId from Firestore when removing agente role
- H2: Replaced all `as UserRole[]` unsafe casts with Zod `userClaimsSchema.safeParse()` in claims.ts, AuthInitializer.tsx, and `Array.isArray()` guard in route.ts
- H3: Deduplicated `VALID_ROLES` — exported from `config/roles.ts`, imported in both `roleSchema.ts` and `userProfileSchema.ts`
- H4: `initUserClaims` now reuses `setUserClaims` for full consistency (JWT + revoke + Firestore sync)
- H5: AuthInitializer catch block now falls back to `profile.roles` from store, then `['cliente']` default
- H6: Created `seedPermissions.test.ts` with 8 tests (PERMISSION_MATRIX structure + runSeed behavior)
- H7: Strengthened tests — useRoleNavigation: 9 tests covering all 5 roles with exact assertions; Navbar: 7 tests with logout click, aria-current, skeleton loading

**MEDIUM (10):**
- M1: Added `updatedAt: FieldValue.serverTimestamp()` in Firestore update within setUserClaims
- M2: Changed sequential N+1 Firestore reads to `Promise.all` in getPermissions
- M3: POST claims route now calls `clearPermissionCache()` after setUserClaims
- M4: Fixed comment in permissions.ts to say correct path `/config/permissions/roles/{role}`
- M5: Unified Firestore path style — permissions.ts now uses direct `adminDb.doc('config/permissions/roles/${role}')` consistent with seedPermissions.ts
- M6: Added comment documenting `agents` collection created in Story 2.1a
- M7: Updated all task checkboxes to `[x]`
- M8: Added isLoading skeleton pulse to Navbar (desktop + mobile)
- M9: Added error handling tests to claims.test.ts (revokeRefreshTokens failure, Firestore update failure)
- M10: Replaced fragile `callCount` pattern in permissions.test.ts with `mockReturnValueOnce` chain

### File List

**New files:**
- src/schemas/roleSchema.ts
- src/schemas/roleSchema.test.ts
- src/lib/auth/claims.ts
- src/lib/auth/claims.test.ts
- src/lib/auth/permissions.ts
- src/lib/auth/permissions.test.ts
- src/lib/auth/seedPermissions.ts
- src/lib/auth/seedPermissions.test.ts
- src/hooks/useRoleNavigation.ts
- src/hooks/useRoleNavigation.test.ts
- src/app/api/auth/claims/route.ts
- src/app/api/auth/claims/route.test.ts
- src/components/shared/Navbar.test.tsx
- scripts/seed-permissions.ts

**Modified files:**
- src/types/user.ts (added UserClaims, agentId)
- src/schemas/userProfileSchema.ts (added agentId + refine, VALID_ROLES from config/roles)
- src/lib/firebase/admin.ts (added adminDb)
- src/app/api/auth/session/route.ts (added initUserClaims)
- src/stores/useAuthStore.ts (added claims, setClaims, hasRole)
- src/stores/useAuthStore.test.ts (added 6 new tests)
- src/components/shared/AuthInitializer.tsx (getIdTokenResult, setClaims, cancelled flag, Zod validation, profile fallback)
- src/components/shared/Navbar.tsx (multi-role nav, auth-aware CTA, loading skeleton)
- src/config/roles.ts (VALID_ROLES export, ROLE_PRIORITY, ROLE_NAVIGATION_MAP)
- src/app/dashboard/page.test.tsx (fixed for auth-aware Navbar + beforeAll warmup)
- firestore.rules (added /config/** rule)
- package.json (added seed:permissions script, tsx devDep)
