# Story 1.1b: Design System & Layout Foundation

Status: done

## Story

As a **developer**,
I want the design system and role-based layouts configured,
So that all UI work uses consistent tokens, typography, and layout structures.

**Business Context:** Esta story establece la identidad visual de AroundaPlanet y los 7 layouts base que todas las stories subsecuentes usan. Sin esto, cada story reinventaria estilos y estructuras. El deadline Pre-Madrid (Mar 3) requiere interfaz profesional demostrable a Noel. Tambien crea los 9 custom components como stubs tipados — el contrato de API que stories futuras implementan progresivamente.

**Dependencies:**
- **Requiere:** Story 1.1a (scaffold, globals.css con tokens, route groups con stubs, components.json) - DONE
- **Bloquea:** Story 1.2 (Public Landing Pages), 1.3 (Auth), y todas las stories de Epic 2-7 que usan layouts y componentes

## Acceptance Criteria

1. **AC1 - Componentes shadcn/ui:**
   Given el scaffold de Story 1.1a con globals.css (@theme tokens) y components.json (new-york, RSC, lucide)
   When se agregan los componentes shadcn/ui base
   Then los 20 componentes estan instalados: Button, Card, Dialog, Sheet, Form, Input, Progress, Badge, Avatar, Table, Tabs, Toast, Skeleton, Sidebar, Select, Alert, Tooltip, DropdownMenu, Popover, Separator
   And cada componente hereda los design tokens de globals.css (primary #1B4332, accent #F4A261, background #FAFAF8, destructive #E76F51)
   And NO se crea tailwind.config.ts (Tailwind v4 usa CSS-first config en globals.css @theme)
   And NO se reinicializa shadcn (components.json ya existe)

2. **AC2 - Tipografia:**
   Given las fuentes Google ya cargadas en root layout (Inter, Poppins, Roboto Mono via next/font/google)
   When se renderea cualquier pagina
   Then Inter se usa para body/UI (--font-sans), Poppins para headings/KPIs (--font-heading), Roboto Mono para montos y referencias (--font-mono)
   And las clases Tailwind `font-sans`, `font-heading`, `font-mono` funcionan correctamente

3. **AC3 - Layout Shells (7 archivos):**
   Given los 7 route groups creados en 1.1a con stubs vacios
   When se implementan los layouts reales
   Then existen 7 layouts funcionales en estos paths:
   - `src/app/(public)/layout.tsx` — PublicLayout: floating navbar + footer
   - `src/app/(auth)/layout.tsx` — AuthLayout: hero blur + card centrada
   - `src/app/(agent)/layout.tsx` — AgentMobileLayout: BottomNavBar + area content
   - `src/app/(admin)/layout.tsx` — AdminDesktopLayout: RoleSidebar 280px + content
   - `src/app/(director)/layout.tsx` — DirectorLayout: KPI area + content (mobile-first)
   - `src/app/(client)/layout.tsx` — ClientLayout: EmotionalProgress hero + content
   - `src/app/(superadmin)/layout.tsx` — reutiliza AdminDesktopLayout (import directo, no copia)
   And cada layout renderiza una pagina placeholder con el patron de navegacion correcto
   And cada route group tiene su propio `error.tsx` con UI consistente con el design system

4. **AC4 - Responsive y Navegacion Adaptativa:**
   Given los breakpoints Tailwind por defecto (sm=640, md=768, lg=1024, xl=1280)
   When se prueban los layouts en diferentes viewports
   Then todos los layouts son responsive: 375px (mobile) -> 768px (tablet) -> 1024px+ (desktop)
   And en viewports `<lg`: BottomNavBar visible para agent/director/client, menu hamburger para public
   And en viewports `>=lg`: RoleSidebar visible para admin/director/superadmin, navbar horizontal para public
   And BottomNavBar y RoleSidebar NUNCA se muestran simultaneamente
   And estilos base son mobile-first (clases sin prefijo = mobile, agregar con md:, lg:, xl:)

5. **AC5 - Framer Motion (infraestructura completa):**
   Given la necesidad de una UI super moderna con animaciones premium
   When se configura framer-motion como infraestructura reutilizable
   Then existe `src/lib/animations/variants.ts` con variantes: fadeIn, slideUp, slideFromLeft, scaleIn, staggerChildren
   And existe `src/lib/animations/transitions.ts` con curvas estandar: spring, tween, easeOutExpo y duraciones
   And existe `src/hooks/useReducedMotion.ts` que retorna variantes vacias cuando `prefers-reduced-motion` activo
   And existe `src/components/shared/PageTransition.tsx` ('use client') que wrappea children con AnimatePresence + motion.div
   And cada layout usa PageTransition para transiciones de pagina (fade + slide 200ms)
   And RoleSidebar tiene animacion slide-in/out con spring
   And BottomNavBar tiene indicador activo animado con layoutId
   And toda animacion en el proyecto importa de `@/lib/animations/` — CERO animaciones ad-hoc inline

6. **AC6 - Error Boundaries:**
   Given la regla de error boundaries por route group
   When ocurre un error en cualquier route group
   Then cada uno de los 7 route groups tiene su propio `error.tsx`
   And la UI de error usa design tokens (primary, destructive) y Skeleton pattern
   And NUNCA un solo error boundary global

7. **AC7 - Accesibilidad Base:**
   Given los requisitos WCAG 2.1 AA selectivo
   When se implementan los layouts y componentes
   Then todos los elementos interactivos tienen min 44x44px touch targets (min-h-11 min-w-11)
   And focus-visible ring usa accent (#F4A261) con offset 2px en todo elemento clickeable
   And cada layout principal tiene skip link: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Saltar al contenido principal</a>`
   And el contenido principal tiene `id="main-content"`
   And contraste minimo 4.5:1 respetado (ya validado en palette: primary/background=11.2:1 AAA)

8. **AC8 - Custom Components (9 stubs tipados):**
   Given la spec UX define 9 componentes custom como parte del design system
   When se crean los stubs en `src/components/custom/`
   Then cada componente tiene:
   - Interface de props completa (segun spec UX)
   - Render basico funcional con Skeleton o placeholder visual
   - Test co-located que verifica render y ARIA roles basicos
   - Accesibilidad: roles ARIA, touch targets, focus-visible
   And los 9 componentes son: EmotionalProgress, KPICard, PaymentStepper, VerificationPanel, BottomNavBar, RoleSidebar, TripCard, OfflineBanner, BusinessMetric
   And CERO barrel exports — import directo: `import { KPICard } from '@/components/custom/KPICard'`

## Tasks / Subtasks

- [x] Task 1: Instalar 20 componentes shadcn/ui (AC: 1)
  - [x]1.1 Ejecutar `npx shadcn@latest add button card dialog sheet form input progress badge avatar table tabs toast skeleton sidebar select alert tooltip dropdown-menu popover separator`
  - [x]1.2 Verificar que cada componente respeta tokens de globals.css
  - [x]1.3 Eliminar .gitkeep de src/components/ui/ (ya tiene archivos reales)

- [x] Task 2: Infraestructura Framer Motion (AC: 5)
  - [x]2.1 `pnpm add framer-motion`
  - [x]2.2 Crear `src/lib/animations/variants.ts` — fadeIn, slideUp, slideFromLeft, slideFromRight, scaleIn, staggerChildren
  - [x]2.3 Crear `src/lib/animations/transitions.ts` — spring (stiffness 300, damping 30), tween, easeOutExpo, duraciones (fast 150ms, normal 200ms, slow 300ms)
  - [x]2.4 Crear `src/hooks/useReducedMotion.ts` — wrappea useReducedMotion de framer-motion, retorna variantes nulas si activo
  - [x]2.5 Crear `src/components/shared/PageTransition.tsx` ('use client') — AnimatePresence + motion.div con fadeIn + slideUp

- [x] Task 3: Componentes shared de navegacion (AC: 3, 5, 7)
  - [x]3.1 Crear `src/components/shared/Navbar.tsx` — floating navbar para PublicLayout (logo izq, links centro, CTA der, hamburger mobile)
  - [x]3.2 Crear `src/components/shared/Footer.tsx` — footer con contacto, social links, legal
  - [x]3.3 Crear `src/components/shared/SkeletonPage.tsx` — skeleton full-page reutilizable para loading states

- [x] Task 4: Implementar PublicLayout (AC: 3, 4, 7)
  - [x]4.1 `src/app/(public)/layout.tsx` — Server Component, renderiza Navbar + PageTransition({children}) + Footer
  - [x]4.2 `src/app/(public)/error.tsx` — error boundary con design system
  - [x]4.3 Skip link + id="main-content"
  - [x]4.4 Responsive: hamburger <lg, nav horizontal >=lg, max-width 1280px centrado

- [x] Task 5: Implementar AuthLayout (AC: 3, 4, 7)
  - [x]5.1 `src/app/(auth)/layout.tsx` — card centrada mobile, split hero(50%)+form(50%) >=lg
  - [x]5.2 `src/app/(auth)/error.tsx`
  - [x]5.3 Background blur/gradient con primary color

- [x] Task 6: Implementar AgentMobileLayout (AC: 3, 4, 7)
  - [x]6.1 `src/app/(agent)/layout.tsx` — content scrolleable + BottomNavBar
  - [x]6.2 `src/app/(agent)/error.tsx`
  - [x]6.3 BottomNavBar visible <lg, RoleSidebar >=lg (NUNCA ambos)
  - [x]6.4 Safe area bottom iOS: `pb-[env(safe-area-inset-bottom)]`

- [x] Task 7: Implementar AdminDesktopLayout (AC: 3, 4, 7)
  - [x]7.1 `src/app/(admin)/layout.tsx` — RoleSidebar 280px + content area
  - [x]7.2 `src/app/(admin)/error.tsx`
  - [x]7.3 RoleSidebar con animacion slide spring (framer-motion), colapsable a 64px con iconos
  - [x]7.4 Mobile <lg: sidebar oculta, hamburger menu con Sheet overlay

- [x] Task 8: Implementar DirectorLayout (AC: 3, 4, 7)
  - [x]8.1 `src/app/(director)/layout.tsx` — mobile-first (optimizado para Noel en telefono)
  - [x]8.2 `src/app/(director)/error.tsx`
  - [x]8.3 Mobile: KPI area scroll horizontal snap + content full-width
  - [x]8.4 Desktop >=lg: sidebar + dashboard grid

- [x] Task 9: Implementar ClientLayout + SuperAdminLayout (AC: 3, 4, 7)
  - [x]9.1 `src/app/(client)/layout.tsx` — hero area (EmotionalProgress placeholder) + content, max-width 800px desktop
  - [x]9.2 `src/app/(client)/error.tsx`
  - [x]9.3 `src/app/(superadmin)/layout.tsx` — importa y re-exporta AdminDesktopLayout
  - [x]9.4 `src/app/(superadmin)/error.tsx`

- [x] Task 10: 9 Custom Components stubs (AC: 8)
  - [x]10.1 `BottomNavBar.tsx` + test — props: tabs[], notificationBadges; role="navigation", aria-current="page"; indicador activo con framer-motion layoutId; altura 64px, touch targets 56px
  - [x]10.2 `RoleSidebar.tsx` + test — props: roles[], activeSection, collapsed; base shadcn Sidebar; 280px fijo, fondo primary, secciones role="group"; animacion slide spring
  - [x]10.3 `KPICard.tsx` + test — props: title, value, trend, isLoading; base shadcn Card; variants compact/expanded; aria-label descriptivo; font-mono para value
  - [x]10.4 `BusinessMetric.tsx` + test — props: label, value, comparison, variant; base shadcn Card; font-mono 24px value; variants default/highlight
  - [x]10.5 `TripCard.tsx` + test — props: trip, variant(public/agent/client/compact), onClick; base shadcn Card; imagen 16:9, precio font-mono; hover translateY(-4px) con whileHover
  - [x]10.6 `EmotionalProgress.tsx` + test — props: percentage, tripName, destinationHighlight, userName; base shadcn Progress; role="progressbar", aria-valuenow/min/max; milestone states
  - [x]10.7 `PaymentStepper.tsx` + test — props: steps[]; custom (no shadcn base); role="list", aria-current="step"; states: completed(verde), current(naranja), rejected(coral), upcoming(gris)
  - [x]10.8 `VerificationPanel.tsx` + test — props: payment, receipt, aiData, odooData, onVerify, onReject; base shadcn Card + grid; keyboard shortcuts V/R (solo placeholder hints, sin logica)
  - [x]10.9 `OfflineBanner.tsx` + test — props: isOffline, lastSyncTimestamp; base shadcn Alert; role="alert", aria-live="polite"; states offline/online/reconnecting

- [x] Task 11: Paginas placeholder por route group (AC: 3)
  - [x]11.1 Actualizar `src/app/(public)/page.tsx` existente para usar PublicLayout real
  - [x]11.2 Crear `src/app/(auth)/login/page.tsx` y `register/page.tsx` — placeholders con AuthLayout
  - [x]11.3 Crear `src/app/(agent)/dashboard/page.tsx` — placeholder con BottomNavBar visible
  - [x]11.4 Crear `src/app/(admin)/verification/page.tsx` — placeholder con RoleSidebar visible
  - [x]11.5 Crear `src/app/(director)/dashboard/page.tsx` — placeholder con KPI area
  - [x]11.6 Crear `src/app/(client)/my-trips/page.tsx` — placeholder con EmotionalProgress area
  - [x]11.7 Crear `src/app/(superadmin)/users/page.tsx` — placeholder reutilizando AdminDesktopLayout

- [x] Task 12: Verificacion final (AC: 1-8)
  - [x]12.1 `pnpm typecheck` — CERO errores
  - [x]12.2 `pnpm test` — todos los tests de custom components pasan
  - [x]12.3 `pnpm lint` — cero warnings
  - [x]12.4 `pnpm build` — build exitoso con webpack (Serwist)
  - [x]12.5 Verificar responsive visual: 375px, 768px, 1024px en al menos 3 layouts

## Dev Notes

### LO QUE YA EXISTE (de Story 1.1a) — NO MODIFICAR

| Archivo | Que tiene | NO hacer |
|---------|-----------|----------|
| `src/app/globals.css` | @theme con TODOS los brand tokens (colors, fonts, shadows, radius), CSS vars shadcn, dark mode, reduced-motion, safe-bottom | NO modificar tokens. NO crear tailwind.config.ts. Tailwind v4 = CSS-first. |
| `components.json` | shadcn config: new-york, RSC true, lucide, aliases correctos | NO reinicializar shadcn. Solo `npx shadcn@latest add [component]`. |
| `src/app/layout.tsx` | Root layout con Inter/Poppins/RobotoMono via next/font/google, metadata, viewport, lang="es" | NO modificar fuentes. NO agregar providers aqui (story futuras). |
| `src/lib/utils.ts` | `cn()` (clsx + tailwind-merge), `formatCurrency()` | NO duplicar cn(). Importar de `@/lib/utils`. |
| `src/lib/errors.ts` | AppError class | Solo para referencia si error boundaries la usan. |
| 7 route group dirs | Stubs vacios `<>{children}</>` | REEMPLAZAR contenido, no crear archivos nuevos de layout. |
| `src/proxy.ts` | Stub (NextResponse.next()) para 1.4b | NO tocar. |

### PATRONES CRITICOS ARQUITECTURA

**Server vs Client Components:**
- Layouts (`layout.tsx`): Server Component SIEMPRE. Renderiza hijos client como `<PageTransition>`.
- `PageTransition.tsx`: 'use client' (usa motion.div, AnimatePresence)
- `BottomNavBar.tsx`, `RoleSidebar.tsx`: 'use client' (interactivos, framer-motion)
- `error.tsx`: 'use client' (requerido por Next.js)
- Paginas placeholder: Server Component (sin estado)
- Custom component stubs: 'use client' solo si usan hooks/eventos. Si es puro render, Server Component.

**Framer Motion + RSC:**
- `motion.*` components SOLO en archivos 'use client'
- Para animar dentro de Server Components: crear wrapper Client Component
- Patron: Layout (Server) -> PageTransition (Client, wraps children) -> Page (Server)

**Tailwind v4 — CSS-first (NO tailwind.config.ts):**
```css
/* globals.css — YA CONFIGURADO, referencia de tokens disponibles */
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
}
```
Usar en Tailwind como: `bg-primary`, `text-accent`, `font-heading`, `rounded`, etc.

**Naming conventions obligatorias:**
- Archivos componente: `PascalCase.tsx` (KPICard.tsx, BottomNavBar.tsx)
- Tests co-located: `PascalCase.test.tsx` junto al componente
- NUNCA carpeta `__tests__/`
- NUNCA barrel exports (index.ts)
- Import directo: `import { KPICard } from '@/components/custom/KPICard'`
- Un componente principal por archivo
- Props interface con `className?: string` siempre

**Template base para custom components:**
```typescript
// src/components/custom/MyComponent.tsx
import { cn } from '@/lib/utils'

interface MyComponentProps {
  className?: string
  // ... specific props from UX spec
}

export function MyComponent({ className, ...props }: MyComponentProps) {
  return (
    <div className={cn('base-classes', className)} {...props}>
      {/* Stub render or Skeleton */}
    </div>
  )
}
```

**Template base para tests:**
```typescript
// src/components/custom/MyComponent.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('renders without crashing', () => {
    render(<MyComponent />)
    // Assert on ARIA role, visible text, or testid
  })

  it('applies custom className', () => {
    const { container } = render(<MyComponent className="test-class" />)
    expect(container.firstChild).toHaveClass('test-class')
  })
})
```

### RESPONSIVE — REGLAS DE NAVEGACION ADAPTATIVA

```
Viewport <lg (mobile/tablet):
  - (public): Navbar con hamburger menu (Sheet overlay)
  - (auth): Card centrada full-screen
  - (agent): BottomNavBar (4-5 tabs, 64px height)
  - (admin): Hamburger -> Sheet overlay con sidebar
  - (director): BottomNavBar o similar nav compacta
  - (client): Nav minima (back + profile)

Viewport >=lg (desktop):
  - (public): Navbar horizontal con links visibles
  - (auth): Split hero izq 50% + form der 50%
  - (agent): RoleSidebar 280px (NO BottomNavBar)
  - (admin): RoleSidebar 280px persistente
  - (director): RoleSidebar + dashboard grid
  - (client): Layout centrado max-width 800px

REGLA: BottomNavBar y RoleSidebar NUNCA simultaneos.
Implementar con:
  <BottomNavBar className="lg:hidden" />
  <RoleSidebar className="hidden lg:flex" />
```

### ACCESIBILIDAD — CHECKLIST POR LAYOUT

Cada layout DEBE incluir:
1. Skip link como primer hijo: `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground">Saltar al contenido principal</a>`
2. Main content con `<main id="main-content">`
3. Nav con `role="navigation"` y `aria-label` descriptivo
4. Touch targets min 44x44px en todo interactivo
5. Focus ring: `focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2`

### LAYOUT SPECS DETALLADAS (de UX Design Spec)

**PublicLayout:**
- Navbar: fixed top, bg-background/80 backdrop-blur, z-50
- Logo izquierda, links centro (Inicio, Viajes, Nosotros, Contacto), CTA "Cotizar" derecha
- Mobile: hamburger icon -> Sheet desde derecha con links verticales
- Footer: bg-primary, text-primary-foreground, 3 columnas (contacto, links, legal)
- Content: max-w-7xl mx-auto px-4

**AuthLayout:**
- Mobile: bg-background, logo centrado top, card centrada con form
- Desktop >=lg: grid grid-cols-2, izq hero imagen blur con overlay primary/80, der form centrado
- Card: bg-card rounded-lg shadow-lg p-8 max-w-md

**AgentMobileLayout:**
- Content: flex-1 overflow-y-auto pb-20 (espacio para BottomNav)
- BottomNav: fixed bottom, bg-card, border-top, 4 tabs (Dashboard, Clientes, Pagos, Perfil)
- Tab activo: text-accent con indicator bar animado (layoutId)
- iOS safe area: pb-[env(safe-area-inset-bottom)]

**AdminDesktopLayout:**
- Sidebar: fixed left, w-[280px], bg-primary, text-primary-foreground
- Logo top, secciones agrupadas, collapse a 64px (iconos only)
- Content: ml-[280px] (o ml-16 collapsed)
- Mobile <lg: sidebar hidden, hamburger -> Sheet overlay

**DirectorLayout:**
- Mobile-first (Noel usa telefono)
- KPI area: scroll horizontal snap, cards KPICard
- Content: full-width, pull-to-refresh feel
- Desktop >=lg: sidebar + grid 3 columnas

**ClientLayout:**
- Hero area: EmotionalProgress component (placeholder en 1.1b)
- Content: below hero, max-w-3xl mx-auto
- Minimal nav: back button + avatar/profile
- Centrado y limpio, emotivo

### CUSTOM COMPONENTS — PROPS INTERFACES (de UX Spec)

```typescript
// BottomNavBar
interface BottomNavBarProps {
  tabs: Array<{ id: string; label: string; icon: React.ReactNode; href: string }>
  notificationBadges?: Record<string, number>
  className?: string
}

// RoleSidebar
interface RoleSidebarProps {
  roles: string[]
  activeSection: string
  collapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
  className?: string
}

// KPICard
interface KPICardProps {
  title: string
  value: string | number
  trend?: { direction: 'up' | 'down' | 'flat'; percentage: number }
  isLoading?: boolean
  variant?: 'compact' | 'expanded'
  className?: string
}

// BusinessMetric
interface BusinessMetricProps {
  label: string
  value: string | number
  comparison?: { label: string; value: string | number; direction: 'up' | 'down' }
  variant?: 'default' | 'highlight'
  className?: string
}

// TripCard
interface TripCardProps {
  trip: { title: string; slug: string; imageUrl: string; price: number; dates: string; destination: string }
  variant?: 'public' | 'agent' | 'client' | 'compact'
  onClick?: () => void
  className?: string
}

// EmotionalProgress
interface EmotionalProgressProps {
  percentage: number
  tripName: string
  destinationHighlight?: string
  userName?: string
  className?: string
}

// PaymentStepper
interface PaymentStepperProps {
  steps: Array<{ id: string; label: string; status: 'completed' | 'current' | 'rejected' | 'upcoming'; icon?: React.ReactNode; timestamp?: string; amount?: number }>
  className?: string
}

// VerificationPanel
interface VerificationPanelProps {
  payment?: { id: string; amount: number; agentName: string; clientName: string; date: string }
  receipt?: { imageUrl: string; ocrData?: Record<string, string> }
  onVerify?: () => void
  onReject?: (reason: string) => void
  className?: string
}

// OfflineBanner
interface OfflineBannerProps {
  isOffline: boolean
  lastSyncTimestamp?: Date
  className?: string
}
```

### DEPENDENCIAS A INSTALAR

```bash
pnpm add framer-motion
```

NO instalar nada mas. Todo lo demas ya existe de 1.1a:
- shadcn components se agregan via CLI (no pnpm add manual)
- tailwindcss, @tailwindcss/postcss ya instalados
- lucide-react, radix-ui, class-variance-authority ya instalados
- @testing-library/react, vitest, jsdom ya instalados

### ADVERTENCIAS DE STORY 1.1a (LECCIONES APRENDIDAS)

1. **shadcn/ui sobreescribe archivos:** Al agregar componentes, shadcn puede intentar modificar globals.css o utils.ts. Verificar que no se pierdan brand tokens despues de cada `shadcn add`.
2. **Tailwind v4 NO usa tailwind.config.ts:** Los tokens estan en `globals.css @theme`. NO crear tailwind.config.ts — rompe la config CSS-first.
3. **Build con --webpack:** `pnpm build` usa `--webpack` (Serwist). Verificar que los nuevos componentes compilen correctamente.
4. **cross-env en Windows:** Scripts usan `cross-env` para variables de entorno. Ya instalado como devDep.
5. **next/font/google carga fuentes:** Inter, Poppins (600,700), Roboto Mono (500). Las variables CSS se aplican en body className del root layout. NO cargar fuentes otra vez.

### Project Structure Notes

Archivos nuevos creados por esta story:
```
src/
├── lib/animations/
│   ├── variants.ts           # NUEVO — variantes framer-motion reutilizables
│   └── transitions.ts        # NUEVO — curvas y duraciones estandar
├── hooks/
│   └── useReducedMotion.ts   # NUEVO — hook accesibilidad motion
├── components/
│   ├── ui/
│   │   ├── button.tsx        # NUEVO (shadcn add)
│   │   ├── card.tsx          # NUEVO (shadcn add)
│   │   └── ... (18 mas)     # NUEVO (shadcn add, 20 total)
│   ├── custom/
│   │   ├── BottomNavBar.tsx          # NUEVO — stub tipado
│   │   ├── BottomNavBar.test.tsx     # NUEVO — test co-located
│   │   ├── RoleSidebar.tsx           # NUEVO
│   │   ├── RoleSidebar.test.tsx      # NUEVO
│   │   ├── KPICard.tsx               # NUEVO
│   │   ├── KPICard.test.tsx          # NUEVO
│   │   ├── BusinessMetric.tsx        # NUEVO
│   │   ├── BusinessMetric.test.tsx   # NUEVO
│   │   ├── TripCard.tsx              # NUEVO
│   │   ├── TripCard.test.tsx         # NUEVO
│   │   ├── EmotionalProgress.tsx     # NUEVO
│   │   ├── EmotionalProgress.test.tsx # NUEVO
│   │   ├── PaymentStepper.tsx        # NUEVO
│   │   ├── PaymentStepper.test.tsx   # NUEVO
│   │   ├── VerificationPanel.tsx     # NUEVO
│   │   ├── VerificationPanel.test.tsx # NUEVO
│   │   ├── OfflineBanner.tsx         # NUEVO
│   │   └── OfflineBanner.test.tsx    # NUEVO
│   └── shared/
│       ├── PageTransition.tsx  # NUEVO — 'use client', AnimatePresence wrapper
│       ├── Navbar.tsx          # NUEVO — floating navbar para PublicLayout
│       ├── Footer.tsx          # NUEVO — footer para PublicLayout
│       └── SkeletonPage.tsx    # NUEVO — skeleton full-page loading
├── app/
│   ├── (public)/
│   │   ├── layout.tsx        # MODIFICAR — PublicLayout real
│   │   ├── page.tsx          # MODIFICAR — actualizar placeholder con layout
│   │   └── error.tsx         # NUEVO
│   ├── (auth)/
│   │   ├── layout.tsx        # MODIFICAR — AuthLayout real
│   │   ├── login/page.tsx    # NUEVO — placeholder
│   │   ├── register/page.tsx # NUEVO — placeholder
│   │   └── error.tsx         # NUEVO
│   ├── (agent)/
│   │   ├── layout.tsx        # MODIFICAR — AgentMobileLayout real
│   │   ├── dashboard/page.tsx # NUEVO — placeholder
│   │   └── error.tsx         # NUEVO
│   ├── (admin)/
│   │   ├── layout.tsx        # MODIFICAR — AdminDesktopLayout real
│   │   ├── verification/page.tsx # NUEVO — placeholder
│   │   └── error.tsx         # NUEVO
│   ├── (director)/
│   │   ├── layout.tsx        # MODIFICAR — DirectorLayout real
│   │   ├── dashboard/page.tsx # NUEVO — placeholder
│   │   └── error.tsx         # NUEVO
│   ├── (client)/
│   │   ├── layout.tsx        # MODIFICAR — ClientLayout real
│   │   ├── my-trips/page.tsx # NUEVO — placeholder
│   │   └── error.tsx         # NUEVO
│   └── (superadmin)/
│       ├── layout.tsx        # MODIFICAR — re-exporta AdminDesktopLayout
│       ├── users/page.tsx    # NUEVO — placeholder
│       └── error.tsx         # NUEVO
```

**Total archivos nuevos: ~55** (20 shadcn + 18 custom components + 7 error.tsx + 7 placeholders + 3 shared + 3 animations/hooks - 3 .gitkeep eliminados)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-1 — Story 1.1b ACs y dependencias]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md — Route groups, layouts, carpetas]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md — Naming conventions, 28 reglas]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/design-system-foundation.md — shadcn config, Tailwind]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/visual-design-foundation.md — Colores, tipografia, spacing]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md — 9 custom components spec completa]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md — Breakpoints, nav adaptativa, WCAG]
- [Source: _bmad-output/implementation-artifacts/1-1a-project-scaffold-ci-pipeline.md — Lecciones Tailwind v4, shadcn, Serwist]
- [Source: CLAUDE.md — Build commands, naming conventions, key file locations]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 — dev-story workflow con 4 subagentes paralelos (Sonnet) para layouts, componentes y paginas.

### Debug Log References

- **Toast deprecado:** `npx shadcn@latest add toast` fallo. shadcn/ui reemplazo toast con sonner. Fix: usar `sonner` en lugar de `toast`.
- **Conflicto de rutas paralelas:** `(agent)/dashboard/` y `(director)/dashboard/` resolvian ambos a `/dashboard`. Next.js route groups no crean segmentos URL. Fix: mover paginas bajo carpetas con prefijo de rol (`(agent)/agent/dashboard/`, `(director)/director/dashboard/`, etc.) y actualizar todos los hrefs en layouts, BottomNavBar tabs y RoleSidebar sectionsByRole.
- **Lint: Math.random() en sidebar.tsx:** Componente shadcn/ui generado usa Math.random() en SidebarMenuSkeleton. Fix: eslint-disable-next-line.
- **Lint: `any` en test mocks:** Mocks de framer-motion usan `any` para pasar props arbitrarios. Fix: eslint-disable-next-line en lineas de mock.
- **React warnings en tests:** `layoutId`, `whileHover`, `whileTap` no reconocidos en DOM — console warnings del mock passthrough, no afectan tests.

### Completion Notes List

- Story creada via create-story workflow con Party Mode review (Winston, Sally, Amelia)
- Correcciones Party Mode aplicadas: 20 componentes shadcn (no 19), Framer Motion robusto como infraestructura, AC8 para 9 custom components, nav adaptativa NUNCA simultanea, skip links, Tailwind v4 CSS-first explicito
- Scope: ~62 archivos nuevos/modificados, 12 tasks completados
- shadcn usa `sonner` en lugar del deprecado `toast` (20 componentes instalados correctamente)
- Framer Motion 12.34.3 instalado con infraestructura completa (variants, transitions, useReducedMotion, PageTransition)
- Paginas placeholder movidas bajo carpetas con prefijo de rol para evitar conflictos de rutas paralelas en Next.js App Router
- Verificacion final: typecheck 0 errores, 9/9 test files (21/21 tests) passed, lint 0 errores, build exitoso con Serwist SW

### Change Log

- **2026-02-25:** Story creada via create-story workflow con party mode review (Winston, Sally, Amelia). 8 ACs, 12 tasks, Framer Motion como infraestructura completa.
- **2026-02-25:** Implementacion completa. 12/12 tasks done. 62 archivos creados/modificados. Fix critico: rutas con prefijo de rol para evitar conflictos en App Router. Verificacion: typecheck, tests, lint, build — todo green.
- **2026-02-25:** Code review adversarial (5 agentes Sonnet paralelos). 28 issues encontrados (8 CRITICAL, 10 HIGH, 10 MEDIUM). TODOS corregidos:
  - PageTransition reescrito con AnimatePresence + motion.div + usePathname key + useReducedMotion
  - RoleSidebar reescrito: shadcn Sidebar como base, usePathname() para active detection, framer-motion stagger+spring
  - AdminShell.tsx creado: componente compartido admin/superadmin con SidebarProvider + SidebarTrigger mobile
  - SuperAdminLayout reusa AdminShell (no copia), Admin/SuperAdmin tienen Sheet overlay mobile
  - BottomNavBar: fix startsWith falsos positivos, reduced-motion support para layoutId
  - TripCard: animacion importada de @/lib/animations/ (no inline), stopPropagation en Button
  - OfflineBanner: 3 estados (offline/reconnecting/restored), fix aria-live conflicto
  - PaymentStepper: fix CSS relative, icon className forwarding, formatCurrency de utils
  - VerificationPanel: flujo rechazo 2 pasos con textarea, formatCurrency de utils
  - KPICard y EmotionalProgress: removido 'use client' innecesario (Server Components)
  - 8 archivos: constantes renombradas a UPPER_SNAKE_CASE
  - Skip links estandarizados (texto, touch targets, focus-visible ring) en 7 layouts
  - ClientLayout: removido h1 hardcodeado del layout
  - use-mobile.ts renombrado a useMobile.ts + 'use client' + breakpoint lg
  - sidebar.tsx: breakpoints md→lg, import actualizado
  - useReducedMotion: fix null handling (=== true)
  - Footer: suppressHydrationWarning para getFullYear()
  - variants.ts/transitions.ts: staggerChildren unificado a 0.08
  - useHydrated.ts eliminado (dead code)
  - Tests mejorados: de 22 a 96 tests (ARIA, estados, callbacks, className, formatCurrency)
  - Verificacion final: typecheck 0, 96/96 tests passed, lint 0, build exitoso

### File List

**Configuracion:**
- `package.json` — framer-motion agregado
- `pnpm-lock.yaml` — lock actualizado
- `vitest.config.ts` — setupFiles agregado

**Infraestructura Animaciones:**
- `src/lib/animations/variants.ts` — fadeIn, slideUp, slideFromLeft, slideFromRight, scaleIn, staggerChildren, pageTransition, sidebarSlide, noMotion
- `src/lib/animations/transitions.ts` — spring, tween, easeOutExpo, duration presets, pageTransitionConfig, sidebarTransitionConfig
- `src/hooks/useReducedMotion.ts` — hook accesibilidad reduced-motion

**Componentes Shared:**
- `src/components/shared/PageTransition.tsx` — AnimatePresence + motion.div wrapper
- `src/components/shared/Navbar.tsx` — floating navbar, hamburger Sheet mobile
- `src/components/shared/Footer.tsx` — 3 columnas, bg-primary
- `src/components/shared/SkeletonPage.tsx` — skeleton full-page
- `src/components/shared/ErrorPage.tsx` — error UI reutilizable
- `src/components/shared/AdminShell.tsx` — layout compartido admin/superadmin con SidebarProvider

**Componentes shadcn/ui (21 archivos):**
- `src/components/ui/button.tsx`, `card.tsx`, `dialog.tsx`, `sheet.tsx`, `form.tsx`, `input.tsx`, `progress.tsx`, `badge.tsx`, `avatar.tsx`, `table.tsx`, `tabs.tsx`, `sonner.tsx`, `skeleton.tsx`, `sidebar.tsx`, `select.tsx`, `alert.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `separator.tsx`, `label.tsx`
- `src/hooks/useMobile.ts` — shadcn dependency (renombrado de use-mobile.ts, breakpoint lg)

**Componentes Custom (9 + 9 tests):**
- `src/components/custom/BottomNavBar.tsx` + `.test.tsx`
- `src/components/custom/RoleSidebar.tsx` + `.test.tsx`
- `src/components/custom/KPICard.tsx` + `.test.tsx`
- `src/components/custom/BusinessMetric.tsx` + `.test.tsx`
- `src/components/custom/TripCard.tsx` + `.test.tsx`
- `src/components/custom/EmotionalProgress.tsx` + `.test.tsx`
- `src/components/custom/PaymentStepper.tsx` + `.test.tsx`
- `src/components/custom/VerificationPanel.tsx` + `.test.tsx`
- `src/components/custom/OfflineBanner.tsx` + `.test.tsx`

**Layouts (7 modificados):**
- `src/app/(public)/layout.tsx` — PublicLayout: Navbar + PageTransition + Footer
- `src/app/(auth)/layout.tsx` — AuthLayout: hero blur + card centrada
- `src/app/(agent)/layout.tsx` — AgentMobileLayout: BottomNavBar + RoleSidebar
- `src/app/(admin)/layout.tsx` — AdminDesktopLayout: RoleSidebar 280px
- `src/app/(director)/layout.tsx` — DirectorLayout: BottomNavBar mobile + sidebar desktop
- `src/app/(client)/layout.tsx` — ClientLayout: hero + back nav
- `src/app/(superadmin)/layout.tsx` — SuperAdminLayout: RoleSidebar superadmin

**Error Boundaries (7 nuevos):**
- `src/app/(public)/error.tsx`, `(auth)/error.tsx`, `(agent)/error.tsx`, `(admin)/error.tsx`, `(director)/error.tsx`, `(client)/error.tsx`, `(superadmin)/error.tsx`

**Paginas Placeholder (8 nuevas):**
- `src/app/(public)/page.tsx` — actualizada con hero CTA
- `src/app/(auth)/login/page.tsx`, `register/page.tsx`
- `src/app/(agent)/agent/dashboard/page.tsx` — ruta: /agent/dashboard
- `src/app/(admin)/admin/verification/page.tsx` — ruta: /admin/verification
- `src/app/(director)/director/dashboard/page.tsx` — ruta: /director/dashboard
- `src/app/(client)/client/my-trips/page.tsx` — ruta: /client/my-trips
- `src/app/(superadmin)/superadmin/users/page.tsx` — ruta: /superadmin/users

**Test Setup:**
- `src/test/setup.ts` — @testing-library/jest-dom/vitest
