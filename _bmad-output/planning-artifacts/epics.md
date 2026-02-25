---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  # PRD (shardeado - 9 secciones)
  - _bmad-output/planning-artifacts/prd/index.md
  - _bmad-output/planning-artifacts/prd/executive-summary.md
  - _bmad-output/planning-artifacts/prd/project-classification.md
  - _bmad-output/planning-artifacts/prd/success-criteria.md
  - _bmad-output/planning-artifacts/prd/product-scope.md
  - _bmad-output/planning-artifacts/prd/user-journeys.md
  - _bmad-output/planning-artifacts/prd/innovation-novel-patterns.md
  - _bmad-output/planning-artifacts/prd/functional-requirements.md
  - _bmad-output/planning-artifacts/prd/web-app-pwa-specific-requirements.md
  - _bmad-output/planning-artifacts/prd/non-functional-requirements.md
  # Architecture (shardeado - 6 secciones)
  - _bmad-output/planning-artifacts/architecture/index.md
  - _bmad-output/planning-artifacts/architecture/project-context-analysis.md
  - _bmad-output/planning-artifacts/architecture/starter-template-evaluation.md
  - _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md
  - _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md
  - _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md
  - _bmad-output/planning-artifacts/architecture/architecture-validation-results.md
  # UX Design Spec (shardeado - 12 secciones)
  - _bmad-output/planning-artifacts/ux-design-specification/index.md
  - _bmad-output/planning-artifacts/ux-design-specification/executive-summary.md
  - _bmad-output/planning-artifacts/ux-design-specification/core-user-experience.md
  - _bmad-output/planning-artifacts/ux-design-specification/desired-emotional-response.md
  - _bmad-output/planning-artifacts/ux-design-specification/ux-pattern-analysis-inspiration.md
  - _bmad-output/planning-artifacts/ux-design-specification/design-system-foundation.md
  - _bmad-output/planning-artifacts/ux-design-specification/defining-core-experience.md
  - _bmad-output/planning-artifacts/ux-design-specification/visual-design-foundation.md
  - _bmad-output/planning-artifacts/ux-design-specification/design-direction-decision.md
  - _bmad-output/planning-artifacts/ux-design-specification/user-journey-flows.md
  - _bmad-output/planning-artifacts/ux-design-specification/component-strategy.md
  - _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md
  - _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md
  # Odoo - Repo Estrategia (contexto integracion real)
  - "D:/dev/AlekContenido/Areas/Proyectos/AroundaPlanet/execution/infraestructura/odoo/odoo-api-reference.md"
  - "D:/dev/AlekContenido/Areas/Proyectos/AroundaPlanet/execution/infraestructura/odoo/usuarios-roles-odoo.md"
  - "D:/dev/AlekContenido/Areas/Proyectos/AroundaPlanet/execution/infraestructura/odoo/auditoria-datos-ventas.md"
  - "D:/dev/AlekContenido/Areas/Proyectos/AroundaPlanet/execution/infraestructura/odoo/auditoria-visual-odoo.md"
  - "D:/dev/AlekContenido/Areas/Proyectos/AroundaPlanet/execution/infraestructura/odoo/manual-captura-datos-odoo.md"
  - "D:/dev/AlekContenido/Areas/Proyectos/AroundaPlanet/execution/infraestructura/odoo/manual-acceso-odoo.md"
  - "D:/dev/AlekContenido/Areas/Proyectos/AroundaPlanet/execution/infraestructura/odoo/RESEARCH-ORDER-ODOO-AROUNDAPLANET.md"
  - "D:/dev/AlekContenido/Areas/Proyectos/AroundaPlanet/execution/infraestructura/odoo/analisis-estrategia-fiscal.md"
  - "D:/dev/AlekContenido/Areas/Proyectos/AroundaPlanet/execution/infraestructura/odoo/analisis-inflacion-ventas.md"
---

# AroundaPlanet - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for AroundaPlanet, decomposing the requirements from the PRD, UX Design, Architecture, and Odoo exploration data into implementable stories.

## Requirements Inventory

### Functional Requirements

#### 1. Identity & Access Management (9 FRs)

- FR1: Visitante anonimo puede crear cuenta con email o Google desde cualquier pagina publica
- FR2: Usuario autenticado tiene rol Cliente como base — siempre presente independientemente de roles adicionales
- FR3: SuperAdmin puede asignar roles adicionales (Agente, Admin, Director, SuperAdmin) a cualquier usuario
- FR4: SuperAdmin puede desactivar un usuario sin borrar sus datos ni historial
- FR5: SuperAdmin puede sincronizar usuarios desde Odoo (res.users + hr.employee) y asignarles roles
- FR6: SuperAdmin puede configurar permisos read-only para roles especificos (ej: Director sin edicion)
- FR7: Sistema impide que un usuario vea datos de otro usuario que no le correspondan segun su rol y asignaciones
- FR8: Usuario autenticado puede editar su perfil: foto, datos personales, datos fiscales (RFC, razon social, regimen, domicilio, uso CFDI), cuenta bancaria (agentes)
- FR9: Usuario autenticado puede configurar sus preferencias de notificacion segun las categorias disponibles para su rol

#### 2. Public Content & Conversion (6 FRs)

- FR10: Visitante puede navegar paginas publicas: home, catalogo de viajes, landing individual por viaje, pagina Vuelta al Mundo
- FR11: Landing de viaje muestra galeria de fotos (profesionales + UGC), itinerario, precio, fechas de salida disponibles, ocupacion/disponibilidad, testimonios de viajeros
- FR12: Visitante puede solicitar cotizacion / apartar lugar en un viaje seleccionando fecha de salida, creando una orden en estado "Interesado"
- FR13: Sistema captura atribucion de origen (UTMs, ref de agente) al momento de la primera visita y la asocia al usuario cuando crea cuenta
- FR14: Si visitante llega con parametro ref de agente, se autoasigna a ese agente al crear cuenta (primer toque gana)
- FR15: Si visitante llega sin ref, admin recibe notificacion de nuevo lead para asignacion manual o round-robin

#### 3. Trip Management & Catalog (5 FRs)

- FR16: SuperAdmin/Admin puede crear, editar, publicar y despublicar viajes con datos sincronizados desde Odoo (product.template)
- FR17: Viaje puede tener multiples fechas de salida con capacidad individual por fecha (via Odoo Events)
- FR18: Viaje tiene contenido rico en Firestore (fotos hero, copy marketing, SEO meta, slug URL) independiente de datos operativos de Odoo
- FR19: Cliente puede ver catalogo completo de viajes disponibles con filtros
- FR20: Agente puede ver catalogo de viajes con material de venta y copiar su link personalizado por viaje

#### 4. Payment Flow (11 FRs)

- FR21: Agente o Cliente puede reportar un pago subiendo foto de comprobante bancario
- FR22: Sistema analiza foto del comprobante con IA y extrae automaticamente monto, fecha, referencia y banco
- FR23: Usuario que reporta pago puede confirmar o corregir los datos extraidos por IA antes de enviar
- FR24: Agente puede reportar pago en nombre de un cliente asignado
- FR25: Admin puede reportar pago en nombre de cualquier agente o cliente (proxy)
- FR26: Admin ve cola de verificacion de pagos priorizada por antiguedad con indicador de urgencia para pagos >48h
- FR27: Admin puede verificar un pago confirmando que coincide con movimiento bancario
- FR28: Admin puede rechazar un pago especificando motivo
- FR29: Sistema detecta comprobantes duplicados por referencia bancaria y alerta al admin
- FR30: Viaje activo de cliente muestra plan de pagos con monto total, pagado, pendiente, y sugerencia de proximo pago
- FR31: Cliente puede ver historial completo de pagos de todos sus viajes con status de cada uno

#### 5. Agent Business Portal (6 FRs)

- FR32: Agente puede ver lista de SUS clientes asignados con status de cada uno
- FR33: Agente puede ver detalle de cada cliente: perfil, viaje activo, historial de pagos
- FR34: Agente puede ver sus comisiones acumuladas con detalle por cliente y viaje
- FR35: Agente puede ver resumen de su cartera: total ventas, cantidad clientes, comision del periodo
- FR36: Agente puede generar y copiar su link personalizado por viaje con parametro de atribucion
- FR37: Agente recibe notificacion cuando un lead se autoasigna desde su link

#### 6. Director Dashboard & BI (7 FRs)

- FR38: Director puede ver dashboard ejecutivo con KPIs de ventas brutas, cobranza, ocupacion por viaje, ranking agentes
- FR39: Director puede cambiar dimension temporal de cualquier metrica: semana, mes, trimestre, anio, comparativas YoY, tendencias
- FR40: Director puede hacer drill-down desde KPI agregado hasta detalle de orden individual
- FR41: Director puede ver widget de fuentes de trafico: desglose por canal (Instagram, Google, agentes, etc.) con embudo de conversion
- FR42: Director puede ver widget de performance de agentes: leads generados, pagos procesados, ranking
- FR43: Director puede ver cobranza pendiente con filtros por antiguedad y monto
- FR44: Director puede ver metricas de adopcion por agente (pagos via plataforma vs proxy admin)

#### 7. Notification System (6 FRs)

- FR45: Sistema despacha notificaciones via multiples canales: push (FCM), WhatsApp (Odoo templates), email
- FR46: Cada notificacion incluye deep link que lleva al usuario a la seccion relevante de la informacion
- FR47: Sistema envia resumenes programados: diario nocturno para Director, diario matutino para Admin, semanal para Agente
- FR48: Sistema envia alertas por excepcion al Director: agente inactivo, pago atrasado, meta no alcanzada, hito de negocio
- FR49: Sistema agrupa notificaciones cuando multiples eventos ocurren en ventana corta (ej: 5 pagos en 1 hora = 1 push agrupado)
- FR50: Usuario puede activar/desactivar categorias de notificacion y configurar horarios desde su perfil

#### 8. Client Experience & UGC (8 FRs)

- FR51: Cliente puede ver todos sus viajes (pasados, activo, futuro) con detalle de cada uno
- FR52: Cliente puede ver progreso visual de pagos de su viaje activo
- FR53: Cliente puede descargar documentos asociados a sus viajes (contratos, itinerarios) 24/7
- FR54: Cliente puede subir fotos de viajes completados a su galeria personal
- FR55: Cliente puede escribir resenia y calificar viajes completados
- FR56: Cliente puede marcar fotos individuales como publicas (toggle) para que aparezcan en la landing del viaje
- FR57: Admin puede moderar fotos y resenias antes de publicarlas en landing pages
- FR58: Cliente puede generar card para compartir su experiencia en redes sociales con link de atribucion a la landing del viaje

#### 9. Analytics & Attribution (5 FRs)

- FR59: Sistema registra eventos de conversion en Firebase Analytics: view_trip, sign_up, begin_checkout, purchase
- FR60: Sistema captura y almacena parametros UTM y ref de agente en la sesion del visitante y los asocia a su cuenta
- FR61: Sistema dispara eventos equivalentes en Meta Pixel y Google Tag para cada evento de conversion
- FR62: Sistema mide push click-through rate por tipo de notificacion
- FR63: Director puede ver dashboard de atribucion: fuentes de trafico, conversion por canal, performance de links de agente

#### 10. Odoo Integration (5 FRs)

- FR64: Sistema lee datos de Odoo via XML-RPC: contactos, ordenes de venta, pagos, productos, CRM, empleados, eventos
- FR65: Sistema escribe datos de vuelta a Odoo cuando corresponde: registro de pagos en account.move, actualizacion de ordenes
- FR66: Sistema sincroniza catalogo de viajes entre Odoo product.template y Firestore
- FR67: Sistema opera con capa de abstraccion que desacopla la logica de negocio de la API especifica de Odoo
- FR68: Sistema opera en modo degradado si Odoo no esta disponible, mostrando datos cacheados con indicador de estado

### NonFunctional Requirements

#### Performance (7 NFRs)

- NFR1: Paginas publicas (landing viajes) cargan con LCP <2.5s para cumplir Core Web Vitals y posicionar en Google (SSG/ISR)
- NFR2: Dashboard Director carga datos iniciales en <3s desde cualquier conexion (Madrid, 4G)
- NFR3: Flujo completo de reporte de pago (foto → IA → datos → confirma → enviado) se completa en <30s
- NFR4: Cola de verificacion admin carga en <2s para que Mariana procese pagos sin esperar
- NFR5: Navegacion entre secciones privadas (SPA) transiciona en <500ms sin recargas completas
- NFR6: Time to Interactive (TTI) <3.5s en primera carga sobre red 4G
- NFR7: El sistema soporta al menos 50 usuarios concurrentes sin degradacion perceptible de performance

#### Security (8 NFRs)

- NFR8: Toda comunicacion entre cliente y servidor usa HTTPS/TLS 1.2+
- NFR9: Datos sensibles (comprobantes, datos fiscales, cuenta bancaria) se almacenan en Firebase con security rules que restringen acceso por uid y rol
- NFR10: Un agente no puede acceder a datos de clientes, pagos o comisiones de otro agente bajo ninguna circunstancia — validado tanto en frontend (UI) como backend (Firestore rules + server-side)
- NFR11: Sesiones de autenticacion expiran despues de 14 dias de inactividad. Revocacion inmediata disponible desde panel SuperAdmin
- NFR12: Fotos de comprobantes bancarios son accesibles unicamente por: el usuario que las subio, admin asignado a verificar, y SuperAdmin
- NFR13: Operaciones destructivas (borrar usuario, cambiar roles) requieren rol SuperAdmin y dejan audit trail en log
- NFR14: API Routes del proxy Odoo validan autenticacion y autorizacion en cada request — no hay endpoint publico que exponga datos de Odoo
- NFR15: Firebase Storage rules imponen estructura de carpetas por uid — un usuario no puede escribir ni leer fuera de su scope

#### Scalability (4 NFRs)

- NFR16: Arquitectura soporta crecimiento de 120 usuarios a 500 sin cambios en infraestructura (Firebase auto-scale)
- NFR17: Queries de Firestore usan indices compuestos para mantener performance constante independientemente del volumen de datos
- NFR18: Landing pages estaticas (SSG) se sirven desde CDN sin carga en servidor de aplicacion
- NFR19: Cache de datos Odoo en Firestore evita que crecimiento de usuarios multiplique llamadas XML-RPC

#### Integration (5 NFRs)

- NFR20: Capa proxy Odoo abstrae el protocolo XML-RPC — cambiar de Odoo a otro ERP solo requiere reemplazar el adaptador, no la logica de negocio
- NFR21: Si Odoo no responde en <5s, el sistema usa cache de Firestore y muestra indicador visual "datos de hace X horas"
- NFR22: Sincronizacion Odoo↔Firestore es eventual (no transaccional) — el sistema tolera inconsistencias temporales con mecanismo de reconciliacion
- NFR23: WhatsApp Odoo templates tienen fallback a push FCM + email si el canal falla
- NFR24: Firebase AI Logic para OCR tiene fallback a formulario manual — el flujo de pagos nunca se bloquea por falla de IA

#### Reliability (5 NFRs)

- NFR25: El flujo de pagos (reportar → verificar → notificar) tiene disponibilidad >99.5% — es la operacion critica diaria
- NFR26: PWA funciona offline mostrando ultimo snapshot cacheado del dashboard y historial de pagos, con indicador "sin conexion"
- NFR27: Notificaciones push se despachan con retry automatico (hasta 3 intentos) si el primer envio falla
- NFR28: Errores de sincronizacion con Odoo se registran en log visible para SuperAdmin con opcion de retry manual
- NFR29: El sistema no tiene single point of failure fuera de Firebase — si un servicio individual de Firebase se degrada, los demas siguen operando

#### Accessibility (3 NFRs)

- NFR30: Contraste de texto cumple ratio minimo 4.5:1 para legibilidad en mobile bajo condiciones de luz solar (agentes en campo)
- NFR31: Elementos interactivos tienen area de toque minima de 44x44px para uso en dispositivos moviles
- NFR32: Formularios clave (reporte pago, verificacion) son navegables por teclado para admins en escritorio

### Additional Requirements

#### Starter Template & Scaffold (Arquitectura)

- Starter: `create-next-app@latest` con integracion manual (greenfield) — IMPACTA Epic 1, Story 1
- Comando: `npx create-next-app@latest aroundaplanet --typescript --tailwind --eslint --app --src-dir --turbopack --use-pnpm`
- Post-scaffold: `npx shadcn@latest init`, instalar Firebase SDK, Serwist, dependencias
- Branch produccion: `master` (NO `main`)

#### Infraestructura & Deployment (Arquitectura)

- Firebase App Hosting (Blaze, us-east4) con auto-deploy desde rama `master`
- Preview URLs por PR automaticos
- Cloud Run: minInstances=1, maxInstances=10, concurrency=80, CPU=1, RAM=1024MB prod
- 7 secretos en Cloud Secret Manager antes del primer deploy: prod-firebase-api-key, prod-firebase-messaging-sender-id, prod-firebase-app-id, prod-firebase-vapid-key, prod-odoo-api-key, prod-meta-pixel-id, prod-gtm-id
- ADC (Application Default Credentials) en produccion — sin archivo JSON admin SDK en Cloud Run
- Archivo JSON Admin SDK solo en desarrollo local (.keys/ gitignored)
- apphosting.yaml y apphosting.staging.yaml requeridos en raiz
- Build diferenciado: `next dev --turbopack` para dev, `next build --webpack` para prod (Serwist requiere Webpack)
- CI/CD GitHub Actions: ESLint + Vitest + Playwright en cada PR, merge bloqueado si falla

#### Integracion Odoo (Arquitectura + Repo Estrategia)

- XML-RPC exclusivo (no REST) — metodos: search, read, create, write, search_read, search_count, fields_get, read_group, name_get, name_search
- Rate limit real: ~60 req/min (Odoo Online) — requiere cache agresivo y retry con backoff exponencial (1s → 2s → 4s, max 3 intentos)
- Bug Odoo 18: `read_group` requiere kwargs (no positional args)
- 719 modelos disponibles; MVP: product.product (1,545), res.partner (3,854), sale.order (12,214), account.move (10,154), crm.lead (30), event.event
- Paginacion obligatoria para datasets >100 registros
- Proxy en Route Handlers `/api/odoo/*` — ubicacion canonical: `lib/odoo/client.ts`
- Interfaz OdooClient anti vendor-lock obligatoria
- Solo 5 usuarios activos en Odoo — agentes (~47) NO tienen cuenta Odoo, operan via cuentas compartidas
- 5/5 seats ocupados ($274 MXN/mes por seat adicional) — agentes NUNCA tendran cuenta Odoo
- Mapeo agente PWA ↔ Odoo vendor requiere tabla propia en Firestore
- 7 templates WhatsApp ya aprobados por Meta (ready to fire desde PWA)
- Anomalias conocidas: 1,002 ordenes a "CONOCIDO", 198 sin vendedor, 96 sin facturar, 480 parcialmente pagadas, 31 pares duplicados
- Stages CRM no capturadas aun — requiere sesion con Noel
- Codificacion UTF-8 con emojis/zero-width spaces en datos Odoo

#### Data Architecture (Arquitectura)

- Firestore hibrido: flat collections compartidas + subcollections per-agent
- Montos en centavos (integer): amountCents: 14500000 = $145,000 MXN — NUNCA floating point
- Fechas como Firestore Timestamp nativo — NUNCA new Date() ni ISO string en writes
- Campos Odoo con prefijo `odoo`: odooWriteDate, odooAmountTotal, odooOrderId
- Cache TTL por modelo: viajes 24h, contactos 1h, pedidos 15min, facturas 1h, KPIs 5min
- Offline persistence habilitada en Firestore
- IndexedDB como cola de acciones offline
- Background Sync API para Android; window.addEventListener('online') fallback iOS
- Sync bidireccional: write-through App→Odoo, Cloud Scheduler polling 15-30min Odoo→Firestore
- Conflictos: last-write-wins con timestamp

#### Security (Arquitectura)

- RBAC granular con custom claims en JWT: roles: string[] + agentId?: string
- Permisos granulares en Firestore (/config/permissions/{role}) — separados de claims, cache middleware TTL 5min
- Firestore Security Rules: request.auth.token.agentId == agentId (aislamiento agente)
- Firebase App Check con reCAPTCHA Enterprise
- Rate limiting en rutas auth (gap identificado — implementar en primer sprint payments)
- proxy.ts verifica Firebase ID token en CADA request protegido
- Route Handlers con verificacion adicional: requireRole(), requirePermission()
- CSP headers en next.config.ts
- Odoo NUNCA expuesto al cliente

#### API & Communication (Arquitectura)

- 8 boundaries API definidos: /api/auth/*, /api/odoo/*, /api/payments/*, /api/payments/ocr, /api/notifications/*, /api/contracts/*, /api/analytics/*, /api/sync/*
- Formato respuesta: datos directamente en JSON (sin wrapper), AppError para errores, paginacion { data, pagination }
- DomainEvents NotificationService: payment.reported, payment.verified, payment.rejected, client.created, agent.inactive, kpi.exception

#### Patrones de Implementacion (Arquitectura)

- Feature-adjacent organization (NO feature-grouped) — PROHIBIDO src/features/
- Tests co-locados con archivo fuente — PROHIBIDO __tests__/ separado
- E2E en carpeta e2e/ en raiz
- 28 naming conventions son LEY (camelCase Firestore, PascalCase componentes, UPPER_SNAKE_CASE constantes, etc.)
- PROHIBIDO barrel exports (index.ts que re-exporta)
- Rendering: SSG+ISR publicas, CSR+onSnapshot dashboards, CSR+offline portales
- Server Components por default; 'use client' lo mas abajo posible
- Loading: SIEMPRE Skeleton con pulse, NUNCA Spinner generico
- Error boundaries por route group, NUNCA global unico
- Validacion triple: React Hook Form + Zod cliente, Zod servidor, Firestore Security Rules
- Schemas en src/schemas/ — PROHIBIDA validacion inline
- npx tsc --noEmit sin errores antes de considerar tarea completa

#### UX & Design System (UX Spec)

- 5 layouts master por rol: PublicLayout, AgentMobileLayout, AdminDesktopLayout, DirectorLayout, ClientLayout
- Tailwind CSS + shadcn/ui (Radix UI) — ~20 componentes base a instalar Fase 0A
- 9 custom components sobre shadcn/ui: EmotionalProgress, KPICard, PaymentStepper, VerificationPanel, BottomNavBar, RoleSidebar, TripCard, OfflineBanner, BusinessMetric
- Componentes 21st.dev para paginas publicas: Scroll Morph Hero, Clip Path Links, Floating Navbar, Footer 2, CTA Glow, etc.
- Framer Motion para animaciones funcionales con prefers-reduced-motion support
- Design tokens: primary #1B4332, accent #F4A261, background #FAFAF8, destructive #E76F51
- Tipografia: Inter (body), Poppins (headings), Roboto Mono (montos)
- WCAG 2.1 AA selectivo: contraste 4.5:1+, touch 44x44px+, keyboard nav admin
- Push notifications con deep link funcional obligatorio
- Toast system: 5 variantes con templates por accion critica
- Responsive: mobile-first, breakpoint lg (1024px) para transicion bottom-nav → sidebar
- Empty states con ilustracion + CTA, NUNCA "No hay datos"

#### Cloud Functions 2nd Gen (Arquitectura — agregado en validacion)

- Runtime: Node.js 20, region us-east4 (misma que App Hosting)
- 6 funciones planificadas para MVP:
  1. `aggregateAnalyticsEvent` — Firestore trigger `onWrite` en `/analytics/events/` → incrementa contadores en `/analytics/daily/`, `/analytics/agents/`, `/analytics/traffic/`
  2. `materializeKPIs` — scheduled cada hora → agrega pagos/ordenes en `/kpis/{period}`
  3. `directorNightlySummary` — scheduled 10pm Madrid (cron: `0 22 * * *`)
  4. `adminMorningSummary` — scheduled 8am Mexico (cron: `0 8 * * *`)
  5. `agentWeeklySummary` — scheduled lunes 9am Mexico (cron: `0 9 * * 1`)
  6. `processNotificationQueue` — Firestore trigger `onWrite` en `/events/` → despacha via NotificationService (Epic 6)
- Todas incluidas en Blaze plan (free tier: 2M invocaciones/mes, 400K GB-sec)
- Domain events escritos antes de Epic 6: quedan en Firestore `/events/` sin despachar hasta que Cloud Function 6 este activa

#### Custom Analytics (Arquitectura — agregado en validacion)

- Alternativa a BigQuery para evitar costos adicionales
- Cada accion de usuario escribe evento ligero a `/analytics/events/{eventId}`: type, timestamp, channel, agentRef, userId, metadata
- Cloud Function `aggregateAnalyticsEvent` materializa agregados en tiempo real
- Director Dashboard lee de Firestore (no de BigQuery) via `onSnapshot`
- Firebase Analytics sigue activo en paralelo para GA4/Meta Pixel/GTM (gratis, reportes de Google)
- Beneficio: cero costo adicional, control total del modelo de datos, queries instantaneas

#### Modelo de Comisiones (Odoo Audit — agregado en validacion)

- Odoo tiene modelo Studio `x_comisiones` pero con 0 registros — nunca usado
- Agentes mapeados como `crm.team` en Odoo (~30 equipos, solo ~15 con ordenes atribuidas)
- `sale_margin` NO instalado — sin calculo automatico de margenes
- **Decision**: comisiones se calculan en Firestore, no se jalan de Odoo
- Coleccion: `/agents/{agentId}/commissions/{commissionId}`
- Calculo: commissionAmountCents = order.amountTotal * agent.commissionRate
- Ordenes de Odoo se mapean via `sale.order.team_id` → `agentId` en tabla de equivalencias Firestore
- Admin aprueba comisiones antes de que agente vea status "paid"

#### Monitoreo (Arquitectura)

- Firebase Performance Monitoring (Web Vitals)
- Firebase Crashlytics (errores client-side)
- Cloud Logging automatico via Cloud Run
- Codigos error estandarizados: AUTH_*, PAYMENT_*, ODOO_*, NOTIFICATION_*, UPLOAD_*
- Monitoring avanzado (Sentry, DataDog) DIFERIDO post-MVP

### FR Coverage Map

| FR | Epic | Descripcion |
|----|------|-------------|
| FR1 | Epic 1 | Registro email/Google |
| FR2 | Epic 1 | Rol Cliente base |
| FR3 | Epic 1 | SuperAdmin asigna roles |
| FR4 | Epic 1 | Desactivar usuario |
| FR5 | Epic 1 | Sync usuarios Odoo |
| FR6 | Epic 1 | Permisos read-only |
| FR7 | Epic 1 | Aislamiento datos por rol |
| FR8 | Epic 1 | Editar perfil + datos fiscales |
| FR9 | Epic 1 | Preferencias notificacion |
| FR10 | Epic 1 + Epic 2 | Paginas publicas (1.2 home + VaM, 2.2 catalogo, 2.3 landing individual) |
| FR11 | Epic 2 | Landing viaje completa |
| FR12 | Epic 2 | Solicitar cotizacion |
| FR13 | Epic 2 | Captura atribucion UTM/ref |
| FR14 | Epic 2 | Autoasignacion agente por ref |
| FR15 | Epic 2 | Notificacion lead sin agente |
| FR16 | Epic 2 | CRUD viajes admin + Odoo sync |
| FR17 | Epic 2 | Fechas salida con capacidad |
| FR18 | Epic 2 | Contenido rico Firestore |
| FR19 | Epic 2 | Catalogo con filtros |
| FR20 | Epic 2 | Catalogo agente + link |
| FR21 | Epic 3 | Reportar pago con foto |
| FR22 | Epic 3 | IA OCR comprobante |
| FR23 | Epic 3 | Confirmar/corregir datos IA |
| FR24 | Epic 3 | Agente reporta por cliente |
| FR25 | Epic 3 | Admin reporta proxy |
| FR26 | Epic 3 | Cola verificacion admin |
| FR27 | Epic 3 | Verificar pago |
| FR28 | Epic 3 | Rechazar pago |
| FR29 | Epic 3 | Deteccion duplicados |
| FR30 | Epic 3 | Plan de pagos |
| FR31 | Epic 3 | Historial pagos cliente |
| FR32 | Epic 4 | Lista clientes agente |
| FR33 | Epic 4 | Detalle cliente |
| FR34 | Epic 4 | Comisiones acumuladas |
| FR35 | Epic 4 | Resumen cartera |
| FR36 | Epic 4 | Link personalizado |
| FR37 | Epic 4 + Epic 6 | Notificacion lead autoasignado (badge en Epic 4, push en Epic 6) |
| FR38 | Epic 5 | Dashboard KPIs ejecutivo |
| FR39 | Epic 5 | Dimensiones temporales |
| FR40 | Epic 5 | Drill-down |
| FR41 | Epic 5 | Widget trafico |
| FR42 | Epic 5 | Widget performance agentes |
| FR43 | Epic 5 | Cobranza pendiente |
| FR44 | Epic 5 | Metricas adopcion |
| FR45 | Epic 6 | Despacho multi-canal |
| FR46 | Epic 6 | Deep links notificacion |
| FR47 | Epic 6 | Resumenes programados |
| FR48 | Epic 6 | Alertas excepcion |
| FR49 | Epic 6 | Agrupacion inteligente |
| FR50 | Epic 6 | Preferencias notificacion |
| FR51 | Epic 7 | Ver todos sus viajes |
| FR52 | Epic 7 | Progreso visual pagos |
| FR53 | Epic 7 | Descargar documentos |
| FR54 | Epic 7 | Subir fotos |
| FR55 | Epic 7 | Escribir resenia |
| FR56 | Epic 7 | Toggle fotos publicas |
| FR57 | Epic 7 | Moderacion admin |
| FR58 | Epic 7 | ShareCard redes |
| FR59 | Epic 2 | Eventos conversion Analytics |
| FR60 | Epic 2 | Captura UTM + ref |
| FR61 | Epic 2 | Meta Pixel + Google Tag |
| FR62 | Epic 6 | Push click-through rate |
| FR63 | Epic 5 | Dashboard atribucion |
| FR64 | Epic 1 | Lectura Odoo XML-RPC |
| FR65 | Epic 3 | Escritura Odoo (pagos) |
| FR66 | Epic 2 | Sync catalogo viajes |
| FR67 | Epic 1 | Capa abstraccion Odoo |
| FR68 | Epic 1 | Modo degradado Odoo |

**68/68 FRs cubiertos.** FR10 cubierto por Stories 1.2 + 2.2 + 2.3. FR37 parcial en Epic 4 (badge) + Epic 6 (push).

**Total: 7 Epics, 35 Stories** (was 29 — split oversized stories + added Cloud Function stories)

## Epic List

### Epic 1: Foundation & User Identity
Plataforma desplegada y funcionando. Usuarios pueden registrarse, hacer login, gestionar perfiles. SuperAdmin administra usuarios y roles. Conexion Odoo establecida con capa de abstraccion y modo degradado. Paginas publicas con branding real mostrables desde dia 1.
**FRs cubiertos:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10 (parcial), FR64, FR67, FR68
**Stories:** 9 (1.1a Scaffold+CI, 1.1b Design System+Layouts, 1.2 Public Pages, 1.3 Auth, 1.4a Role Model+Claims, 1.4b Route Protection+Security Rules, 1.5 Odoo Client, 1.6 SuperAdmin, 1.7 Profile)

### Epic 2: Trip Discovery & Public Content
Visitantes descubren viajes, navegan catalogo con landings ricas, solicitan cotizaciones. Atribucion capturada desde el primer click. Viajes sincronizados desde Odoo. Analytics fluyendo en Firebase, Meta Pixel y Google Tag.
**FRs cubiertos:** FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR59, FR60, FR61, FR66
**Stories:** 7 (2.1a Trip Sync Odoo, 2.1b Admin Trip CRUD, 2.2 Catalog+Filters, 2.3 Trip Landing, 2.4 Conversion Flow+Order State Machine, 2.5 Attribution+Lead Routing, 2.6 Analytics Tracking)

### Epic 3: Payment Flow & Verification
Ciclo de vida completo de pagos: agente/cliente reporta con foto, IA extrae datos del comprobante, admin verifica contra movimiento bancario, estado se actualiza en Firestore y Odoo.
**FRs cubiertos:** FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR65
**Stories:** 4 (3.1 Report+OCR, 3.2 Agent/Admin Proxy, 3.3 Verification Queue, 3.4 Payment Plan+History)

### Epic 4: Agent Business Portal
Agentes ven SUS clientes asignados, comisiones acumuladas, metricas de cartera. Generan links de referido por viaje. Reciben notificaciones de nuevos leads autoasignados.
**FRs cubiertos:** FR32, FR33, FR34, FR35, FR36, FR37
**Stories:** 3 (4.1 Client List+Detail, 4.2 Commissions+Metrics, 4.3 Referral Links+Lead Notifications)

### Epic 5: Director Dashboard & BI
Director tiene visibilidad ejecutiva en tiempo real: KPIs de ventas, cobranza, ocupacion, ranking agentes, fuentes de trafico, adopcion de plataforma. Drill-down hasta orden individual.
**FRs cubiertos:** FR38, FR39, FR40, FR41, FR42, FR43, FR44, FR63
**Stories:** 4 (5.1 Dashboard+KPIs, 5.2 Traffic+Agent Performance, 5.3 Pending Collections, 5.4 Analytics Cloud Functions)

### Epic 6: Notification System
Notificaciones automaticas multi-canal (push FCM, WhatsApp Odoo, email) con deep links funcionales, resumenes programados, alertas por excepcion, agrupacion inteligente y preferencias configurables.
**FRs cubiertos:** FR45, FR46, FR47, FR48, FR49, FR50, FR62
**Stories:** 5 (6.1a NotificationService Core+Push, 6.1b Notification Center UI+CTR, 6.2 Multi-Channel+Grouping, 6.3 Scheduled Summaries+Alerts, 6.4 Notification Cloud Functions)

### Epic 7: Client Experience & UGC
Clientes ven sus viajes (pasados/activo/futuro), progresan emocionalmente con pagos, descargan documentos, suben fotos, escriben resenias, comparten en redes sociales con link de atribucion.
**FRs cubiertos:** FR51, FR52, FR53, FR54, FR55, FR56, FR57, FR58
**Stories:** 3 (7.1 My Trips+Emotional Progress, 7.2 Documents+Photos, 7.3 Reviews+Social Sharing)

---

## Epic 1: Foundation & User Identity

Plataforma desplegada y funcionando. Paginas publicas con branding real mostrables desde dia 1. Usuarios pueden registrarse, hacer login, gestionar perfiles. SuperAdmin administra usuarios y roles. Conexion Odoo establecida con capa de abstraccion y modo degradado.

**Total Stories:** 9 (1.1a, 1.1b, 1.2, 1.3, 1.4a, 1.4b, 1.5, 1.6, 1.7)

### Story 1.1a: Project Scaffold & CI Pipeline

As a **developer**,
I want the project scaffolded with the correct tech stack and deployment pipeline,
So that all subsequent features can be built on a production-ready foundation.

**Acceptance Criteria:**

**Given** the project repository has no source code
**When** the scaffold is created
**Then** Next.js App Router project exists with TypeScript, Tailwind CSS, ESLint, src/ directory, and pnpm
**And** Serwist is configured for PWA with single service worker at scope `/`
**And** Firebase SDK is installed and configured for development (emulator connection)
**And** apphosting.yaml and apphosting.staging.yaml exist at project root
**And** GitHub Actions CI pipeline runs ESLint + TypeScript check on every PR
**And** project directory structure matches architecture specification
**And** `pnpm dev` starts without errors using Turbopack
**And** `pnpm build` succeeds using Webpack (Serwist requirement)
**And** first deploy to Firebase App Hosting succeeds with a placeholder page

### Story 1.1b: Design System & Layout Foundation

As a **developer**,
I want the design system and role-based layouts configured,
So that all UI work uses consistent tokens, typography, and layout structures.

**Dependencies:** Story 1.1a

**Acceptance Criteria:**

**Given** the scaffold from Story 1.1a exists
**When** the design system is initialized
**Then** shadcn/ui is initialized with AroundaPlanet design tokens (primary #1B4332, accent #F4A261, background #FAFAF8, destructive #E76F51)
**And** typography is configured: Inter (body), Poppins (headings), Roboto Mono (montos)
**And** 5 layout shells exist: PublicLayout, AgentMobileLayout, AdminDesktopLayout, DirectorLayout, ClientLayout + AuthLayout
**And** each layout shell renders a placeholder page with the correct navigation pattern (BottomNavBar mobile, RoleSidebar desktop)
**And** responsive breakpoints use Tailwind defaults: sm 640px, md 768px, lg 1024px, xl 1280px
**And** Framer Motion is installed with `prefers-reduced-motion` support configured
**And** all layouts are responsive: mobile 375px → tablet 768px → desktop 1024px+

### Story 1.2: Public Landing Pages con Branding Real

As a **visitante**,
I want to see professional, branded public pages with real images and trip information,
So that I trust the brand and want to explore trip options.

**Acceptance Criteria:**

**Given** a visitor navigates to the home page
**When** the page loads
**Then** they see a hero section with real group travel photos (Scroll Morph Hero or equivalent) (FR10)
**And** the AroundaPlanet logo is visible in the Floating Navbar
**And** design tokens are applied: primary #1B4332, accent #F4A261, background #FAFAF8
**And** typography uses Inter (body), Poppins (headings), Roboto Mono (montos)
**And** page renders as SSG with LCP <2.5s (NFR1)

**Given** the home page is loaded
**When** the visitor scrolls
**Then** they see a carousel/grid of trip destinations with real product images from the catalog
**And** they see a section "Sobre Nosotros" with team photo and CEO portrait
**And** they see a CTA section with Clip Path Links or CTA Glow component
**And** they see a footer with contact info and social links (Footer 2 component)

**Given** a visitor navigates to the "Vuelta al Mundo" landing page
**When** the page loads
**Then** they see the trip hero image, itinerario placeholder, precio ($145,000 MXN en Roboto Mono), and CTA "Cotizar"
**And** the page uses the PublicLayout with responsive behavior (mobile stack → desktop 3-col grid)

**Given** real assets need to be in the project
**When** the scaffold includes assets
**Then** logo, hero images, carousel images, and select product images are copied from the strategy repo (`execution/web-audit/assets/`) to `public/images/`
**And** images use Next.js `<Image>` with `sizes` prop and WebP format
**And** all public pages are responsive: mobile 375px → tablet 768px → desktop 1024px+

**Given** analytics are required from day 1
**When** any public page loads
**Then** Firebase Analytics is initialized
**And** Meta Pixel base code fires
**And** Google Tag Manager container is loaded (FR59, FR61)

### Story 1.3: Firebase Authentication & User Registration

As a **visitante anonimo**,
I want to create an account with email or Google sign-in from any public page,
So that I can access the platform's authenticated features.

**Acceptance Criteria:**

**Given** a visitor is on any public page
**When** they click "Registrarse" or "Iniciar Sesion"
**Then** they see the AuthLayout with login/register form
**And** they can register with email + password
**And** they can register/login with Google Sign-In (one tap)
**And** upon registration, a Firestore document is created in `/users/{uid}` with role Cliente (base) (FR1, FR2)
**And** Firebase ID token is set and proxy.ts allows access to protected routes
**And** session persists for 14 days of inactivity (NFR11)
**And** auth pages render as SSG static
**And** touch targets are minimum 44x44px (NFR31)

**Given** a user is already logged in
**When** they visit a login page
**Then** they are redirected to their role-appropriate dashboard

**Given** an unauthenticated user tries to access a protected route
**When** proxy.ts intercepts the request
**Then** they are redirected to login with return URL preserved for post-login redirect

### Story 1.4a: Role Model & Custom Claims

As a **SuperAdmin**,
I want an additive role system with granular permissions defined in Firestore,
So that each user has the correct roles and the system can enforce access control.

**Acceptance Criteria:**

**Given** the role system is implemented
**When** a user registers
**Then** they have role Cliente as base, always present regardless of additional roles (FR2)

**Given** permissions are configured
**When** the system initializes
**Then** Firestore collection `/config/permissions/{role}` exists with granular permissions per role (FR6)
**And** custom claims in JWT contain `roles: string[]` and optional `agentId: string`
**And** a Cloud Function or admin endpoint sets custom claims when roles change
**And** permissions cache has TTL 5min

**Given** a user has multiple roles (e.g., Cliente + Agente)
**When** they log in
**Then** they see navigation options for all their active roles with correct scoping (FR2)

### Story 1.4b: Route Protection & Security Rules

As a **system**,
I want every protected route and data access validated at multiple layers,
So that data isolation is guaranteed and no unauthorized access is possible.

**Dependencies:** Story 1.4a

**Acceptance Criteria:**

**Given** custom claims are set from Story 1.4a
**When** a protected request is made
**Then** proxy.ts validates Firebase ID token on every protected request
**And** Route Handlers include `requireRole()` and `requirePermission()` functions
**And** Firestore Security Rules enforce `request.auth.token.agentId == agentId` for agent-scoped data (FR7)
**And** Firebase Storage Rules enforce uid-based folder structure (NFR15)

**Given** a user with role Agente
**When** they attempt to access data of another agent
**Then** the request is denied at Firestore Security Rules AND server-side validation (NFR10)

**Given** an unauthenticated request hits any protected API route
**When** the request is processed
**Then** it returns 401 with standardized `AUTH_*` error code

### Story 1.5: Odoo Client Abstraction Layer

As a **system administrator**,
I want a reliable, abstracted connection to Odoo via XML-RPC,
So that business data flows between platforms without vendor lock-in and with graceful degradation.

**Acceptance Criteria:**

**Given** OdooClient is implemented in `lib/odoo/client.ts`
**When** the application needs Odoo data
**Then** it uses the OdooClient interface: search, read, create, write, searchRead methods (FR64, FR67)
**And** XML-RPC calls go through Route Handlers `/api/odoo/*` — never client-side (NFR14)
**And** auth and authorization are validated on every request
**And** rate limiting respects ~60 req/min with retry backoff exponencial (1s → 2s → 4s, max 3 retries)
**And** `read_group` uses kwargs (not positional args) for Odoo 18 compatibility
**And** pagination is implemented for datasets >100 records
**And** all amounts stored as integer centavos (amountCents) — never floating point
**And** all dates stored as Firestore Timestamp — never `new Date()` or ISO strings
**And** Odoo-synced fields use prefix `odoo`: odooWriteDate, odooAmountTotal, odooOrderId
**And** error codes use standardized `ODOO_*` pattern

**Given** Odoo is available
**When** data is read
**Then** results are cached in Firestore with model-specific TTL (viajes 24h, contactos 1h, pedidos 15min, facturas 1h, KPIs 5min)

**Given** Odoo does not respond within 5 seconds
**When** any Odoo-dependent feature is accessed
**Then** cached Firestore data is shown with visual indicator "Datos de hace X horas" (FR68, NFR21)
**And** the error is logged and the rest of the app continues operating (NFR29)

### Story 1.6: SuperAdmin Panel & User Management

As a **SuperAdmin**,
I want to manage all users from a dedicated panel,
So that I can assign roles, sync users from Odoo, and maintain the team.

**Acceptance Criteria:**

**Given** a SuperAdmin is logged in
**When** they navigate to the SuperAdmin panel
**Then** they see a list of all users with name, email, roles, status (active/inactive)
**And** they can assign additional roles (Agente, Admin, Director, SuperAdmin) to any user (FR3)
**And** they can configure read-only permissions for specific roles (FR6)
**And** role changes update custom claims in JWT and permissions in Firestore

**Given** a SuperAdmin triggers "Sincronizar desde Odoo"
**When** the sync runs
**Then** the system reads `res.partner` from Odoo (NOTE: PRD says res.users + hr.employee, but agents are contacts in Odoo without login accounts — res.partner is the correct model for the ~100 agents) and creates/updates Firestore user records (FR5)
**And** the mapping agente PWA ↔ Odoo `crm.team` (each agent is a "Sales Team" in Odoo) is stored in Firestore (not dependent on Odoo user accounts — agents don't have Odoo seats)
**And** sync handles UTF-8 encoding with emojis/zero-width spaces in Odoo data

**Given** a SuperAdmin deactivates a user
**When** the deactivation is confirmed
**Then** the user cannot log in but their data and history are preserved (FR4)
**And** the action is recorded in audit trail (NFR13)
**And** active sessions can be revoked immediately (NFR11)

### Story 1.7: User Profile & Notification Preferences

As a **usuario autenticado**,
I want to edit my profile and configure notification preferences,
So that my information is complete and I receive only relevant communications.

**Acceptance Criteria:**

**Given** a user is logged in
**When** they navigate to their profile
**Then** they see collapsible sections: Datos Personales, Datos Fiscales, Datos Bancarios (agents only)
**And** they can edit: photo, name, phone, email (FR8)
**And** they can edit fiscal data: RFC, razon social, regimen fiscal, domicilio fiscal, uso CFDI (FR8)
**And** agents can edit bank account details (FR8)
**And** each section saves independently with auto-save
**And** sensitive data shows lock icon + "Solo tu ves estos datos"
**And** profile photo uploads to Firebase Storage under `/users/{uid}/profile/`

**Given** a user accesses notification preferences
**When** they configure preferences
**Then** they see categories available for their role (FR9)
**And** they can toggle on/off each category
**And** they can configure quiet hours (default 11pm-7am)
**And** preferences are stored in `/users/{uid}/preferences`

**Given** profile data is submitted
**When** validation runs
**Then** React Hook Form + Zod validates client-side, Zod validates server-side, Firestore Security Rules enforce write permissions (triple validation)

## Epic 2: Trip Discovery & Public Content

Visitantes descubren viajes, navegan catalogo con landings ricas, solicitan cotizaciones. Atribucion capturada desde el primer click. Viajes sincronizados desde Odoo. Analytics fluyendo.

### Story 2.1a: Trip Sync Odoo → Firestore

As a **system**,
I want trips automatically synchronized from Odoo to Firestore,
So that the trip catalog stays current with operational data.

**Dependencies:** Story 1.5 (Odoo Client)

**Acceptance Criteria:**

**Given** the Odoo client from Story 1.5 is available
**When** a sync is triggered (manual from SuperAdmin panel or scheduled polling every 24h)
**Then** `product.template` records from Odoo are synced to Firestore `/trips/{tripId}` (FR66)
**And** each trip document includes Odoo operational data (odooProductId, odooAmountTotal, odooWriteDate) and cache timestamp
**And** pagination handles the 1,545 products in batches of 100

**Given** a trip is synced from Odoo
**When** Odoo data changes
**Then** next sync cycle updates Firestore with only changed records (incremental sync by `odooWriteDate` timestamp)
**And** Firestore content (photos, copy, SEO) is NOT overwritten by Odoo sync (independent fields)

**Given** departure dates exist in Odoo Events
**When** a trip syncs
**Then** `event.event` records are synced to `/trips/{tripId}/departures/{departureId}` with capacity per date (FR17)

### Story 2.1b: Admin Trip CRUD & Document Uploads

As an **Admin/SuperAdmin**,
I want to manage trips from the platform with rich content and documents,
So that the catalog is complete and clients have access to trip materials.

**Dependencies:** Story 2.1a (trip data exists in Firestore)

**Acceptance Criteria:**

**Given** an Admin is logged in
**When** they navigate to trip management
**Then** they can create, edit, publish, and unpublish trips (FR16)
**And** they can add rich content in Firestore: hero photos, marketing copy, SEO meta, URL slug (FR18)
**And** they can upload trip documents (contracts, itineraries, vouchers as PDF) to Firebase Storage under `/trips/{tripId}/documents/` — these are the documents clients download in Story 7.2 (FR53)
**And** they can configure multiple departure dates with individual capacity per date via Odoo Events (FR17)
**And** published trips appear in the public catalog, unpublished do not
**And** the RoleSidebar (admin) includes "Viajes" section linking to trip management

### Story 2.2: Public Trip Catalog with Filters

As a **visitante**,
I want to browse all available trips with filters,
So that I can find the perfect trip for my interests and budget.

**Acceptance Criteria:**

**Given** a visitor navigates to the trip catalog page
**When** the page loads
**Then** they see a grid of TripCard components with real product images, title, price (Roboto Mono), and next departure date (FR19)
**And** the page renders as SSG with ISR `revalidate: 3600` for SEO (NFR1, NFR18)
**And** the grid is responsive: 1 col mobile, 2 cols tablet, 3 cols desktop
**And** the Floating Navbar includes "Viajes" link to this page

**Given** the catalog is displayed
**When** the visitor applies filters
**Then** they can filter by destination, price range, departure month using inline chip filters (real-time, no "Aplicar" button)
**And** active filters show as chips with X to deselect
**And** filtered results update without page reload

**Given** a trip is sold out
**When** it appears in the catalog
**Then** the TripCard shows "Agotado" badge and CTA is disabled

### Story 2.3: Trip Landing Page (Dynamic)

As a **visitante**,
I want to see a rich, detailed landing page for each trip,
So that I have all the information I need to decide on a trip.

**Acceptance Criteria:**

**Given** a visitor navigates to `/viajes/{slug}`
**When** the landing page loads
**Then** they see hero gallery (professional photos + UGC when available), itinerary, price, available departure dates with occupancy, and traveler testimonials (FR11)
**And** the page renders as SSG with ISR for SEO performance
**And** departure dates show real-time capacity from Odoo Events (FR17)
**And** price is displayed in Roboto Mono format ($145,000 MXN)

**Given** the landing page is loaded
**When** the visitor scrolls
**Then** they see a sticky CTA "Cotizar" / "Apartar Lugar" on mobile
**And** the page is responsive with PublicLayout behavior

**Given** no reviews or UGC exist yet for a trip
**When** the testimonials section renders
**Then** it shows an empty state with illustration + "Se el primero en compartir tu experiencia" + CTA to register (NEVER "No hay datos")

**Given** a visitor arrives via agent ref link (`?ref=agentId`)
**When** the landing loads
**Then** the ref parameter is captured and stored in session/localStorage for later attribution (FR13)

### Story 2.4: Conversion Flow (Quote / Reserve)

As a **visitante**,
I want to request a quote or reserve a spot on a trip,
So that I can start my booking process.

**Acceptance Criteria:**

**Given** a visitor clicks "Cotizar" or "Apartar Lugar" on a trip landing
**When** the conversion form opens
**Then** they select a departure date from available options (FR12)
**And** they see the price and basic trip summary
**And** if not logged in, they are prompted to register/login (redirects back after auth)
**And** upon submission, an order is created in Firestore with status "Interesado"

**Given** an order is created
**When** the system processes it
**Then** the order is stored in Firestore at `/orders/{orderId}` (canonical collection path for ALL orders in the system)
**And** the order document includes: userId, agentId (if assigned), tripId, departureId, status, amountTotalCents, amountPaidCents, createdAt, updatedAt
**And** a `view_trip` event fires in Firebase Analytics (FR59)
**And** a `begin_checkout` event fires on form open (FR59)
**And** equivalent events fire on Meta Pixel and Google Tag Manager (FR61)

**Order State Machine (contrato central del sistema):**
- `Interesado` → orden recien creada desde cotizacion/reserva
- `Confirmado` → al menos un pago verificado por admin
- `En Progreso` → viaje activo (fecha salida alcanzada)
- `Completado` → viaje terminado
- `Cancelado` → orden cancelada por admin o cliente
- Transiciones validas: Interesado→Confirmado, Interesado→Cancelado, Confirmado→En Progreso (automatico por fecha), En Progreso→Completado (automatico por fecha), Confirmado→Cancelado
- Status se actualiza via Firestore Security Rules que validan transiciones permitidas
- Cada cambio de status genera un domain event para el sistema de notificaciones (Epic 6)

**Given** the visitor registered during this flow
**When** their account is created
**Then** UTM parameters and agent ref from their session are permanently associated to their account (FR60)

### Story 2.5: Agent Attribution & Lead Routing

As an **agente**,
I want visitors who arrive via my referral link to be automatically assigned to me,
So that I receive credit for leads I generate.

**Acceptance Criteria:**

**Given** a visitor arrives with `?ref=agentId` parameter
**When** they create an account
**Then** they are automatically assigned to that agent (first-touch attribution) (FR14)
**And** the agent's `agentId` is stored in the user's Firestore document
**And** the agent receives a data event for the new lead (notification dispatch in Epic 6, data recorded here)

**Given** a visitor arrives WITHOUT a ref parameter
**When** they create an account and submit a quote request
**Then** a notification is sent to admin for manual assignment or round-robin (FR15)
**And** the lead appears in admin's unassigned leads queue

**Given** an agent is logged in
**When** they navigate to the trip catalog
**Then** they see the same catalog as visitors PLUS a "Copiar Mi Link" button per trip (FR20)
**And** the copied link includes `?ref={agentId}` parameter
**And** BottomNavBar (agent) includes navigation to catalog view

### Story 2.6: Analytics & Attribution Tracking

**Dependencies:** Story 1.2 (public pages must exist to track)

As a **director/admin**,
I want all visitor interactions tracked with proper attribution,
So that we can measure marketing effectiveness and agent performance.

**Acceptance Criteria:**

**Given** any public page loads
**When** the page renders
**Then** Firebase Analytics captures the pageview with UTM parameters if present (FR59, FR60)
**And** Meta Pixel fires corresponding event (FR61)
**And** Google Tag Manager container processes the event (FR61)

**Given** a conversion event occurs (view_trip, sign_up, begin_checkout, purchase)
**When** the event fires
**Then** all three analytics platforms receive the event simultaneously (FR59, FR61)
**And** the event includes attribution data: UTM source/medium/campaign, agent ref if present

**Given** UTM or ref parameters are present in the URL
**When** the visitor navigates within the site
**Then** attribution data persists in session storage across page navigations
**And** upon account creation, attribution is permanently stored in `/users/{uid}` document (FR60)

## Epic 3: Payment Flow & Verification

Ciclo de vida completo de pagos: reporte con foto, OCR con IA, verificacion admin, write-back a Odoo.

### Story 3.1: Payment Report Flow (Upload + OCR + Confirm)

As an **agente o cliente**,
I want to report a payment by uploading a receipt photo and have AI extract the data,
So that the process is fast and I don't have to type everything manually.

**Acceptance Criteria:**

**Given** a user (agente or cliente) navigates to "Reportar Pago"
**When** the payment report screen loads
**Then** the BottomNavBar (agent/client) highlights the active section
**And** RoleSidebar (admin/desktop) includes "Pagos" in the navigation
**And** the FAB "Reportar Pago" is visible on agent/client dashboards (only primary FAB on screen)

**Given** the user taps the FAB or navigates to report payment
**When** the fullscreen mobile flow opens
**Then** they can take a photo or select from gallery of a bank receipt (FR21)
**And** the photo uploads to Firebase Storage under `/receipts/{agentId}/{paymentId}` (NFR12)
**And** upload shows progress indicator and handles errors with toast "No pudimos subir la imagen — intenta de nuevo" + "Reintentar"

**Given** the photo is uploaded
**When** Firebase AI Logic (gemini-2.5-flash-lite) processes the image
**Then** it extracts: monto, fecha, referencia bancaria, banco (FR22)
**And** extracted fields are pre-filled in the form with confidence indicators (green/yellow) (FR23)
**And** the user can tap any field to edit inline with 1 tap
**And** the complete flow (photo → IA → confirm → submit) takes <30s (NFR3)

**Given** the user confirms the data
**When** they tap "Confirmar y Enviar"
**Then** the payment is created in Firestore with status "Pendiente Verificacion"
**And** a success toast appears: "Pago reportado — en cola de verificacion"
**And** a `payment.reported` domain event is recorded for the notification system
**And** a `purchase` analytics event fires (FR59)

**Given** AI extraction fails or is unavailable
**When** the OCR endpoint returns an error
**Then** the form falls back to manual entry (all fields empty, no AI) (NFR24)
**And** the flow is never blocked — user can always report manually

### Story 3.2: Agent & Admin Payment Proxy

As an **agente**,
I want to report payments on behalf of my assigned clients,
So that I can help clients who aren't tech-savvy complete their payments.

As an **admin**,
I want to report payments on behalf of any agent or client,
So that I can process payments received through other channels.

**Acceptance Criteria:**

**Given** an agent opens the payment report flow
**When** they start the report
**Then** they see a client selector (Combobox) pre-filtered to only THEIR assigned clients (FR24)
**And** the last-selected client appears as suggestion
**And** the selector reads from `/agents/{agentId}/clients/` subcollection (NOTE: this collection is created in Story 4.1 — if Epic 3 ships before Epic 4, the agent proxy flow reads directly from `/orders/` filtered by agentId as interim solution)

**Given** an admin opens the payment report flow
**When** they start the report
**Then** they see a selector for any agent, then any client of that agent (FR25)
**And** the payment is attributed to the selected agent and client
**And** admin's proxy action is recorded in the payment metadata

**Given** a proxy payment is submitted
**When** the payment enters the verification queue
**Then** it shows who reported it (proxy) and on behalf of whom
**And** the payment follows the same verification flow as direct payments
**And** navigation returns the user to their previous context after submission

### Story 3.3: Admin Verification Queue & Actions

As an **admin (Mariana)**,
I want to see a prioritized queue of pending payments and verify or reject them efficiently,
So that payments are processed quickly and accurately.

**Acceptance Criteria:**

**Given** an admin is logged in
**When** they navigate to "Verificacion de Pagos"
**Then** the RoleSidebar highlights "Verificacion" in the admin section
**And** the BottomNavBar (mobile) includes a badge count of pending payments
**And** the queue loads in <2s (NFR4)
**And** payments are sorted by oldest first with urgency indicator for >48h pending (FR26)

**Given** the queue is displayed
**When** the admin views the queue
**Then** on desktop: VerificationPanel shows split-screen — receipt image (zoom/rotate) left, AI-extracted data + Odoo comparison right (FR26)
**And** on mobile: stacked view with swipeable receipt + data below
**And** keyboard shortcuts work on desktop: `V` verify, `R` reject, arrow-right next, arrow-left previous, arrow-up/arrow-down navigate queue

**Given** an admin verifies a payment
**When** they confirm the payment matches the bank movement
**Then** payment status updates to "Verificado" in Firestore (FR27)
**And** the payment is written to Odoo `account.move` via OdooClient (FR65)
**And** a `payment.verified` domain event is recorded
**And** a success toast appears: "Pago verificado — notificaciones enviadas" with "Siguiente" CTA
**And** focus moves to the next payment in queue

**Given** an admin rejects a payment
**When** they click reject
**Then** a Dialog opens requiring a rejection reason (destructive action requires confirmation) (FR28)
**And** payment status updates to "Rechazado" with the reason stored
**And** a `payment.rejected` domain event is recorded
**And** a warning toast appears: "Pago rechazado — [nombre] sera notificado"

**Given** the system detects a duplicate
**When** a payment has the same bank reference as an existing payment
**Then** a duplicate alert is shown to the admin with link to the original payment (FR29)
**And** the admin can proceed or dismiss the duplicate

### Story 3.4: Payment Plan, History & Status Tracking

As a **cliente**,
I want to see my payment plan and complete history,
So that I know exactly where I stand with my trip payments.

**Acceptance Criteria:**

**Given** a client is logged in and has an active trip
**When** they navigate to their trip detail
**Then** the BottomNavBar (client) includes "Mis Viajes" which leads to this view
**And** they see the payment plan: total amount, amount paid, amount pending, and suggested next payment amount/date (FR30)
**And** the PaymentStepper component shows the visual timeline of each payment's lifecycle
**And** each step shows status: completed (green check), current (orange pulse), rejected (coral X + reason), upcoming (grey)

**Given** a client wants to see their full history
**When** they navigate to payment history
**Then** they see all payments across all trips with status of each (FR31)
**And** each payment shows: amount, date reported, date verified/rejected, bank reference
**And** on mobile, each payment is a card with status badge; on desktop, a table row
**And** the view is accessible via BottomNavBar → "Mis Viajes" → trip detail → "Historial de Pagos"

**Given** a payment's status changes (verified or rejected)
**When** the client views their trip
**Then** the PaymentStepper updates in real-time via Firestore `onSnapshot`
**And** if rejected, the reason is visible and a CTA to re-submit appears

**Given** a client is offline
**When** they open their payment history
**Then** they see the last cached snapshot with OfflineBanner visible (NFR26)
**And** any pending payment reports are queued via Serwist Background Sync API (Android) or `window.addEventListener('online')` fallback (iOS) for sync when online — infrastructure from Serwist configured in Story 1.1

## Epic 4: Agent Business Portal

Agentes ven SUS clientes, comisiones, metricas de cartera. Generan links de referido. Reciben notificaciones de nuevos leads.

### Story 4.1: Agent Client List & Detail

As an **agente**,
I want to see all my assigned clients with their status and full details,
So that I can manage my portfolio and support my clients effectively.

**Acceptance Criteria:**

**Given** an agent is logged in
**When** they navigate to "Mi Negocio"
**Then** the BottomNavBar highlights "Negocio" tab (mobile) and RoleSidebar highlights "Mis Clientes" (desktop)
**And** they see a list of ONLY their assigned clients with name, trip, and payment status per client (FR32)
**And** the list is scoped by Firestore subcollection `/agents/{agentId}/clients/` — never shows other agents' clients (NFR10)
**And** on mobile: each client is a card (56px min-height, 1px border divider); on desktop: table rows
**And** the list loads from Firestore with offline persistence (NFR26)

**Given** an agent taps on a client
**When** the client detail opens
**Then** they see: client profile (name, phone, email), active trip with payment progress, and payment history (FR33)
**And** on mobile: Sheet slides up (85vh max) with handle bar; on desktop: side panel or full page
**And** the PaymentStepper shows the client's payment lifecycle
**And** a "Reportar Pago" button is available scoped to this client (links to Story 3.1 flow with client pre-selected)
**And** back navigation returns to the client list with scroll position preserved

**Given** an agent searches for a client
**When** they type in the search field
**Then** a Combobox filters their assigned clients by name (real-time, no "Buscar" button)
**And** only their scoped clients appear — never clients from other agents

### Story 4.2: Commissions & Business Metrics

As an **agente**,
I want to see my commissions and business summary,
So that I understand my earnings and can track my performance.

**Acceptance Criteria:**

**Given** an agent navigates to "Mi Negocio" dashboard
**When** the dashboard loads
**Then** the BottomNavBar "Negocio" tab shows this view as the default landing
**And** they see BusinessMetric components in a 2x2 grid (mobile) showing: total ventas, cantidad clientes, comision del periodo, and one highlight metric (FR35)
**And** amounts display in Roboto Mono format
**And** each metric shows comparativa vs periodo anterior (arrow + %)

**Given** an agent wants commission detail
**When** they tap on "Comisiones"
**Then** they see commissions accumulated by client and by trip (FR34)
**And** each row shows: client name, trip name, order total, commission amount, status (pending/paid)
**And** on mobile: cards with status badge; on desktop: table with sortable columns
**And** the view is accessible from BottomNavBar → "Negocio" → "Comisiones" tab or section

**Given** a commission is calculated
**When** a payment is verified (from Story 3.3)
**Then** a commission record is created in `/agents/{agentId}/commissions/{commissionId}` with fields: clientId, tripId, orderId, amountCents (integer), commissionRate (decimal), commissionAmountCents (integer), status (pending/approved/paid), period (YYYY-MM), createdAt
**And** `commissionAmountCents` = `order.amountTotalCents` * `agent.commissionRate`
**And** `commissionRate` is read from `/agents/{agentId}` document (configurable per-agent by SuperAdmin)
**And** all amounts are stored as integer centavos — NEVER floating point

**Given** sale orders sync from Odoo
**When** order attribution is determined
**Then** `sale.order.team_id` maps to `agentId` via equivalence table in `/config/odoo-agent-mapping`
**And** orders from Odoo generic "Sales" team (team_id without specific agent) are flagged for manual assignment

**Given** an admin reviews commissions
**When** they access the commission management view
**Then** they can adjust commission amounts before approval
**And** they can change status from "pending" to "approved" (agent can now see it) to "paid" (disbursed)
**And** agent NEVER sees "paid" status until admin explicitly approves

**NOTE — Odoo Audit Context:** Odoo `x_comisiones` model exists but has 0 records. Agents mapped as `crm.team` (~30 teams). `sale_margin` NOT installed. Commissions calculated 100% in Firestore.

**Given** an agent is offline
**When** they open their business dashboard
**Then** they see the last cached snapshot with OfflineBanner (NFR26)
**And** metrics display with timestamp of last sync

**Given** an agent views the dashboard in sunlight
**When** colors render
**Then** all text meets 4.5:1 contrast ratio (NFR30) and touch targets are 44x44px+ (NFR31)

### Story 4.3: Referral Links & Lead Notifications

As an **agente**,
I want to generate referral links for trips and know when new leads arrive,
So that I can actively promote trips and follow up on interested clients.

**Acceptance Criteria:**

**Given** an agent views the trip catalog (from Story 2.5)
**When** they see any trip
**Then** each TripCard (agent variant) shows a "Copiar Mi Link" button (FR36)
**And** tapping copies `https://aroundaplanet.com/viajes/{slug}?ref={agentId}` to clipboard
**And** a success toast appears: "Link copiado al portapapeles"
**And** the link is also accessible from "Mi Negocio" → "Mis Links" section

**Given** an agent wants to see all their referral links
**When** they navigate to "Mis Links" (within Mi Negocio)
**Then** they see a list of trips with their personalized link per trip and a copy button each
**And** this section is accessible from RoleSidebar (desktop) under "Mi Negocio" → "Links"
**And** from BottomNavBar (mobile) → "Negocio" → swipe/tab to "Links"

**Given** a new lead auto-assigns to the agent via their ref link
**When** the assignment occurs (from Story 2.5)
**Then** the agent's BottomNavBar "Alertas" tab shows a badge increment (FR37)
**And** the domain event `client.created` with agentId is recorded for push notification in Epic 6
**And** the new client appears at the top of "Mis Clientes" list immediately

**Given** an agent navigates between sections
**When** they move from Clientes → Comisiones → Links → Alertas
**Then** the BottomNavBar tabs transition with fade 200ms
**And** all sections are within the "Mi Negocio" scope with consistent back navigation
**And** no page exists without a clear path back to the main agent dashboard

## Epic 5: Director Dashboard & BI

Director (Noel) tiene visibilidad ejecutiva en tiempo real desde Madrid: KPIs, ventas, cobranza, ranking agentes, trafico, adopcion.

### Story 5.1: Executive Dashboard & KPI Cards

As a **director (Noel)**,
I want to see an executive dashboard with key business metrics at a glance,
So that I can monitor the health of the business from anywhere in the world.

**Acceptance Criteria:**

**Given** a Director is logged in
**When** they navigate to "Dashboard"
**Then** the BottomNavBar (mobile) highlights "Dashboard" tab and RoleSidebar (desktop) highlights "Dashboard"
**And** the dashboard loads initial data in <3s from any connection including Madrid 4G (NFR2)
**And** they see KPICard components showing: ventas brutas, cobranza total, ocupacion promedio por viaje, ranking top 3 agentes (FR38)
**And** KPIs use Roboto Mono for amounts, Poppins for labels
**And** each KPICard shows trend arrow + % vs previous period
**And** on mobile: KPIs snap horizontal (swipe between cards); on desktop: grid 2x2 or 3-col

**Given** the dashboard is loaded
**When** the Director changes time dimension
**Then** they can switch any metric between: semana, mes, trimestre, anio, comparativas YoY (FR39)
**And** data updates via Firestore `onSnapshot` on materialized views (`/kpis/{period}`) with TTL 5min
**And** materialized views are populated by Cloud Function `materializeKPIs` (scheduled every hour, cron: `0 * * * *`) that aggregates payment/order data from Firestore into `/kpis/{period}` documents with fields: ventasBrutasCents, cobranzaTotalCents, ocupacionPromedio, topAgentes[], periodStart, periodEnd
**And** dimension selector is accessible and doesn't obscure KPI content

**Given** a Director taps on a KPI card
**When** the drill-down opens
**Then** they can navigate from aggregated KPI → category breakdown → individual order detail (FR40)
**And** each drill-down level has a back-arrow in header (no breadcrumbs, flat navigation)
**And** the drill-down path is clear: KPI → lista → detalle orden
**And** on mobile: full-screen transition slide-left 250ms; on desktop: panel expansion

**Given** the Director is offline
**When** they open the dashboard
**Then** they see the last cached snapshot with OfflineBanner and timestamp of last data (NFR26)

### Story 5.2: Traffic Sources, Agent Performance & Attribution

As a **director**,
I want to see where my traffic comes from and how my agents perform,
So that I can optimize marketing spend and coach underperforming agents.

**Acceptance Criteria:**

**Given** a Director is on the dashboard
**When** they scroll to the traffic widget
**Then** they see a desglose by channel: Instagram, Google, agentes (ref links), directo, etc. (FR41)
**And** the widget shows a funnel: visitantes → registros → cotizaciones → pagos with conversion % at each step
**And** on mobile: simplified view (3-5 data points max, tap for tooltip); on desktop: full interactive chart with hover (Recharts responsiveContainer)

**Given** the traffic widget reads data
**When** the dashboard loads
**Then** data comes from custom Firestore analytics (NOT BigQuery) — zero additional cost
**And** events are written by Epic 2 (Story 2.6) to `/analytics/events/{eventId}` with fields: type, timestamp, channel, agentRef, userId, metadata
**And** Cloud Function `aggregateAnalyticsEvent` (Story 5.4) materializes aggregates in real-time:
  - `/analytics/daily/{YYYY-MM-DD}` — daily aggregates by channel
  - `/analytics/agents/{agentId}` — per-agent metrics (leads, payments, conversion)
  - `/analytics/traffic/{period}` — traffic breakdown by channel and funnel step
**And** Director Dashboard reads aggregated views via Firestore `onSnapshot`
**And** Firebase Analytics runs in parallel for GA4/Meta Pixel/GTM reports (free tier) — NOT used for our dashboard

**Given** a Director views agent performance
**When** they access the agents widget
**Then** they see a ranking: leads generados, pagos procesados, conversion rate per agent (FR42)
**And** they can see adoption metrics: pagos reportados via plataforma vs proxy admin per agent (FR44)
**And** the widget is accessible from RoleSidebar → "Agentes" or scrolling on mobile dashboard

**Given** a Director wants attribution detail
**When** they navigate to the attribution dashboard
**Then** they see: fuentes de trafico, conversion por canal, performance de links de agente (FR63)
**And** this view is accessible from RoleSidebar (desktop) → "Atribucion" or BottomNavBar → "Dashboard" → scroll/tab
**And** all attribution data comes from custom Firestore analytics events (materialized from Epic 2 events via Cloud Functions)

**Given** a Director navigates between dashboard sections
**When** they move between KPIs → Trafico → Agentes → Atribucion
**Then** sections are accessible as scrollable regions (mobile) or tabs/sidebar items (desktop)
**And** all sections remain within the DirectorLayout with consistent navigation

### Story 5.3: Pending Collections & Financial Drill-down

As a **director**,
I want to see pending collections filtered by age and amount,
So that I can identify payment risks and take action on overdue accounts.

**Acceptance Criteria:**

**Given** a Director navigates to "Cobranza"
**When** the cobranza view loads
**Then** the RoleSidebar highlights "Cobranza" (desktop) and the view is accessible from BottomNavBar → "Dashboard" → tab/scroll (mobile)
**And** they see a list of pending payments with filters by antiguedad (7d, 15d, 30d, 60d+) and monto range (FR43)
**And** filters use inline chips (same pattern as trip catalog filters — consistent UX)
**And** each row shows: client name, agent name, trip, amount pending, days overdue, last payment date
**And** urgent items (>30d overdue) show destructive color highlight

**Given** a Director taps on a pending collection
**When** the detail opens
**Then** they see the full payment history for that client/trip via drill-down (FR40)
**And** they see the agent assigned and can view agent performance from this context
**And** back navigation returns to the filtered cobranza list with position preserved

**Given** a Director wants to compare periods
**When** they select YoY or quarterly comparison
**Then** the cobranza view shows side-by-side or trend comparison (FR39)
**And** data refreshes from materialized views in Firestore

**Given** the Director accesses cobranza from a deep link URL (e.g., `/director/cobranza?filter=urgent`)
**When** the deep link resolves
**Then** it opens the cobranza view pre-filtered to the relevant items
**And** if not logged in: login → redirect to this filtered view
**And** deep link pattern is ready for push notification integration (implemented in Epic 6)

### Story 5.4: Analytics & KPI Cloud Functions

As a **system**,
I want Cloud Functions that aggregate analytics events and materialize KPI views,
So that the Director Dashboard has real-time data without BigQuery costs.

**Dependencies:** Story 1.1a (project scaffold), Story 1.5 (Odoo client for order data)

**Acceptance Criteria:**

**Given** a user action writes an event to `/analytics/events/{eventId}`
**When** the Firestore trigger fires
**Then** Cloud Function `aggregateAnalyticsEvent` (2nd gen, us-east4, Firestore trigger `onWrite`) processes the event
**And** increments counters in `/analytics/daily/{YYYY-MM-DD}` with fields: totalVisits, signUps, checkouts, purchases, byChannel (map), byAgent (map)
**And** updates `/analytics/agents/{agentId}` with fields: totalLeads, totalPayments, conversionRate, lastActivity
**And** updates `/analytics/traffic/{period}` with fields: byChannel (map with funnel steps), bySource (UTM breakdown)
**And** the function completes in <500ms per event
**And** idempotent — re-processing the same event does not double-count

**Given** the scheduled time arrives (every hour, cron: `0 * * * *`)
**When** Cloud Function `materializeKPIs` fires
**Then** it aggregates payment and order data from Firestore into `/kpis/{period}` documents
**And** each document contains: ventasBrutasCents, cobranzaTotalCents, ocupacionPromedio, topAgentes[], periodStart, periodEnd, updatedAt
**And** periods include: current-week, current-month, current-quarter, current-year, and YoY comparisons
**And** the function handles the full dataset without timeout (Cloud Functions 2nd gen: up to 540s)

**Given** both functions are deployed
**When** they run in production
**Then** they are in region us-east4 (same as App Hosting)
**And** runtime is Node.js 20
**And** they stay within Firebase Blaze free tier (2M invocations/month, 400K GB-sec)
**And** errors are logged with standardized `ANALYTICS_*` error codes

## Epic 6: Notification System

Notificaciones automaticas multi-canal con deep links funcionales, resumenes programados, alertas por excepcion, agrupacion inteligente.

### Story 6.1a: NotificationService Core & Push (FCM)

As a **usuario de cualquier rol**,
I want to receive push notifications with deep links that take me to the exact screen with the right data,
So that I can act immediately on important events without navigating manually.

**Acceptance Criteria:**

**Given** the NotificationService is implemented as a centralized, declarative service
**When** a domain event occurs (payment.reported, payment.verified, payment.rejected, client.created, agent.inactive, kpi.exception)
**Then** the service determines recipients, channel, and content based on `/config/notification-rules` in Firestore (FR45)
**And** push notifications are dispatched via FCM through the Serwist service worker (single SW at scope `/`)
**And** NO separate `firebase-messaging-sw.js` file exists

**Given** a push notification is received
**When** the user taps it
**Then** the deep link opens the EXACT screen with data pre-loaded — not a generic list (FR46)
**And** deep links use real Firestore IDs (e.g., `/admin/verificacion/{paymentId}`, `/agente/pagos/{paymentId}`, `/agente/clientes/{clientId}`)
**And** if not logged in: login → automatic redirect to the deep link target
**And** if no permission for that screen: redirect to role-default dashboard + info toast

**Given** FCM fails to deliver on first attempt
**When** retry logic activates
**Then** up to 3 retry attempts are made with backoff (NFR27)

### Story 6.1b: Notification Center UI & CTR Tracking

As a **usuario de cualquier rol**,
I want an in-app notification center and click tracking on push notifications,
So that I can see all my notifications in one place and the system measures engagement.

**Dependencies:** Story 6.1a (NotificationService must dispatch)

**Acceptance Criteria:**

**Given** the "Alertas" tab exists in BottomNavBar for all roles
**When** a user navigates to Alertas
**Then** they see a notification center listing recent notifications, newest first
**And** each notification shows: icon, title, body, timestamp, read/unread indicator
**And** tapping a notification navigates to its deep link target
**And** the badge count on "Alertas" tab reflects unread count and updates in real-time via Firestore `onSnapshot`
**And** the RoleSidebar (desktop) includes "Alertas" with the same badge count

**Given** a push notification is sent
**When** the user interacts (or doesn't) with it
**Then** push click-through rate is tracked per notification type (FR62)
**And** CTR event `push_clicked` is written to `/analytics/events/` with fields: notificationType, timestamp, userId, clicked (boolean)
**And** CTR data feeds the attribution dashboard (Epic 5, FR63)

### Story 6.2: Multi-Channel Dispatch, Fallback & Grouping

As a **usuario**,
I want to receive notifications through my preferred channel with intelligent fallback and grouping,
So that I'm always informed without being overwhelmed.

**Acceptance Criteria:**

**Given** the NotificationService dispatches a notification
**When** the primary channel (push FCM) is determined
**Then** the fallback chain activates if primary fails: Push → WhatsApp (Odoo templates) → email (FR45, NFR23)
**And** WhatsApp uses the 7 pre-approved Meta templates via Odoo's WhatsApp integration
**And** email is the last resort fallback
**And** channel selection respects user preferences stored in `/users/{uid}/preferences` (from Story 1.7)

**Given** multiple events of the same type occur within a short window
**When** 5+ events of the same type happen within 1 hour
**Then** they are grouped into a single summary notification (FR49)
**And** the grouped notification shows count and summary (e.g., "5 nuevos pagos reportados — $75K total")
**And** deep link goes to the filtered list of those specific items
**And** NEVER group: payment rejections or exception alerts (these are always individual and urgent)

**Given** user quiet hours are configured
**When** a non-urgent notification would fire during quiet hours (default 11pm-7am local)
**Then** it is queued and delivered at the end of quiet hours
**And** urgent notifications (payment.rejected, kpi.exception) bypass quiet hours

**Given** push notification templates are defined
**When** each notification type fires
**Then** it uses the correct template format per the UX spec:
- Pago reportado: "Nuevo pago — $15K" / "Lupita → Roberto Garcia" → `/admin/verificacion/{id}`
- Pago verificado: "Pago verificado — $15K" / "Roberto — VaM" → `/agente/pagos/{id}`
- Pago rechazado: "Pago rechazado" / "[Motivo]" → `/agente/pagos/{id}`
- Nuevo lead: "Nuevo cliente desde tu link" / "[Nombre] — [viaje]" → `/agente/clientes/{id}`
- Lead sin asignar: "Lead sin agente" / "[Nombre] — asignar" → `/admin/leads`
**And** title is <50 chars, icon is logo 72px

### Story 6.3: Scheduled Summaries & Exception Alerts

As a **director**,
I want to receive nightly summaries and exception alerts,
So that I stay informed of business health without checking the dashboard constantly.

As an **admin**,
I want morning summaries of pending work,
So that I know what needs attention when I start my day.

As an **agente**,
I want weekly summaries of my performance,
So that I can track my progress without logging in daily.

**Acceptance Criteria:**

**Given** scheduled summaries are configured
**When** the scheduled time arrives
**Then** Director receives nightly summary at 10pm Madrid time (configurable): ventas del dia, pagos procesados, alertas pendientes (FR47)
**And** Admin receives morning summary at 8am local: pending verification count, urgent items (>48h), new leads unassigned (FR47)
**And** Agent receives weekly summary Monday 9am local: pagos de la semana, comision acumulada, nuevos clientes (FR47)
**And** each summary includes a deep link to the relevant dashboard section
**And** summary template: "Resumen del dia" → `/dashboard` (Director), "Tu semana" → `/agente/mi-negocio` (Agent)

**Scheduling Infrastructure:** Implemented in Story 6.4 (Cloud Functions). Story 6.3 defines the WHAT (content, recipients, timing); Story 6.4 implements the HOW (Cloud Functions 2nd gen with cron triggers).

**Given** an exception condition is detected
**When** the exception matches a defined rule
**Then** Director receives an immediate alert (FR48):
- Agent inactivo >7 dias → "Atencion requerida" / "Agente [nombre] inactivo 7d" → `/dashboard/agentes/{id}`
- Pago atrasado >30 dias → "Cobranza critica" / "[Cliente] — $X pendiente" → `/dashboard/cobranza`
- Meta no alcanzada (monthly target <80%) → "Meta en riesgo" / "[Metrica] al [X]%" → `/dashboard`
- Hito de negocio (e.g., cliente 100, $1M cobranza) → celebratory notification → `/dashboard`
**And** exception alerts NEVER group — each fires individually
**And** exception alerts bypass quiet hours

**Given** user notification preferences exist (from Story 1.7)
**When** a summary or alert would be dispatched
**Then** it respects the user's category toggles (FR50)
**And** if a user disabled "Resumenes", they don't receive summaries but still receive exception alerts
**And** category preferences are enforced at dispatch time, not at event creation time

### Story 6.4: Notification Cloud Functions (Dispatch + Scheduling)

As a **system**,
I want Cloud Functions that process domain events into notifications and trigger scheduled summaries,
So that the NotificationService has backend infrastructure to dispatch automatically.

**Dependencies:** Story 6.1a (NotificationService Core)

**Acceptance Criteria:**

**Given** a domain event is written to `/events/{eventId}` in Firestore
**When** the Firestore trigger fires
**Then** Cloud Function `processNotificationQueue` (2nd gen, us-east4, Firestore trigger `onWrite`) processes the event
**And** determines recipients based on event type and `/config/notification-rules`
**And** invokes NotificationService (Story 6.1a) with assembled content
**And** marks the event as processed to prevent re-delivery
**And** the function is idempotent — re-processing does not send duplicate notifications

**Given** domain events are written by Epics 1-5 before this function is deployed
**When** `processNotificationQueue` is first deployed
**Then** it only processes events created AFTER deployment (not retroactive)
**And** events written before deployment remain in `/events/` as historical data

**Given** scheduled summary time arrives
**When** the cron trigger fires
**Then** `directorNightlySummary` runs at 10pm Madrid (cron: `0 22 * * * Europe/Madrid`)
**And** `adminMorningSummary` runs at 8am Mexico (cron: `0 8 * * * America/Mexico_City`)
**And** `agentWeeklySummary` runs Monday 9am Mexico (cron: `0 9 * * 1 America/Mexico_City`)
**And** each function queries Firestore for the relevant period's data and invokes NotificationService

**Given** all notification Cloud Functions are deployed
**When** they run in production
**Then** they are in region us-east4 (same as App Hosting)
**And** runtime is Node.js 20
**And** they stay within Firebase Blaze free tier
**And** errors are logged with standardized `NOTIFICATION_*` error codes

## Epic 7: Client Experience & UGC

Clientes ven sus viajes, progresan emocionalmente con pagos, descargan documentos, suben fotos, escriben resenias, comparten en redes.

### Story 7.1: My Trips Dashboard & Emotional Progress

As a **cliente**,
I want to see all my trips and feel excited about my payment progress,
So that paying for my trip feels like part of the adventure, not a chore.

**Acceptance Criteria:**

**Given** a client is logged in
**When** they navigate to "Mis Viajes"
**Then** the BottomNavBar (client) highlights "Viajes" tab
**And** they see a list of all their trips: pasados, activo, futuro — each as a TripCard (client variant with mini progress bar) (FR51)
**And** trips are grouped by status with the active trip prominently at the top
**And** on mobile: vertical stack, full-width cards; on desktop: centered max-width 800px (ClientLayout)

**Given** a client taps on their active trip
**When** the trip detail opens
**Then** they see the EmotionalProgress component as hero: container with primary gradient, trip name, progress bar in accent, percentage in Roboto Mono 36px, and personalized emotional message (FR52)
**And** milestone celebrations fire at 25%, 50%, 75%, 100%: animated check + contextual message (e.g., 50% = "Medio camino — el mundo te espera")
**And** below the hero: PaymentStepper timeline (from Epic 3), trip itinerary summary, departure date countdown

**Given** a client views a past trip
**When** they tap on it
**Then** they see the trip summary with final status, their photos (if uploaded), and their review (if written)
**And** a CTA invites them to add photos or write a review if they haven't yet

**Given** a client is offline
**When** they open "Mis Viajes"
**Then** they see cached trip data with OfflineBanner (NFR26)

### Story 7.2: Document Downloads & Photo Uploads

As a **cliente**,
I want to download my trip documents anytime and upload my travel photos,
So that I have 24/7 access to my contracts and can share my experience.

**Acceptance Criteria:**

**Given** a client views their trip detail
**When** they navigate to "Documentos"
**Then** they see a list of associated documents: contracts, itineraries, vouchers (FR53)
**And** each document has a download button (minimum 44x44px touch target)
**And** documents are served from Firebase Storage under the trip's scope
**And** documents are available 24/7 regardless of Odoo availability
**And** "Documentos" is accessible from trip detail view — part of the trip navigation flow (no orphan page)

**Given** a client wants to upload travel photos
**When** they navigate to their completed trip's "Mis Fotos" section
**Then** they can select and upload multiple photos from their device (FR54)
**And** photos upload to Firebase Storage under `/users/{uid}/trips/{tripId}/photos/`
**And** each photo has a toggle: "Mostrar en la pagina del viaje" (public) or private (default: private) (FR56)
**And** upload shows progress indicator per photo
**And** storage rules enforce that only the owner can write to their folder (NFR15)

**Given** a client toggles a photo to public
**When** the toggle changes
**Then** the photo becomes a candidate for the trip landing page gallery (FR56)
**And** it enters a moderation queue for admin review before appearing publicly (FR57)
**And** a badge or indicator shows "Pendiente de aprobacion" until admin approves

**Given** an admin reviews UGC
**When** they access the moderation queue
**Then** the RoleSidebar (admin) includes "Moderacion" section
**And** they see pending photos and reviews with approve/reject actions (FR57)
**And** approved photos appear in the trip landing gallery (Story 2.3) alongside professional photos
**And** rejected content is hidden with optional notification to the user

### Story 7.3: Reviews, Ratings & Social Sharing

As a **cliente**,
I want to write a review, rate my trip, and share my experience on social media,
So that I can express my satisfaction and help other travelers decide.

**Acceptance Criteria:**

**Given** a client has a completed trip
**When** they navigate to their past trip detail
**Then** they see a "Escribe tu resenia" CTA if they haven't written one yet (FR55)
**And** the CTA is prominent but not intrusive — below trip summary and photos
**And** the review form includes: star rating (1-5), text review, optional photo attachment
**And** the review is stored in Firestore under the trip's reviews subcollection

**Given** a client submits a review
**When** the review is saved
**Then** it enters the moderation queue for admin approval (FR57)
**And** a success toast appears: "Resenia enviada — aparecera cuando sea aprobada"
**And** the client can edit their review from their trip detail before approval
**And** approved reviews appear on the trip landing page (Story 2.3) in the testimonials section

**Given** a client wants to share their experience
**When** they tap "Compartir en Redes"
**Then** a ShareCard is generated with: trip destination photo, their name, a quote from their review (if exists), and a link to the trip landing page (FR58)
**And** the link includes attribution back to the trip landing (not the client's profile)
**And** the ShareCard is optimized for Instagram Stories (9:16), WhatsApp (1:1), and generic share (OG image)
**And** native share dialog opens (Web Share API) with the card image and link
**And** the share action is accessible from trip detail → "Compartir" button

**Given** a client navigates between My Trips features
**When** they move between trip list → trip detail → documents → photos → review → share
**Then** all views are within the ClientLayout with consistent BottomNavBar
**And** back navigation is clear at every level (back-arrow in header)
**And** no page exists without a clear path back to "Mis Viajes"
