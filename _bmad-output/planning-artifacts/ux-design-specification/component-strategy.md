# Component Strategy

## Design System Components (shadcn/ui)

19 componentes base cubren el 60% de las necesidades de UI:

| Componente | Uso en AroundaPlanet | Journey(s) |
|-----------|---------------------|-----------|
| `Button` | CTAs, verificar/rechazar, acciones | Todos |
| `Card` | KPIs, viajes catalogo, metricas agente | J2, J4, J5 |
| `Dialog` | Modales confirmacion, motivo rechazo | J3 |
| `Sheet` | Drawers mobile, detalle pago | J2, J5 |
| `Form` + `Input` | Reporte pago fallback, perfil, fiscales | J2, J6 |
| `Progress` | Base para EmotionalProgress | J5 |
| `Badge` | Status pagos, roles, urgencia | Todos |
| `Avatar` | Fotos perfil, agentes en cards | J3, J6 |
| `Table` | Cola verificacion, drill-down director | J3, J4 |
| `Tabs` | Secciones portales, periodos KPI | J4 |
| `Toast` | Confirmaciones, errores, feedback | Todos |
| `Skeleton` | Loading states | Todos |
| `Sidebar` | Navegacion desktop | J3 |
| `Select` / `Combobox` | Filtros, selector cliente, motivos | J1, J2, J3 |
| `Separator` | Division secciones sidebar | J3, J4 |
| `Alert` | Base para OfflineBanner | J4 |
| `Tooltip` | Ayuda contextual desktop | J3 |
| `Dropdown Menu` | Acciones cards, opciones perfil | Varios |
| `Popover` | Info adicional KPIs | J4 |

## Custom Components

9 componentes custom disenados para necesidades especificas de AroundaPlanet:

### EmotionalProgress
**Proposito**: Progreso de pagos como viaje emocional (hero portal cliente).
**Anatomia**: Container gradiente primary, titulo viaje, barra progreso accent, porcentaje grande (Roboto Mono 36px), mensaje emocional personalizado.
**States**: default, milestone-25/50/75/100 (con celebraciones), loading (skeleton).
**Props**: `percentage`, `tripName`, `destinationHighlight`, `userName`.
**Accesibilidad**: `role="progressbar"`, `aria-valuenow/min/max`.

### KPICard
**Proposito**: Metrica de negocio con numero grande + tendencia.
**Anatomia**: Card con label, valor (Roboto Mono 24px), tendencia (flecha + %), subtexto.
**States**: default, loading, error, offline (con timestamp cache).
**Variants**: `compact` (grid mobile), `expanded` (desktop con mini-grafica).
**Accesibilidad**: `aria-label` descriptivo completo.

### PaymentStepper
**Proposito**: Timeline visual del ciclo de vida de un pago.
**Anatomia**: Linea vertical + dots (32px) por paso + info + monto.
**States por step**: completed (verde check), current (naranja pulsante), rejected (coral X + motivo), upcoming (gris).
**Accesibilidad**: `role="list"`, `aria-current="step"`.

### VerificationPanel
**Proposito**: Split-screen verificacion pagos (desktop admin).
**Anatomia**: Grid 50/50 — imagen comprobante (zoom/rotar) izq + datos IA/Odoo der + barra acciones fija.
**States**: default, comparing (highlights coincidencia), duplicate-alert, verified (dismiss), rejected (modal motivo).
**Keyboard**: `V` verificar, `R` rechazar, `→` siguiente, `←` anterior.
**Accesibilidad**: Focus trap, `aria-keyshortcuts`.

### BottomNavBar
**Proposito**: Navegacion mobile adaptativa por roles.
**Anatomia**: Container fijo 64px bottom, 4-5 tabs (icono + label), badge notificaciones.
**Tabs por rol**: Cliente (Inicio/Viajes/Alertas/Perfil), Agente (Inicio/Negocio/Alertas/Perfil), Director (Dashboard/Agentes/Alertas/Perfil), Multi-rol (5 tabs max).
**States**: default, active-tab (accent), notification-badge, hidden (scroll down).
**Accesibilidad**: `role="navigation"`, `aria-current="page"`.

### RoleSidebar
**Proposito**: Sidebar desktop con secciones dinamicas por roles aditivos.
**Anatomia**: Container 280px fijo, fondo primary, logo top, secciones agrupadas con separadores.
**Secciones dinamicas**: Director (Dashboard/Ventas/Agentes/Cobranza), Admin (Verificacion/Usuarios), Siempre (Mis Viajes/Perfil), Agente (Clientes/Comisiones/Links).
**Accesibilidad**: `role="navigation"`, secciones como `role="group"`.

### TripCard
**Proposito**: Card de viaje para catalogo y portales.
**Anatomia**: Imagen hero 16:9, badge urgencia, titulo, precio (Roboto Mono), fechas, CTA.
**Variants**: `public` (catalogo, CTA "Cotizar"), `agent` (boton "Copiar Link"), `client` (mini progress bar), `compact` (grid mobile).
**States**: default, hover (translateY -4px), loading, sold-out.

### OfflineBanner
**Proposito**: Indicador sticky sin conexion.
**Anatomia**: Banner sticky, fondo warning, icono wifi-off + texto + timestamp.
**States**: offline (visible), online (slide-up dismiss), reconnecting (pulsante).
**Accesibilidad**: `role="alert"`, `aria-live="polite"`.

### BusinessMetric
**Proposito**: Metrica tipo Shopify para portal agente.
**Anatomia**: Card compacta, valor grande (Roboto Mono 24px), label, comparativa periodo.
**Variants**: `default` (grid 2x2), `highlight` (full-width, fondo accent-muted).

## Componentes 21st.dev (Paginas Publicas)

34 seleccionados de 499+ explorados. 3 favoritos confirmados por Alek (★).

| Categoria | Componente | Prioridad |
|-----------|-----------|-----------|
| Hero | Scroll Morph Hero ★ | P0 |
| Hero | Hero Section Mapa ★ | P1 |
| Cards | Clip Path Links ★ | P0 |
| Navbar | Floating Navbar | P0 |
| Footer | Footer 2 | P0 |
| CTA | CTA with Glow + Shimmer Button | P0 |
| Testimonials | Animated Testimonials + Marquee | P1 |
| Carousel | 3D Carousel + Gallery image cards | P1 |
| Pricing | Creative Pricing + Comparison | P1 |
| Features | Bento Grid + Feature Advantages | P1 |
| Forms | Multistep Form + Ride Booking Form | P1 |
| Login | Sign In (Shadcnblocks) | P0 |
| CTA | Floating Action Menu (WhatsApp) | P2 |

## Implementation Roadmap

**Fase 0A — Pre-Madrid (antes 3 marzo):** RoleSidebar, BottomNavBar, KPICard, VerificationPanel, BusinessMetric + shadcn/ui base + Sign In. *Demo funcional a Noel con datos reales.*

**Fase 0B — Construccion Remota (marzo-abril):** EmotionalProgress, PaymentStepper, TripCard, OfflineBanner + Toast/Dialog/Sheet/Skeleton + Floating Navbar + Footer 2. *Flujos completos de pago end-to-end.*

**Fase 0C — Estabilizacion (mayo):** Scroll Morph Hero ★, Clip Path Links ★, CTA Glow/Shimmer, Testimonials, Pricing, Multistep Form. *Paginas publicas con wow factor.*

**Fase 1 — Growth (post-MVP):** Hero Section Mapa ★, 3D Carousel, Bento Grid, Floating Action Menu WhatsApp, UGC Gallery, ShareCard.
