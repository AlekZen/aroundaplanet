# Design System Foundation

## Design System Choice

**Tailwind CSS + shadcn/ui** como fundacion del sistema de diseno de AroundaPlanet.

Tailwind CSS proporciona utilidades CSS atomic mobile-first con zero runtime overhead. shadcn/ui proporciona componentes React accesibles (basados en Radix UI primitives) que se copian directamente al proyecto — no es una dependencia externa sino codigo propio editable. Ambos son nativos del ecosistema Next.js App Router.

## Rationale for Selection

| Factor | Evaluacion |
|--------|-----------|
| **Timeline (90 dias, 1 dev)** | shadcn/ui provee ~40 componentes listos para customizar. No hay que construir Cards, Progress, Dialogs, Forms desde cero |
| **Marca AroundaPlanet** | Design tokens via CSS variables permiten aplicar paleta (#1B4332, #F4A261, #E76F51, #FAFAF8) y tipografia (Poppins/Inter/Roboto Mono) globalmente en una sola configuracion |
| **Mobile-first** | Tailwind es mobile-first por defecto. Breakpoints `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px` coinciden con la estrategia responsive del proyecto |
| **Accesibilidad** | Radix UI primitives incluyen aria labels, keyboard navigation, focus trapping. Touch targets 44x44px se implementan con `min-h-11 min-w-11` |
| **Performance** | Tailwind genera solo el CSS usado (tree-shaking). Cero JS runtime adicional. Critico para LCP <2.5s y TTI <3.5s en paginas publicas SSG |
| **Control sin dependencia** | Componentes shadcn/ui son codigo en `/components/ui/`. Sin versiones externas que rompan, sin overrides complejos de temas |
| **Compatibilidad IA** | Tailwind + shadcn/ui es el stack de UI mas documentado para asistentes IA. Maximiza productividad del desarrollo asistido |

## Implementation Approach

**Design Tokens (tailwind.config.ts):**

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-primary` | `#1B4332` | Sidebar, headers, elementos de confianza |
| `--color-primary-foreground` | `#FAFAF8` | Texto sobre primary |
| `--color-accent` | `#F4A261` | CTAs, FAB "Reportar Pago", enlaces activos |
| `--color-destructive` | `#E76F51` | Alertas, pagos rechazados, urgencias |
| `--color-background` | `#FAFAF8` | Fondo general (crema calido, no blanco frio) |
| `--color-card` | `#FFFFFF` | Superficie de cards sobre fondo crema |
| `--color-muted` | `#F1F0EB` | Fondos secundarios, skeleton loading |
| `--font-sans` | `Inter` | Cuerpo de texto, formularios, UI general |
| `--font-heading` | `Poppins` | Titulos, KPIs grandes, nombres de seccion |
| `--font-mono` | `Roboto Mono` | Montos ($145,000), referencias bancarias, fechas |
| `--radius` | `0.75rem` | Border radius global — redondeado amigable |
| `--touch-min` | `44px` | Area minima de toque (NFR31) |

**Componentes shadcn/ui base (instalar desde dia 1):**

| Componente | Uso en AroundaPlanet |
|-----------|---------------------|
| `Button` | CTAs, verificar/rechazar, acciones primarias |
| `Card` | KPIs dashboard, viajes catalogo, resumen agente |
| `Dialog` / `Sheet` | Modales desktop / drawers mobile |
| `Form` + `Input` | Reporte pago, perfil, datos fiscales |
| `Progress` | Barra progreso pagos Carmen |
| `Badge` | Status pagos (pendiente/verificado/rechazado), roles |
| `Avatar` | Fotos perfil, agentes en cards |
| `Table` | Cola verificacion admin (drill-down, no vista principal) |
| `Tabs` | Secciones dentro de portales |
| `Toast` | Confirmaciones ("Pago reportado"), errores |
| `Skeleton` | Loading states (nunca pantalla blanca) |
| `Navigation Menu` / `Sidebar` | Navegacion desktop por roles |
| `Select` / `Combobox` | Filtros catalogo, seleccion cliente |
| `Separator` | Division visual entre secciones del sidebar |

**Componentes custom a construir sobre shadcn/ui:**

| Componente | Base shadcn/ui | Personalizacion |
|-----------|---------------|----------------|
| `EmotionalProgress` | `Progress` | Hitos 25/50/75/100% con micro-celebraciones, imagen destino, mensaje emocional |
| `KPICard` | `Card` | Numero grande (Poppins), tendencia (flecha + %), subtexto contextual |
| `PaymentStepper` | Custom | Timeline vertical: Reportado → Verificando → Verificado. Iconos + timestamps |
| `VerificationPanel` | `Card` + layout | Split-screen: imagen comprobante + datos IA resaltados + botones accion |
| `BottomNavBar` | Custom | 4-5 tabs dinamicos segun roles del usuario, badge notificaciones |
| `RoleSidebar` | `Sidebar` | Secciones dinamicas segun roles aditivos, colapsable, indicadores activos |
| `TripCard` | `Card` | Imagen hero, precio, ocupacion, fechas, CTA. Version publica y privada |
| `OfflineBanner` | `Alert` | Banner sticky "Sin conexion — datos de hace Xh" con icono y timestamp |
| `BusinessMetric` | `Card` | Metrica tipo Shopify: label + valor grande + comparativa periodo anterior |

## Customization Strategy

**Principio rector:** shadcn/ui provee la estructura y accesibilidad. Tailwind provee el styling. Los design tokens proveen la marca. Los componentes custom proveen la emocion.

**Niveles de customizacion:**

1. **Tokens globales** — Se configuran UNA vez en `tailwind.config.ts` y `globals.css`. Toda la app hereda colores, tipografia, radios y espaciado de marca automaticamente
2. **Componentes base** — shadcn/ui se instala y usa con minima modificacion. Solo se ajustan variantes (ej: `Button` con variante `accent` usando `--color-accent`)
3. **Componentes compuestos** — Combinaciones de componentes base para patrones especificos de AroundaPlanet (KPICard = Card + numero + tendencia)
4. **Layouts responsivos** — Tres layouts master: mobile (bottom nav), desktop (sidebar), publico (header + footer). Cada pagina elige su layout
5. **Estados emocionales** — Capa final que agrega micro-animaciones, mensajes contextuales y celebraciones. Se construye SOBRE los componentes funcionales, no reemplazandolos
