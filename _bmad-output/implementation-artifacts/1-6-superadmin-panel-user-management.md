# Story 1.6: SuperAdmin Panel & User Management

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **SuperAdmin**,
I want to manage all users from a dedicated panel,
so that I can assign roles, sync users from Odoo, and maintain the team.

## Acceptance Criteria

### AC1: User List Panel (FR3, FR4)

**Given** a SuperAdmin is logged in and navigates to `/superadmin/users`
**When** the page loads
**Then** they see a data table of ALL users with columns: Avatar, Name, Email, Role(s) as color-coded badges, Status (Active/Inactive), Last Login, Actions
**And** the table supports server-side pagination (20 per page, Firestore cursor-based)
**And** real-time search filters by name or email (debounced 300ms)
**And** dropdown filters by Role and by Status (Activo/Inactivo)
**And** the page uses Skeleton loading that mirrors table row structure
**And** empty state shows illustration + CTA if zero users exist
**And** the data table component is built with 21st.dev Magic Component Builder for high-quality visual design

### AC2: Role Assignment (FR3, FR6)

**Given** a SuperAdmin clicks "Editar Roles" on any user row
**When** the role assignment Sheet (slide-over) opens
**Then** they see the user's current roles as visual chips with role-specific colors and icons
**And** they can add/remove roles via multi-select (Agente, Admin, Director, SuperAdmin) — Cliente always present and non-removable
**And** if role Agente is added, an agentId field appears (required, validated against existing agents)
**And** if role Agente is removed, agentId is cleared via FieldValue.delete()
**And** on save, `POST /api/auth/claims` is called → JWT custom claims updated + Firestore synced + refresh tokens revoked + permission cache cleared
**And** the user sees Toast success "Roles actualizados para [nombre]"
**And** role changes are logged in `/auditLog/{autoId}` with: action, targetUid, previousRoles, newRoles, performedBy, timestamp

### AC3: Odoo User Sync (FR5)

**Given** a SuperAdmin clicks "Sincronizar desde Odoo"
**When** the sync runs via `POST /api/odoo/sync-users`
**Then** the system reads `res.partner` from Odoo (domain: agents/contacts with sales team) using OdooClient.searchRead()
**And** reads `crm.team` to map each agent to their Odoo Sales Team
**And** for each Odoo partner: creates or updates Firestore `/users/{uid}` with fields: firstName, lastName, email, odooPartnerId, odooTeamId, odooWriteDate, lastSyncAt
**And** for new users without Firebase Auth account: creates a record with `isActive: false` and `needsRegistration: true` flag (they must register themselves)
**And** sync handles UTF-8 encoding (emojis, zero-width spaces in Odoo data)
**And** sync uses `withCacheFallback('res.partner', ...)` for resilience
**And** a sync status card shows: total synced, created, updated, errors, last sync timestamp, stale indicator if Odoo was unreachable
**And** sync progress is shown in real-time (or polling every 2s for large batches)

### AC4: User Deactivation (FR4, NFR11, NFR13)

**Given** a SuperAdmin clicks "Desactivar" on an active user
**When** the confirmation Dialog appears with destructive styling
**Then** they see: "Desactivar a [nombre]? Este usuario no podra acceder a la plataforma. Sus datos e historial se conservan."
**And** on confirm, `PATCH /api/users/[uid]/status` sets `isActive: false` in Firestore
**And** `adminAuth.revokeRefreshTokens(uid)` revokes all active sessions immediately
**And** the action is recorded in `/auditLog/{autoId}` with: action='user.deactivated', targetUid, performedBy, timestamp, reason (optional)
**And** Toast success "Usuario [nombre] desactivado"
**And** deactivated users appear in the table with muted styling and Badge "Inactivo"
**And** a SuperAdmin can re-activate a user with the same flow (sets `isActive: true`, logged in audit)

### AC5: UI/UX Quality (NFR1, NFR31)

**Given** the SuperAdmin panel is rendered
**When** on desktop (1024px+)
**Then** AdminShell layout with RoleSidebar 280px + main content area
**And** keyboard navigation: Tab through rows, Enter opens detail Sheet, Escape closes
**And** all touch targets minimum 44x44px, focus-visible ring on interactive elements
**And** color-coded role badges: SuperAdmin=purple/shield, Director=blue/chart, Admin=green/gear, Agente=orange/briefcase, Cliente=gray/person
**And** typography: Poppins for headings, Inter for body, Roboto Mono for emails and IDs
**And** responsive fallback for tablet (<1024px): cards instead of table rows

### AC6: Browser Testing

**Given** Story 1.6 is implemented
**When** browser tests run via `scripts/test-superadmin-1-6.mjs`
**Then** the script authenticates as SuperAdmin (extract `__session` cookie)
**And** tests: GET /api/users returns paginated user list
**And** tests: POST /api/auth/claims assigns roles successfully
**And** tests: PATCH /api/users/[uid]/status deactivates/reactivates user
**And** tests: POST /api/odoo/sync-users syncs from Odoo (or returns graceful degradation)
**And** tests: unauthorized access (non-SuperAdmin) returns 403
**And** all results saved to `scripts/browser-test-1-6-results.json`

## Tasks / Subtasks

- [x] **Task 1: Zod Schemas & Types** (AC: 1,2,3,4)
  - [x] 1.1 Create `src/schemas/userManagementSchema.ts` — userListQuerySchema (page, pageSize, search, roleFilter, statusFilter), userDeactivateSchema (uid, reason?), odooSyncResultSchema
  - [x] 1.2 Extend `src/types/user.ts` — add AuditLogEntry type, OdooSyncResult type, UserListResponse type
  - [x] 1.3 Add role visual config to `src/config/roles.ts` — ROLE_COLORS, ROLE_ICONS mapping for UI badges

- [x] **Task 2: API Route — User List** (AC: 1)
  - [x] 2.1 Create `src/app/api/users/route.ts` — GET handler with `requirePermission('users:read')`
  - [x] 2.2 Implement Firestore paginated query on `/users` collection (cursor-based, 20 per page)
  - [x] 2.3 Support query params: search (name/email prefix), roleFilter, statusFilter
  - [x] 2.4 Return `{ users: UserProfile[], nextCursor: string | null, total: number }`
  - [x] 2.5 Unit tests: auth guard, pagination, filters, empty results (7 tests)

- [x] **Task 3: API Route — User Status** (AC: 4)
  - [x] 3.1 Create `src/app/api/users/[uid]/status/route.ts` — PATCH handler with `requirePermission('users:manage')`
  - [x] 3.2 Validate with userStatusUpdateSchema, update Firestore `isActive` field
  - [x] 3.3 If deactivating: call `adminAuth.revokeRefreshTokens(uid)`
  - [x] 3.4 Write audit log to `/auditLog/{autoId}` via Admin SDK
  - [x] 3.5 Unit tests: activate/deactivate flow, audit log creation, auth guard, self-deactivation prevention (11 tests)

- [x] **Task 4: API Route — Odoo User Sync** (AC: 3)
  - [x] 4.1 Create `src/app/api/odoo/sync-users/route.ts` — POST handler with `requirePermission('sync:odoo')`
  - [x] 4.2 Use `getOdooClient().searchRead('res.partner', ...)` to fetch agent contacts
  - [x] 4.3 Use `getOdooClient().searchRead('crm.team', ...)` to fetch sales teams
  - [x] 4.4 Implement upsert logic: match by email → create or update Firestore `/users/{uid}`
  - [x] 4.5 Transform Odoo fields: snake_case → camelCase, add odoo prefix (odooPartnerId, odooTeamId, odooWriteDate)
  - [x] 4.6 Handle UTF-8 edge cases (strip zero-width chars, normalize unicode)
  - [x] 4.7 Use `withCacheFallback` for resilient Odoo reads
  - [x] 4.8 Return OdooSyncResult: { total, created, updated, errors, syncedAt, isStale }
  - [x] 4.9 Unit tests: sync create/update, error handling, graceful degradation, field transformation (14 tests)

- [x] **Task 5: Firestore Security Rules** (AC: 2, 4)
  - [x] 5.1 Add `/auditLog/{logId}` rules: read by admin/superadmin, write never (Admin SDK only)
  - [x] 5.2 Verify existing `/users/{uid}` rules allow SuperAdmin read (already OK)
  - [x] 5.3 Rules verified structurally (Firestore emulator tests deferred to E2E)

- [x] **Task 6: UI — Users Page with 21st.dev** (AC: 1, 5)
  - [x] 6.1 Use 21st.dev Magic Component Builder to generate data table component for user list — explore variants for best visual quality
  - [x] 6.2 Replace placeholder in `src/app/(superadmin)/superadmin/users/page.tsx` with real implementation
  - [x] 6.3 Create `src/components/custom/UserTable.tsx` — Client Component with data table, pagination controls, search input, filter dropdowns
  - [x] 6.4 Create `src/components/custom/RoleBadge.tsx` — color-coded badge per role with icon
  - [x] 6.5 Create `src/components/custom/StatusBadge.tsx` — Active (green) / Inactive (muted) badge
  - [x] 6.6 Implement Skeleton loading state mirroring table structure
  - [x] 6.7 Implement empty state with illustration + CTA
  - [x] 6.8 Unit tests: renders table, loading state, empty state, filter interactions, pagination (7 tests)

- [x] **Task 7: UI — Role Assignment Sheet** (AC: 2)
  - [x] 7.1 Create `src/components/custom/RoleAssignmentSheet.tsx` — Sheet slide-over with role multi-select
  - [x] 7.2 Role chips with color/icon per role, Cliente always locked
  - [x] 7.3 Conditional agentId field when Agente role selected
  - [x] 7.4 Form validation with React Hook Form + Zod (roleSchema reuse)
  - [x] 7.5 Call `POST /api/auth/claims` on save, show Toast feedback
  - [x] 7.6 Unit tests: role selection, agentId conditional, validation errors, save flow (16 tests)

- [x] **Task 8: UI — User Deactivation Dialog** (AC: 4)
  - [x] 8.1 Create `src/components/custom/UserDeactivateDialog.tsx` — destructive Dialog with confirmation
  - [x] 8.2 Optional reason textarea for audit trail
  - [x] 8.3 Call `PATCH /api/users/[uid]/status` on confirm, Toast feedback
  - [x] 8.4 Unit tests: confirm/cancel flow, reason capture, API call (9 tests)

- [x] **Task 9: UI — Odoo Sync Card** (AC: 3)
  - [x] 9.1 Create `src/components/custom/OdooSyncCard.tsx` — status card with sync button, results summary, stale indicator
  - [x] 9.2 Progress/polling state during sync execution
  - [x] 9.3 Display last sync timestamp, counts (total/created/updated/errors)
  - [x] 9.4 Unit tests: sync trigger, loading state, results display, error state (12 tests)

- [x] **Task 10: Integration & Typecheck** (AC: all)
  - [x] 10.1 Wire all components in UsersPanel.tsx: UserTable + RoleAssignmentSheet + UserDeactivateDialog + OdooSyncCard
  - [x] 10.2 Run `pnpm typecheck` — zero errors (PASS)
  - [x] 10.3 Run `pnpm test` — 434 passed, 0 failed (PASS)
  - [x] 10.4 Run `pnpm build` — successful webpack build (PASS)

- [x] **Task 11: Browser Tests** (AC: 6)
  - [x] 11.1 Create `scripts/test-superadmin-1-6.mjs` — Node HTTP test script (11 tests)
  - [x] 11.2 Test all API endpoints with SuperAdmin session cookie (GET /api/users, PATCH /api/users/:uid/status, POST /api/odoo/sync-users)
  - [x] 11.3 Test 403 for non-SuperAdmin access (6 security tests)
  - [x] 11.4 Save results to `scripts/browser-test-1-6-results.json` (11/11 PASS)

## Dev Notes

### Critical Architecture Constraints

- **Auth helper chain:** `requireAuth()` → `requireRole('superadmin')` or `requirePermission('users:manage')` — ALWAYS first line in Route Handlers
- **Claims update flow (already built in 1.4b):** `setUserClaims(uid, { roles, agentId })` → writes JWT + Firestore + revokes tokens. Call `clearPermissionCache()` after
- **Firestore writes via Admin SDK only** — client SDK cannot write `/users/{uid}` for other users (security rules enforce `request.auth.uid == uid` for writes)
- **Odoo agents are `res.partner` NOT `res.users`** — agents don't have Odoo login accounts, they're contacts assigned to `crm.team` (Sales Teams)
- **21st.dev MCP Magic Component Builder** — use for UserTable, RoleBadge, OdooSyncCard. Explore multiple variants to pick best visual design. NOT for simple Dialogs/Sheets (shadcn base sufficient)

### Existing Code to Reuse (DO NOT REINVENT)

| What | Where | Notes |
|------|-------|-------|
| Role assignment endpoint | `src/app/api/auth/claims/route.ts` | POST already works, validates with setRolesSchema |
| setUserClaims() | `src/lib/auth/claims.ts` | JWT + Firestore + revoke + FieldValue.delete for agentId |
| clearPermissionCache() | `src/lib/auth/permissions.ts` | Call after ANY role change |
| requireAuth/Role/Permission | `src/lib/auth/require*.ts` | Auth guard chain |
| AppError + handleApiError | `src/lib/errors/` | Standard error pattern |
| OdooClient | `src/lib/odoo/client.ts` | searchRead(), getOdooClient() singleton |
| withCacheFallback | `src/lib/odoo/cache.ts` | Resilient Odoo reads with Firestore cache |
| AdminShell + RoleSidebar | `src/components/shared/AdminShell.tsx` + `src/components/custom/RoleSidebar.tsx` | Layout already working |
| setRolesSchema | `src/schemas/roleSchema.ts` | Zod validation for role assignment |
| VALID_ROLES, ROLE_PRIORITY | `src/config/roles.ts` | Single source of truth for roles |
| UserProfile type | `src/types/user.ts` | User interface definition |
| Skeleton, Card, Badge | `src/components/ui/` | shadcn base components |

### API Response Patterns (Mandatory)

```typescript
// SUCCESS — data direct, NO wrapper
return NextResponse.json({ users: [...], nextCursor: '...', total: 150 })

// ERROR — AppError pattern
return NextResponse.json({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado', retryable: false }, { status: 404 })

// NO { success: true, data: ... } wrapper EVER
```

### Naming Conventions (Mandatory)

- **Files:** `UserTable.tsx` (PascalCase component), `userManagementSchema.ts` (camelCase schema)
- **Firestore fields:** `camelCase` — firstName, isActive, odooPartnerId, lastSyncAt
- **API routes:** `kebab-case` folders — `/api/users/[uid]/status`, `/api/odoo/sync-users`
- **Constants:** `UPPER_SNAKE_CASE` — `ROLE_COLORS`, `SYNC_POLL_INTERVAL_MS`
- **Booleans:** `is/has/can` prefix — `isActive`, `needsRegistration`, `isStale`
- **Handlers:** `handle*` — `handleDeactivate`, `handleSyncOdoo`
- **Callbacks:** `on*` — `onRoleChange`, `onUserDeactivated`
- **Odoo fields:** `odoo` prefix + camelCase — `odooPartnerId`, `odooTeamId`, `odooWriteDate`

### Testing Standards

- **Co-located:** `UserTable.test.tsx` next to `UserTable.tsx` — NEVER `__tests__/`
- **vi.hoisted():** OBLIGATORIO para mock variables en vi.mock() factories
- **mockReset():** Use instead of clearAllMocks (doesn't reset mockReturnValue)
- **pool: 'forks':** Already configured in vitest.config for cross-file isolation
- **beforeAll warmup:** For modules with Firebase deps
- **Verify:** ARIA roles + states + callbacks (not just "renders")
- **Fake timers:** DO NOT use with xmlrpc mocks — use fast mock delays [1,2,4]ms
- **ESLint:** NEVER use `Function` type — always `(...args: unknown[]) => void`
- **Browser tests:** Node .mjs script with http module, save to JSON file. NEVER Playwright MCP inline

### Firestore Data Model

```
/users/{uid}                          # Existing (extended)
  + odooPartnerId?: number            # NEW: Odoo res.partner ID
  + odooTeamId?: number               # NEW: Odoo crm.team ID
  + odooWriteDate?: string            # NEW: Last Odoo modification
  + lastSyncAt?: Timestamp            # NEW: Last sync from Odoo
  + needsRegistration?: boolean       # NEW: Synced from Odoo but no Firebase Auth yet

/auditLog/{autoId}                    # NEW collection
  - action: string                    # 'user.rolesUpdated' | 'user.deactivated' | 'user.activated' | 'odoo.syncCompleted'
  - targetUid: string                 # Affected user UID
  - performedBy: string               # SuperAdmin UID who performed action
  - timestamp: Timestamp
  - details: object                   # { previousRoles?, newRoles?, reason?, syncResults? }
```

### Previous Story Intelligence (1.5 — Odoo Client)

- OdooClient uses singleton pattern via `getOdooClient()` — reuse, don't create new instances
- Rate limiter is sequential FIFO queue (~60 req/min) — sync-users must batch reads, not blast parallel
- `readGroup` uses KWARGS not positional args (Odoo 18 requirement)
- Cache keys follow `{model}/{descriptive-key}` pattern — e.g., `res.partner/all-agents`
- Amount transformation: `Math.round(odooAmount * 100)` for centavos
- Date transformation: `new Date(odooDateStr.replace(' ', 'T') + 'Z')` → Firestore Timestamp
- `authenticate()` has lock via `authPromise` to prevent race conditions
- Error codes: ODOO_AUTH_FAILED, ODOO_TIMEOUT, ODOO_RATE_LIMITED, ODOO_NOT_FOUND, ODOO_VALIDATION, ODOO_UNAVAILABLE

### UX Specifications (from UX Design Spec)

- **Desktop-first:** AdminDesktopLayout, sidebar 280px fijo, contenido principal fluido
- **Loading:** Skeleton pulse (0.5→1.0 opacity, 1.5s cycle) mirroring table rows — NEVER spinner or blank
- **Buttons:** Max 1 Primary (accent #F4A261) per visible screen. Destructive (#E76F51) ALWAYS requires Dialog confirmation
- **Toasts:** Success = green #D8F3DC (4s auto-dismiss). Error = coral #FADBD8 (persist until dismiss)
- **Role Badges:** Colored chips — SuperAdmin(purple), Director(blue), Admin(green), Agente(orange), Cliente(gray)
- **Keyboard:** Tab through rows, Enter opens Sheet, Escape closes. Focus-visible ring 2px accent
- **Responsive fallback:** <1024px shows Cards instead of Table rows
- **Touch targets:** Min 44x44px mobile, 36px desktop
- **Typography:** Poppins headings, Inter body, Roboto Mono for emails/IDs

### Project Structure Notes

- Files follow feature-adjacent organization (NO `src/features/` folders)
- Tests co-located: `UserTable.test.tsx` next to `UserTable.tsx`
- Schemas in `src/schemas/` — NEVER inline Zod validation
- One component per file (exception: compound components)
- NO barrel exports (`index.ts`)
- Server Components by default; `'use client'` pushed as low as possible
- The users page will be a Client Component (needs interactivity) — push `'use client'` to the leaf components, keep page.tsx as thin Server Component wrapper if possible

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 1, Story 1.6]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md — Roles, Firestore schema, Custom Claims]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md — 28 naming conventions, API patterns]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md — Route groups, API boundaries]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md — Buttons, forms, tables, toasts]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md — AdminDesktopLayout, keyboard nav]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md — shadcn + custom components]
- [Source: _bmad-output/implementation-artifacts/1-5-odoo-client-abstraction-layer.md — OdooClient patterns, cache, retry]
- [Source: src/app/api/auth/claims/route.ts — Existing role assignment endpoint]
- [Source: src/lib/auth/claims.ts — setUserClaims, getUserClaims, initUserClaims]
- [Source: src/lib/auth/permissions.ts — getPermissions, hasPermission, clearPermissionCache]
- [Source: src/config/roles.ts — VALID_ROLES, ROLE_PRIORITY, ROLE_DASHBOARDS, NAV_SECTIONS_BY_ROLE]
- [Source: src/schemas/roleSchema.ts — setRolesSchema with agentId validation]
- [Source: firestore.rules — /users, /config, /odooCache rules]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
