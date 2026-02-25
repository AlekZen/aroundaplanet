# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AroundaPlanet — digital transformation platform for a travel agency (8 years in business, ~100 freelance agents, 8 admin staff). Product: "Vuelta al Mundo 33.8 dias" ($145K MXN). Based in Ocotlan, Jalisco with expansion to Madrid.

**Current state:** Story 1.1a (Project Scaffold & CI Pipeline) in progress. Epic 1 active.

## Build & Development Commands

```bash
pnpm run dev          # next dev --turbopack (Serwist disabled in dev)
pnpm run build        # next build --webpack (Serwist SW requires webpack bundler)
pnpm run test         # vitest run --passWithNoTests
pnpm run test:watch   # vitest
pnpm run test:e2e     # playwright test
pnpm run lint         # eslint src/
pnpm run typecheck    # tsc --noEmit
```

Run `pnpm typecheck` before considering any task complete (zero type errors required).
Build uses `--webpack` flag because `@serwist/next` injects the SW via webpack plugin (incompatible with Turbopack). Dev uses Turbopack (faster HMR, Serwist disabled anyway).

## Tech Stack

- **Frontend:** Next.js (App Router, PWA via Serwist) + TypeScript + Tailwind v4 + shadcn/ui
- **State:** Zustand (small focused stores, no immer)
- **Auth:** Firebase Authentication (Email + Google Sign-In) + custom JWT claims (roles: string[] + agentId?: string)
- **Database:** Firestore (real-time sync, hybrid: flat collections + agent-scoped subcollections)
- **Storage:** Firebase Storage (receipts, UGC, profiles)
- **AI:** Firebase AI Logic (gemini-2.5-flash-lite) for OCR on payment receipts
- **Notifications:** FCM + WhatsApp (Odoo) + email fallback, centralized NotificationService
- **Analytics:** Firebase Analytics + Meta Pixel + Google Tag
- **Hosting:** Firebase App Hosting (Blaze plan, us-east4, Cloud Run)
- **ERP:** Odoo 18 Enterprise Online via XML-RPC (aroundaplanet.odoo.com, ~60 req/min rate limit)
- **Testing:** Vitest (unit, co-located) + Playwright (E2E in `/e2e/`)
- **CI:** GitHub Actions (ESLint + Vitest + Playwright)
- **Build tool:** pnpm
- **Production branch:** `master` (NOT main)

## Architecture — Route Groups by Role

```
src/app/
  (public)/    # PublicLayout — SSG/ISR, floating navbar + footer
  (auth)/      # AuthLayout — hero blur + centered card
  (agent)/     # AgentMobileLayout — BottomNav + FAB, mobile-first
  (admin)/     # AdminDesktopLayout — Sidebar 280px, desktop-first
  (director)/  # DirectorLayout — KPI swipe, semaforo alerts
  (client)/    # ClientLayout — EmotionalProgress hero
  (superadmin)/ # AdminDesktopLayout shared
  api/         # 8 API boundaries: auth, odoo, payments, payments/ocr, notifications, contracts, analytics, sync
```

5 additive roles: Cliente (base) + Agente + Admin + Director + SuperAdmin. Granular permissions from day 1, seeded from Odoo.

## Critical Implementation Rules (Architecture Law)

These 28 naming conventions and patterns are non-negotiable:

**Firestore:** `camelCase` collections (plural), `camelCase` fields, Firestore `Timestamp` for dates (NEVER ISO strings in writes), booleans with `is/has/can` prefix, currency in centavos (integer, NEVER floating point).

**API routes:** `kebab-case` folders (`/api/odoo/search-read`), `camelCase` query/path params. Return data directly in JSON (NO `{ success: true, data: ... }` wrapper). Use `AppError` pattern for errors: `{ code, message, retryable }`.

**Code naming:** `PascalCase` component files (`PaymentStepper.tsx`), `camelCase` hooks with `use` prefix, `camelCase` stores with `use`+`Store` suffix, `PascalCase` types without `I` prefix, `UPPER_SNAKE_CASE` constants, `camelCase` Zod schemas with `Schema` suffix. Internal handlers: `handle*`. Callback props: `on*`.

**Structural rules:**
- Feature-adjacent organization (NEVER `src/features/` folders — App Router route groups already organize by feature)
- Tests co-located with source (`KPICard.test.tsx` next to `KPICard.tsx`, NEVER `__tests__/` directory)
- E2E tests in `/e2e/` at project root
- One component per file (exception: compound components like Table+TableRow)
- NO barrel exports (`index.ts` that re-exports) — always import directly
- Zod schemas in `src/schemas/` — NEVER inline validation
- Server Components by default; `'use client'` pushed as low as possible
- Loading: ALWAYS Skeleton with pulse (NEVER generic Spinner or blank screen)
- Error boundaries per route group (NEVER single global error boundary)
- Validation triple: React Hook Form + Zod (client) → Zod (server) → Firestore Security Rules

**Odoo integration:** XML-RPC only. OdooClient abstraction in `lib/odoo/client.ts` (anti vendor-lock). Exponential backoff retry (1s→2s→4s, max 3). Cache TTL: trips 24h, contacts 1h, orders 15min, invoices 1h, KPIs 5min. Pagination required for datasets >100. NEVER expose Odoo directly to client.

**Rendering strategy:** SSG+ISR for public pages, CSR+onSnapshot for dashboards, CSR+offline for agent portal. Offline: IndexedDB queue + Background Sync API (Android) + `window.addEventListener('online')` (iOS fallback).

**Environment:** ADC in production (NO JSON admin SDK in Cloud Run). JSON admin SDK only in dev via `.keys/`. Secrets via Cloud Secret Manager + `apphosting.yaml`.

## Key File Locations

```
.keys/                    # Credentials (gitignored): Firebase Admin SDK, client SDK config, VAPID keys
src/lib/odoo/client.ts    # OdooClient XML-RPC abstraction layer
src/lib/firebase/admin.ts # Firebase Admin SDK (ADC prod, JSON dev)
src/lib/notifications/    # NotificationService: declarative rules, multi-channel fallback
src/schemas/              # All Zod validation schemas
src/proxy.ts              # Auth verification + role routing on every request (Next.js 16 proxy, NOT middleware)
apphosting.yaml           # Production config (Cloud Run: min=1, max=10, concurrency=80)
firestore.rules           # Security rules (agent isolation: request.auth.token.agentId == agentId)
```

## BMAD Methodology & Artifacts

This project uses BMAD v6.0.3. All planning artifacts are in `_bmad-output/`:

**Planning artifacts (read order for full context):**
1. `planning-artifacts/prd/index.md` — PRD table of contents (68 FRs, 32 NFRs, 7 user journeys)
2. `planning-artifacts/prd/user-journeys.md` — 7 detailed journeys (most important for understanding flows)
3. `planning-artifacts/architecture/index.md` — Architecture decisions + implementation patterns
4. `planning-artifacts/ux-design-specification/index.md` — UX spec (5 layouts, design system, 9 custom components)
5. `planning-artifacts/epics.md` — 7 epics, 35 stories

**Implementation tracking:** `implementation-artifacts/sprint-status.yaml` — all story statuses

**BMAD workflows:** invoke via `/bmad-bmm-*` skills. Implementation cycle per story: Create Story → Dev Story → Code Review → next story. Retrospective optional per epic.

## Next.js 16 Migration Notes (IMPORTANT for all stories)

These conventions changed in Next.js 16. **NEVER use the deprecated patterns:**

| Deprecated (Next.js 15) | Current (Next.js 16) | Notes |
|---|---|---|
| `middleware.ts` / `export function middleware()` | `proxy.ts` / `export function proxy()` | Same API (NextRequest, NextResponse), just renamed. File lives at `src/proxy.ts` |
| `skipMiddlewareUrlNormalize` | `skipProxyUrlNormalize` | Config flag renamed |
| `next build` (defaults to Turbopack) | `next build --webpack` | Required for `@serwist/next` which uses webpack plugin. Dev uses Turbopack (Serwist disabled) |
| Static `import withSerwistInit from "@serwist/next"` | Dynamic `const withSerwistInit = (await import("@serwist/next")).default` | Avoids CJS/ESM mismatch in compiled config |

**Serwist 9.5+ API (NOT the old workbox-style strings):**
- Runtime caching handlers are **class instances**: `new CacheFirst({...})`, NOT strings `"CacheFirst"`
- Use `matcher` functions, NOT `urlPattern` regex
- Expiration via `ExpirationPlugin` in handler's `plugins` array
- `__SW_MANIFEST` requires `declare global { interface WorkerGlobalScope extends SerwistGlobalConfig { ... } }`

## Design System

- **Colors:** primary `#1B4332` (dark green), accent `#F4A261` (orange), background `#FAFAF8` (warm white)
- **Components:** shadcn/ui base (19) + 9 custom (EmotionalProgress, KPICard, PaymentStepper, VerificationPanel, BottomNavBar, RoleSidebar, TripCard, OfflineBanner, BusinessMetric)
- **Public pages:** 21st.dev for high-conversion landing pages

## Credentials

All in `.keys/` (gitignored):
- `arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json` — Firebase Admin SDK
- `firebaseSDK.txt` — Firebase client SDK config values
- `pushkeys.txt` — FCM VAPID keys

## External Context

Companion strategy repo at `D:\dev\AlekContenido\Areas\Proyectos\AroundaPlanet` contains business context (data sheet, stakeholder profiles, meeting minutes, competitive analysis, timeline).

## Language

All documentation, commit messages, and agent communication in **Espanol Mexicano**.
