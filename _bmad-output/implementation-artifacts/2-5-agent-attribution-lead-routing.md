# Story 2.5: Agent Attribution & Lead Routing

Status: done

## Story

As an **agente**,
I want visitors who arrive via my referral link to be automatically assigned to me,
So that I receive credit for leads I generate.

## Acceptance Criteria

1. **Given** a visitor arrives with `?ref=agentId` parameter **When** they create an order (guest or authenticated) **Then** the `agentId` is validated against Firestore `/users/` (must be active agent) before storing in the order document (FR14)
2. **Given** a visitor arrives with `?ref=agentId` **When** they create an account **Then** they are automatically assigned to that agent (first-touch attribution) **And** `assignedAgentId` is stored in the user's Firestore document (FR14)
3. **Given** a visitor arrives WITHOUT a ref parameter **When** they create an order **Then** the lead appears in admin's unassigned leads view (FR15)
4. **Given** an agent is logged in **When** they navigate to the trip catalog **Then** they see the same catalog as visitors PLUS a "Copiar Mi Link" button per trip (FR20, FR36)
5. **Given** an agent clicks "Copiar Mi Link" **Then** the clipboard receives `{origin}/viajes/{slug}?ref={agentId}` **And** a toast "Link copiado al portapapeles" appears (4s auto-dismiss)
6. **Given** an agent is logged in **When** they navigate to `/agent/leads` **Then** they see a list of orders where `agentId` matches their own, with contact name, trip, status, and date

## Tasks / Subtasks

- [x] **Task 1: Validate agentId server-side in POST /api/orders** (AC: #1)
  - [x] 1.1 Add Firestore lookup: verify `agentId` exists in `/users/` with role `agente` and is active
  - [x] 1.2 If invalid agentId, silently ignore (don't block order creation — set agentId to null)
  - [x] 1.3 Add test: valid agentId, invalid agentId, missing agentId

- [x] **Task 2: Persist attribution on user registration** (AC: #2)
  - [x] 2.1 In registration flow, read `sessionStorage.attribution_ref` and UTM params
  - [x] 2.2 After account creation, write `assignedAgentId` + `attributionSource` to `/users/{uid}`
  - [x] 2.3 Link guest orders to new account: already implemented via linkGuestOrders in session/route.ts
  - [x] 2.4 Add test: registration with ref, without ref (2 tests in firestore.test.ts)

- [x] **Task 3: Agent catalog page with "Copiar Mi Link"** (AC: #4, #5)
  - [x] 3.1 Create `/agent/catalog/page.tsx` — reuse `CatalogContent` with variant="agent"
  - [x] 3.2 Pass `agentId` from `useAuthStore().claims.agentId` to CatalogContent
  - [x] 3.3 In CatalogContent: implement clipboard copy with `navigator.clipboard.writeText()` + fallback
  - [x] 3.4 Show toast "Link copiado al portapapeles" on successful copy (4s auto-dismiss via sonner)
  - [x] 3.5 Add "Catalogo" + "Mis Leads" tabs to `AGENT_TABS` in agent layout
  - [x] 3.6 Add test: page renders with agentId, no-access states (3 tests)

- [x] **Task 4: Agent leads page** (AC: #6)
  - [x] 4.1 Create `GET /api/agents/[agentId]/orders` — returns orders with .select() projection + trip name batch fetch
  - [x] 4.2 Protect with `requireAuth()` + verify `claims.agentId === params.agentId` (agent isolation)
  - [x] 4.3 Create `/agent/leads/page.tsx` with desktop table + mobile cards (contact name, trip name, monto, status, date)
  - [x] 4.4 "Mis Leads" tab already added in Task 3
  - [x] 4.5 Empty state: "Tu primer cliente te espera" + CTA "Comparte tu link" → `/agent/catalog`
  - [x] 4.6 Tests: 4 API tests (orders, empty, 403 isolation, 401 auth) + 3 UI tests (no-access, empty state, renders orders)

- [x] **Task 5: Admin unassigned leads view** (AC: #3)
  - [x] 5.1 Create `GET /api/orders/unassigned` — returns orders where `agentId` is null, sorted by `createdAt` desc
  - [x] 5.2 Protect with `requirePermission('orders:readAll')` (admin has this permission)
  - [x] 5.3 Create `/admin/leads/page.tsx` with unassigned order list + "Asignar" button per row
  - [x] 5.4 Create `PATCH /api/orders/[orderId]/assign` — sets `agentId` on order + `assignedAgentId` on user doc
  - [x] 5.5 Agent selector dialog: list active agents, search by name
  - [x] 5.6 Add "Leads" to admin + superadmin sidebar navigation
  - [x] 5.7 Add test: 2 unassigned API tests + 5 assign API tests + 5 UI tests

- [x] **Task 6: Typecheck + build verification**
  - [x] 6.1 `pnpm typecheck` — zero errors
  - [x] 6.2 `pnpm build` — successful
  - [x] 6.3 `pnpm test` — 1013 passed, 0 failed, 32 todo (pre-existing)

## Dev Notes

### What Already Exists (DO NOT REBUILD)

**Attribution capture is ALREADY implemented:**
- `src/lib/analytics.ts` → `captureAttribution()` reads `?ref=agentId` from URL and saves to `sessionStorage.attribution_ref` (first-touch-wins pattern)
- `src/app/(public)/viajes/[slug]/ConversionFlow.tsx` → `getAttributionData()` reads from sessionStorage and passes to form
- `src/schemas/orderSchema.ts` → `createOrderSchema` already has `agentId: z.string().max(128).optional()`
- `src/app/api/orders/route.ts` → already saves `agentId` to Firestore order document
- `captureAttribution()` is called in `AnalyticsProvider.tsx` on every public page load

**TripCard variant="agent" is ALREADY defined:**
- `src/components/custom/TripCard.tsx` → `CTA_LABELS.agent = 'Copiar Link'`
- The variant exists but the `onClick` for clipboard copy is not wired up
- The caller must pass the right `onClick` handler

**Agent layout shell exists:**
- `src/app/(agent)/layout.tsx` → `AGENT_TABS` array with 2 tabs (dashboard, profile)
- `src/components/custom/BottomNavBar.tsx` → supports `notificationBadges` per tab
- Agent dashboard page is placeholder: "Epic 4 implementa portal agente"

**Auth store has agent info:**
- `src/stores/useAuthStore.ts` → `claims.agentId` available for authenticated agents
- `src/types/user.ts` → `UserClaims.agentId?: string`

### What Needs to Be Built

| Component | Gap |
|---|---|
| `POST /api/orders` agentId validation | Verify agentId is real active agent in Firestore |
| Registration attribution persistence | Write `assignedAgentId` + `attributionSource` to user doc |
| Guest-to-account order linking | Query orders by `guestToken`, update `userId` |
| `/agent/catalog/page.tsx` | New page reusing CatalogContent with variant="agent" |
| Clipboard copy logic | `navigator.clipboard.writeText()` + toast |
| `/agent/leads/page.tsx` | New page showing agent's orders |
| `GET /api/agents/[agentId]/orders` | New API route |
| `/admin/leads/page.tsx` | New page showing unassigned orders |
| `GET /api/orders/unassigned` | New API route |
| `PATCH /api/orders/[orderId]/assign` | New API route |
| Agent selector dialog | Dialog to pick agent for assignment |
| Navigation updates | New tabs in AGENT_TABS, admin sidebar |

### Critical Implementation Rules

1. **NEVER trust client-side agentId** — always validate server-side against Firestore before writing attribution
2. **First-touch-wins** — if `sessionStorage.attribution_ref` already has a value, don't overwrite it
3. **Silent failure on invalid ref** — if `?ref=invalid` arrives, ignore silently (don't show error, don't block the visitor)
4. **Server-side agent lookup** — `POST /api/orders` must verify agentId exists in `/users/` with `roles` containing `agente`
5. **Firestore select() projection** — when listing orders for agent/admin, use `.select()` to avoid transferring unnecessary fields
6. **Zod safeParse** for all external data — NEVER `as Type`
7. **AppError pattern** for all API error responses: `{ code, message, retryable }`
8. **POST returns 201** for created resources
9. **requireAuth()** on all protected routes, **requireRole('admin')** for admin-only routes
10. **Agent isolation** — agent can ONLY see orders with their own `agentId`, enforced server-side

### Project Structure Notes

```
src/app/
  (agent)/
    agent/
      catalog/page.tsx          # NEW — agent catalog with "Copiar Mi Link"
      leads/page.tsx            # NEW — agent's orders list
      layout.tsx                # MODIFY — add catalog + leads to AGENT_TABS
  (admin)/
    admin/
      leads/page.tsx            # NEW — unassigned leads queue
      leads/AgentSelectorDialog.tsx  # NEW — dialog to pick agent
  api/
    agents/
      [agentId]/
        orders/route.ts         # NEW — GET agent's orders
    orders/
      route.ts                  # MODIFY — add agentId validation
      unassigned/route.ts       # NEW — GET unassigned orders
      [orderId]/
        assign/route.ts         # NEW — PATCH assign agent to order
  (auth)/
    register/page.tsx           # MODIFY — persist attribution on signup

src/schemas/
  orderSchema.ts                # MODIFY — add assignOrderSchema for PATCH

src/lib/
  analytics.ts                  # EXISTS — captureAttribution() already works
```

### Patterns from Previous Stories

**From Story 2-4 (Conversion Flow):**
- `tryAuth()` for optional auth (guest checkout) — reuse same pattern
- Zod `safeParse` for all request bodies — MANDATORY
- `FieldValue.serverTimestamp()` not serializable — exclude from JSON response
- Rate limiting with `.count().get()` — efficient Firestore aggregation
- Toast notifications via sonner — already configured
- `useSearchParams()` needs `Suspense` boundary

**From Story 1.6 (SuperAdmin Panel):**
- Admin data tables with actions — reuse DataTable pattern if exists
- `requireRole('admin')` for admin-only endpoints
- Agent list fetching — look at existing `/api/odoo/sync-users` patterns

**From Story 1.7 (User Profile):**
- Firestore `update()` on doc that might not exist → always check `.exists` first
- `FieldValue.delete()` for removing fields

### Clipboard API Notes

```typescript
// Modern clipboard API — works in HTTPS and localhost
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    return true
  }
}
```

### Registration Attribution Flow

```
1. Visitor lands on /viajes/vuelta-al-mundo-2025?ref=lupita
2. AnalyticsProvider → captureAttribution() → sessionStorage.attribution_ref = "lupita"
3. Visitor clicks "Cotizar" → guest order created with agentId="lupita"
4. Visitor decides to register → /register?returnUrl=/viajes/vuelta-al-mundo-2025
5. RegisterPage: after Firebase Auth createUser:
   a. Read sessionStorage: attribution_ref, utm_source, utm_medium, utm_campaign
   b. Write to /users/{uid}: { assignedAgentId: "lupita", attributionSource: {...} }
   c. Query /orders where guestToken == localStorage.guestOrderToken
   d. Update matching orders: set userId = uid
6. Visitor redirected back to trip page (returnUrl)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5] — Acceptance Criteria, FR14, FR15, FR20, FR36, FR37
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md] — FR13-FR20, FR36-37, FR59-61
- [Source: _bmad-output/planning-artifacts/prd/user-journeys.md#Journey 1] — Attribution flow
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md] — API patterns, naming conventions
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md] — Firestore model, security rules
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md] — TripCard variants, BottomNavBar
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md] — Toast pattern, empty states
- [Source: src/lib/analytics.ts] — captureAttribution() already implemented
- [Source: src/app/api/orders/route.ts] — POST order with agentId field
- [Source: src/schemas/orderSchema.ts] — createOrderSchema with agentId
- [Source: src/components/custom/TripCard.tsx] — variant="agent" with "Copiar Link" CTA
- [Source: src/app/(agent)/layout.tsx] — AGENT_TABS array
- [Source: src/stores/useAuthStore.ts] — claims.agentId for authenticated agents

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Dashboard page.test.tsx was stale (tested old welcome page, not current redirect-only skeleton). Fixed to match current implementation.
- RoleSidebar.test.tsx updated count from 3→4 inactive items after adding Leads nav item.

### Completion Notes List

- Task 1: Server-side agentId validation in POST /api/orders — 27/27 tests
- Task 2: Registration attribution persistence — 7/7 tests, uses optional AttributionData param
- Task 3: Agent catalog with clipboard copy — 3/3 tests, reuses CatalogContent with agentId prop
- Task 4: Agent leads page — 4 API tests + 3 UI tests, desktop table + mobile cards
- Task 5: Admin unassigned leads — 2 unassigned API + 5 assign API + 5 UI tests, AgentSelectorDialog with search
- Task 6: Full verification — typecheck 0 errors, build OK, 1013 tests pass

### Code Review Fixes (0 deuda tecnica)

- **H1**: Added Cache-Control `public, s-maxage=300, stale-while-revalidate=600` to `/api/trips/published`
- **M1**: Registration attribution now validates agentId server-side via `GET /api/agents/[agentId]/validate` before persisting — 5 new tests
- **M2**: Extracted `STATUS_COLORS` to `src/config/orderStatus.ts` — single source of truth, imported by both agent/leads and admin/leads
- **M3**: Fixed AgentSelectorDialog to use `agent.agentId` (from API) instead of `agent.uid` for onSelect
- **M4**: Created `AgentSelectorDialog.test.tsx` — 5 tests (fetch, filter, selection uses agentId, error, closed state)
- Post-fix verification: typecheck 0 errors, build OK, 1023 tests pass (10 new)

### File List

**Modified:**
- `src/app/api/orders/route.ts` — added server-side agentId validation
- `src/app/api/orders/route.test.ts` — 5 new agentId validation tests
- `src/lib/firebase/firestore.ts` — createUserProfile accepts optional AttributionData
- `src/lib/firebase/firestore.test.ts` — 2 new attribution tests
- `src/app/(auth)/register/page.tsx` — getRegistrationAttribution() now async with server-side agentId validation
- `src/app/(public)/viajes/CatalogContent.tsx` — agentId prop, clipboard copy, toast
- `src/app/(agent)/layout.tsx` — AGENT_TABS expanded: catalog + leads
- `src/app/(agent)/agent/leads/page.tsx` — imports STATUS_COLORS from shared config
- `src/components/custom/RoleSidebar.tsx` — added Leads to admin + superadmin sections
- `src/components/custom/RoleSidebar.test.tsx` — updated inactive count
- `src/schemas/orderSchema.ts` — added assignOrderSchema
- `src/app/dashboard/page.test.tsx` — fixed stale tests to match redirect-only page
- `src/app/api/trips/published/route.ts` — added Cache-Control headers (s-maxage=300)
- `src/app/(admin)/admin/leads/UnassignedLeadsPanel.tsx` — imports STATUS_COLORS from shared config
- `src/app/(admin)/admin/leads/AgentSelectorDialog.tsx` — uses agentId field instead of uid for onSelect
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — in-progress → review

**Created:**
- `src/config/orderStatus.ts` — shared STATUS_COLORS for order badge styling
- `src/app/(agent)/agent/catalog/page.tsx` — agent catalog wrapper
- `src/app/(agent)/agent/catalog/AgentCatalogContent.tsx` — fetches trips + renders CatalogContent
- `src/app/(agent)/agent/catalog/page.test.tsx` — 3 tests
- `src/app/api/trips/published/route.ts` — GET published trips for client-side
- `src/app/api/agents/[agentId]/orders/route.ts` — GET agent's orders with isolation
- `src/app/api/agents/[agentId]/orders/route.test.ts` — 4 tests
- `src/app/api/agents/[agentId]/validate/route.ts` — GET public agent validation endpoint
- `src/app/api/agents/[agentId]/validate/route.test.ts` — 5 tests
- `src/app/(agent)/agent/leads/page.tsx` — agent leads with table + cards
- `src/app/(agent)/agent/leads/page.test.tsx` — 3 tests
- `src/app/api/orders/unassigned/route.ts` — GET unassigned orders
- `src/app/api/orders/unassigned/route.test.ts` — 2 tests
- `src/app/api/orders/[orderId]/assign/route.ts` — PATCH assign agent
- `src/app/api/orders/[orderId]/assign/route.test.ts` — 5 tests
- `src/app/(admin)/admin/leads/page.tsx` — admin leads page wrapper
- `src/app/(admin)/admin/leads/UnassignedLeadsPanel.tsx` — unassigned leads list + assign flow
- `src/app/(admin)/admin/leads/AgentSelectorDialog.tsx` — dialog to pick agent
- `src/app/(admin)/admin/leads/UnassignedLeadsPanel.test.tsx` — 5 tests
- `src/app/(admin)/admin/leads/AgentSelectorDialog.test.tsx` — 5 tests
- `src/app/(superadmin)/superadmin/leads/page.tsx` — thin wrapper reusing admin component
