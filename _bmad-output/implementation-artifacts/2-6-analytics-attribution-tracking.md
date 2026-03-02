# Story 2.6: Analytics & Attribution Tracking

Status: done

## Story

As a **director/admin**,
I want all visitor interactions tracked with proper attribution,
So that we can measure marketing effectiveness and agent performance.

## Acceptance Criteria

1. **Given** any public page loads **When** the page renders **Then** Firebase Analytics captures the pageview with UTM parameters if present (FR59, FR60) **And** Meta Pixel fires corresponding event (FR61) **And** Google Tag Manager container processes the event (FR61)
2. **Given** a conversion event occurs (view_trip, sign_up, begin_checkout, purchase) **When** the event fires **Then** all three analytics platforms receive the event simultaneously (FR59, FR61) **And** the event includes attribution data: UTM source/medium/campaign, agent ref if present
3. **Given** UTM or ref parameters are present in the URL **When** the visitor navigates within the site **Then** attribution data persists in session storage across page navigations **And** upon account creation, attribution is permanently stored in `/users/{uid}` document (FR60)
4. **Given** a trackable event fires **When** the analytics service processes it **Then** the event is also written to Firestore `/analytics/events/{eventId}` with fields: type, timestamp, channel, agentRef, userId, metadata **And** this data is available for the Director Dashboard (Epic 5, Story 5.2)

## Tasks / Subtasks

- [x] **Task 1: Fix analytics infrastructure** (AC: #1)
  - [x] 1.1 Fix env var mismatch: unified to `NEXT_PUBLIC_GTM_ID`
  - [x] 1.2 Initialize Firebase Analytics SDK in AnalyticsProvider via `initFirebaseAnalytics()`
  - [x] 1.3 Added `NEXT_PUBLIC_META_PIXEL_ID` and `NEXT_PUBLIC_GTM_ID` to `apphosting.yaml`
  - [x] 1.4 Updated `.env.example` with placeholder values and comments
  - [x] 1.5 Tests: 11 analytics.test.ts tests cover initialization and dispatching

- [x] **Task 2: Create Firestore analytics event writer** (AC: #4)
  - [x] 2.1 Created `POST /api/analytics/events` with Zod validation and Firestore write
  - [x] 2.2 Rate limit: 30/min guest (IP-based), 60/min auth (uid-based) via Firestore `.count()`
  - [x] 2.3 Zod schema `analyticsEventSchema` in `src/schemas/analyticsEventSchema.ts`
  - [x] 2.4 Created `src/lib/analytics-server.ts` — `writeAnalyticsEvent()` helper
  - [x] 2.5 4 API tests (valid event 201, invalid type 400, rate limit 429, userId enrichment)

- [x] **Task 3: Client-side analytics service upgrade** (AC: #1, #2)
  - [x] 3.1 `trackEvent()` fires `logEvent()` from Firebase Analytics SDK (4th platform)
  - [x] 3.2 `writeServerEvent()` fire-and-forget POST to `/api/analytics/events`
  - [x] 3.3 Wired `writeServerEvent` into `trackEvent()` and `trackPageView()`
  - [x] 3.4 Added `sign_up` event: register page (email+google), login page (first-time email+google)
  - [x] 3.5 META_PIXEL_EVENTS mapping: view_item→ViewContent, begin_checkout→InitiateCheckout, sign_up→CompleteRegistration, generate_lead→Lead, purchase→Purchase
  - [x] 3.6 Tests: trackEvent dispatches all 4, writeServerEvent fires fetch with attribution

- [x] **Task 4: Verify attribution end-to-end flow** (AC: #3)
  - [x] 4.1 captureAttribution tests: stores UTM+ref, first-touch-wins (analytics.test.ts)
  - [x] 4.2 getRegistrationAttribution validates server-side (Story 2-5, already working)
  - [x] 4.3 getAttributionData in ConversionFlow reads sessionStorage (Story 2-4, already working)
  - [x] 4.4 Integration test: captureAttribution → trackEvent → writeServerEvent chain verified
  - [x] 4.5 Attribution flow documented in Completion Notes below

- [x] **Task 5: Typecheck + build verification**
  - [x] 5.1 `pnpm typecheck` — zero errors
  - [x] 5.2 `pnpm build` — successful
  - [x] 5.3 `pnpm test` — 1038 passed, 0 failed

## Dev Notes

### What Already Exists (DO NOT REBUILD)

**Triple-platform analytics is ALREADY wired up:**
- `src/lib/analytics.ts` → `trackEvent(name, params?)` dispatches to `window.gtag()`, `window.fbq()`, `window.dataLayer.push()` simultaneously
- `src/lib/analytics.ts` → `trackPageView(path)` fires page_view to gtag + fbq
- `src/lib/analytics.ts` → `captureAttribution()` reads `?ref`, `?utm_source`, `?utm_medium`, `?utm_campaign` from URL, saves to sessionStorage (first-touch-wins)

**AnalyticsProvider is ALREADY mounted:**
- `src/components/shared/AnalyticsProvider.tsx` — Client Component, loads GTM/Meta Pixel via `<Script strategy="afterInteractive">`
- Calls `captureAttribution()` once on mount
- Tracks page views on SPA navigation via pathname change
- **ONLY mounted in `src/app/(public)/layout.tsx`** — NOT in agent/admin/director/client layouts (intentional: those are private routes)

**Event tracking calls ALREADY exist:**
| File | Event | When |
|---|---|---|
| `CatalogContent.tsx:141` | `view_item_list` | Catalog page load |
| `CatalogContent.tsx:153` | `select_item` | Trip card click |
| `CatalogContent.tsx:180` | `agent_copy_link` | Agent copies referral link |
| `TripAnalytics.tsx:13` | `view_item` | Trip landing page load |
| `ConversionFlow.tsx:54` | `begin_checkout` | Conversion form opens |
| `ConversionFlow.tsx:65` | `select_item` | Departure date selected |
| `ConversionForm.tsx:154` | `generate_lead` | Order successfully created |

**Attribution persistence in registration ALREADY works (Story 2-5):**
- `src/app/(auth)/register/page.tsx` → `getRegistrationAttribution()` reads sessionStorage, validates agentId server-side via `/api/agents/[agentId]/validate`, passes to `createUserProfile()`
- `src/lib/firebase/firestore.ts` → `createUserProfile()` accepts optional `AttributionData` and writes `assignedAgentId` + `attributionSource` to `/users/{uid}`

### What Needs to Be Built

| Component | Gap |
|---|---|
| Env var mismatch | `AnalyticsProvider` reads `NEXT_PUBLIC_GOOGLE_TAG_ID` but `.env.example` has `NEXT_PUBLIC_GTM_ID` |
| Firebase Analytics SDK | Not initialized — only using inline gtag/fbq. Need `getAnalytics()` for Firebase-native events |
| Production env vars | `NEXT_PUBLIC_META_PIXEL_ID` and `NEXT_PUBLIC_GTM_ID` not in `apphosting.yaml` |
| Firestore event writing | No `/analytics/events/` collection. Events only go to 3rd-party platforms, not our own DB |
| `POST /api/analytics/events` | New API route for server-side event persistence |
| `sign_up` event | Not tracked anywhere — registration completes without analytics event |
| `purchase` event | Not yet trackable (happens when payment verified in Epic 3) — document as future hook |

### Critical Implementation Rules

1. **Fire-and-forget for Firestore writes** — analytics MUST NEVER block user interactions. `writeServerEvent()` must be non-blocking (no await in the UI path)
2. **AnalyticsProvider stays in public layout ONLY** — private routes don't need GTM/Pixel tracking (those are for marketing attribution). Firestore events in private routes go through API calls
3. **Firebase Analytics SDK is SEPARATE from gtag** — `getAnalytics()` initializes Firebase Analytics, which sends to Google's Firebase console. `gtag()` sends to GA4 via GTM. Both should fire for redundancy
4. **Rate limit the analytics API** — public endpoint, must prevent abuse. Use IP-based rate limiting like orders route
5. **Event type allowlist** — only accept known event types in the API to prevent spam: `page_view`, `view_item`, `view_item_list`, `select_item`, `begin_checkout`, `generate_lead`, `sign_up`, `purchase`, `agent_copy_link`
6. **Zod safeParse** for all external data — NEVER `as Type`
7. **AppError pattern** for API errors: `{ code, message, retryable }`
8. **tryAuth() not requireAuth()** — analytics events can come from both guests and authenticated users

### Firestore Analytics Event Schema

```typescript
// /analytics/events/{eventId}
interface AnalyticsEvent {
  type: string              // 'page_view' | 'view_item' | 'begin_checkout' | 'sign_up' | 'generate_lead' | etc.
  timestamp: Timestamp      // FieldValue.serverTimestamp()
  channel: string | null    // utm_source or 'direct' or 'agent_ref'
  agentRef: string | null   // attribution_ref from sessionStorage
  userId: string | null     // from tryAuth() — null for guests
  metadata: Record<string, string | number | boolean>  // event-specific params
  ip: string                // for rate limiting, hashed or truncated for privacy
}
```

**This is consumed by:**
- Story 5.2 (Director Dashboard traffic widget) via Firestore `onSnapshot`
- Story 5.4 (Cloud Function `aggregateAnalyticsEvent`) materializes into `/analytics/daily/`, `/analytics/agents/`, `/analytics/traffic/`

### Project Structure Notes

```
src/lib/
  analytics.ts                  # MODIFY — add Firebase Analytics SDK init, writeServerEvent(), sign_up event
  analytics-server.ts           # NEW — writeAnalyticsEvent() for server-side Firestore writes

src/components/shared/
  AnalyticsProvider.tsx          # MODIFY — fix env var name, init Firebase Analytics SDK

src/schemas/
  analyticsEventSchema.ts       # NEW — Zod schema for analytics event validation

src/app/api/
  analytics/
    events/route.ts             # NEW — POST analytics events to Firestore
    events/route.test.ts        # NEW — 4+ tests

src/app/(auth)/
  register/page.tsx             # MODIFY — add trackEvent('sign_up') after successful registration

.env.example                    # MODIFY — fix GTM var name, add comments
apphosting.yaml                 # MODIFY — add NEXT_PUBLIC_META_PIXEL_ID and NEXT_PUBLIC_GTM_ID
```

### Patterns from Previous Stories

**From Story 2-5 (Agent Attribution):**
- `tryAuth()` for optional auth — analytics events come from guests AND authenticated users
- `getRegistrationAttribution()` is now async (validates agentId server-side) — don't break this
- `captureAttribution()` keys in sessionStorage: `attribution_ref`, `attribution_utm_source`, `attribution_utm_medium`, `attribution_utm_campaign`
- Toast notifications via sonner — already configured

**From Story 2-4 (Conversion Flow):**
- `getAttributionData()` reads sessionStorage and passes to ConversionForm
- Rate limiting with `.count().get()` — efficient Firestore aggregation
- `FieldValue.serverTimestamp()` not serializable — exclude from JSON response
- POST returns 201 for created resources

**From Story 1.2 (Public Landing Pages):**
- `AnalyticsProvider` renders as sibling, NOT wrapping children (avoids forcing Client Component boundary)
- Meta Pixel and GTM scripts use `<Script strategy="afterInteractive">`

### Firebase Analytics SDK Notes

```typescript
// Initialize Firebase Analytics (client-side only)
import { getAnalytics, logEvent, isSupported } from 'firebase/analytics'
import { getApp } from 'firebase/app'

// Must check isSupported() — Analytics not available in all environments (SSR, some browsers)
let analytics: ReturnType<typeof getAnalytics> | null = null

async function initAnalytics() {
  if (typeof window === 'undefined') return
  const supported = await isSupported()
  if (supported) {
    analytics = getAnalytics(getApp())
  }
}

// Then in trackEvent:
if (analytics) logEvent(analytics, eventName, params)
```

### Event Name Mapping (Standard Ecommerce)

| Our Event | Firebase Analytics | Meta Pixel | GTM dataLayer |
|---|---|---|---|
| `page_view` | `page_view` | `PageView` | `page_view` |
| `view_item` | `view_item` | `ViewContent` | `view_item` |
| `view_item_list` | `view_item_list` | `ViewContent` | `view_item_list` |
| `select_item` | `select_item` | `ViewContent` | `select_item` |
| `begin_checkout` | `begin_checkout` | `InitiateCheckout` | `begin_checkout` |
| `generate_lead` | `generate_lead` | `Lead` | `generate_lead` |
| `sign_up` | `sign_up` | `CompleteRegistration` | `sign_up` |
| `purchase` | `purchase` | `Purchase` | `purchase` |
| `agent_copy_link` | custom | custom | custom |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6] — Acceptance Criteria, FR59, FR60, FR61
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md#Analytics] — FR59-FR63
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md] — Custom Analytics architecture, /analytics/events/ schema
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2] — Director Dashboard traffic widget reads /analytics/events/
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4] — Cloud Function aggregateAnalyticsEvent materializes aggregates
- [Source: _bmad-output/planning-artifacts/prd/success-criteria.md] — KPIs: fuente trafico, leads por agente, embudo conversion
- [Source: _bmad-output/planning-artifacts/prd/user-journeys.md#Journey 1] — Diego: UTM capture + attribution flow
- [Source: _bmad-output/planning-artifacts/prd/user-journeys.md#Journey 5] — Noel: Dashboard widgets traffic + agent performance
- [Source: src/lib/analytics.ts] — trackEvent, trackPageView, captureAttribution
- [Source: src/components/shared/AnalyticsProvider.tsx] — GTM + Meta Pixel scripts, captureAttribution on mount
- [Source: src/app/(public)/layout.tsx] — AnalyticsProvider mounted here only
- [Source: src/app/(auth)/register/page.tsx] — getRegistrationAttribution() with server-side validation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Zod 4.3.6 `z.record()` requires 2 args (key + value schema). Single-arg caused runtime `_zod` TypeError in safeParse.

### Completion Notes List

1. **Zod 4 breaking change**: `z.record(valueSchema)` → `z.record(z.string(), valueSchema)`. Zod 4 interprets single arg as key schema, leaving value undefined.
2. **Firebase Analytics SDK**: Initialized via dynamic import with `isSupported()` check to avoid SSR issues. Module-scoped `firebaseAnalytics` variable.
3. **Fire-and-forget pattern**: `writeServerEvent()` calls `fetch()` with `keepalive: true` and `.catch(() => {})` — never blocks UI.
4. **Meta Pixel mapping**: Standard ecommerce events use `fbq('track', ...)`, custom events use `fbq('trackCustom', ...)`. Mapping in `META_PIXEL_EVENTS` object.
5. **Rate limiting**: Uses Firestore `.count().get()` aggregation — no full document transfers. `analyticsRateLimit` collection with key+timestamp+expireAt.
6. **sign_up event**: Fires AFTER `createUserProfile()` succeeds, in 4 code paths: register email, register google, login email (first-time), login google (first-time).

### Code Review Fixes (1H + 3M + 1L = 5 fixes, 0 deuda tecnica)

1. **H1**: Rate limit TTL — added `expireAt` field to `analyticsRateLimit` entries + TTL policy in `firestore.indexes.json`
2. **M1**: Cached `logEvent` reference at init time — eliminated dynamic `import()` on every trackEvent/trackPageView
3. **M2**: Added metadata size limits — max 20 entries, keys max 100 chars, string values max 500 chars
4. **M3**: Added sign_up server event test — verifies method metadata propagates to writeServerEvent
5. **L1**: Fixed misleading comment in analytics-server.ts — path is `/analytics/events/events/{id}` not "flat collection"

### Attribution Flow (Task 4.5 Documentation)

```
URL (?ref=lupita&utm_source=instagram)
  → captureAttribution() [AnalyticsProvider mount]
    → sessionStorage: attribution_ref, attribution_utm_source, ...
      → trackEvent() → writeServerEvent() → POST /api/analytics/events
        → Firestore /analytics/events/{eventId} (agentRef, channel, metadata)
      → getRegistrationAttribution() [register page, async + server validation]
        → createUserProfile() → /users/{uid} (assignedAgentId, attributionSource)
      → getAttributionData() [ConversionFlow]
        → order creation → /orders/{orderId} (agentId, utmSource, ...)
```

### File List

- `src/components/shared/AnalyticsProvider.tsx` — Fixed env var, added initFirebaseAnalytics
- `src/lib/analytics.ts` — Complete rewrite: Firebase SDK, Meta Pixel mapping, writeServerEvent, getSessionAttribution
- `src/lib/analytics-server.ts` — NEW: writeAnalyticsEvent() Firestore helper
- `src/schemas/analyticsEventSchema.ts` — NEW: Zod schema for event validation
- `src/app/api/analytics/events/route.ts` — NEW: POST endpoint with rate limiting
- `src/app/api/analytics/events/route.test.ts` — NEW: 4 tests
- `src/lib/analytics.test.ts` — NEW: 12 tests (trackEvent, trackPageView, captureAttribution, writeServerEvent, e2e chain)
- `firestore.indexes.json` — Added TTL policy for analyticsRateLimit collection
- `src/app/(auth)/register/page.tsx` — Added trackEvent('sign_up') for email and Google
- `src/app/(auth)/login/page.tsx` — Added trackEvent('sign_up') for first-time email and Google
- `apphosting.yaml` — Added NEXT_PUBLIC_META_PIXEL_ID and NEXT_PUBLIC_GTM_ID
- `.env.example` — Updated comments for analytics env vars
