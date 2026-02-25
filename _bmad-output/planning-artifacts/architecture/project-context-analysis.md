# Project Context Analysis

## Requirements Overview

**Functional Requirements:**
68 FRs across 10 capability areas that define a role-aware travel agency platform with ERP integration:

| Area de Capacidad | FRs | Impacto Arquitectonico |
|-------------------|-----|----------------------|
| **FR01-FR08: Identity & Access** | 8 | RBAC aditivo, Firebase Auth + Firestore profiles, Odoo user seeding, session management |
| **FR09-FR17: Public Content & Conversion** | 9 | SSG/ISR pages, SEO optimization, Odoo-sourced trip data, Meta Pixel + GTM, agent attribution links |
| **FR18-FR23: Trip Management** | 6 | Odoo↔Firestore bidirectional sync, trip CRUD, itinerary management, pricing from Odoo |
| **FR24-FR35: Payment Flow** | 12 | Core loop: report→OCR→verify→notify. Offline-capable, camera integration, AI extraction, admin queue, status machine |
| **FR36-FR44: Agent Portal** | 9 | "Mi Negocio" dashboard, commission tracking, client management, performance metrics, agent-scoped data |
| **FR45-FR52: Director BI** | 8 | Real-time KPIs, revenue tracking, agent performance, exception alerts, drill-down analytics |
| **FR53-FR58: Notifications** | 6 | Multi-channel (FCM+WhatsApp+email), deep links, templates, quiet hours, grouping rules |
| **FR59-FR62: Client Portal** | 4 | Emotional progress tracker, payment timeline, trip details, UGC upload |
| **FR63-FR65: Analytics** | 3 | Firebase Analytics events, conversion funnels, attribution tracking |
| **FR66-FR68: Odoo Integration** | 3 | XML-RPC proxy, data sync strategy, abstraction layer for vendor independence |

**Non-Functional Requirements:**
32 NFRs que restringen directamente decisiones arquitectonicas:

| Categoria | NFRs | Restriccion Arquitectonica Clave |
|-----------|-------|--------------------------------|
| **Performance (NFR01-06)** | 6 | LCP <2.5s SSG, <3s dashboard, <30s payment flow. Offline persistence obligatoria. Cache estrategico |
| **Reliability (NFR07-11)** | 5 | 99.5% uptime, graceful Odoo degradation, queued payments survive offline, data consistency eventual |
| **Odoo Integration (NFR12-15)** | 4 | Rate limit 100 req/min, cache TTL por modelo, retry con backoff, abstraction layer mandatory |
| **Security (NFR16-20)** | 5 | RBAC granular Firestore Rules, App Check, rate limiting auth, data encryption, agent data isolation |
| **Scalability (NFR21-25)** | 5 | 500 agents + 5K clients concurrent, Firestore auto-scale, Odoo proxy horizontal-ready, CDN for assets |
| **Accessibility (NFR26-32)** | 7 | WCAG 2.1 AA selectivo, 4.5:1 contraste, 44px touch targets, keyboard nav admin, reduced motion |

**UX Design — Implicaciones Arquitectonicas:**

| Aspecto UX | Requerimiento | Impacto en Arquitectura |
|------------|---------------|------------------------|
| **6 Layout Masters** | PublicLayout, AgentMobile, AdminDesktop, Director, Client, Auth | Route groups con layout nesting, role-based layout selection proxy |
| **Hybrid Contextual Direction** | 5 direcciones visuales mapeadas a contextos | Component variants por contexto, no 5 apps separadas — tokens compartidos, density variable |
| **19 shadcn/ui + 9 custom + 34 21st.dev** | 62 componentes total | Design system modular, tree-shaking critical, lazy loading 21st.dev components |
| **Real-time updates** | KPIs director, cola admin, payment status | Firestore onSnapshot listeners, optimistic UI, stale-while-revalidate |
| **Offline capability** | Payment reporting without connection | Service worker, IndexedDB queue, background sync |
| **Animations (Framer Motion)** | Scroll Morph Hero, transitions, micro-interactions | prefers-reduced-motion support, code splitting motion library |
| **PWA** | Installable, push notifications, offline | next-pwa config, service worker strategy, Web App Manifest |
| **Responsive 5 breakpoints** | 375px → 1536px, role-aware | Tailwind config, CSS-first responsive, JS breakpoint hooks for complex behavior |

## Scale & Complexity

- **Primary domain:** Full-stack PWA (Next.js App Router) con integracion ERP bidireccional
- **Complexity level:** ALTA — multi-role, ERP integration, AI, offline-first, real-time + static
- **Estimated architectural components:** ~15 major (auth, RBAC, layouts, Odoo proxy, sync engine, payment flow, OCR pipeline, notification service, analytics, offline queue, PWA shell, CDN/storage, admin queue, agent portal, public SSG)

## Technical Constraints & Dependencies

| Constraint | Source | Implicacion |
|-----------|--------|-------------|
| Firebase Blaze plan (us-east4) | Infraestructura existente | Region fija, pricing pay-as-you-go, App Hosting con buildpacks |
| Odoo 18 Enterprise Online | ERP existente con datos reales | XML-RPC only (no REST), rate limit ~100 req/min, 719 modelos disponibles |
| Solo 5 usuarios internos Odoo | Investigacion usuarios | Agentes NO tienen acceso Odoo — toda interaccion agente es via nuestra plataforma |
| 7 WhatsApp templates aprobados | Odoo WhatsApp module | Templates rigidos, nuevos requieren aprobacion Meta (dias/semanas) |
| Deadline Pre-Madrid: Mar 3 | Contractual | Fase 0 Sub-fase 1 en 8 dias: auth + roles + dashboard + landing + PWA |
| $145K MXN producto unico | Modelo negocio | Pagos parciales de alto valor, no e-commerce clasico — payment flow custom |
| ~100 agentes freelance via WhatsApp | Operacion actual | Adopcion digital es el reto #1 — UX agente debe ser mas facil que WhatsApp |
| Noel anti-chatbot | Stakeholder principal | Cero chatbots. IA solo para OCR. Cualquier feature "inteligente" debe ser invisible |
| Budget $50K MXN Fase 0 | Deal cerrado | MVP lean — maximizar Firebase free tier, minimizar Cloud Functions |

## Cross-Cutting Concerns Identified

1. **Authentication & Authorization (RBAC)** — Firestore Security Rules + custom claims Firebase Auth. Cada query, cada vista, cada API call filtrado por rol+permisos. Roles aditivos requieren claim-based access, no role-based routing simple.

2. **Odoo↔Firestore Sync Engine** — Bidireccional: Odoo es fuente de verdad para trips/productos/contactos, Firestore es fuente de verdad para pagos/actividad/UGC. Sync strategy: webhook ideal pero Odoo Online no lo soporta nativamente → polling + event-driven writes.

3. **Offline-First Architecture** — Service worker con Firestore offline persistence. Payment queue en IndexedDB. Background sync al reconectar. Implicacion: toda la UI debe funcionar con datos potencialmente stale.

4. **Performance Budget** — Odoo XML-RPC es inherentemente lento (500-2000ms). Cache agresivo en Firestore como "materialized views" de datos Odoo. SSG/ISR para publico. Lazy loading para portales privados.

5. **Agent Data Isolation** — Firestore Security Rules que garantizan que agente X NUNCA pueda leer datos de agente Y. Ni clientes, ni pagos, ni comisiones. Requiere estructura de datos que soporte queries eficientes con filtro de agente.

6. **Notification Orchestration** — NotificationService centralizado que decide canal (FCM→WhatsApp→email), respeta horarios silenciosos, agrupa eventos, genera deep links funcionales, y loguea delivery para analytics.

7. **Multi-Layout Rendering** — Role-based layout selection en proxy/layout nesting de Next.js App Router. Un usuario puede tener multiples roles → layout se selecciona por contexto actual, no por rol unico.
