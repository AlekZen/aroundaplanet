# Starter Template Evaluation

## Primary Technology Domain

**Full-stack PWA (Next.js App Router)** con integracion ERP bidireccional. Dominio primario: web application con capacidades offline, real-time, y SSG hibrido.

## Starter Options Considered

| Starter | Que incluye | Veredicto |
|---------|-------------|-----------|
| **`create-next-app@latest`** | Next.js 16 + TypeScript + Tailwind v4 + ESLint + App Router + Turbopack | Base solida, control total, docs oficiales |
| **nextjs-pwa-firebase-boilerplate** (tomsoderlund) | Next.js + Firebase Auth + PWA basico | Desactualizado, no usa App Router, sin Tailwind v4 |
| **MakerKit Next.js + Firebase** | SaaS boilerplate con Stripe + Auth + multi-tenant | Comercial ($299+), SaaS-oriented, no travel/ERP |
| **create-t3-app** | Next.js + tRPC + Prisma + NextAuth + Tailwind | Usa Prisma (no Firestore), NextAuth (no Firebase Auth) — incompatible |
| **Divjoy** | Auth + Tailwind variantes | Generador comercial, no justifica dependencia |

**Ninguno cubre:** Odoo XML-RPC abstraction, 5 roles aditivos con Firestore Security Rules, OCR pipeline con Firebase AI Logic, NotificationService multi-canal, PWA offline queue para pagos, generacion de contratos PDF.

## Selected Starter: `create-next-app@latest` + integracion manual

**Rationale for Selection:**
1. **Control total** — AroundaPlanet tiene requisitos unicos que ningun boilerplate cubre
2. **Documentacion oficial** — Next.js, Firebase, shadcn/ui, y Serwist tienen guias de integracion excelentes
3. **Stack limpio** — Sin dependencias innecesarias de boilerplates que luego hay que desmontar
4. **Versiones actualizadas** — `create-next-app@latest` siempre trae lo ultimo
5. **Firebase App Hosting compatible** — GA desde abril 2025, soporte nativo Next.js 13.5+

**Initialization Command:**

```bash
# 1. Scaffold Next.js
npx create-next-app@latest aroundaplanet --typescript --tailwind --eslint --app --src-dir --turbopack --use-npm

# 2. Inicializar shadcn/ui (design system)
npx shadcn@latest init

# 3. Instalar Firebase SDK
npm install firebase
npm install -D firebase-admin

# 4. Instalar Serwist para PWA (reemplazo moderno de next-pwa)
npm install @serwist/next @serwist/precaching @serwist/sw

# 5. Instalar dependencias del stack
npm install framer-motion zustand zod react-hook-form @hookform/resolvers recharts
npm install -D vitest @testing-library/react @testing-library/jest-dom playwright @playwright/test

# 6. PDF Generation
npm install @react-pdf/renderer
npm install @pdfme/generator @pdfme/common

# 7. Inicializar Firebase App Hosting
firebase init app-hosting
```

**Nota Serwist + Turbopack:** Serwist requiere Webpack para el build del service worker. El script de build debe usar `next build --webpack` mientras Turbopack no soporte SW compilation. Turbopack se usa solo en development (`next dev --turbopack`).

## Architectural Decisions Provided by Starter

**Language & Runtime:**
- TypeScript strict mode (tsconfig.json auto-generado)
- Next.js 16.x con App Router como default
- React 19.x (incluido con Next.js 16)
- Node.js runtime para SSR, Edge runtime disponible para middleware

**Styling Solution:**
- Tailwind CSS v4.2 — builds 5x mas rapidos, incremental 100x mas rapido
- CSS variables nativas (shadcn/ui v4 guide)
- PostCSS pipeline integrado
- shadcn/ui con estilo "new-york", componentes Radix UI bajo el hood

**Build Tooling:**
- Turbopack para development (HMR <200ms)
- Webpack para production build (requerido por Serwist)
- Tree-shaking automatico
- Code splitting por route (App Router default)
- ISR/SSG configurables por page

**Testing Framework:**
- Vitest 2.x para unit tests (recomendado oficialmente por Next.js sobre Jest, 10-20x mas rapido)
- Playwright 1.x para E2E (multi-browser: Chrome, Firefox, Safari — critico para PWA)
- React Testing Library para component tests

**PDF Generation Strategy:**

| Fase | Solucion | Uso |
|------|----------|-----|
| **MVP** | `@react-pdf/renderer` v4.3 | Contratos desde React components. Rapido, sin Chromium overhead. Devs controlan templates |
| **Post-MVP** | `pdfme` (generator + common) | Templates JSON con WYSIWYG designer. Admins editan contratos sin codigo. Versionable en Firestore |

Ambas librerias son ligeras (sin dependencias pesadas como Puppeteer/Chromium), compatibles con Cloud Run de Firebase App Hosting, y TypeScript-first. Se evita Puppeteer por su overhead de 500MB+ y cold starts de 5-10s.

**PWA + FCM: Service Worker Consolidado (Decision Arquitectonica Critica)**

Serwist y Firebase Cloud Messaging deben compartir UN UNICO service worker. Solo puede existir un SW por scope (`/`). Firebase Messaging se inicializa DENTRO del SW de Serwist, no como archivo separado (`firebase-messaging-sw.js`).

El patron correcto:
1. Serwist maneja precaching + runtime caching strategies
2. Firebase `onBackgroundMessage` se registra en el mismo SW
3. `notificationclick` event handler implementa deep linking
4. `sync` event handler procesa offline queue (Background Sync API)
5. El token FCM se obtiene pasando `serviceWorkerRegistration` existente a `getToken()`

**iOS Limitations (documentadas para el equipo):**

| Feature | Android | iOS |
|---------|---------|-----|
| Push notifications | Completo | Solo si PWA instalada en Home Screen (iOS 16.4+) |
| Background Sync API | Soportado | NO soportado — fallback con `online` event listener |
| Offline Firestore | Funciona | Funciona |
| Wake-up desde push | Si | No |

Impacto: ~100 agentes (Android) tienen soporte completo. Noel (director, iOS) necesita instalar PWA en Home Screen — onboarding debe guiarlo. Background Sync en iOS se resuelve con `window.addEventListener('online', syncPendingActions)`.

**Code Organization:**
```
src/
├── app/                          # App Router (routes, layouts, pages)
│   ├── (public)/                 # Route group: PublicLayout (SSG/ISR)
│   ├── (auth)/                   # Route group: AuthLayout
│   ├── (agent)/                  # Route group: AgentMobileLayout
│   ├── (admin)/                  # Route group: AdminDesktopLayout
│   ├── (director)/               # Route group: DirectorLayout
│   ├── (client)/                 # Route group: ClientLayout
│   ├── api/                      # Route Handlers (Odoo proxy, webhooks, PDF generation)
│   ├── layout.tsx                # Root layout (providers, PWA manifest, FCM setup)
│   ├── sw.ts                     # Service worker UNIFICADO (Serwist + Firebase Messaging)
│   └── manifest.ts               # Web App Manifest (dynamic)
├── components/
│   ├── ui/                       # shadcn/ui (19 base components)
│   ├── custom/                   # 9 custom components (EmotionalProgress, KPICard, etc.)
│   └── shared/                   # Shared composites (OfflineBanner, BottomNavBar, etc.)
├── lib/
│   ├── firebase/                 # Firebase client SDK config + services
│   ├── odoo/                     # Odoo abstraction layer (anti vendor-lock)
│   ├── notifications/            # NotificationService centralizado
│   ├── pdf/                      # PDF generation (react-pdf MVP, pdfme post-MVP)
│   ├── offline/                  # Offline queue (IndexedDB + Background Sync)
│   └── utils.ts                  # Utility functions (cn(), formatters)
├── hooks/                        # Custom hooks (useAuth, useRole, useFirestore, useOffline)
├── stores/                       # Zustand stores (auth, notifications, offline queue)
├── types/                        # TypeScript types/interfaces
└── config/                       # App config (roles, permissions, feature flags)
```

**Development Experience:**
- Turbopack HMR en dev (<200ms refresh)
- TypeScript autocompletion con paths aliases (`@/*`)
- ESLint con reglas Next.js (migracion a Biome v2.3 factible post-MVP)
- Firebase Emulator Suite para desarrollo local
- Playwright UI mode para debugging E2E visual

## Versiones del Stack Verificadas (Feb 2026)

| Tecnologia | Version | Status |
|-----------|---------|--------|
| Next.js | 16.x | Estable |
| React | 19.x | Estable |
| TypeScript | 5.x | Estable |
| Tailwind CSS | 4.2.0 | Estable (Feb 19, 2026) |
| shadcn/ui | latest (CLI: `shadcn`) | Activo, soporte Tailwind v4 |
| Firebase JS SDK | 12.9.0 | Estable |
| Firebase App Hosting | GA | Desde abril 2025 |
| Serwist | latest | Activo (reemplazo de next-pwa) |
| Framer Motion | 12.34.x | Estable, sin breaking changes v12 |
| Vitest | 2.x | Recomendado por Next.js docs |
| Playwright | 1.x | Estable |
| Zustand | 4.x | Estable (~3KB) |
| React Hook Form | 7.60.x | Estable |
| Zod | 3.25.x | Estable |
| Recharts | 3.7.0 | Estable |
| @react-pdf/renderer | 4.3.x | Estable (MVP PDF) |
| pdfme | 3.x | Activo (post-MVP PDF WYSIWYG) |
| Biome | 2.3 | Production-ready (post-MVP migration) |

**Note:** Project initialization using this command should be the first implementation story.
