# Project Structure & Boundaries

## Complete Project Directory Structure

```
aroundaplanet/
├── .github/
│   └── workflows/
│       └── ci.yml                          # GitHub Actions: ESLint + Vitest + Playwright
├── .keys/                                  # gitignored: credentials (dev only)
│   ├── arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json
│   ├── firebaseSDK.txt
│   └── pushkeys.txt
├── public/
│   ├── icons/
│   │   ├── icon-72x72.png                  # Push notification badge
│   │   ├── icon-192x192.png                # PWA icon
│   │   └── icon-512x512.png                # PWA splash
│   ├── images/
│   │   ├── logo-aroundaplanet.webp         # Logo principal
│   │   ├── trips/                          # Trip hero images (SSG)
│   │   └── agents/                         # Agent profile photos
│   └── robots.txt
├── e2e/                                    # Playwright E2E tests
│   ├── auth-flow.spec.ts
│   ├── payment-flow.spec.ts
│   ├── admin-verification.spec.ts
│   ├── agent-portal.spec.ts
│   └── public-catalog.spec.ts
├── src/
│   ├── app/
│   │   ├── globals.css                     # Tailwind v4 + shadcn/ui CSS variables
│   │   ├── layout.tsx                      # Root layout: providers, FCM init, analytics
│   │   ├── not-found.tsx                   # 404 global
│   │   ├── sw.ts                           # Unified service worker (Serwist + FCM)
│   │   ├── manifest.ts                     # Dynamic Web App Manifest
│   │   │
│   │   ├── (public)/                       # Route group: PublicLayout (SSG/ISR)
│   │   │   ├── layout.tsx                  # PublicLayout: floating navbar, footer
│   │   │   ├── page.tsx                    # Landing page (SSG)
│   │   │   ├── about/page.tsx
│   │   │   ├── catalog/
│   │   │   │   ├── page.tsx                # Trip catalog grid (ISR revalidate: 3600)
│   │   │   │   └── [tripSlug]/page.tsx     # Trip detail (ISR)
│   │   │   ├── contact/page.tsx
│   │   │   └── error.tsx
│   │   │
│   │   ├── (auth)/                         # Route group: AuthLayout
│   │   │   ├── layout.tsx                  # AuthLayout: hero blur + centered card
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── error.tsx
│   │   │
│   │   ├── (agent)/                        # Route group: AgentMobileLayout
│   │   │   ├── layout.tsx                  # AgentMobileLayout: BottomNav + FAB
│   │   │   ├── dashboard/page.tsx          # Mi Negocio: KPIs, clientes, comisiones
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx                # Lista clientes (Firestore real-time)
│   │   │   │   └── [clientId]/page.tsx
│   │   │   ├── payments/
│   │   │   │   ├── page.tsx                # Historial pagos
│   │   │   │   ├── report/page.tsx         # Reportar pago (camara + OCR)
│   │   │   │   └── [paymentId]/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── share/page.tsx              # Mi link de referido + QR
│   │   │   └── error.tsx
│   │   │
│   │   ├── (admin)/                        # Route group: AdminDesktopLayout
│   │   │   ├── layout.tsx                  # AdminDesktopLayout: Sidebar 280px
│   │   │   ├── verification/
│   │   │   │   ├── page.tsx                # Cola verificacion (Firestore onSnapshot)
│   │   │   │   └── [paymentId]/page.tsx    # Detalle pago + comprobante + OCR
│   │   │   ├── agents/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [agentId]/page.tsx
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [clientId]/page.tsx
│   │   │   ├── leads/page.tsx
│   │   │   ├── trips/
│   │   │   │   ├── page.tsx                # CRUD viajes (Odoo sync)
│   │   │   │   └── [tripId]/page.tsx
│   │   │   └── error.tsx
│   │   │
│   │   ├── (director)/                     # Route group: DirectorLayout
│   │   │   ├── layout.tsx                  # DirectorLayout: semaforo + KPI swipe
│   │   │   ├── dashboard/page.tsx          # Dashboard BI: KPIs, graficas, alertas
│   │   │   ├── agents/[agentId]/page.tsx   # Drill-down agente
│   │   │   └── error.tsx
│   │   │
│   │   ├── (client)/                       # Route group: ClientLayout
│   │   │   ├── layout.tsx                  # ClientLayout: EmotionalProgress hero
│   │   │   ├── my-trips/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [tripSlug]/page.tsx     # Progreso viaje + timeline pagos
│   │   │   ├── profile/page.tsx
│   │   │   └── error.tsx
│   │   │
│   │   ├── (superadmin)/                   # Route group: AdminDesktopLayout (shared)
│   │   │   ├── layout.tsx
│   │   │   ├── users/page.tsx              # Gestion usuarios + roles
│   │   │   ├── config/page.tsx             # Config sistema, permisos, notificaciones
│   │   │   ├── odoo-sync/page.tsx          # Monitor sync Odoo, logs, retry manual
│   │   │   └── error.tsx
│   │   │
│   │   └── api/                            # Route Handlers
│   │       ├── auth/
│   │       │   ├── session/route.ts
│   │       │   └── claims/route.ts
│   │       ├── odoo/
│   │       │   ├── search-read/route.ts    # Generic Odoo search_read proxy
│   │       │   ├── trips/route.ts
│   │       │   ├── contacts/route.ts
│   │       │   ├── orders/route.ts
│   │       │   └── sync/route.ts           # Trigger manual sync
│   │       ├── payments/
│   │       │   ├── route.ts                # GET list, POST create
│   │       │   ├── [paymentId]/
│   │       │   │   ├── route.ts            # GET detail, PATCH update
│   │       │   │   └── verify/route.ts     # POST verify/reject (admin)
│   │       │   └── ocr/route.ts            # POST receipt → AI extraction
│   │       ├── notifications/
│   │       │   ├── route.ts                # POST dispatch
│   │       │   └── token/route.ts          # POST register FCM token
│   │       ├── contracts/generate/route.ts # POST generate PDF
│   │       ├── analytics/events/route.ts   # POST server-side events
│   │       └── sync/offline-actions/route.ts
│   │
│   ├── components/
│   │   ├── ui/                             # shadcn/ui (19 base, auto-generated)
│   │   │   └── ... (Button, Card, Dialog, Input, Sheet, Skeleton, Table, Toast, etc.)
│   │   ├── custom/                         # 9 custom components (UX spec)
│   │   │   ├── EmotionalProgress.tsx
│   │   │   ├── EmotionalProgress.test.tsx
│   │   │   ├── KPICard.tsx
│   │   │   ├── KPICard.test.tsx
│   │   │   ├── PaymentStepper.tsx
│   │   │   ├── VerificationPanel.tsx
│   │   │   ├── BottomNavBar.tsx
│   │   │   ├── RoleSidebar.tsx
│   │   │   ├── TripCard.tsx
│   │   │   ├── OfflineBanner.tsx
│   │   │   └── BusinessMetric.tsx
│   │   └── shared/                         # Shared composites
│   │       ├── Navbar.tsx
│   │       ├── Footer.tsx
│   │       ├── AuthGuard.tsx
│   │       ├── RoleGuard.tsx
│   │       ├── SkeletonPage.tsx
│   │       └── ToastProvider.tsx
│   │
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── client.ts                   # Firebase client SDK init (singleton)
│   │   │   ├── admin.ts                    # Firebase Admin SDK init (ADC in prod, JSON in dev)
│   │   │   ├── auth.ts                     # Auth helpers
│   │   │   ├── firestore.ts                # Typed doc/collection refs
│   │   │   ├── storage.ts                  # Upload, getURL, delete
│   │   │   ├── messaging.ts                # FCM client-side
│   │   │   └── ai.ts                       # Firebase AI Logic OCR
│   │   ├── odoo/
│   │   │   ├── client.ts                   # OdooClient XML-RPC abstraction
│   │   │   ├── client.test.ts
│   │   │   ├── models/
│   │   │   │   ├── trips.ts                # product.product mapping
│   │   │   │   ├── contacts.ts             # res.partner mapping
│   │   │   │   ├── orders.ts               # sale.order mapping
│   │   │   │   └── invoices.ts             # account.move mapping
│   │   │   ├── sync.ts                     # Sync engine
│   │   │   └── cache.ts                    # TTL management
│   │   ├── notifications/
│   │   │   ├── service.ts                  # NotificationService
│   │   │   ├── service.test.ts
│   │   │   ├── rules.ts                    # Declarative rules per event
│   │   │   ├── channels/
│   │   │   │   ├── fcm.ts
│   │   │   │   ├── whatsapp.ts
│   │   │   │   └── email.ts
│   │   │   └── templates.ts
│   │   ├── pdf/
│   │   │   ├── contract.tsx                # @react-pdf/renderer template (MVP)
│   │   │   └── contract.test.ts
│   │   ├── offline/
│   │   │   ├── queue.ts                    # IndexedDB queue
│   │   │   └── sync.ts                     # Background sync logic
│   │   ├── auth/
│   │   │   ├── session.ts                  # Server-side session verification
│   │   │   ├── claims.ts                   # Custom claims management
│   │   │   ├── permissions.ts              # Permission expansion
│   │   │   └── middleware.ts               # Auth middleware helpers
│   │   ├── analytics/
│   │   │   ├── firebase.ts
│   │   │   ├── meta-pixel.ts
│   │   │   └── gtm.ts
│   │   ├── errors.ts                       # AppError class
│   │   └── utils.ts                        # cn(), formatCurrency(), parseOdooDate()
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useRole.ts
│   │   ├── useFirestoreDoc.ts
│   │   ├── useFirestoreCollection.ts
│   │   ├── useOffline.ts
│   │   ├── useBreakpoint.ts
│   │   └── useReducedMotion.ts
│   │
│   ├── stores/
│   │   ├── useAuthStore.ts
│   │   ├── useNotificationStore.ts
│   │   └── useOfflineStore.ts
│   │
│   ├── schemas/
│   │   ├── user.ts
│   │   ├── payment.ts
│   │   ├── trip.ts
│   │   ├── client.ts
│   │   ├── agent.ts
│   │   └── notification.ts
│   │
│   ├── types/
│   │   ├── user.ts
│   │   ├── payment.ts
│   │   ├── trip.ts
│   │   ├── odoo.ts
│   │   ├── notification.ts
│   │   └── api.ts
│   │
│   ├── config/
│   │   ├── roles.ts
│   │   ├── routes.ts
│   │   ├── odoo.ts
│   │   └── firebase.ts
│   │
│   └── proxy.ts                            # Auth verification + role routing
│
├── .env.local                              # Local dev (gitignored)
├── .env.example                            # Template with documentation
├── .eslintrc.json
├── .gitignore
├── apphosting.yaml                         # Firebase App Hosting: production config
├── apphosting.staging.yaml                 # Firebase App Hosting: staging overrides
├── components.json                         # shadcn/ui config
├── firebase.json                           # Firebase project config
├── firestore.rules                         # Firestore Security Rules
├── firestore.indexes.json                  # Composite indexes
├── next.config.ts                          # Next.js + Serwist
├── package.json
├── playwright.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── vitest.config.ts
```

## Environment Management

**Principio: Secretos en Cloud Secret Manager, nunca en git. Admin SDK usa ADC en prod.**

**Firebase Admin SDK — Sin JSON file en produccion:**

```typescript
// lib/firebase/admin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app'

function initAdmin() {
  if (getApps().length > 0) return getApps()[0]

  // Produccion (Cloud Run): ADC automatico, sin argumentos
  if (process.env.NODE_ENV === 'production') {
    return initializeApp()
  }

  // Desarrollo local: usar JSON file
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_ADMIN_SDK_JSON ||
    require('fs').readFileSync('.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json', 'utf8')
  )
  return initializeApp({ credential: cert(serviceAccount) })
}

export const adminApp = initAdmin()
```

**apphosting.yaml (produccion):**

```yaml
runConfig:
  minInstances: 1
  maxInstances: 10
  concurrency: 80
  cpu: 1
  memoryMiB: 1024

env:
  # === Cliente (NEXT_PUBLIC_ = congeladas en build time) ===
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    secret: prod-firebase-api-key
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: arounda-planet.firebaseapp.com
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: arounda-planet
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: arounda-planet.firebasestorage.app
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    secret: prod-firebase-messaging-sender-id
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    secret: prod-firebase-app-id
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_VAPID_KEY
    secret: prod-firebase-vapid-key
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_APP_URL
    value: https://aroundaplanet--arounda-planet.us-east4.hosted.app
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_META_PIXEL_ID
    secret: prod-meta-pixel-id
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_GTM_ID
    secret: prod-gtm-id
    availability: [BUILD, RUNTIME]

  # === Servidor (RUNTIME only — never exposed to client) ===
  - variable: ODOO_URL
    value: https://aroundaplanet.odoo.com
    availability: [RUNTIME]
  - variable: ODOO_DB
    value: aroundaplanet
    availability: [RUNTIME]
  - variable: ODOO_API_KEY
    secret: prod-odoo-api-key
    availability: [RUNTIME]
  # Firebase Admin SDK: NO NECESITA variable — usa ADC automaticamente en Cloud Run
```

**apphosting.staging.yaml (overrides para staging):**

```yaml
runConfig:
  minInstances: 0
  maxInstances: 3
  cpu: 1
  memoryMiB: 512

env:
  - variable: NEXT_PUBLIC_APP_URL
    value: https://staging--arounda-planet.us-east4.hosted.app
    availability: [BUILD, RUNTIME]
  - variable: ODOO_READ_ONLY
    value: "true"
    availability: [RUNTIME]
```

**.env.local (desarrollo local — gitignored):**

```bash
# Firebase Client SDK (valores de .keys/firebaseSDK.txt)
NEXT_PUBLIC_FIREBASE_API_KEY=<from firebaseSDK.txt>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=arounda-planet.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=arounda-planet
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=arounda-planet.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from firebaseSDK.txt>
NEXT_PUBLIC_FIREBASE_APP_ID=<from firebaseSDK.txt>
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Firebase FCM (from .keys/pushkeys.txt)
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BETZxJf3M_tS1mLQW7c98kHSTp-OPUxx96DsLrgA9sdUNfHLEf-R0zFEubHSnhh7qUl9VKLowk86qk831GAoN3Q

# Odoo (API key ya generada y testeada)
ODOO_URL=https://aroundaplanet.odoo.com
ODOO_DB=aroundaplanet
ODOO_API_KEY=<from Odoo admin panel>

# Firebase Admin SDK (dev only — prod uses ADC)
# Option A: JSON string
FIREBASE_ADMIN_SDK_JSON='<contents of .keys/arounda-planet-firebase-adminsdk-*.json>'
# Option B: File path (lib/firebase/admin.ts reads the file directly in dev)

# Analytics (optional in dev)
# NEXT_PUBLIC_META_PIXEL_ID=
# NEXT_PUBLIC_GTM_ID=
```

**.env.example (committed to git — template with docs):**

```bash
# === Firebase Client SDK ===
# Source: Firebase Console > Project Settings > General > Web App
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=arounda-planet.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=arounda-planet
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=arounda-planet.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3000

# === Firebase FCM (Push Notifications) ===
# Source: .keys/pushkeys.txt (VAPID public key)
NEXT_PUBLIC_FIREBASE_VAPID_KEY=

# === Odoo (Server-side only) ===
# Source: Odoo Admin Panel > Settings > API Keys
ODOO_URL=https://aroundaplanet.odoo.com
ODOO_DB=aroundaplanet
ODOO_API_KEY=

# === Firebase Admin SDK (Dev only — prod uses ADC) ===
# Source: .keys/arounda-planet-firebase-adminsdk-*.json
# Paste full JSON as string, or leave empty to read from .keys/ directory
FIREBASE_ADMIN_SDK_JSON=

# === Analytics (Optional) ===
NEXT_PUBLIC_META_PIXEL_ID=
NEXT_PUBLIC_GTM_ID=
```

**Secrets Setup Commands (run once per environment):**

```bash
# Production secrets
firebase apphosting:secrets:set prod-firebase-api-key
firebase apphosting:secrets:set prod-firebase-messaging-sender-id
firebase apphosting:secrets:set prod-firebase-app-id
firebase apphosting:secrets:set prod-firebase-vapid-key
firebase apphosting:secrets:set prod-odoo-api-key
firebase apphosting:secrets:set prod-meta-pixel-id
firebase apphosting:secrets:set prod-gtm-id

# Grant access to backend
firebase apphosting:secrets:grantaccess prod-odoo-api-key
```

## Architectural Boundaries

**API Boundaries:**

| Boundary | Scope | Auth | Roles |
|----------|-------|------|-------|
| `/api/auth/*` | Session, claims | Varies | All |
| `/api/odoo/*` | Odoo XML-RPC proxy | Yes | Admin, SuperAdmin, Server sync |
| `/api/payments/*` | Payment CRUD + verify | Yes | Agent (own), Admin (all), Director (read) |
| `/api/payments/ocr` | Receipt → AI extraction | Yes | Agent |
| `/api/notifications/*` | Dispatch + FCM token | Yes | All |
| `/api/contracts/*` | PDF generation | Yes | Admin, Agent |
| `/api/analytics/*` | Server-side events | Yes | All |
| `/api/sync/*` | Offline queue processing | Yes | Agent |

**Data Boundaries:**

| Source | Ownership | Access |
|--------|-----------|--------|
| Firestore `/trips` | Odoo (sync) | Public read, Admin write |
| Firestore `/agents/{id}/payments` | App (source of truth) | Agent own, Admin/Director all |
| Firestore `/agents/{id}/clients` | App + Odoo (bidirectional) | Agent own, Admin all |
| Firestore `/users/{uid}` | App | Owner + Admin |
| Firestore `/kpis/{period}` | Server (materialized) | Director, Admin |
| Firebase Storage `/receipts` | Agent upload | Agent own, Admin verify |
| Odoo (via proxy) | Odoo (source of truth) | Server-side only — NEVER direct client access |

## Requirements to Structure Mapping

| FR Category | Primary Location | API Routes |
|-------------|-----------------|------------|
| **FR01-08: Identity** | `lib/auth/`, `proxy.ts` | `/api/auth/*` |
| **FR09-17: Public Content** | `app/(public)/*` | N/A (SSG/ISR) |
| **FR18-23: Trips** | `lib/odoo/models/trips.ts`, `app/(admin)/trips/*` | `/api/odoo/trips` |
| **FR24-35: Payments** | `app/(agent)/payments/*`, `app/(admin)/verification/*` | `/api/payments/*` |
| **FR36-44: Agent Portal** | `app/(agent)/*` | `/api/payments/*` (agent-scoped) |
| **FR45-52: Director BI** | `app/(director)/*` | `/api/odoo/*` (KPI data) |
| **FR53-58: Notifications** | `lib/notifications/*` | `/api/notifications/*` |
| **FR59-62: Client Portal** | `app/(client)/*` | N/A (Firestore direct) |
| **FR63-65: Analytics** | `lib/analytics/*` | `/api/analytics/*` |
| **FR66-68: Odoo Integration** | `lib/odoo/*` | `/api/odoo/*` |

## Data Flow — Payment Core Loop

```
Agent (mobile) → PaymentReport form
  → Camera capture receipt
  → Upload to Firebase Storage /receipts/{agentId}/{paymentId}
  → POST /api/payments/ocr → Firebase AI Logic extracts data
  → Agent confirms/edits → POST /api/payments (create)
  → Firestore /agents/{agentId}/payments/{paymentId}
  → Write-through to Odoo sale.order
  → Emit: payment.reported
  → NotificationService → FCM push to admins
  → Admin (desktop) sees in queue (onSnapshot)
  → Admin verifies → PATCH /api/payments/{id}/verify
  → Firestore status update → Write-through to Odoo
  → Emit: payment.verified
  → NotificationService → FCM to agent + WhatsApp to client
```

## Development Workflow

```bash
npm run dev          # next dev --turbopack (Turbopack HMR)
npm run build        # next build --webpack (Serwist requires Webpack)
npm run test         # vitest run
npm run test:watch   # vitest
npm run test:e2e     # playwright test
npm run lint         # next lint
npm run typecheck    # tsc --noEmit
```
