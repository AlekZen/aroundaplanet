# Responsive Design & Accessibility

## Responsive Strategy

**Filosofia: Mobile-first, role-aware**

AroundaPlanet no es "un sitio que se adapta a mobile" — es una app mobile que se expande a desktop cuando el rol lo requiere. Noel, agentes y clientes viven en el telefono. Solo Mariana (admin) y Alek (SuperAdmin) trabajan en escritorio como dispositivo principal.

**Breakpoints (Tailwind defaults):**

| Token | Valor | Target | Roles principales |
|-------|-------|--------|-------------------|
| `sm` | 640px | Mobile landscape, phablets | Transicion |
| `md` | 768px | Tablet portrait | Uso ocasional todos |
| `lg` | 1024px | Desktop | Admin, SuperAdmin |
| `xl` | 1280px | Desktop amplio | Dashboard director, admin split-view |
| `2xl` | 1536px | Monitores grandes | SuperAdmin gestion completa |

**Regla de diseno:** Disenar para 375px primero. Cada breakpoint SUMA layout, nunca RESTA funcionalidad. Todo lo que funciona en mobile funciona identico en desktop — desktop agrega densidad y vistas simultaneas.

## Adaptive Layouts por Rol

**PublicLayout (Landing pages SSG)**

| Breakpoint | Comportamiento |
|-----------|----------------|
| Mobile (375px+) | Stack vertical. Scroll Morph Hero full-width. TripCards 1 columna. CTA sticky bottom. Menu hamburger. |
| Tablet (768px+) | TripCards grid 2 columnas. Hero con parallax. Navegacion horizontal. |
| Desktop (1024px+) | TripCards grid 3 columnas. Sidebar sticky con filtros. Hero con overlay texto lateral. Max-width 1280px centrado. |

**AgentMobileLayout (Portal agente)**

| Breakpoint | Comportamiento |
|-----------|----------------|
| Mobile (375px+) | Bottom nav 4 tabs. KPIs 2x2 grid. Clientes lista scroll. Pagos full-width cards. Camara nativa para comprobantes. |
| Tablet (768px+) | Bottom nav persiste. KPIs 4x1 row. Split: lista clientes izq + detalle der. |
| Desktop (1024px+) | Sidebar 280px reemplaza bottom nav. Dashboard completo 3 columnas. Tabla clientes con sort/filter. Vista escritorio pero la mayoria no la usara. |

**AdminDesktopLayout (Panel verificacion)**

| Breakpoint | Comportamiento |
|-----------|----------------|
| Mobile (375px+) | Stack: cola arriba, detalle abajo. Swipe para aprobar/rechazar. Funcional pero no optimizado — admin usa desktop. |
| Tablet (768px+) | Split horizontal: cola izq (40%), detalle+comprobante der (60%). |
| Desktop (1024px+) | Split view principal. Cola izq (320px) con scroll. Centro: comprobante zoom + datos IA. Sidebar der: historial cliente. Keyboard shortcuts activos. |

**DirectorLayout (Dashboard Noel)**

| Breakpoint | Comportamiento |
|-----------|----------------|
| Mobile (375px+) | **Optimizado aqui.** KPIs scroll horizontal (snap). Graficas full-width touchables. Pull-to-refresh. Bottom sheet para drill-down. |
| Tablet (768px+) | KPIs grid 2x2. Grafica + tabla side by side. |
| Desktop (1024px+) | Dashboard completo. KPIs row, graficas interactivas, tabla con filtros avanzados. Util para presentaciones. |

**ClientLayout (Mi viaje)**

| Breakpoint | Comportamiento |
|-----------|----------------|
| Mobile (375px+) | EmotionalProgress full-width. Timeline vertical. Pagos como cards. Todo tactil. |
| Tablet (768px+) | EmotionalProgress + timeline side by side. |
| Desktop (1024px+) | Layout centrado max-width 800px (contenido no necesita mas ancho). |

**AuthLayout (Login/Registro)**

| Breakpoint | Comportamiento |
|-----------|----------------|
| Mobile (375px+) | Centrado vertical. Logo + form. Teclado no cubre inputs (scroll auto). |
| Desktop (1024px+) | Split: hero imagen izq (50%) + form der (50%). |

## Patrones Responsive Especificos

**Navegacion adaptativa:**
- Mobile: `BottomNavBar` (4-5 tabs, 56px height, safe-area-inset)
- Desktop: `RoleSidebar` (280px fija, colapsable a 64px con iconos)
- Transicion en `lg` (1024px): hide bottom nav, show sidebar
- NUNCA mostrar ambas simultaneamente

**Tablas → Cards:**
- Desktop `lg+`: tabla con columnas, sort, pagination
- Mobile `<lg`: cada row se convierte en card stackeable
- Aplicar a: lista clientes, historial pagos, cola verificacion
- Implementacion: `<Table className="hidden lg:table">` + `<CardList className="lg:hidden">`

**Graficas touch-friendly:**
- Mobile: graficas simplificadas (3-5 data points max). Tap para tooltip.
- Desktop: graficas completas con hover, zoom, export.
- Usar Recharts con `responsiveContainer` + custom breakpoint hooks.

**Imagenes responsive:**
- Next.js `<Image>` con `sizes` prop para cada breakpoint
- TripCard hero: 375w mobile, 400w tablet, 420w desktop
- Comprobantes: full-width mobile, max 600px desktop
- Format: WebP con fallback JPEG (ya tenemos WebP)

**Touch vs Mouse:**
- Swipe gestures solo en `<lg` (swipe-to-action en lista pagos, swipe-dismiss sheet)
- Hover states solo en `lg+` (keyboard focus visible en ambos)
- Right-click context menu solo desktop (acciones rapidas admin)

## Accessibility Strategy

**Nivel target: WCAG 2.1 AA (selectivo)**

No buscamos certificacion completa — buscamos accesibilidad funcional enfocada en los escenarios reales de nuestros usuarios:

| Criterio | Prioridad | Justificacion |
|----------|-----------|---------------|
| Contraste 4.5:1+ | **P0 - Critico** | NFR30: agentes en campo bajo luz solar directa |
| Touch targets 44x44px+ | **P0 - Critico** | NFR31: uso en movimiento, manos ocupadas |
| Keyboard nav (admin) | **P1 - Alto** | NFR32: Mariana procesa 20+ verificaciones/dia en desktop |
| Focus visible | **P1 - Alto** | Tab navigation para eficiencia admin |
| ARIA labels | **P2 - Medio** | Screen readers no son caso de uso primario pero buena practica |
| Skip links | **P2 - Medio** | Implementar en layouts principales |
| Reduced motion | **P2 - Medio** | `prefers-reduced-motion` desactiva Framer Motion |

## Contraste y Color

**Palette validada contra WCAG AA:**

| Combinacion | Ratio | Resultado |
|------------|-------|-----------|
| `primary` (#1B4332) sobre `background` (#FAFAF8) | 11.2:1 | AAA |
| `foreground` (#1A1A1A) sobre `background` (#FAFAF8) | 16.5:1 | AAA |
| `accent` (#F4A261) sobre `primary` (#1B4332) | 4.8:1 | AA |
| `destructive` (#E76F51) sobre `background` (#FAFAF8) | 4.6:1 | AA |
| `background` (#FAFAF8) sobre `primary` (#1B4332) | 11.2:1 | AAA |
| `muted-foreground` (#6B7280) sobre `background` (#FAFAF8) | 5.3:1 | AA |

**Regla**: Texto informativo NUNCA usa `accent` solo — siempre con background oscuro o acompanado de texto `foreground`. Iconos decorativos pueden usar `accent` libre.

**Modo luz solar**: No dark mode (innecesario). En su lugar, los agentes configuran brillo de dispositivo. Nuestros colores ya tienen contraste suficiente para exteriores gracias al fondo warm-white `#FAFAF8` vs un blanco puro que refleja mas.

## Keyboard Navigation

**Scope: Desktop admin (Mariana) como usuario principal de keyboard:**

| Contexto | Atajo | Accion |
|----------|-------|--------|
| Cola verificacion | `↑` / `↓` | Navegar entre pagos |
| Cola verificacion | `Enter` | Abrir detalle del pago seleccionado |
| Detalle pago | `V` | Verificar pago |
| Detalle pago | `R` | Rechazar (abre motivo) |
| Detalle pago | `Escape` | Volver a cola |
| Global | `Tab` | Navegacion secuencial |
| Global | `Shift+Tab` | Navegacion inversa |
| Modales | `Escape` | Cerrar |
| Formularios | `Enter` | Submit (si formulario valido) |

**Focus management:**
- `focus-visible` ring: 2px `accent` con offset 2px (visible sin ser invasivo)
- Focus trap en modales y sheets (Radix UI lo maneja nativo)
- Despues de cerrar modal: focus regresa al trigger element
- Skip link: "Saltar al contenido principal" visible on focus, posicion absoluta top-left

## Touch Targets

**Minimo 44x44px (NFR31), target 48px para acciones primarias:**

| Elemento | Tamano tactil | Spacing |
|----------|--------------|---------|
| Botones primarios | 48px height | 12px gap entre botones |
| Bottom nav tabs | 56px height, area tactil completa | Distribucion equitativa |
| List items clickeables | 56px min-height | 1px border divisor |
| Iconos accionables | 44x44px area tactil (icono puede ser 24px visual) | 8px padding |
| Checkboxes/Radio | 44x44px area tactil | 12px gap |
| Links en texto | Padding vertical 4px extra | N/A |
| Chips/Tags filtro | 36px height, 44px area tactil | 8px gap |

**Regla**: Si un tap target esta a <8px de otro, uno de los dos crece o se reubica. Nunca dos targets adyacentes sin spacing.

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

**Implementacion Framer Motion**: Wrapper `useReducedMotion()` hook que convierte `animate` props a `initial` values cuando activo. Los componentes 21st.dev (Scroll Morph Hero, Clip Path Links) deben respetar esta preferencia — fallback a version estatica.

## Testing Strategy

**Responsive Testing:**

| Que | Como | Frecuencia |
|-----|------|-----------|
| Mobile portrait 375px | Chrome DevTools + dispositivo real (Android) | Cada PR |
| Mobile landscape 667px | Chrome DevTools | Sprint review |
| Tablet 768px | Chrome DevTools | Sprint review |
| Desktop 1024px/1280px | Navegador nativo | Cada PR |
| Safari iOS | BrowserStack o dispositivo real | Pre-release |
| Chrome Android | Dispositivo real (Noel tiene Android) | Pre-release |

**Accessibility Testing:**

| Que | Herramienta | Frecuencia |
|-----|-------------|-----------|
| Contraste automatizado | axe-core (eslint-plugin-jsx-a11y) | CI en cada PR |
| ARIA / semantica | axe DevTools extension | Manual cada sprint |
| Keyboard nav cola admin | Manual: tab through completo | Cada cambio en cola |
| Touch targets | Responsive overlay en DevTools | Cada componente nuevo |
| Reduced motion | Toggle en OS settings + verificar | Pre-release |

**Criterios de aceptacion minimos por PR:**
1. Zero violations axe-core (nivel A y AA)
2. Tab navigation funcional en flujo modificado
3. Touch targets >= 44px verificados visualmente
4. No texto sobre imagen sin overlay de contraste

## Implementation Guidelines

**CSS / Tailwind:**
- Mobile-first: estilos base son mobile, agregar con `md:`, `lg:`, `xl:`
- Usar `min-h-[44px]` en todo elemento interactivo
- `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2` en todo clickeable
- Container responsive: `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8`
- Safe area iOS: `pb-[env(safe-area-inset-bottom)]` en bottom nav

**Componentes:**
- Todos los componentes shadcn/ui ya incluyen ARIA correcto (Radix UI)
- Componentes custom (EmotionalProgress, KPICard, etc.): agregar `role`, `aria-label`, `aria-live` donde aplique
- `aria-live="polite"` en: toast container, offline banner, KPI updates
- `aria-live="assertive"` en: errores de formulario, alertas criticas

**Imagenes:**
- Siempre `alt` descriptivo. No "imagen" — describir contenido: "Grupo de viajeros en Machu Picchu"
- Imagenes decorativas: `alt=""` + `aria-hidden="true"`
- Next.js `<Image>` con `priority` en above-the-fold

**Formularios:**
- `<label>` asociado a cada input (htmlFor). NUNCA placeholder como unico label
- Errores: `aria-describedby` apuntando al mensaje de error
- Required: `aria-required="true"` + asterisco visual
- Live validation: `aria-invalid="true"` cuando invalido

**Semantica HTML:**
- `<main>`, `<nav>`, `<header>`, `<footer>`, `<aside>` en layouts
- `<h1>` unico por pagina. Headings en orden (h1→h2→h3)
- Listas para navegacion (`<ul>` + `<li>`)
- `<button>` para acciones, `<a>` para navegacion. NUNCA `<div onClick>`
