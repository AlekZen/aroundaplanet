# Story 1.2: Public Landing Pages con Branding Real

Status: done

## Story

As a **visitante**,
I want to see professional, branded public pages with real images and trip information,
So that I trust the brand and want to explore trip options.

**Business Context:** Esta story construye las paginas publicas que demuestran valor visual a Noel antes de la garantia Pre-Madrid (Mar 3). Son SSG estaticas con imagenes reales del repo de estrategia, componentes 21st.dev de alto impacto visual, y analytics integrados desde dia 1. NO requiere datos de Odoo (eso es Story 2.1a) — los viajes se muestran con datos estaticos/hardcodeados. El objetivo es "wow factor" visual y conversion tracking.

**Dependencies:**
- **Requiere:** Story 1.1a (scaffold, CI) - DONE + Story 1.1b (design system, layouts, componentes) - DONE
- **Bloquea:** Story 2.6 (analytics attribution tracking requiere analytics init de esta story)
- **NO requiere:** Odoo client (1.5), Auth (1.3), Trip sync (2.1a) — los datos de viajes son ESTATICOS

## Acceptance Criteria

1. **AC1 - Home Page Hero y Branding:**
   Given un visitante navega al home page
   When la pagina carga
   Then ve una seccion hero con fotos reales de viajes grupales (componente hero animado con imagenes del repo estrategia)
   And el logo AroundaPlanet es visible en el Floating Navbar (YA EXISTE de 1.1b)
   And los design tokens estan aplicados: primary #1B4332, accent #F4A261, background #FAFAF8 (YA EXISTE)
   And la tipografia usa Inter (body), Poppins (headings), Roboto Mono (montos) (YA EXISTE)
   And la pagina renderiza como SSG con LCP <2.5s (NFR1)

2. **AC2 - Home Page Secciones de Contenido:**
   Given el home page esta cargado
   When el visitante hace scroll
   Then ve un grid de destinos de viaje con imagenes reales de producto (TripCard variant=public, datos estaticos)
   And ve una seccion "Sobre Nosotros" con foto grupal y retrato del CEO Noel Sahagun
   And ve una seccion CTA con componente de alto impacto visual (glow/shimmer button)
   And ve el footer con info de contacto y links sociales (YA EXISTE de 1.1b)

3. **AC3 - Landing Vuelta al Mundo:**
   Given un visitante navega a la landing "Vuelta al Mundo"
   When la pagina carga
   Then ve la imagen hero del viaje, itinerario placeholder, precio ($145,000 MXN en Roboto Mono), y CTA "Cotizar"
   And la pagina usa el PublicLayout con comportamiento responsive (mobile stack -> desktop grid)

4. **AC4 - Assets Reales en el Proyecto:**
   Given el proyecto necesita imagenes reales
   When se incluyen los assets
   Then logo, hero images, imagenes de carousel, e imagenes de productos estan copiadas desde el repo de estrategia (`execution/web-audit/assets/`) a `public/images/`
   And las imagenes usan Next.js `<Image>` con prop `sizes` y formato WebP
   And todas las paginas publicas son responsive: mobile 375px -> tablet 768px -> desktop 1024px+

5. **AC5 - Analytics desde Dia 1:**
   Given analytics son requeridos desde dia 1
   When cualquier pagina publica carga
   Then Firebase Analytics esta inicializado (FR59)
   And el codigo base de Meta Pixel dispara (FR61)
   And el contenedor de Google Tag Manager esta cargado (FR61)

## Tasks / Subtasks

- [x] Task 1: Copiar assets reales del repo estrategia (AC: 4)
  - [x]1.1 Copiar imagenes hero: `hero-group-photo-01.webp`, `hero-group-photo-02.webp`, `bg-group-original.webp` a `public/images/hero/`
  - [x]1.2 Copiar imagenes de productos (viajes): seleccion de ~12 mejores de `products/` a `public/images/trips/`
  - [x]1.3 Copiar imagenes de destinos: `dest-intl-01.webp` a `dest-intl-10.webp` a `public/images/destinations/`
  - [x]1.4 Copiar imagenes "sobre nosotros": `noel-sahagun-ceo.webp`, `about-group-photo.webp` a `public/images/about/`
  - [x]1.5 Copiar imagenes carousel: `carousel-01.webp` a `carousel-10.webp` a `public/images/carousel/`
  - [x]1.6 Copiar `vuelta-al-mundo-2025.webp` a `public/images/trips/`

- [x] Task 2: Crear datos estaticos de viajes (AC: 2, 3)
  - [x]2.1 Crear `src/lib/data/trips.ts` con array de viajes hardcodeados (nombre, slug, precio en centavos, fechas, destino, imageUrl apuntando a public/images/trips/)
  - [x]2.2 Incluir minimo 6 viajes representativos del catalogo real (Vuelta al Mundo, Europa, Chiapas, Argentina-Brasil, Turquia, Colombia)
  - [x]2.3 Incluir viaje "Vuelta al Mundo 33.8 dias" con datos completos (precio 14500000 centavos, itinerario placeholder de 10 dias)

- [x] Task 3: Componentes 21st.dev para paginas publicas (AC: 1, 2)
  - [x]3.1 Crear `src/components/public/HeroSection.tsx` — hero animado con imagen de fondo, headline "Camina con Nosotros", subtitulo, CTA shimmer button. Responsive: full-width mobile, overlay texto desktop. Usar `<Image priority>` para LCP
  - [x]3.2 Crear `src/components/public/CTASection.tsx` — seccion CTA con glow effect en boton principal. Texto motivacional + boton "Explorar Viajes" con efecto shimmer naranja (#F4A261)
  - [x]3.3 Crear `src/components/public/AboutSection.tsx` — seccion "Sobre Nosotros" con foto grupal, retrato CEO, copy breve de la empresa (8 anios, Ocotlan Jalisco, +100 agentes). Grid 1 col mobile, 2 cols desktop

- [x] Task 4: Implementar Home Page real (AC: 1, 2)
  - [x]4.1 Reemplazar `src/app/(public)/page.tsx` placeholder con home page completo
  - [x]4.2 Seccion Hero: HeroSection con hero-group-photo-01.webp
  - [x]4.3 Seccion Viajes: grid responsive (1/2/3 cols) de TripCard con datos estaticos de trips.ts
  - [x]4.4 Seccion Sobre Nosotros: AboutSection con fotos reales
  - [x]4.5 Seccion CTA: CTASection con shimmer button
  - [x]4.6 SSG: export const revalidate = 3600 (ISR 1 hora para futuro, por ahora es estatico)

- [x] Task 5: Implementar Landing Vuelta al Mundo (AC: 3)
  - [x]5.1 Crear `src/app/(public)/viajes/vuelta-al-mundo/page.tsx` — landing estatica SSG
  - [x]5.2 Hero image con vuelta-al-mundo-2025.webp, titulo, precio $145,000 MXN (formatCurrency), CTA "Cotizar"
  - [x]5.3 Seccion itinerario placeholder (timeline visual con 10 paradas representativas)
  - [x]5.4 Seccion de precio con Roboto Mono, plan de pagos sugerido placeholder
  - [x]5.5 SEO metadata: generateMetadata con Open Graph, description, og:image

- [x] Task 6: Pagina Catalogo placeholder (AC: 2)
  - [x]6.1 Crear `src/app/(public)/viajes/page.tsx` — grid de todos los viajes estaticos
  - [x]6.2 Responsive grid: 1 col mobile, 2 tablet, 3 desktop
  - [x]6.3 TripCard variant="public" para cada viaje de trips.ts

- [x] Task 7: Actualizar Navbar links y Footer (AC: 1, 2)
  - [x]7.1 Actualizar navLinks en Navbar.tsx: rutas correctas (`/viajes`, `/viajes/vuelta-al-mundo`, `/sobre-nosotros`)
  - [x]7.2 Actualizar Footer links para coincidir con rutas reales
  - [x]7.3 Agregar links de redes sociales reales de AroundaPlanet al Footer (Instagram, Facebook, TikTok)

- [x] Task 8: SEO y Metadata (AC: 1, 3)
  - [x]8.1 Crear `src/lib/metadata.ts` — helpers para generateMetadata con defaults de AroundaPlanet
  - [x]8.2 Home page metadata: title, description, Open Graph, og:image con hero
  - [x]8.3 Landing Vuelta al Mundo: metadata especifica del viaje
  - [x]8.4 Catalogo: metadata con listado de viajes

- [x] Task 9: Analytics Integration (AC: 5)
  - [x]9.1 Crear `src/lib/analytics.ts` — wrapper unificado que dispara eventos en Firebase Analytics + Meta Pixel + Google Tag
  - [x]9.2 Funciones: `trackEvent(name, params)`, `trackPageView()`, `initAnalytics()`
  - [x]9.3 Crear `src/components/shared/AnalyticsProvider.tsx` ('use client') — inicializa analytics en mount, captura UTMs y ref de agente en sessionStorage
  - [x]9.4 Agregar AnalyticsProvider al PublicLayout (wrappea children)
  - [x]9.5 Agregar variables de entorno a `.env.local`: NEXT_PUBLIC_META_PIXEL_ID, NEXT_PUBLIC_GOOGLE_TAG_ID
  - [x]9.6 Eventos a trackear: page_view en cada pagina, view_trip al hacer click en TripCard

- [x] Task 10: Pagina Sobre Nosotros (AC: 2)
  - [x]10.1 Crear `src/app/(public)/sobre-nosotros/page.tsx` — pagina "Sobre Nosotros" con contenido real
  - [x]10.2 Foto grupal hero, retrato CEO Noel Sahagun, historia breve de la empresa
  - [x]10.3 Copy: fundada en Ocotlan Jalisco, 8 anios de experiencia, mas de 100 agentes, expansion a Madrid

- [x] Task 11: Verificacion final (AC: 1-5)
  - [x]11.1 `pnpm typecheck` — CERO errores
  - [x]11.2 `pnpm lint` — cero warnings
  - [x]11.3 `pnpm build` — build exitoso con webpack (Serwist)
  - [x]11.4 Verificar responsive visual: 375px, 768px, 1024px en home page
  - [x]11.5 Verificar LCP <2.5s (Lighthouse audit o manual check)
  - [x]11.6 Verificar que analytics script tags estan presentes en HTML output

## Dev Notes

### LO QUE YA EXISTE (de Stories 1.1a + 1.1b) — NO RECREAR

| Componente | Ubicacion | Estado | NO hacer |
|-----------|-----------|--------|----------|
| PublicLayout | `src/app/(public)/layout.tsx` | Completo: Navbar + PageTransition + Footer, skip link, max-w-7xl | NO crear nuevo layout. Solo agregar AnalyticsProvider |
| Navbar | `src/components/shared/Navbar.tsx` | Floating, hamburger Sheet mobile, logo, nav links, CTA | Solo ACTUALIZAR hrefs de navLinks, NO reescribir |
| Footer | `src/components/shared/Footer.tsx` | 3 columnas, bg-primary, links, legal, copyright | Solo ACTUALIZAR hrefs y agregar social links |
| TripCard | `src/components/custom/TripCard.tsx` | Completo con 4 variants, formatCurrency, hover anim, Image | USAR directamente con datos estaticos |
| PageTransition | `src/components/shared/PageTransition.tsx` | AnimatePresence + motion.div | NO tocar |
| Design tokens | `src/app/globals.css` | @theme con todos los brand tokens | NO modificar |
| Typography | `src/app/layout.tsx` | Inter, Poppins 600/700, Roboto Mono 500 | NO re-cargar fuentes |
| cn() + formatCurrency() | `src/lib/utils.ts` | Utilities listas | IMPORTAR, no duplicar |
| 21 shadcn/ui components | `src/components/ui/` | Todos instalados | NO reinstalar |
| ErrorPage | `src/components/shared/ErrorPage.tsx` | Error UI compartida | Usar en error.tsx si necesario |
| error.tsx | `src/app/(public)/error.tsx` | YA EXISTE de 1.1b | NO recrear |

### DATOS ESTATICOS — NO USAR ODOO

Story 1.2 usa datos HARDCODEADOS en `src/lib/data/trips.ts`. NO hay llamadas a Odoo, NO hay API routes, NO hay Firestore. Los datos son representativos del catalogo real:

```typescript
// src/lib/data/trips.ts
export interface StaticTrip {
  title: string
  slug: string
  imageUrl: string // /images/trips/nombre.webp
  price: number // centavos (14500000 = $145,000 MXN)
  dates: string // "Marzo 2026"
  destination: string // "Internacional"
  description?: string
}

export const STATIC_TRIPS: StaticTrip[] = [
  {
    title: 'Vuelta al Mundo 33.8 dias',
    slug: 'vuelta-al-mundo',
    imageUrl: '/images/trips/vuelta-al-mundo-2025.webp',
    price: 14500000,
    dates: 'Todo el anio',
    destination: 'Internacional',
    description: 'La aventura de tu vida...'
  },
  // ... 5-7 mas con datos del catalogo real
]
```

**Precios reales del catalogo (centavos):**
- Vuelta al Mundo: 14,500,000 ($145,000 MXN)
- Europa Inolvidable: ~8,000,000 ($80,000 MXN estimado)
- Argentina-Brasil: ~5,500,000 ($55,000 MXN estimado)
- Chiapas: ~1,500,000 ($15,000 MXN estimado)
- Turquia-Dubai: ~6,000,000 ($60,000 MXN estimado)
- Colombia: ~4,000,000 ($40,000 MXN estimado)

### ASSETS — REPO ESTRATEGIA

Las imagenes vienen de `D:\dev\AlekContenido\Areas\Proyectos\AroundaPlanet\execution\web-audit\assets\` y se copian a `public/images/`:

```
public/images/
├── logo-aroundaplanet.webp    # YA EXISTE
├── hero/
│   ├── hero-group-photo-01.webp   # Foto grupal viajeros
│   ├── hero-group-photo-02.webp   # Segunda foto grupal
│   └── bg-group-original.webp     # Background parallax
├── trips/
│   ├── vuelta-al-mundo-2025.webp
│   ├── europa-inolvidable.webp
│   ├── argentina-brasil-agosto-2025.webp
│   ├── chiapas-octubre-2025.webp
│   ├── turquia-dubai-2025.webp
│   ├── colombia-octubre-2025.webp
│   └── ... (seleccion de 8-12 productos)
├── destinations/
│   ├── dest-intl-01.webp a dest-intl-10.webp
├── carousel/
│   ├── carousel-01.webp a carousel-10.webp
└── about/
    ├── noel-sahagun-ceo.webp      # Retrato CEO
    └── about-group-photo.webp     # Foto equipo
```

**CRITICO:** Todas las imagenes ya estan en formato WebP. Usar Next.js `<Image>` con:
- `priority` en hero above-the-fold (LCP)
- `sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"` para responsive
- `fill` con `className="object-cover"` para backgrounds
- `width`/`height` explicitos para content images

### COMPONENTES PUBLICOS — ARQUITECTURA

Crear en `src/components/public/` (carpeta nueva para componentes exclusivos de paginas publicas):

**HeroSection.tsx** ('use client' — usa framer-motion para animacion de entrada):
- Imagen de fondo full-width con overlay semi-transparente primary/60
- Headline: "Camina con Nosotros" (font-heading, text-4xl md:text-5xl lg:text-6xl, text-white)
- Subtitulo: "Vuelta al Mundo en 33.8 dias — Tu aventura comienza hoy"
- CTA: Button con efecto shimmer/glow (bg-accent, hover:bg-accent-light)
- Responsive: min-h-[60vh] mobile, min-h-[80vh] desktop
- `<Image priority>` en la imagen hero (LCP critical)
- Animacion: fadeIn + slideUp del texto usando variants de `@/lib/animations/variants`
- `useReducedMotion`: sin animacion si activo

**CTASection.tsx** (Server Component o 'use client' segun efecto):
- Background bg-primary o bg-muted
- Copy motivacional centrado
- Boton grande con efecto visual (shimmer, glow, o gradiente animado)
- Margin vertical generoso (py-16 md:py-24)

**AboutSection.tsx** (Server Component):
- Grid: 1 col mobile, 2 cols md+
- Col izquierda: foto grupal con `<Image>`
- Col derecha: titulo "Sobre Nosotros" (font-heading), copy empresa, retrato CEO con caption
- Datos: 8 anios experiencia, +100 agentes, Ocotlan Jalisco, expansion Madrid 2026

**NO crear en `src/components/custom/`** — esa carpeta es para componentes reutilizables cross-role (TripCard, KPICard, etc). Los componentes de paginas publicas van en `src/components/public/`.

### ANALYTICS — IMPLEMENTACION

**Tres servicios de analytics desde dia 1 (FR59, FR61):**

1. **Firebase Analytics** — ya hay Firebase SDK de 1.1a
   - Importar de firebase/analytics
   - Inicializar con `getAnalytics(firebaseApp)`
   - Eventos: `logEvent(analytics, 'page_view', { page_path })`

2. **Meta Pixel** — script inyectado en head
   - Variable: `NEXT_PUBLIC_META_PIXEL_ID`
   - Script tag en layout o via next/script
   - Eventos: `fbq('track', 'PageView')`, `fbq('track', 'ViewContent', { content_name })`

3. **Google Tag Manager** — container inyectado
   - Variable: `NEXT_PUBLIC_GOOGLE_TAG_ID`
   - Script tag via next/script
   - Eventos se disparan via dataLayer push

**Wrapper unificado (`src/lib/analytics.ts`):**
```typescript
// Dispara el mismo evento en los 3 servicios
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  // Firebase Analytics
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params)
  }
  // Meta Pixel
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('trackCustom', eventName, params)
  }
}
```

**AnalyticsProvider.tsx** ('use client'):
- Inicializa Firebase Analytics en useEffect
- Inyecta Meta Pixel script
- Inyecta GTM script
- Captura UTMs y `ref` param en sessionStorage para atribucion futura
- Solo se ejecuta en cliente (typeof window !== 'undefined')
- NO bloquea render — scripts con strategy="afterInteractive"

**Variables de entorno necesarias en `.env.local`:**
```
NEXT_PUBLIC_META_PIXEL_ID=  # Pendiente de Noel
NEXT_PUBLIC_GOOGLE_TAG_ID=  # Pendiente de Noel
```
Si las variables estan vacias, los scripts NO se inyectan (graceful degradation). Firebase Analytics usa la config existente del SDK.

### SEO — METADATA HELPERS

**`src/lib/metadata.ts`:**
```typescript
import { Metadata } from 'next'

const BASE_URL = 'https://aroundaplanet.com' // Placeholder, se actualizara con dominio real
const DEFAULT_OG_IMAGE = '/images/hero/hero-group-photo-01.webp'

export function createMetadata(overrides: Partial<Metadata>): Metadata {
  return {
    title: overrides.title || 'AroundaPlanet — Viaja el Mundo',
    description: overrides.description || 'Vuelta al Mundo en 33.8 dias. La agencia de viajes grupales mas aventurera de Mexico.',
    openGraph: {
      type: 'website',
      siteName: 'AroundaPlanet',
      locale: 'es_MX',
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
      ...(overrides.openGraph || {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...(overrides.twitter || {}),
    },
    ...overrides,
  }
}
```

Cada pagina usa `export const metadata = createMetadata({...})` o `export async function generateMetadata()`.

### RESPONSIVE — REGLAS YA DEFINIDAS

PublicLayout ya es responsive de 1.1b:
- **Mobile (375px+):** Hamburger menu, content full-width, px-4
- **Tablet (768px+):** Nav horizontal, 2 cols grid
- **Desktop (1024px+):** Nav + CTA, 3 cols grid, max-w-7xl centrado

Para las secciones nuevas del home:
- Hero: full-width siempre (fuera del max-w-7xl si se desea bleed)
- Grid viajes: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- Sobre Nosotros: `grid grid-cols-1 md:grid-cols-2 gap-8`
- CTA: full-width con padding interno

**NOTA sobre full-bleed hero:** El PublicLayout wrappea children en `max-w-7xl mx-auto px-4`. Si el hero necesita ser full-width, hay dos opciones:
1. Usar CSS negative margin trick: `mx-[-1rem] md:mx-[-calc-based]` (fragil)
2. **MEJOR:** Modificar PublicLayout para que el max-w-7xl este en un wrapper interno que el hero puede saltar con una prop o slot

Recomendacion: Modificar PublicLayout minimo — agregar el hero DENTRO del max-w-7xl pero con `rounded-lg overflow-hidden` o que el hero use `relative` con imagen que llena el viewport width via CSS. Evaluar en implementacion.

### FRAMER MOTION + SSR — REGLA CRITICA (de 1.1b)

**NUNCA usar `motion.*` en page shell SSR** (Navbar, layouts, Footer). framer-motion SIEMPRE inyecta inline styles en cliente que no existen en SSR -> hydration mismatch inevitable.

Para los componentes nuevos:
- `HeroSection.tsx`: 'use client' SI usa motion para animacion de entrada del texto. Imagen hero es HTML plano (no motion).
- `AboutSection.tsx`: Server Component preferido. Si necesita animacion scroll-reveal, crear wrapper client.
- `CTASection.tsx`: Server Component si solo es texto + boton con CSS. 'use client' si usa shimmer animation con JS.

**Patron seguro para animaciones en paginas SSG:**
```tsx
// Componente 'use client' que anima en mount
'use client'
import { motion } from 'framer-motion'
import { fadeIn, slideUp } from '@/lib/animations/variants'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export function AnimatedText({ children }: { children: React.ReactNode }) {
  const { variants } = useReducedMotion(slideUp)
  return <motion.div variants={variants} initial="hidden" animate="visible">{children}</motion.div>
}
```

### RUTAS — ESTRUCTURA

```
src/app/(public)/
├── layout.tsx              # MODIFICAR: agregar AnalyticsProvider
├── page.tsx                # REEMPLAZAR: home page real
├── error.tsx               # YA EXISTE
├── viajes/
│   ├── page.tsx            # NUEVO: catalogo de viajes
│   └── vuelta-al-mundo/
│       └── page.tsx        # NUEVO: landing VaM
└── sobre-nosotros/
    └── page.tsx            # NUEVO: about page
```

**ATENCION rutas:** En Next.js App Router con route groups, `(public)/viajes/page.tsx` mapea a la URL `/viajes`. No hay prefijo `(public)` en la URL.

### LECCIONES DE STORIES ANTERIORES (CRITICAS)

1. **shadcn/ui sobreescribe globals.css:** Al ejecutar `shadcn add`, verificar que no se pierdan brand tokens. En esta story NO se agregan shadcn components — todos ya estan instalados.
2. **Route groups paralelos:** Evitar rutas que colisionen. `/viajes` solo existe en `(public)`. Verificar que no haya conflicto con rutas futuras de agent/admin.
3. **Build con --webpack:** `pnpm build` usa `--webpack` (Serwist). Verificar que las nuevas paginas compilen correctamente.
4. **Framer Motion + SSR:** NUNCA poner `motion.*` en shell SSR. Solo en 'use client' components que se montan despues del hydrate.
5. **Next.js Image optimization:** El build falla si las imagenes referenciadas con `<Image src="/images/...">` no existen en `public/`. Copiar assets ANTES de hacer build.
6. **formatCurrency:** Ya existe en `@/lib/utils`. NO recrear. Usa centavos como input.
7. **PageTransition en PublicLayout:** Ya wrappea children con AnimatePresence. NO agregar otro wrapper de animacion en las paginas — causa animaciones dobles.
8. **next/script para terceros:** Usar `<Script strategy="afterInteractive">` de next/script para Meta Pixel y GTM. NO inyectar scripts manualmente en document.
9. **Tests co-located:** Si se crean componentes en `src/components/public/`, los tests van junto a ellos (`HeroSection.test.tsx`). NUNCA carpeta `__tests__/`.

### Project Structure Notes

Archivos nuevos creados por esta story:
```
public/images/
├── hero/                          # NUEVO (3 archivos WebP)
├── trips/                         # NUEVO (8-12 archivos WebP)
├── destinations/                  # NUEVO (10 archivos WebP)
├── carousel/                      # NUEVO (10 archivos WebP)
└── about/                         # NUEVO (2 archivos WebP)

src/
├── lib/
│   ├── data/trips.ts              # NUEVO — datos estaticos viajes
│   ├── analytics.ts               # NUEVO — wrapper unificado analytics
│   └── metadata.ts                # NUEVO — helpers SEO metadata
├── components/
│   ├── public/
│   │   ├── HeroSection.tsx        # NUEVO — hero animado
│   │   ├── CTASection.tsx         # NUEVO — CTA con efecto visual
│   │   └── AboutSection.tsx       # NUEVO — seccion sobre nosotros
│   └── shared/
│       ├── AnalyticsProvider.tsx   # NUEVO — inicializa analytics + captura atribucion
│       ├── Navbar.tsx             # MODIFICAR — actualizar hrefs
│       └── Footer.tsx             # MODIFICAR — actualizar hrefs + social links
├── app/(public)/
│   ├── layout.tsx                 # MODIFICAR — agregar AnalyticsProvider
│   ├── page.tsx                   # REEMPLAZAR — home page real
│   ├── viajes/
│   │   ├── page.tsx               # NUEVO — catalogo
│   │   └── vuelta-al-mundo/
│   │       └── page.tsx           # NUEVO — landing VaM
│   └── sobre-nosotros/
│       └── page.tsx               # NUEVO — about page
```

**Total archivos nuevos:** ~10 archivos TS/TSX + ~30-35 imagenes WebP
**Archivos modificados:** 3 (Navbar.tsx, Footer.tsx, PublicLayout)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.2 — ACs originales y FRs]
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md — FR10-FR15 (public content), FR59-FR61 (analytics)]
- [Source: _bmad-output/planning-artifacts/prd/non-functional-requirements.md — NFR1 (LCP), NFR18 (CDN), NFR30 (contraste), NFR31 (touch targets)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md — 21st.dev components seleccion]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/visual-design-foundation.md — Colores, tipografia, spacing]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/design-system-foundation.md — PublicLayout specs]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/user-journey-flows.md — Journey 1: Visitante->Cliente]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md — SSG/ISR, rendering patterns]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md — Naming, file structure, testing]
- [Source: _bmad-output/implementation-artifacts/1-1b-design-system-layout-foundation.md — Componentes existentes, lecciones aprendidas]
- [Source: CLAUDE.md — Build commands, Next.js 16 notes, naming conventions]
- [Source: D:/dev/AlekContenido/.../web-audit/assets/ — Assets reales disponibles]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- **Hydration mismatch PageTransition:** `motion.div` con `initial="hidden"` en shell SSR causaba hydration error persistente (documentado en 1.1b pero no corregido correctamente). Fix definitivo: `useSyncExternalStore` para detectar client vs server, renderizar `<div>` plano durante SSR/hydration, `motion.div` solo despues de hydration.
- **ESLint react-hooks/refs:** Mutacion de `useRef.current` durante render no permitida. Fix: migrar a `useSyncExternalStore`.
- **ESLint react-hooks/set-state-in-effect:** `useState` + `useEffect` para hydration detection no permitido. Fix: `useSyncExternalStore` (patron oficial React 18+).
- **metadataBase warning:** Build advierte que `metadataBase` no esta configurada para OG images. No bloqueante, se configurara cuando haya dominio real.

### Completion Notes List

- 35 imagenes WebP copiadas del repo estrategia a public/images/ (hero, trips, destinations, carousel, about)
- 8 viajes estaticos en src/lib/data/trips.ts con datos representativos del catalogo real + itinerario VaM 11 paradas
- 3 componentes publicos: HeroSection (animated hero 'use client'), CTASection (Server Component), AboutSection (Server Component)
- Home page completo: hero animado, grid 8 TripCards, seccion About, CTA section
- Landing Vuelta al Mundo: hero image, itinerario timeline 11 paradas, precio $145,000 MXN, CTA
- Catalogo: grid responsive de todos los viajes
- Sobre Nosotros: hero image, contenido empresa, stats, foto CEO
- AnalyticsProvider: Firebase Analytics page views, Meta Pixel, GTM — graceful degradation si IDs no configurados
- Analytics wrapper (src/lib/analytics.ts): trackEvent, trackPageView, captureAttribution (UTMs + ref en sessionStorage)
- SEO metadata helper (src/lib/metadata.ts): createMetadata con defaults OG
- Navbar actualizada: rutas reales (/viajes, /viajes/vuelta-al-mundo, /sobre-nosotros)
- Footer actualizado: rutas reales
- FIX CRITICO: PageTransition reescrito con useSyncExternalStore para eliminar hydration mismatch de framer-motion
- Verificacion: typecheck 0, 96/96 tests pass, lint 0, build exitoso (15 static pages)

### Change Log

- **2026-02-25:** Implementacion completa Story 1.2. 11/11 tasks done. Fix hydration mismatch PageTransition con useSyncExternalStore.
- **2026-02-25:** Code review adversarial: 16 issues (4 CRITICAL, 4 HIGH, 8 MEDIUM), TODOS corregidos. Fixes: AnalyticsProvider como sibling (no wrapper), double page view eliminado (skip first render), itinerario usa item.day (no index+1), metadata.ts spread bug, captureAttribution first-touch-wins, Navbar active indicator con aria-current, TripCard href con Link, PRICE_CENTAVOS eliminado (usa STATIC_TRIPS), arrays readonly, COMPANY_STATS UPPER_SNAKE_CASE, semantic ul/li grids, Footer email mailto:, CEO avatar shrink-0. Verificacion: typecheck 0, 96/96 tests, lint 0, build green.

### File List

**Assets (35 imagenes WebP):**
- `public/images/hero/hero-group-photo-01.webp`
- `public/images/hero/hero-group-photo-02.webp`
- `public/images/hero/bg-group-original.webp`
- `public/images/trips/vuelta-al-mundo-2025.webp`
- `public/images/trips/europa-inolvidable.webp`
- `public/images/trips/argentina-brasil-agosto-2025.webp`
- `public/images/trips/chiapas-octubre-2025.webp`
- `public/images/trips/turquia-dubai-2025.webp`
- `public/images/trips/colombia-octubre-2025.webp`
- `public/images/trips/peru-diciembre-2025.webp`
- `public/images/trips/japon-china-corea-2026.webp`
- `public/images/trips/nueva-york-diciembre-2025.webp`
- `public/images/destinations/dest-intl-01.webp` a `dest-intl-10.webp`
- `public/images/carousel/carousel-01.webp` a `carousel-10.webp`
- `public/images/about/about-group-photo.webp`
- `public/images/about/noel-sahagun-ceo.webp`

**Codigo nuevo:**
- `src/lib/data/trips.ts` — datos estaticos viajes + itinerario VaM
- `src/lib/analytics.ts` — wrapper unificado analytics (Firebase + Meta Pixel + GTM)
- `src/lib/metadata.ts` — helpers SEO metadata
- `src/components/public/HeroSection.tsx` — hero animado con framer-motion
- `src/components/public/CTASection.tsx` — seccion CTA reutilizable
- `src/components/public/AboutSection.tsx` — seccion sobre nosotros
- `src/components/shared/AnalyticsProvider.tsx` — provider analytics + attribution capture
- `src/app/(public)/viajes/page.tsx` — catalogo viajes
- `src/app/(public)/viajes/vuelta-al-mundo/page.tsx` — landing VaM
- `src/app/(public)/sobre-nosotros/page.tsx` — pagina sobre nosotros

**Codigo modificado:**
- `src/app/(public)/page.tsx` — home page real (reemplazado placeholder)
- `src/app/(public)/layout.tsx` — agregado AnalyticsProvider
- `src/components/shared/Navbar.tsx` — rutas actualizadas, constante UPPER_SNAKE_CASE
- `src/components/shared/Footer.tsx` — rutas actualizadas
- `src/components/shared/PageTransition.tsx` — FIX hydration: useSyncExternalStore
