# Story 1.1a: Project Scaffold & CI Pipeline

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want the project scaffolded with the correct tech stack and deployment pipeline,
So that all subsequent features can be built on a production-ready foundation.

### Business Context

Esta es la story fundacional de todo el proyecto AroundaPlanet. Todos los 35 stories restantes en los 7 epics dependen de que esta foundation este correcta. Errores aqui se propagan a toda la plataforma. El deadline Pre-Madrid (Mar 3) requiere una plataforma demostrable a Noel, lo que significa que el scaffold debe estar desplegado en produccion desde el dia 1.

### Dependencies

- **Bloquea:** TODAS las stories del proyecto (1.1b, 1.2, 1.3, 1.4a, 1.4b, 1.5, 1.6, 1.7, y todos los epics 2-7)
- **Depende de:** Nada (story raiz)
- **Inputs necesarios:** Credenciales en `.keys/` (ya disponibles), repo GitHub configurado

---

## Acceptance Criteria (BDD)

### AC1: Next.js Project Scaffold

**Given** el repositorio solo tiene artefactos de planeacion y `.gitignore`
**When** se ejecuta el scaffold
**Then** existe un proyecto Next.js 16.x App Router con:
- TypeScript strict mode habilitado
- Tailwind CSS v4 configurado (CSS-first con `@theme` directive)
- ESLint con reglas Next.js
- Directorio `src/` como raiz de codigo
- `pnpm` como package manager con `pnpm-lock.yaml` commiteado
- Import alias `@/*` configurado en `tsconfig.json`

### AC2: PWA con Serwist

**Given** el proyecto scaffolded existe
**When** se configura Serwist
**Then** `@serwist/next` y `serwist` estan instalados (v9.5+)
**And** `next.config.ts` usa async config con dynamic import `(await import("@serwist/next")).default` y `swSrc: "src/app/sw.ts"`, `swDest: "public/sw.js"`
**And** `src/app/sw.ts` existe con Serwist inicializado y placeholder para FCM `onBackgroundMessage`
**And** `src/app/manifest.ts` exporta Web App Manifest dinamico con `theme_color: "#1B4332"` y iconos PWA
**And** Serwist esta deshabilitado en development (`disable: process.env.NODE_ENV === "development"`)
**And** `public/sw.js` y `public/sw.js.map` estan en `.gitignore`

### AC3: Firebase SDK Configurado

**Given** las credenciales existen en `.keys/`
**When** se configura Firebase
**Then** Firebase client SDK esta instalado e inicializado como singleton en `src/lib/firebase/client.ts`
**And** Firebase Admin SDK esta configurado en `src/lib/firebase/admin.ts` con ADC en produccion y JSON file fallback en desarrollo
**And** `.env.local` existe con todas las variables `NEXT_PUBLIC_FIREBASE_*` pobladas desde `.keys/firebaseSDK.txt`
**And** `.env.example` existe como template documentado (sin valores sensibles, commiteado a git)

### AC4: Deployment Configuration

**Given** Firebase App Hosting esta configurado para el proyecto `arounda-planet`
**When** se crean los archivos de deployment
**Then** `apphosting.yaml` existe en la raiz con:
- `runConfig`: minInstances=1, maxInstances=10, concurrency=80, cpu=1, memoryMiB=1024
- Variables `NEXT_PUBLIC_*` con references a Cloud Secret Manager (`secret:` field)
- Variables servidor (ODOO_URL, ODOO_DB) con `availability: [RUNTIME]`
- Region: us-east4
**And** `apphosting.staging.yaml` existe con overrides: minInstances=0, maxInstances=3, memoryMiB=512, ODOO_READ_ONLY=true
**And** `firebase.json` existe con configuracion basica del proyecto

### AC5: CI Pipeline (GitHub Actions)

**Given** el proyecto tiene codigo deployable
**When** se crea un Pull Request en GitHub
**Then** GitHub Actions ejecuta `.github/workflows/ci.yml` con:
- `pnpm install --frozen-lockfile`
- ESLint check (`pnpm lint`)
- TypeScript type check (`pnpm typecheck` = `tsc --noEmit`)
- Vitest (`pnpm test` con `passWithNoTests: true`)
- Playwright (`pnpm test:e2e` con spec placeholder vacio)
**And** el pipeline bloquea merge si cualquier check falla

### AC6: Project Directory Structure

**Given** la arquitectura define ~120 archivos en el arbol final
**When** se crea el scaffold
**Then** existen las siguientes carpetas con archivos placeholder (`layout.tsx` o `.gitkeep`):
- Route groups: `src/app/(public)/`, `(auth)/`, `(agent)/`, `(admin)/`, `(director)/`, `(client)/`, `(superadmin)/`
- API: `src/app/api/`
- Components: `src/components/ui/`, `src/components/custom/`, `src/components/shared/`
- Lib: `src/lib/firebase/`, `src/lib/odoo/`, `src/lib/notifications/`, `src/lib/auth/`, `src/lib/analytics/`, `src/lib/pdf/`, `src/lib/offline/`
- Hooks: `src/hooks/`
- Stores: `src/stores/`
- Schemas: `src/schemas/`
- Types: `src/types/`
- Config: `src/config/`
- E2E: `e2e/`
**And** `src/proxy.ts` existe como archivo vacio (placeholder para Story 1.4b)
**And** NO se crean archivos de features (componentes custom, hooks, stores, schemas, types) — esos los crea cada story

### AC7: Development Server Funcional

**Given** el scaffold esta completo
**When** se ejecuta `pnpm dev`
**Then** el servidor inicia sin errores usando Turbopack
**And** `pnpm build` completa exitosamente usando Webpack (requerido por Serwist)
**And** `pnpm lint` pasa sin errores
**And** `pnpm typecheck` (`tsc --noEmit`) pasa con cero type errors

### AC8: First Deploy Exitoso

**Given** el build funciona localmente
**When** se hace push a `master`
**Then** Firebase App Hosting despliega automaticamente
**And** la URL publica `https://aroundaplanet--arounda-planet.us-east4.hosted.app` muestra una placeholder page funcional
**And** la placeholder page muestra el logo AroundaPlanet y texto "Plataforma en construccion"

---

## Tasks / Subtasks

- [x] **Task 1: Scaffold Next.js** (AC: #1)
  - [x] 1.1 Ejecutar `npx create-next-app@latest aroundaplanet --typescript --tailwind --eslint --app --src-dir --turbopack --use-pnpm` en directorio temporal
  - [x] 1.2 Copiar archivos generados al repo existente (preservar `.git/`, `.keys/`, `_bmad/`, `_bmad-output/`, `CLAUDE.md`)
  - [x] 1.3 Verificar `tsconfig.json` con strict mode y path alias `@/*`
  - [x] 1.4 Actualizar `.gitignore` para incluir `node_modules/`, `.env.local`, `.next/`, `public/sw.js`, `public/sw.js.map`
  - [x] 1.5 Actualizar CLAUDE.md: cambiar `npm` a `pnpm` en todos los comandos de build

- [x] **Task 2: Configurar Tailwind v4 + Design Tokens** (AC: #1)
  - [x] 2.1 Configurar `src/app/globals.css` con `@import "tailwindcss"` y `@theme` directive
  - [x] 2.2 Definir design tokens en `@theme`: colores (primary #1B4332, accent #F4A261, destructive #E76F51, background #FAFAF8, + semantic variants), tipografia (Poppins, Inter, Roboto Mono), border-radius, shadows
  - [x] 2.3 Configurar Google Fonts en `src/app/layout.tsx` con `next/font/google` y `display: swap`
  - [x] 2.4 Verificar que `tailwind.config.ts` no sea requerido (Tailwind v4 CSS-first) — shadcn/ui funciona sin el

- [x] **Task 3: Instalar shadcn/ui** (AC: #1)
  - [x] 3.1 Ejecutar `npx shadcn@latest init` (style: new-york, base color: neutral, CSS variables: yes)
  - [x] 3.2 Verificar que `components.json` se genero correctamente
  - [x] 3.3 NO instalar componentes individuales aun — Story 1.1b los instalara
  - [x] 3.4 Fusionar brand colors con variables shadcn en globals.css (shadcn sobreescribe colores)

- [x] **Task 4: Configurar Serwist PWA** (AC: #2)
  - [x] 4.1 Instalar `@serwist/next` y `serwist` (version ^9.5)
  - [x] 4.2 Configurar `next.config.ts` con async config y dynamic import de `@serwist/next` (disable en dev)
  - [x] 4.3 Crear `src/app/sw.ts` con Serwist inicializado, precache manifest, runtime caching basico, y placeholder para FCM
  - [x] 4.4 Crear `src/app/manifest.ts` con Web App Manifest dinamico
  - [x] 4.5 Agregar `public/sw.js` y `public/sw.js.map` a `.gitignore`
  - [x] 4.6 Agregar `"webworker"` a `lib` en `tsconfig.json`

- [x] **Task 5: Configurar Firebase SDK** (AC: #3)
  - [x] 5.1 Instalar `firebase` (client SDK) y `firebase-admin` (dev dependency)
  - [x] 5.2 Crear `src/lib/firebase/client.ts` — singleton init con config desde env vars
  - [x] 5.3 Crear `src/lib/firebase/admin.ts` — ADC en prod, JSON file fallback en dev
  - [x] 5.4 Crear `.env.local` con valores de `.keys/firebaseSDK.txt` y `.keys/pushkeys.txt`
  - [x] 5.5 Crear `.env.example` como template documentado (commiteado)

- [x] **Task 6: Configurar Deployment** (AC: #4)
  - [x] 6.1 Crear `apphosting.yaml` con runConfig, env variables, y Cloud Secret Manager references
  - [x] 6.2 Crear `apphosting.staging.yaml` con overrides de staging
  - [x] 6.3 Crear `firebase.json` con configuracion basica
  - [x] 6.4 Crear `firestore.rules` placeholder (allow read/write: false por defecto)
  - [x] 6.5 Crear `firestore.indexes.json` vacio

- [x] **Task 7: Configurar CI Pipeline** (AC: #5)
  - [x] 7.1 Crear `.github/workflows/ci.yml` con jobs: lint, typecheck, test, test:e2e
  - [x] 7.2 Configurar `pnpm install --frozen-lockfile` en CI
  - [x] 7.3 Configurar Vitest con `passWithNoTests: true` en `vitest.config.ts`
  - [x] 7.4 Crear `playwright.config.ts` y `e2e/placeholder.spec.ts` con test vacio
  - [x] 7.5 Instalar Vitest, @testing-library/react, @testing-library/jest-dom, jsdom, Playwright, cross-env como dev dependencies

- [x] **Task 8: Crear Directory Structure** (AC: #6)
  - [x] 8.1 Crear route groups con `layout.tsx` placeholder por cada uno (7 route groups)
  - [x] 8.2 Crear carpetas `lib/`, `hooks/`, `stores/`, `schemas/`, `types/`, `config/` con `.gitkeep`
  - [x] 8.3 Crear `src/components/ui/`, `src/components/custom/`, `src/components/shared/` con `.gitkeep`
  - [x] 8.4 Crear `src/proxy.ts` como placeholder vacio exportando `config.matcher`
  - [x] 8.5 Crear `src/lib/utils.ts` con funcion `cn()` + `formatCurrency()` (classnames merge — requerido por shadcn/ui)
  - [x] 8.6 Crear `src/lib/errors.ts` con `AppError` class placeholder

- [x] **Task 9: Root Layout + Placeholder Page** (AC: #7, #8)
  - [x] 9.1 Configurar `src/app/layout.tsx` con providers basicos, metadata SEO, fonts
  - [x] 9.2 Crear `src/app/(public)/layout.tsx` como PublicLayout placeholder
  - [x] 9.3 Crear `src/app/(public)/page.tsx` como placeholder con logo y "Plataforma en construccion"
  - [x] 9.4 Colocar assets basicos en `public/`: logo (PWA iconos pendientes — requieren herramienta de imagen)
  - [x] 9.5 Verificar `pnpm dev` inicia sin errores
  - [x] 9.6 Verificar `pnpm build` completa sin errores ni warnings

- [x] **Task 10: First Deploy** (AC: #8)
  - [x] 10.1 Backend ya configurado en Firebase Console (aroundaplanet, us-east4)
  - [x] 10.2 Push a `master` (3 commits: ca51035, 02ebd93, b462351)
  - [x] 10.3 Rollout manual via `firebase apphosting:rollouts:create` (requirio crear 5 secrets en Cloud Secret Manager + IAM bindings)
  - [x] 10.4 URL publica responde: https://aroundaplanet--arounda-planet.us-east4.hosted.app

---

## Dev Notes

### CRITICAL: Decisiones de Party Mode (2026-02-25)

1. **Package manager: `pnpm`** — Decision explicita de Alek. Mas estable con Firebase App Hosting. Actualizar CLAUDE.md que actualmente dice `npm`.
2. **CI incluye Vitest + Playwright desde dia 1** con `passWithNoTests: true` y spec placeholder. No esperar a que haya tests.
3. **Solo scaffold de carpetas** — NO crear archivos de features. Cada story crea sus propios componentes, hooks, stores, schemas.
4. **Serwist deshabilitado en dev** — `disable: process.env.NODE_ENV === "development"` en `next.config.ts`.

### Serwist 9.5+ (CAMBIO vs Arquitectura Original)

La arquitectura menciona `@serwist/precaching` y `@serwist/sw` como paquetes separados. **Estos estan DEPRECADOS.** Los paquetes correctos son:

```bash
pnpm add @serwist/next
pnpm add -D serwist
```

Solo 2 paquetes. Ejemplo completo de `src/app/sw.ts`:
```typescript
import { Serwist, CacheFirst, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: Array<{ url: string; revision: string | null }>;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: new StaleWhileRevalidate({
        cacheName: "google-fonts-stylesheets",
      }),
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      handler: new CacheFirst({
        cacheName: "google-fonts-webfonts",
      }),
    },
  ],
  // Placeholder para FCM onBackgroundMessage (Story 6.1a)
});

serwist.addEventListeners();
```

**Nota:** Los handlers de runtime caching usan instancias de clase (`new CacheFirst(...)`, `new StaleWhileRevalidate(...)`) — NO strings.

NO usar:
- ~~`@serwist/sw`~~ (deprecado)
- ~~`@serwist/precaching`~~ (deprecado)
- ~~`@serwist/next/init`~~ (no existe)

### SEGURIDAD: Variables en Service Worker

**NUNCA poner variables sin prefijo `NEXT_PUBLIC_` dentro de `src/app/sw.ts`.**

El SW se compila en build time con Webpack. Todas las variables se incrustan (inline) en el bundle final que es publico. Si metes `ODOO_API_KEY` en el SW, se expone al cliente.

Solo usar: `NEXT_PUBLIC_FIREBASE_*` y `NEXT_PUBLIC_APP_URL`.

### Firebase Admin SDK — Patron ADC

```typescript
// src/lib/firebase/admin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';

function initAdmin() {
  if (getApps().length > 0) return getApps()[0];

  // Produccion (Cloud Run): ADC automatico, sin argumentos
  if (process.env.NODE_ENV === 'production') {
    return initializeApp();
  }

  // Desarrollo local: JSON file de .keys/
  const fs = require('fs');
  const serviceAccount = JSON.parse(
    fs.readFileSync('.keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json', 'utf8')
  );
  return initializeApp({ credential: cert(serviceAccount) });
}

export const adminApp = initAdmin();
```

### Tailwind v4 — CSS-First Config

Tailwind v4 NO requiere `tailwind.config.ts` obligatoriamente. Los design tokens se definen en CSS:

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-primary: #1B4332;
  --color-primary-foreground: #FAFAF8;
  --color-primary-light: #2D6A4F;
  --color-primary-muted: #D8F3DC;
  --color-accent: #F4A261;
  --color-accent-foreground: #1B4332;
  --color-accent-light: #F6B97A;
  --color-accent-muted: #FDEBD0;
  --color-destructive: #E76F51;
  --color-destructive-foreground: #FFFFFF;
  --color-destructive-muted: #FADBD8;
  --color-background: #FAFAF8;
  --color-card: #FFFFFF;
  --color-muted: #F1F0EB;
  --color-muted-foreground: #71706B;
  --color-border: #E5E4DF;
  --color-ring: #1B4332;

  --font-sans: 'Inter', sans-serif;
  --font-heading: 'Poppins', sans-serif;
  --font-mono: 'Roboto Mono', monospace;

  --radius-sm: 0.375rem;
  --radius: 0.75rem;
  --radius-lg: 1rem;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
}
```

Si `shadcn@latest init` genera un `tailwind.config.ts`, mantenerlo minimal — solo lo que shadcn/ui requiera. Los tokens custom van en CSS.

### apphosting.yaml — Formato Correcto

```yaml
runConfig:
  minInstances: 1
  maxInstances: 10
  concurrency: 80
  cpu: 1
  memoryMiB: 1024

env:
  # === Cliente (NEXT_PUBLIC_ = frozen at build time) ===
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
```

### apphosting.staging.yaml — Overrides

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

### CI Pipeline — GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [master]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
```

### package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "cross-env NODE_OPTIONS='--no-deprecation' next build --webpack",
    "start": "next start",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

**Nota build:** Next.js 16 requiere `--webpack` flag explicito para `next build` (Serwist necesita Webpack para compilar el SW). Se usa `cross-env NODE_OPTIONS='--no-deprecation'` para suprimir ExperimentalWarning de Node. Instalar `cross-env` como devDependency.

### next.config.ts — Configuracion Completa

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default async () => {
  const withSerwist = (await import("@serwist/next")).default({
    swSrc: "src/app/sw.ts",
    swDest: "public/sw.js",
    disable: process.env.NODE_ENV === "development",
  });
  return withSerwist(nextConfig);
};
```

### Dependencias Completas a Instalar

```bash
# Core (ya incluido por create-next-app)
# next, react, react-dom, typescript, tailwindcss, eslint

# Firebase
pnpm add firebase
pnpm add -D firebase-admin

# PWA
pnpm add @serwist/next
pnpm add -D serwist

# Testing
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @playwright/test jsdom

# Build tools
pnpm add -D cross-env

# Utilities (requeridos por stories posteriores pero instalar ahora para scaffold limpio)
pnpm add zod
```

**NO instalar aun** (los instala cada story que los necesite):
- framer-motion (Story 1.1b)
- zustand (Story 1.3)
- react-hook-form, @hookform/resolvers (Story 1.3)
- recharts (Story 5.1)
- @react-pdf/renderer (Story 3.4)

### Archivos de Credenciales (.keys/)

Estos archivos ya existen en el repo y estan gitignored:

| Archivo | Contiene | Usado en |
|---------|----------|----------|
| `arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json` | Service account JSON | `src/lib/firebase/admin.ts` (solo dev) |
| `firebaseSDK.txt` | Firebase client config (apiKey, authDomain, etc.) | `.env.local` variables NEXT_PUBLIC_* |
| `pushkeys.txt` | VAPID public + private keys | `.env.local` NEXT_PUBLIC_FIREBASE_VAPID_KEY |

### Route Group Layouts — Placeholder Pattern

Cada route group necesita un `layout.tsx` placeholder minimo:

```typescript
// src/app/(public)/layout.tsx
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

Los layouts reales (con navbar, sidebar, bottom nav) se implementan en Story 1.1b.

### iOS PWA Limitations (Documentadas)

| Feature | Android | iOS |
|---------|---------|-----|
| Push notifications | Completo | Solo si PWA instalada en Home Screen (iOS 16.4+) |
| Background Sync API | Soportado | NO — fallback con `window.addEventListener('online')` |
| Offline Firestore | Funciona | Funciona |

Impacto: ~100 agentes (Android) tienen soporte completo. Noel (director, iOS) necesita instalar PWA.

---

### Project Structure Notes

**Alineacion con estructura unificada del proyecto:**

La estructura de carpetas creada en esta story sigue EXACTAMENTE la especificacion de arquitectura en `_bmad-output/planning-artifacts/architecture.md`, seccion "Project Directory Structure". Las unicas desviaciones son:

1. **Archivos de features NO se crean** — solo carpetas con `.gitkeep`. Cada story crea sus propios archivos.
2. **`src/proxy.ts` es placeholder** — el contenido real lo implementa Story 1.4b (Route Protection). Next.js 16 renombro la convencion de `middleware.ts` a `proxy.ts` y `export function middleware()` a `export function proxy()`.
3. **shadcn/ui componentes NO se instalan** — solo la configuracion base (`components.json`). Story 1.1b instala los 19 componentes base.

**Naming Conventions a seguir desde dia 1:**

| Elemento | Convencion | Ejemplo |
|----------|-----------|---------|
| Componentes | `PascalCase.tsx` | `KPICard.tsx` |
| Hooks | `camelCase` con `use` prefix | `useAuth.ts` |
| Stores | `camelCase` con `use` + `Store` | `useAuthStore.ts` |
| Schemas | `camelCase` con `Schema` suffix | `paymentSchema.ts` |
| Types | `PascalCase`, NO prefix `I` | `type Payment` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_UPLOAD_SIZE` |
| API routes | `kebab-case` folders | `/api/odoo/search-read` |
| Firestore collections | `camelCase` plural | `trips`, `users` |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Project Directory Structure, Environment Management, CI/CD]
- [Source: _bmad-output/planning-artifacts/architecture.md — Starter Template Evaluation, Core Architectural Decisions]
- [Source: _bmad-output/planning-artifacts/architecture.md — Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/epics.md — Epic 1, Story 1.1a]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ — Design System Foundation, Visual Design, Responsive Strategy]
- [Source: _bmad-output/planning-artifacts/prd/ — NFRs 1-32, PWA Configuration, Browser Support Matrix]
- [Source: Web research Feb 2026 — Serwist 9.5.4 package changes, Next.js 16.x flags, Tailwind v4 CSS-first, Firebase App Hosting ADC]

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log
- 2026-02-25: Story creada via create-story workflow con party mode review (Winston, Amelia, Bob). Decisiones: pnpm, CI completo desde dia 1, Serwist 9.5+ packages corregidos, scaffold-only sin archivos de features.
- 2026-02-25: Actualizada post-implementacion: middleware.ts→proxy.ts (Next.js 16), next.config.ts async dynamic import, build con --webpack + cross-env, sw.ts con class instances + declare global, lint con eslint src/, jsdom como devDep para Vitest.

### File List
