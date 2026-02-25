# Product Scope

## Strategy & Constraints

**Approach:** Platform MVP — no es un experimento de validacion (12,214 ordenes reales en Odoo). Es una plataforma que reemplaza procesos manuales. El riesgo no es "la gente lo quiere?" sino "lo adoptaran?" La adopcion gradual (admin como proxy, efecto red, presion social) esta disenada en los journeys.

**Resources:** 1 desarrollador full-stack senior (Alek) con Claude Code como multiplicador. Stack conocido (Next.js + Firebase + Odoo API). 90 dias calendario.

**Constraint inamovible:** Garantia Pre-Madrid — plataforma mostrable el 3 de marzo o reembolso 100% ($50K MXN). Define P1 de forma no negociable.

**Journeys soportados:** J1 (Visitante→Cliente), J2 (Cliente paga), J3 (Agente reporta), J4 (Admin verifica), J5 (Director supervisa), J6 (SuperAdmin gestiona), J7 (Agente resistente→proxy).

## MVP — Fase 0 (90 dias)

**Prioridad 1 — Pre-Madrid (8 dias, antes 3 marzo):**
- Auth con roles aditivos (Cliente base + Director/Agente/Admin/SuperAdmin)
- Panel SuperAdmin: gestion usuarios, roles, seed desde Odoo
- Dashboard Director con BI temporal (semana/mes/trimestre/ano/YoY/tendencias)
- Paginas publicas: home, catalogo viajes, landing por viaje (SSG/ISR)
- PWA instalable en celular de Noel
- Firebase Analytics + Meta Pixel + Google Tag instrumentados
- Integracion Odoo via proxy XML-RPC (lectura datos reales)

**Prioridad 2 — Semanas 2-6: Flujo de Pagos con IA:**
- Reporte pago: foto → Firebase AI Logic (gemini-2.5-flash-lite) → datos → confirma
- Cola verificacion admin con datos IA prellenados + comparacion manual
- NotificationService centralizado: push FCM deep links + WhatsApp Odoo + email
- Preferencias notificacion dinamicas por rol en perfil
- Plan de pagos con sugerencia de proximo pago
- Historial pagos por cliente (cross-viaje)

**Prioridad 3 — Semanas 4-8: Transparencia + Conversion:**
- Portal "Mi Negocio" agente: clientes, ventas, cartera, comisiones
- CRUD viajes Odoo↔Firestore con landing pages publicas SEO
- Flujo conversion: visitante → cuenta → Cliente automatico → cotizacion/interes
- Links agente con atribucion (?ref=agentId) + autoasignacion
- Catalogo viajes con material de venta
- Perfil unificado: foto, datos fiscales, cuenta bancaria

**Transversal (todo Fase 0):**
- Navegacion dual publica/privada, sidebar unificado dinamico por roles
- Resumenes push programados para Noel (diario nocturno + semanal)
- Pixels conversion (Meta + Google) en wrapper analytics centralizado
- Firebase Storage organizado (comprobantes, perfiles, UGC, viajes)
- Offline: cache dashboard + historial pagos

## Growth Features (Fase 1, iguala mensual)

- Portal cliente UX emocional (barra progreso gamificada, timeline viaje)
- Galeria fotos UGC con toggle publico/privado + moderacion + compartir redes
- Recuperacion 9,594 cotizaciones muertas (~$15M MXN potencial)
- CRM avanzado con pipeline, scoring, automatizaciones
- Generacion automatica PDFs (contratos, cotizaciones, itinerarios)
- Marketing automation (email sequences, WhatsApp campaigns)
- Dashboards marketing: ROI campanas, costo por adquisicion por canal
- Reportes rentabilidad por destino/agente (requiere margen de Noel)
- Multi-moneda EUR para operacion Madrid
- Integracion Open Banking para verificacion automatica

## Vision (12-18 meses)

- Micro-sitio por agente modelo Shopify ("Hosted by Lupita")
- BI predictivo: estacionalidad, patron pago, bundles de viajes
- Onboarding gamificado agentes con recompensas
- "Tu Ano Viajero" wrapped (resumen anual tipo Spotify)
- Programa referidos clientes
- Expansion SaaS a otras agencias (arquitectura multi-tenant-ready)

## Risk Mitigation

**Technical:**

| Riesgo | Mitigacion |
|--------|------------|
| Odoo API inestable o lenta | Capa proxy con cache en Firestore, modo degradado sin Odoo |
| Firebase AI Logic precision baja | Fallback campos manuales, admin siempre verifica, IA asiste no decide |
| FCM delivery inconsistente | Multi-canal: push + WhatsApp Odoo + email como fallback |
| Performance dashboard con muchos datos | Paginacion, queries optimizados, ISR para datos no real-time |

**Market:**

| Riesgo | Mitigacion |
|--------|------------|
| Agentes no adoptan | Sistema funciona sin ellos (admin proxy), ventaja visible genera presion social |
| Noel no usa dashboard | Resumenes push automaticos — no requiere abrir la app proactivamente |
| Clientes no crean cuenta | Admin puede gestionar sin portal cliente en MVP |

**Resources:**

| Riesgo | Mitigacion |
|--------|------------|
| 1 desarrollador es bottleneck | Claude Code como multiplicador, stack conocido, Firebase reduce infra |
| Timeline Pre-Madrid muy tight | P1 es lo minimo mostrable, P2 y P3 tienen 82 dias mas |
| Scope creep durante Fase 0 | PRD como contrato de scope, features nuevas van a Fase 1 |
