# Visual Design Foundation

*Informed by component audit of 499+ components in 21st.dev, web audit of aroundaplanet.odoo.com, and 34 selected components (3 confirmed favorites by Alek).*

## Color System

**Contexto de migracion visual:**
El sitio actual (aroundaplanet.odoo.com) usa paleta turquesa default de Odoo (~#008B8B) con template estandar sin personalizacion. La nueva plataforma establece identidad visual propia con paleta calida que refleja aventura, confianza y naturaleza — alineada con el slogan "Camina con Nosotros".

**Paleta primaria de marca:**

| Token | Hex | Nombre | Rol emocional | Uso principal |
|-------|-----|--------|--------------|--------------|
| `primary` | `#1B4332` | Verde Bosque | Confianza, naturaleza, seguridad | Sidebar, headers, navbar, estados activos |
| `accent` | `#F4A261` | Naranja Calido | Energia, accion, optimismo | CTAs, FAB "Reportar Pago", Shimmer Button, links activos |
| `destructive` | `#E76F51` | Coral | Urgencia, atencion, alerta | Pagos rechazados, errores, badges urgencia >48h |
| `background` | `#FAFAF8` | Crema | Calidez, hogar, NO corporativo frio | Fondo general de toda la app |

**Expansion semantica completa:**

| Token | Hex | Uso |
|-------|-----|-----|
| `primary-foreground` | `#FAFAF8` | Texto sobre sidebar/headers/Floating Navbar |
| `primary-light` | `#2D6A4F` | Hover states sobre primary |
| `primary-muted` | `#D8F3DC` | Badges verdes suaves, fondos success, estado "Verificado" |
| `accent-foreground` | `#1B4332` | Texto sobre CTAs naranja |
| `accent-light` | `#F6B97A` | Hover sobre CTAs, shimmer effect base |
| `accent-muted` | `#FDEBD0` | Fondos warm, highlights suaves, clip-path reveal bg |
| `destructive-foreground` | `#FFFFFF` | Texto sobre badges error |
| `destructive-muted` | `#FADBD8` | Fondos error suaves |
| `card` | `#FFFFFF` | Cards sobre fondo crema (elevation sutil) |
| `muted` | `#F1F0EB` | Fondos secundarios, skeleton loading |
| `muted-foreground` | `#71706B` | Texto secundario, labels, timestamps |
| `border` | `#E5E4DF` | Bordes de cards, separadores |
| `ring` | `#1B4332` | Focus ring accesibilidad teclado |

**Colores de estado:**

| Estado | Background | Texto | Uso |
|--------|-----------|-------|-----|
| Success / Verificado | `#D8F3DC` | `#1B4332` | Pago verificado, semaforo verde |
| Warning / Pendiente | `#FFF3CD` | `#856404` | Pago pendiente, semaforo amarillo |
| Error / Rechazado | `#FADBD8` | `#E76F51` | Pago rechazado, semaforo rojo |
| Info / Neutral | `#D6EAF8` | `#2C3E50` | Informacion general, tips |

**Colores para componentes 21st.dev:**

| Componente | Token especifico | Valor | Nota |
|-----------|-----------------|-------|------|
| Scroll Morph Hero | `hero-overlay` | `rgba(27,67,50,0.6)` | Overlay verde semi-transparente sobre imagenes destinos |
| Clip Path Links | `reveal-bg` | `#FDEBD0` → foto destino | Fondo calido antes del reveal |
| Floating Navbar | `navbar-bg` | `rgba(27,67,50,0.95)` | Navbar semi-transparente con backdrop-blur |
| CTA Glow | `glow-color` | `#F4A261` | Glow naranja calido en boton "Cotiza tu viaje" |
| Shimmer Button | `shimmer-base` | `#F4A261` → `#F6B97A` | Gradiente shimmer en CTA principal |
| Testimonials Marquee | `testimonial-bg` | `#FAFAF8` | Fondo crema, cards blancas |
| Creative Pricing | `pricing-highlight` | `#1B4332` | Paquete destacado (Vuelta al Mundo) en verde |

**Contraste accesibilidad verificado:**

| Combinacion | Ratio | WCAG AA |
|------------|-------|---------|
| `#1B4332` sobre `#FAFAF8` | 10.2:1 | Si |
| `#1B4332` sobre `#FFFFFF` | 11.1:1 | Si |
| `#F4A261` sobre `#1B4332` | 4.8:1 | Si |
| `#71706B` sobre `#FAFAF8` | 4.6:1 | Si |
| `#E76F51` sobre `#FFFFFF` | 3.6:1 | Solo elementos grandes (>=18px bold) |
| `#856404` sobre `#FFF3CD` | 5.1:1 | Si |

## Typography System

**Font stack:**

| Nivel | Fuente | Pesos | Rol | Carga |
|-------|--------|-------|-----|-------|
| Heading | **Poppins** | 600, 700 | Titulos, KPIs, hero headlines, precios destacados | Google Fonts, `display: swap` |
| Body | **Inter** | 400, 500, 600 | Texto general, formularios, labels, nav, descripciones viajes | Google Fonts, `display: swap` |
| Mono | **Roboto Mono** | 500 | Montos ($145,000), referencias bancarias, fechas, codigos | Google Fonts, `display: swap` |

**Type scale (mobile-first, base 16px):**

| Token | Mobile | Desktop | Line Height | Fuente | Uso |
|-------|--------|---------|------------|--------|-----|
| `display` | 36px | 48px | 1.2 | Poppins Bold | KPI principal ("$27.4M"), hero headline ("Camina con Nosotros") |
| `h1` | 28px | 32px | 1.3 | Poppins SemiBold | Titulo pagina ("Mi Negocio"), nombre destino en landing |
| `h2` | 22px | 24px | 1.35 | Poppins SemiBold | Titulo seccion ("Mis Clientes"), seccion homepage |
| `h3` | 18px | 20px | 1.4 | Poppins SemiBold | Subtitulo, nombre card viaje, pricing tier |
| `body` | 16px | 16px | 1.5 | Inter Regular | Texto general, descripciones viajes, itinerarios |
| `body-medium` | 16px | 16px | 1.5 | Inter Medium | Labels formulario, items nav, botones |
| `small` | 14px | 14px | 1.45 | Inter Regular | Texto secundario, timestamps, "Quedan 7 lugares" |
| `caption` | 12px | 12px | 1.4 | Inter Regular | Badges, metadata, hints, "Actualizado hace 12 min" |
| `mono` | 16px | 16px | 1.4 | Roboto Mono Medium | Montos en cards ($14,490), referencias |
| `mono-large` | 28px | 36px | 1.2 | Roboto Mono Medium | Precio principal en landing/pricing ($145,000) |

## Spacing & Layout Foundation

**Sistema de espaciado (base 4px, Tailwind utilities):**

| Token | Valor | Tailwind | Uso tipico |
|-------|-------|---------|-----------|
| `space-1` | 4px | `p-1` | Gap icon-label, padding badge |
| `space-2` | 8px | `p-2` | Gap entre badges, padding compacto |
| `space-3` | 12px | `p-3` | Padding inputs, gap items lista |
| `space-4` | 16px | `p-4` | Padding cards, margin elementos relacionados |
| `space-5` | 20px | `p-5` | Margin secciones pequenas |
| `space-6` | 24px | `p-6` | Padding horizontal pantalla mobile |
| `space-8` | 32px | `p-8` | Margin entre secciones |
| `space-10` | 40px | `p-10` | Margin bloques mayores |
| `space-12` | 48px | `p-12` | Separacion secciones pagina |
| `space-16` | 64px | `p-16` | Padding vertical hero/secciones landing |

**Border radius:**

| Token | Valor | Uso |
|-------|-------|-----|
| `radius-sm` | 0.375rem (6px) | Badges, inputs |
| `radius` | 0.75rem (12px) | Cards, botones, modales |
| `radius-lg` | 1rem (16px) | Cards hero, pricing cards |
| `radius-full` | 9999px | Avatares, FAB, pills |

**Shadows (elevation sutil sobre fondo crema):**

| Token | Valor | Uso |
|-------|-------|-----|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Cards en reposo |
| `shadow` | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` | Cards hover, dropdowns |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modales, Floating Navbar, popovers |

**Grid system:**

| Contexto | Columnas | Gap | Notas |
|----------|---------|-----|-------|
| Mobile (375px+) | 1 col | 16px | Stack vertical, full-width cards |
| Tablet (768px+) | 2 cols | 16px | Grid cards viajes, KPIs en pares |
| Desktop (1024px+) | 12 cols (CSS Grid) | 24px | Sidebar 3 + contenido 9. Split 6+6 verificacion |

**Layouts master:**

| Layout | Estructura | Paginas | Componentes 21st.dev |
|--------|-----------|---------|---------------------|
| **PublicLayout** | Floating Navbar + Hero + Content + Footer multi-columna | Home, catalogo, landing viajes, sobre nosotros | Floating Navbar, Footer 2, Scroll Morph Hero, Clip Path Links |
| **MobileLayout** | Content scrolleable + BottomNav (4-5 tabs) + FAB opcional | Dashboard agente, director, cliente (mobile) | shadcn/ui components |
| **DesktopLayout** | Sidebar fijo 280px + Content area + Panel detalle opcional | Admin verificacion, SuperAdmin, dashboard director desktop | shadcn/ui Sidebar |
| **AuthLayout** | Centrado vertical, card login, gradiente verde→crema | Login, registro | Sign In (Shadcnblocks) |

## Animation & Motion System

**Framer Motion como libreria de animaciones** (requerido por componentes 21st.dev seleccionados):

| Tipo animacion | Duracion | Easing | Uso |
|---------------|---------|--------|-----|
| Micro-feedback | 150-200ms | `ease-out` | Hover buttons, badge transitions, toast appear |
| Transicion pagina | 250-350ms | `ease-in-out` | Navegacion SPA entre secciones |
| Reveal content | 400-600ms | `spring(1, 0.8, 0.2)` | Clip Path Links reveal, cards appear on scroll |
| Hero animation | 800-1200ms | Custom spring | Scroll Morph Hero morph, carousel transitions |
| Celebracion | 600-1000ms | `spring` | Check animado post-pago, hitos progreso 25/50/75/100% |

**Principios de motion:**
- **Funcional primero**: Animaciones comunican estado (loading, success, error), no decoran
- **Reduced motion**: `prefers-reduced-motion: reduce` desactiva todo excepto feedback esencial
- **Mobile conservative**: Animaciones hero/scroll solo en desktop. Mobile prioriza velocidad percibida
- **No bloquear**: Ninguna animacion impide interaccion. El usuario puede actuar durante transiciones

## Accessibility Considerations

| Requisito | Implementacion | NFR |
|-----------|---------------|-----|
| **Contraste texto** | 4.5:1 minimo. Coral solo en elementos >=18px bold | NFR30 |
| **Touch targets** | 44x44px minimo. Botones 48px height mobile | NFR31 |
| **Navegacion teclado** | Tab navigation + focus ring visible + atajos admin [V/R/→] | NFR32 |
| **Color no unico** | Estados usan color + icono + texto siempre | - |
| **Reduced motion** | Respeta `prefers-reduced-motion`. Celebraciones → texto estatico | - |
| **Font minimo** | 14px small, 12px solo captions. 16px base | - |
| **Focus visible** | `ring-2 ring-offset-2 ring-primary` en todos los interactivos | - |
| **Legibilidad solar** | Contraste 10.2:1 primary/crema funciona bajo luz directa (agentes en campo) | NFR30 |
| **Alt text imagenes** | Todas las fotos de destinos y comprobantes con alt descriptivo | - |
| **Aria labels** | Radix UI primitives de shadcn/ui los incluyen por defecto | - |
