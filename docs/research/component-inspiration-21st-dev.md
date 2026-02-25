# Inspiración de Componentes — 21st.dev

> Fecha: 24 febrero 2026
> Fuente: https://21st.dev (biblioteca de componentes React/Next.js con shadcn/ui)
> Propósito: Selección de componentes modernos y animados para rediseño de páginas públicas AroundaPlanet
> Stack destino: Next.js + Tailwind CSS + Framer Motion + shadcn/ui
> Sincronizado con: `D:\dev\Proyectos de terceros\aroundaplanet\docs\research\`

---

## Decisiones de Alek (confirmadas en sesión)

### HERO — Favoritas (2 componentes)

#### 1. Scroll Morph Hero (Prashant Som)
- **URL**: https://21st.dev/prashantsom75/scroll-morph-hero/default
- **Qué hace**: Imágenes dispersas que al hacer scroll se morphean en círculo, luego en arco interactivo tipo rainbow
- **Instalación**: `npx shadcn@latest add https://21st.dev/r/prashantsom75/scroll-morph-hero`
- **Dependencia**: `framer-motion`
- **Aplicación AroundaPlanet**: Las 20 imágenes del círculo son destinos de viaje. **Cada imagen linkea al paquete correspondiente** (requisito Alek). Título central: "Camina con Nosotros" o "Tu próximo destino te espera"
- **Adaptación**: Reemplazar imágenes placeholder con fotos reales de destinos (ya descargadas en `assets/products/`)

#### 2. Hero Section con Mapa (Ravi Katiyar)
- **URL**: https://21st.dev/ravikatiyar/hero-section-5/default
- **Qué hace**: Headline grande + subtítulo + CTA prominente + mapa visual con pins de roadmap
- **Aplicación AroundaPlanet**: Mapa con pins en destinos populares (Cancún, Europa, Perú, etc.). CTA: "Cotiza tu viaje" / "Explora destinos". El mapa ES el negocio.

### CARDS — Favorita (1 componente)

#### 3. Clip Path Links (Hover.Dev)
- **URL**: https://21st.dev/TomIsLoading/clip-path-links/default
- **Qué hace**: Grid de celdas con iconos. Al hacer hover, se expande con animación clip-path revelando contenido
- **Aplicación AroundaPlanet**: Grid de destinos de viaje. Cada celda = un destino con ícono/bandera. Hover = foto del destino se revela con efecto clip-path. Click = navega al paquete
- **Uso ideal**:
  - Página de destinos (grid 6-9 destinos principales)
  - Homepage sección "Explora Destinos" debajo del hero
  - Cada celda linkeada directo al viaje

---

## Catálogo Completo Explorado por Categoría

### HEROES (73 componentes explorados)

| Componente | Autor | Por qué aplica | URL |
|---|---|---|---|
| **Scroll Morph Hero** ★ | Prashant Som | Galería circular interactiva con scroll | `prashantsom75/scroll-morph-hero` |
| **Hero Section (mapa)** ★ | Ravi Katiyar | Mapa + CTA, perfecto para viajes | `ravikatiyar/hero-section-5` |
| Hero Minimalism | uimix | Clean, minimal hero | `uimix/hero-minimalism` |
| Hero bg Shader | shadway | Background animado con shader | `shadway/hero-section-with-smooth-bg-shader` |
| Sparkles | Aceternity UI | Efecto sparkles, buen hero llamativo | `aceternity/sparkles` |
| Wave Background | KainXu | Ondas animadas (evoca viaje/mar) | `Kain0127/wave-background` |
| Video Scroll Hero | Isaiah | Video con efecto parallax scroll | `isaiahbjork/video-scroll-hero` |
| Spotlight | Aceternity UI | Efecto spotlight, elegante | `aceternity/spotlight` |
| Hero Section 5 | Tailark | Hero clean con imagen lateral | `tailark/hero-section-5` |
| Shaders Hero | Vaibhav Kumar Singh | Background shader impactante | `vaib215/shaders-hero-section` |

### CAROUSELS (55+ componentes explorados)

| Componente | Autor | Por qué aplica | URL |
|---|---|---|---|
| **3D Carousel** | cult ui | Fotos 3D — ideal para destinos | `cult-ui/3d-carousel` |
| **Gallery 6** | Shadcnblocks | Galería con cards descriptivas | `shadcnblockscom/gallery6` |
| **Gallery with image cards** | Shadcnblocks | Case studies con fotos | `shadcnblockscom/gallery4` |
| **Offers Carousel** | Lavi Katiyar | Literalmente para ofertas | `lavikatiyar/offers-carousel` |
| **Feature with Image Carousel** | Tommy Jepsen | Imagen + texto lado a lado | `tommyjepsen/feature-with-image-carousel` |
| 3D Gallery Photography | shadway | Fotos con efecto 3D | `shadway/3d-gallery-photography` |
| Serenity Feature Section | Serenity UI | "Your Journey Starts Here" | `ayushmxxn/feature-section` |
| Cases with Infinite Scroll | Tommy Jepsen | Scroll infinito de cases | `tommyjepsen/cases-with-infinite-scroll` |
| Progressive Carousel | UI Layouts | Carousel con transiciones suaves | `ui-layouts/progressive-carousel` |
| Hover Image Gallery | Isaiah | Galería con hover effects | `isaiahbjork/hover-image-gallery` |
| Circular Gallery | Ravi Katiyar | Galería circular | `ravikatiyar/circular-gallery` |
| Full Screen Scroll FX | Scott Clayton | Scroll fullscreen inmersivo | `Scottclayton3d/full-screen-scroll-fx` |
| Interactive Scrolling Story | Le Thanh | Scroll storytelling | `thanh/interactive-scrolling-story-component` |

### CARDS (79+ componentes explorados)

| Componente | Autor | Por qué aplica | URL |
|---|---|---|---|
| **Clip Path Links** ★ | Hover.Dev | Grid hover reveal — destinos | `TomIsLoading/clip-path-links` |
| **Card (destinos)** | Ravi Katiyar | Cards Indonesia/Dubai con "Explore Now" | `ravikatiyar/card-21` |
| Gallery Hover Carousel | Ruixen UI | Galería con hover | `ruixenui/gallery-hover-carousel` |
| Bento Grid | Kokonut UI | Layout bento moderno | `kokonutd/bento-grid` |
| Feature Section Bento | Tommy Jepsen | Bento grid con features | `tommyjepsen/feature-section-with-bento-grid` |
| Floating Card | Awanish Verma | Card que flota | `avanishverma4/floating-card` |
| Display Cards | Prism UI | Cards de display elegantes | `Codehagen/display-cards` |
| Product Card | B3 | Card de producto | `b3/product-card-1` |
| Neon Gradient Card | Magic UI | Card con gradiente neon | `magicui/neon-gradient-card` |
| Card Spotlight | Aceternity UI | Spotlight en hover | `aceternity/card-spotlight` |
| Animated Pricing Cards | Erik X | Pricing animado | `erikx/aniamted-pricing-cards` |
| Lens | Aceternity UI | Efecto lupa en imagen | `aceternity/lens` |

### TESTIMONIALS (40+ componentes explorados)

| Componente | Autor | Por qué aplica | URL |
|---|---|---|---|
| **Animated Testimonials** | Aceternity UI | Foto + texto animado | `aceternity/animated-testimonials` |
| **Testimonials with Marquee** | Serafim | Marquee horizontal infinito | `serafim/testimonials-with-marquee` |
| Testimonial Cards | Vaibhav Kumar Singh | Cards con foto/quote fullscreen | `vaib215/testimonial-cards` |
| Testimonials (grid) | Serenity UI | Grid de testimonios | `ayushmxxn/testimonials` |
| Testimonials | Tommy Jepsen | "Trusted by thousands" | `tommyjepsen/testimonials` |
| Circular Testimonials | Maxim Bortnikov | Testimonios en círculo | `Northstrix/circular-testimonials` |
| 3D Book Testimonial | Serenity UI | Efecto libro 3D | `ayushmxxn/3d-book-testimonial` |
| Testimonial Carousel | rapid-ui | Carousel con transiciones | `rapid-ui/testimonial-carousel` |
| Image Testimonial Grid | Ravi Katiyar | Grid con imágenes grandes | `ravikatiyar/image-testimonial-grid` |
| Glass Testimonial Swiper | Hossain Jahed | Efecto glassmorphism | `easemize/glass-testimonial-swiper` |

### NAVBAR / NAVIGATION (16 componentes explorados)

| Componente | Autor | Por qué aplica | URL |
|---|---|---|---|
| **Floating Navbar** | Aceternity UI | Navbar flotante que aparece al scroll — moderno y limpio | `aceternity/floating-navbar` |
| **Navbar with Dropdowns** | Shadcnblocks | Mega menu con dropdowns, ideal para destinos por región | `shadcnblockscom/navbar1` |
| **Header** | Efferd | Header profesional con logo + nav + CTA | `efferd/header` |
| Navbar | Shadcnblocks | Navbar estándar con links | `shadcnblockscom/navbar1` |
| Navbar 2 | Tailark | Variante limpia | `tailark/navbar-2` |
| Header 4 | Tommy Jepsen | Header con search integrado | `tommyjepsen/header-4` |
| Responsive Navbar | Ali Imam | Se adapta a mobile | `aliimam/responsive-navbar` |
| Sidebar | Shadcnblocks | Sidebar para dashboard agentes | `shadcnblockscom/sidebar` |
| Animated Navbar | Sonu | Navbar con animación | `uniquesonu/animated-navbar` |
| Navigation Menu | Radu Popescu | Menu con hover effects | `radu-activation-popescu/navigation-menu` |

**Recomendación AroundaPlanet**: Floating Navbar (Aceternity) para páginas públicas + Navbar with Dropdowns (Shadcnblocks) si necesitamos mega-menu de destinos por región. Para dashboard de agentes: Sidebar.

### FOOTERS (23 componentes explorados)

| Componente | Autor | Por qué aplica | URL |
|---|---|---|---|
| **Footer 2** | Shadcnblocks | Footer multi-columna profesional con links | `shadcnblockscom/footer-2` |
| **Footer** | Tailark | Footer limpio y responsive | `tailark/footer` |
| **Animated Footer** | Taher Hathi | Footer con animaciones sutiles | `tahermaxse/animated-footer` |
| Social Links Footer | Serafim | Footer enfocado en redes sociales | `serafim/social-links` |
| Large Name Footer | Spectrum UI | Footer con branding grande | `spectrum-ui/large-name-footer` |
| Retro Grid Footer | Magic UI | Footer con grid retro estilizado | `magicui/retro-grid` |
| Footer | rapid-ui | Footer estándar | `rapid-ui/footer` |
| Footer Section | Efferd | Footer con secciones organizadas | `efferd/footer-section` |
| Flickering Footer | Erik X | Footer con efecto parpadeo | `erikx/flickering-footer` |
| Hover Footer | nur/ui | Footer con hover effects | `nurui/hover-footer` |
| NeoMinimal Footer | Muhammad Kumail Ali | Footer minimalista moderno | `m.kumailalirajpoot/neominimal-footer` |
| Footer | Ravi Katiyar | Footer completo | `ravikatiyar/footer` |
| Footer Taped Design | Radu Popescu | Footer con diseño creativo tipo cinta | `radu-activation-popescu/footer-taped` |
| Modem Animated Footer | Deepak Modi | Footer animado estilo moderno | `decodewithdeepak/modem-animated-footer` |

**Recomendación AroundaPlanet**: Footer 2 (Shadcnblocks) como base — multi-columna con: Destinos populares, Servicios (Vuelos/Hotel/Traslados), Empresa (Nosotros/Agentes/Blog), Contacto + redes sociales. O Animated Footer (Taher Hathi) si queremos más impacto visual.

### CALLS TO ACTION (24 componentes explorados)

| Componente | Autor | Por qué aplica | URL |
|---|---|---|---|
| **CTA with Glow** | Mikolaj Dobrucki | CTA con efecto glow — llamativo para "Cotiza tu viaje" | `mikolajdobrucki/cta-with-glow` |
| **Call to Action** | Tommy Jepsen | CTA section completa con headline + botón | `tommyjepsen/call-to-action` |
| **Shimmer Button** | Magic UI | Botón con shimmer effect — perfecto para CTA principal | `magicui/shimmer-button` |
| **CTA 4** | Shadcnblocks | Sección CTA completa | `shadcnblockscom/cta-4` |
| Button Colorful | Kokonut UI | Botón colorido con hover | `kokonutd/button-colorful` |
| Typewriter Effect | Aceternity UI | Texto que se escribe solo | `aceternity/typewriter-effect` |
| Magnetic Button | Shadcn UI Kit | Botón magnético que sigue el cursor | `bundui/magnetic-button` |
| Get Started Button | SHSF UI | Botón animado "Get Started" | `shsfwork/get-started-button` |
| CTA Card | Axorax | Card con CTA integrado | `axorax/cta-card` |
| Aurora Flow | Scott Clayton | Fondo aurora para secciones CTA | `Scottclayton3d/aurora-flow` |
| Call to Action | Tailark | CTA limpio y directo | `tailark/call-to-action` |
| Call to Action | prebuiltui | CTA pre-construido | `prebuiltui/call-to-action` |
| Floating Action Menu | Chetan Verma | Menu flotante de acciones rápidas | `chetanverma16/floating-action-menu` |
| Fey.com Button | Serafim | Botón estilo Fey | `serafim/fey-button` |

**Recomendación AroundaPlanet**: CTA with Glow para "Cotiza tu viaje" (sección homepage/catálogo). Shimmer Button como botón principal en toda la app. Floating Action Menu para WhatsApp/contacto rápido en mobile.

### PRICING SECTIONS (49 componentes explorados)

| Componente | Autor | Por qué aplica | URL |
|---|---|---|---|
| **Creative Pricing** | Kokonut UI | Pricing con diseño creativo — paquetes de viaje | `kokonutd/creative-pricing` |
| **Pricing with Comparison** | Tommy Jepsen | Tabla comparativa de planes — ideal para comparar paquetes | `tommyjepsen/pricing-with-comparison` |
| **Animated Glassy Pricing** | Varios | Pricing con glassmorphism animado | `animated-glassy-pricing` |
| **Pricing Section 4** | Tailark | Pricing limpio con toggle anual/mensual | `tailark/pricing-section-4` |
| Pricing | Shadcnblocks | Pricing estándar | `shadcnblockscom/pricing` |
| Animated Pricing Cards | Erik X | Cards de pricing animadas | `erikx/animated-pricing-cards` |
| Neon Gradient Card | Magic UI | Card con gradiente neon para destacar paquete premium | `magicui/neon-gradient-card` |
| Pricing Section | Serenity UI | Sección de pricing elegante | `ayushmxxn/pricing-section` |
| Pricing | Tommy Jepsen | Pricing multi-tier | `tommyjepsen/pricing` |
| Pricing Cards | rapid-ui | Cards de precios responsive | `rapid-ui/pricing-cards` |
| Pricing Table | Efferd | Tabla de precios detallada | `efferd/pricing-table` |

**Recomendación AroundaPlanet**: Creative Pricing (Kokonut) para la página de paquetes — cada tier = un paquete de viaje con precio, incluye, no incluye. Pricing with Comparison (Tommy Jepsen) para la tabla "¿Qué incluye cada paquete?" en detalle de viaje.

### FEATURES / SERVICES (96+ componentes explorados)

| Componente | Autor | Por qué aplica | URL |
|---|---|---|---|
| **Bento Grid** | Kokonut UI | Layout bento para mostrar servicios (Vuelos/Hotel/Traslados) | `kokonutd/bento-grid` |
| **Feature with Advantages** | Tommy Jepsen | Lista de ventajas con iconos — "¿Por qué AroundaPlanet?" | `tommyjepsen/feature-with-advantages` |
| **Direction Aware Hover** | Aceternity UI | Cards que reaccionan a dirección del cursor | `aceternity/direction-aware-hover` |
| Feature Section Bento | Tommy Jepsen | Bento grid para features | `tommyjepsen/feature-section-with-bento-grid` |
| Feature with Image Carousel | Tommy Jepsen | Feature + carousel de fotos | `tommyjepsen/feature-with-image-carousel` |
| Animated Feature Cards | Varios | Cards de features animadas | Varios |
| Timeline | Varios | Timeline para "Cómo funciona" / proceso de compra | Varios |
| Tabs Section | Varios | Tabs para separar servicios | Varios |
| Accordion Features | Varios | FAQ / detalles expandibles | Varios |
| Stats Section | Varios | Números: "+5000 viajeros", "70+ agentes", "36 destinos" | Varios |

**Recomendación AroundaPlanet**: Bento Grid para sección "Nuestros Servicios" en homepage. Feature with Advantages para "¿Por qué elegirnos?" Direction Aware Hover para grid de servicios interactivo. Timeline para "Tu viaje en 4 pasos" (Cotiza → Agenda → Viaja → Comparte).

### FORMS (38 componentes explorados)

| Componente | Autor | Por qué aplica | URL |
|---|---|---|---|
| **Contact 2** | Shadcnblocks | Formulario de contacto completo con mapa | `shadcnblockscom/contact-2` |
| **Multistep Form** | Varios | Formulario multi-paso — perfecto para cotización | Varios |
| **Ride Booking Form** | Ravi Katiyar | Formulario de reserva tipo Uber — adaptar para viajes | `ravikatiyar/ride-booking-form` |
| Contact | Shadcnblocks | Formulario contacto estándar | `shadcnblockscom/contact` |
| Newsletter | Tommy Jepsen | Suscripción a newsletter | `tommyjepsen/newsletter` |
| Form with Validation | Varios | Formulario con validación | Varios |
| Animated Input | Aceternity UI | Inputs con animación | `aceternity/animated-input` |
| File Upload | Varios | Subir documentos (pasaportes, etc.) | Varios |

**Recomendación AroundaPlanet**: Multistep Form para cotización de viaje (Paso 1: Destino → Paso 2: Fechas/personas → Paso 3: Presupuesto → Paso 4: Datos contacto). Contact 2 para página de contacto. Ride Booking Form como inspiración para booking rápido.

### SIGN IN (4 componentes explorados)

| Componente | Autor | Por qué aplica | URL |
|---|---|---|---|
| Sign In | Shadcnblocks | Login estándar | `shadcnblockscom/sign-in` |
| Sign In | Tailark | Login minimalista | `tailark/sign-in` |
| Auth Form | Varios | Formulario auth con social login | Varios |
| OTP Input | Varios | Verificación por código | Varios |

**Recomendación AroundaPlanet**: Login para agentes con Firebase Auth. Posiblemente social login (Google) para clientes.

### MAPS (2 componentes disponibles)

| Componente | Autor | Por qué aplica | URL |
|---|---|---|---|
| Map | Varios | Mapa interactivo | `/s/map` |
| Map with Markers | Varios | Mapa con marcadores | `/s/map` |

**Recomendación AroundaPlanet**: Usar Mapbox GL o Google Maps directamente (más flexible que componentes pre-hechos). Pins en: sucursales (GDL, Zapopan, Puerto Vallarta) + destinos populares.

---

## Análisis de Cobertura — Web Audit vs Inspiración

### Secciones del Web Audit que YA tienen componentes

| Sección/Página | Estado | Componentes Seleccionados |
|---|---|---|
| Homepage Hero | ✅ CUBIERTO | Scroll Morph Hero ★ + Hero Section Mapa ★ |
| Homepage Destinos Grid | ✅ CUBIERTO | Clip Path Links ★ + 3D Carousel |
| Homepage Testimoniales | ✅ CUBIERTO | Animated Testimonials + Testimonials Marquee |
| Homepage CTA | ✅ CUBIERTO | CTA with Glow + Shimmer Button |
| Navbar | ✅ CUBIERTO | Floating Navbar (Aceternity) + Navbar Dropdowns |
| Footer | ✅ CUBIERTO | Footer 2 (Shadcnblocks) + Animated Footer |
| Pricing/Paquetes | ✅ CUBIERTO | Creative Pricing + Pricing with Comparison |
| Features/Servicios | ✅ CUBIERTO | Bento Grid + Feature with Advantages |
| Formulario Cotización | ✅ CUBIERTO | Multistep Form + Ride Booking Form |
| Contacto | ✅ CUBIERTO | Contact 2 (Shadcnblocks) + Map |
| Login Agentes | ✅ CUBIERTO | Sign In (Shadcnblocks/Tailark) + Firebase Auth |

### Secciones que FALTAN por explorar/definir

| Sección/Página | Estado | Qué necesitamos |
|---|---|---|
| Detalle de Viaje | ⚠️ PARCIAL | Galería fotos (Lens ✅), itinerario día-por-día, incluye/no incluye, booking inline |
| Sobre Nosotros | ⚠️ PARCIAL | Hero Mapa ✅, falta timeline historia empresa, equipo directivo, misión/visión |
| Catálogo/Búsqueda | ⚠️ PARCIAL | Cards ✅, falta filtros (destino/precio/fecha), search, sorting |
| Directorio Agentes | 🔴 FALTA | Cards con foto de agente + zona + especialidad + botón contacto |
| Blog/Contenido | 🔴 FALTA | Layout de blog, cards de artículos, categorías |
| WhatsApp Flotante | 🔴 FALTA | Floating Action Menu como base, integrar botón WA |
| Página 404 | 🔴 FALTA | Página de error temática (avión perdido, brújula rota) |

---

## Mapeo Final: Componentes → Páginas Públicas AroundaPlanet

| Página | Componentes Seleccionados |
|---|---|
| **Navbar (global)** | Floating Navbar (Aceternity) + Dropdowns por región |
| **Footer (global)** | Footer 2 (Shadcnblocks) multi-columna + redes sociales |
| **WhatsApp (global)** | Floating Action Menu (Chetan Verma) adaptado a WA |
| **Homepage** | Scroll Morph Hero ★ (destinos con links) → Clip Path Links ★ (grid destinos) → Bento Grid (servicios) → Testimonials Marquee → CTA with Glow |
| **Catálogo/Destinos** | 3D Carousel + Gallery image cards + Filtros + Creative Pricing |
| **Detalle Viaje** | Lens (zoom fotos) + Feature Carousel (itinerario) + Pricing Comparison + Multistep Form (cotizar) |
| **Sobre Nosotros** | Hero Section Mapa ★ + Animated Testimonials (equipo) + Timeline + Stats Section |
| **Servicios** | Feature with Advantages + Direction Aware Hover + Bento Grid |
| **Directorio Agentes** | Card grid con fotos + filtro zona/especialidad + botón contacto directo |
| **Contacto** | Contact 2 (mapa + form) + CTA + Info sucursales |
| **Blog** | Cards de artículos + categorías + search |
| **Login Agentes** | Sign In + Firebase Auth + Dashboard Sidebar |

---

## Stack Técnico Recomendado

Todos los componentes de 21st.dev usan:
- **React 18+** / **Next.js 14+**
- **Tailwind CSS** para estilos
- **shadcn/ui** como base de componentes
- **Framer Motion** para animaciones (la mayoría)
- Instalación via `npx shadcn@latest add [url]`

### Dependencias comunes:
- `framer-motion` — Scroll Morph Hero, 3D Carousel, Animated Testimonials, Floating Navbar
- `@radix-ui/*` — Base de shadcn/ui
- `lucide-react` — Iconos
- `tailwind-merge` / `clsx` — Utilidades de className
- `embla-carousel-react` — Algunos carousels

---

## Principios UX del Otro Agente (para alinear)

> Del Product Brief en `D:\dev\Proyectos de terceros\aroundaplanet`:
> 1. **Trust first** — Diseño limpio, testimonios reales, social proof
> 2. **3 toques o menos** — Navegación simple, CTAs prominentes
> 3. **Datos reales desde segundo 1** — Precios, fechas, disponibilidad
> 4. **Emoción sobre información** — Fotos impactantes > texto largo
> 5. **Funciona sin ti** — Self-service, agente asignado automático

---

## Estadísticas de Exploración

| Categoría | Componentes en 21st.dev | Explorados | Seleccionados |
|---|---|---|---|
| Heroes | 73 | 10 | 2 ★ |
| Carousels | 55+ | 13 | 5 |
| Cards | 79+ | 12 | 2 (1 ★) |
| Testimonials | 40+ | 10 | 2 |
| Navbar/Nav | 16 | 10 | 3 |
| Footers | 23 | 14 | 3 |
| CTAs | 24 | 14 | 4 |
| Pricing | 49 | 11 | 4 |
| Features | 96+ | 10 | 3 |
| Forms | 38 | 8 | 3 |
| Sign In | 4 | 4 | 2 |
| Maps | 2 | 2 | 1 |
| **TOTAL** | **499+** | **118** | **34** |

★ = Confirmado por Alek como favorito
