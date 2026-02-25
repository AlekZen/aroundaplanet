# Design Direction Decision

*HTML showcase interactivo disponible en: `_bmad-output/planning-artifacts/ux-design-directions.html`*

## Design Directions Explored

Se exploraron 5 direcciones de diseno, cada una optimizada para un contexto diferente de AroundaPlanet:

| # | Direccion | Filosofia | Fortaleza | Mejor para |
|---|-----------|-----------|-----------|-----------|
| 1 | **Aventura Inmersiva** | Fotografia domina. Chrome minimo. El viaje se siente real | Maximo impacto emocional. Carmen se enamora del viaje | Landing pages, portal cliente |
| 2 | **Dashboard Ejecutivo** | Data-first. Informacion clara, jerarquizada, sin distracciones | Noel lee en 10s. Mariana verifica en 90s | Dashboard director, portal admin |
| 3 | **Emprendedor Mobile** | Shopify meets WhatsApp. "Tu negocio en tu bolsillo" | Lupita se siente duena. Adopcion natural para usuarios WA | Portal agente, experiencia mobile |
| 4 | **Journey Emocional** | Todo es un viaje. Progress bars como elemento central | Carmen ve progreso y se emociona. Gamificacion sutil | Portal cliente, notificaciones |
| 5 | **Hibrida Contextual** | Cada contexto tiene su peso visual optimo | Cada rol tiene la UX que necesita, no un compromiso generico | Todos los roles y contextos |

## Chosen Direction

**Direccion 5: Hibrida Contextual** — La plataforma no es un solo producto con una sola personalidad visual. Es un sistema que sirve a 5 roles distintos en 2 dispositivos principales con necesidades emocionales opuestas. Forzar una unica direccion visual compromete la experiencia de al menos 2-3 roles.

**Mapeo de direcciones por contexto:**

| Contexto | Direccion aplicada | Peso visual | Densidad | Dispositivo |
|----------|-------------------|-------------|----------|-------------|
| Paginas publicas (landing, catalogo, home) | Aventura Inmersiva | Alto — fotos dominan | Baja — espacio para respirar | Ambos |
| Portal Agente "Mi Negocio" | Emprendedor Mobile | Medio — metricas + cards | Media — info util visible | Mobile 375px+ |
| Portal Admin "Operaciones" | Dashboard Ejecutivo | Bajo — datos limpios | Alta — eficiencia maxima | Desktop 1024px+ |
| Dashboard Director | Ejecutivo + Emocional | Medio — semaforo + KPIs | Media — resumen ejecutivo | Mobile 375px+ |
| Portal Cliente "Mis Viajes" | Journey Emocional | Medio — progreso + fotos | Baja — emocion sobre info | Mobile 375px+ |
| Auth (login/registro) | Inmersiva (sutil) | Bajo — foto destino blur | Minima — focus en accion | Ambos |

## Design Rationale

1. **Una app, cinco experiencias** — El design system (tokens, componentes shadcn/ui, Tailwind) garantiza coherencia. Las direcciones visuales garantizan que cada rol tenga la UX que necesita
2. **El contexto define el peso visual** — Landing publica necesita impacto emocional. Cola de verificacion necesita eficiencia. No se puede optimizar ambas con la misma densidad
3. **Componentes 21st.dev confirman la direccion** — Scroll Morph Hero y Clip Path Links (favoritos) son Aventura Inmersiva. shadcn/ui Sidebar + Table son Ejecutivo. Bottom Nav + FAB son Emprendedor. Progress + Stepper son Journey
4. **Consistencia via tokens, diferenciacion via layout** — Mismos colores, tipografia, radios. Diferente densidad, relacion foto/dato, peso de CTAs

## Implementation Approach

**Layouts como vehiculo de las direcciones:**

| Layout | Direccion | Componentes clave |
|--------|-----------|------------------|
| `PublicLayout` | Aventura Inmersiva | Floating Navbar, hero full-bleed, cards con fotos, footer multi-columna |
| `AgentMobileLayout` | Emprendedor Mobile | BottomNav 4 tabs, FAB naranja, cards metricas, pull-to-refresh |
| `AdminDesktopLayout` | Dashboard Ejecutivo | Sidebar fijo 280px, tabla/cola, panel detalle, atajos teclado |
| `DirectorLayout` | Ejecutivo + Emocional | Semaforo hero, KPI cards swipe, drill-down modal |
| `ClientLayout` | Journey Emocional | EmotionalProgress hero, timeline pagos, cards viajes con fotos |
| `AuthLayout` | Inmersiva (sutil) | Foto destino blur, card centrada login, gradiente verde→crema |

**Densidad visual por direccion:**

| Direccion | Padding cards | Gap | Font primario | Ratio foto:texto |
|-----------|-------------|-----|--------------|-----------------|
| Aventura Inmersiva | 0 (full-bleed) o 24px | 24px | display (36-48px) | 70:30 |
| Emprendedor Mobile | 16px | 16px | h2 (22px) | 30:70 |
| Dashboard Ejecutivo | 16px | 12px | body (16px) | 0:100 |
| Ejecutivo + Emocional | 20px | 16px | h1 (28px) | 20:80 |
| Journey Emocional | 20px | 20px | h2 (22px) | 40:60 |
