# Web App (PWA) Specific Requirements

## Project-Type Overview

Plataforma AroundaPlanet es una Progressive Web App (PWA) construida con Next.js que opera como SPA para la experiencia privada (dashboard, portales) y genera paginas estaticas (SSG/ISR) para landing pages publicas optimizadas para SEO. Mobile-first por naturaleza — Noel, agentes y clientes usan celular como dispositivo principal; admins usan escritorio.

## Browser Matrix

| Navegador | Soporte | Notas |
|-----------|---------|-------|
| Chrome (ultimas 2 versiones) | Completo | Primario — mayoria de usuarios Android |
| Safari (ultimas 2 versiones) | Completo | Primario — iOS de Noel y clientes |
| Firefox (ultimas 2 versiones) | Completo | Secundario |
| Edge (ultimas 2 versiones) | Completo | Secundario — admins en escritorio |
| Navegadores legacy (IE, versiones antiguas) | No soportado | No es necesario para esta base de usuarios |

## Responsive Design

| Breakpoint | Target | Usuarios principales |
|-----------|--------|---------------------|
| 375px+ (mobile) | Primario — toda la experiencia funcional | Noel, agentes, clientes |
| 768px+ (tablet) | Secundario — layout adaptado | Uso ocasional |
| 1024px+ (desktop) | Completo — aprovecha espacio para split-screen y dashboards | Admins (Mariana), SuperAdmin |

## Performance Targets

Ver NFR1-NFR7 en Non-Functional Requirements para targets especificos de LCP, TTI, tiempos de carga por seccion y concurrencia.

## SEO Strategy

| Pagina | Renderizado | SEO |
|--------|------------|-----|
| Landing viajes (`/viajes/[slug]`) | SSG con ISR (revalidar cada hora) | Meta tags, Open Graph, JSON-LD schema TravelAction |
| Home (`/`) | SSG | Meta tags, branding |
| Catalogo viajes (`/viajes`) | SSG con ISR | Listado indexable, filtros no indexables |
| Vuelta al Mundo (`/viajes/vuelta-al-mundo-33-dias`) | SSG | Landing especial, SEO prioritaria |
| Paginas privadas (`/dashboard`, `/agente/*`, etc.) | CSR (SPA) | `noindex` — no indexar |

## PWA Configuration

| Feature | Implementacion |
|---------|---------------|
| Instalable | manifest.json con icons, splash screen, theme AroundaPlanet |
| Service Worker | Cache-first para assets estaticos, network-first para API |
| Offline | Cache de ultimo estado del dashboard + historial de pagos consultado. Datos stale con indicador "ultima actualizacion: hace Xh" |
| Push Notifications | FCM via service worker, VAPID keys ya generadas |
| Add to Home Screen | Prompt automatico despues de 2da visita |

## Accessibility

Nice-to-have, no bloqueante para MVP. Ver NFR30-NFR32 para contraste, areas de toque y navegacion por teclado.

## Implementation Considerations

**Next.js App Router:**
- Paginas publicas: SSG con `generateStaticParams` para cada viaje de Odoo
- ISR: revalidacion cada hora para reflejar cambios en ocupacion/disponibilidad
- Paginas privadas: CSR con proxy de auth que redirige a `/login`
- API Routes: proxy Odoo XML-RPC, dispatch de notificaciones, webhooks

**Firebase Integration:**
- Auth: proxy de Next.js valida session cookie en cada request privado
- Firestore: listeners real-time para cola de verificacion admin y notificaciones
- Storage: upload directo desde cliente con security rules por uid
- AI Logic: llamada client-side para OCR, validacion server-side
- FCM: service worker registrado en layout principal
- Analytics: wrapper centralizado con Meta Pixel + Google Tag en paralelo

**Offline Strategy:**
- Service worker cachea: dashboard data (ultimo snapshot), historial pagos consultados, assets estaticos, shell de la app
- Al recuperar conexion: sincroniza automaticamente
- Indicador visual claro: banner "Sin conexion — mostrando datos de hace X horas"
