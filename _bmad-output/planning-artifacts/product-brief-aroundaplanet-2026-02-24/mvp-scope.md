# MVP Scope

## Core Features (Fase 0 — 90 dias)

**Prioridad 1 — Pre-Madrid (antes 3 marzo): Login + Roles + Dashboard**

| Feature | Descripcion | Fuente datos |
|---------|------------|--------------|
| Autenticacion con roles | Login Email + Google, 4 roles base (Director, Agente, Admin, Cliente), permisos granulares | Firebase Auth + Firestore rules |
| Seed de usuarios desde Odoo | Usuarios activos de Odoo se importan con su rol correspondiente | `res.users` + `hr.employee` via API |
| Dashboard Director | KPIs visuales: ventas brutas por periodo, viajes proximos con ocupacion, ranking agentes, pagos pendientes | `sale.order`, `product.template`, `account.move` via Odoo API |
| PWA instalable | App instalable desde navegador en celular de Noel | Next.js PWA config |

**Prioridad 2 — Semanas 2-6: Flujo de Pagos Digital**

| Feature | Descripcion | Detalle |
|---------|------------|---------|
| Reporte de pago (agente) | Formulario: cliente, viaje, monto, metodo, comprobante (foto), notas. 3 toques maximo | Firestore + Storage |
| Cola de verificacion (admin) | Lista priorizada por antiguedad, vista comprobante + datos lado a lado | Firestore queries |
| Verificacion/rechazo con 1 clic | Admin verifica o rechaza (con motivo). Actualiza estado automaticamente | Firestore + notificaciones |
| Cadena de notificacion automatica | Un pago verificado dispara notificacion a: agente, cliente, contabilidad | WhatsApp templates Odoo (7 aprobados) + email |
| Historial de pagos por cliente | Todos los pagos de un cliente con status, accesible por admin y agente asignado | Firestore + Odoo `account.move` |

**Prioridad 3 — Semanas 4-8: Transparencia Agentes**

| Feature | Descripcion | Detalle |
|---------|------------|---------|
| Portal "Mi Negocio" del agente | Mis clientes, mis ventas, mi cartera — solo lo suyo, cero visibilidad cruzada | Odoo `sale.order` filtrada por vendedor |
| Comisiones visibles | Agente ve comision acumulada y por cliente/viaje | Calculado desde Odoo (requiere dato de margen de Noel) |
| Catalogo de viajes | Viajes disponibles con detalle, material de venta | Odoo `product.template` (1,545 productos) |

**Transversal — Todo Fase 0:**

| Feature | Descripcion |
|---------|------------|
| Integracion Odoo via proxy | Servicio que envuelve llamadas XML-RPC. Abstraccion ligera, no acoplamiento directo |
| Responsive mobile-first | Todas las vistas funcionales en 375px+. Noel y agentes usan celular |
| Permisos granulares | Cada usuario ve SOLO lo que le corresponde. Sin hardcodear roles — configuracion flexible |

## Out of Scope for MVP

**Explicitamente fuera de Fase 0:**

| Feature | Por que se difiere | Cuando |
|---------|-------------------|--------|
| Portal cliente completo | Carmen es secundaria para MVP. Su dolor se resuelve indirectamente con flujo pagos | Fase 1 — con UX emocional |
| Pasarela de pago online | Implicaciones fiscales, configuracion de procesador, comisiones. Noel paga por separado | Fase 1+ |
| Generacion automatica de PDFs (contratos/cotizaciones) | Complejidad tecnica en mobile. Evaluar durante Fase 0 | Fase 1 si es viable |
| Chatbot / IA conversacional | Anti-chatbot explicito de Noel. Ademas se necesitan datos capturados para entrenar | 12-18 meses minimo |
| App nativa (App Store / Google Play) | PWA cubre el caso. Nativa no justifica costo | Solo si PWA no satisface |
| Landing pages por destino | Se construye silenciosamente como parte de la plataforma, pero se vende como Fase 1 | Construir Fase 0, monetizar Fase 1 |
| Marketing automatizado (email sequences, WhatsApp campaigns) | Requiere datos y procesos estabilizados primero | Fase 1 |
| Recuperacion cotizaciones muertas (9,594 drafts) | Requiere definir con Noel cuales son reales vs pruebas | Fase 1 con seguimiento automatizado |
| Multi-moneda (EUR para Madrid) | Primero estabilizar operacion en MXN | Fase 1+ |
| Integracion GDS (Amadeus/Sabre) | Complejidad y costo de licencias | Fuera de horizonte cercano |
| Gamificacion / club de viajes / millas | Vision a largo plazo, requiere portal cliente activo | 12+ meses |
| CRM avanzado (pipeline, scoring, automatizaciones) | CRM basico de Odoo activable como quick win. Avanzado es Fase 1 | Activar Odoo CRM en Fase 0, expandir en Fase 1 |

**Quick wins Odoo-first (activar sin codigo, paralelo al desarrollo):**
- CRM basico (ya instalado, sin uso real)
- Helpdesk como bandeja temporal de soporte
- WhatsApp templates para notificaciones manuales (mientras se automatiza)
- Knowledge articles como base de tips internos

## MVP Success Criteria

| Criterio | Validacion |
|----------|-----------|
| Noel tiene plataforma en su celular el 3 marzo | PWA instalada, login funcional, dashboard con datos reales de Odoo |
| Al menos 1 pago procesado end-to-end en plataforma | Agente reporta -> admin verifica -> notificaciones se disparan |
| Grupo inicial de agentes usando la plataforma | Early adopters con acceso, clientes visibles, pagos reportados |
| Datos financieros mostrados con terminologia correcta | "Ventas Brutas" alineado con como Noel entiende sus numeros |
| Plataforma estable conectada a Odoo | Lectura de datos sin caidas, proxy funcional |
| Privacidad implementada | Agente X no puede ver clientes de Agente Y en ningun endpoint |

## Future Vision

**Fase 1 (iguala mensual, post Fase 0)**:
- Portal cliente completo con UX emocional (barra progreso gamificada, timeline viaje, centro preparacion viajero)
- Landing pages por destino optimizadas con SEO y atribucion de leads
- Recuperacion de cotizaciones muertas con seguimiento automatizado
- CRM avanzado con pipeline, scoring y automatizaciones
- Generacion automatica de PDFs (contratos, cotizaciones, itinerarios)
- Marketing automation con Odoo (email sequences, WhatsApp campaigns)
- Reportes de rentabilidad por destino/agente (cuando Noel proporcione margenes)

**Fase 2+ (12-18 meses)**:
- Micro-sitio por agente ("Hosted by Lupita" — modelo Shopify)
- BI avanzado: estacionalidad predictiva, patron pago por cliente, viajes que se venden juntos
- Multi-moneda para operacion Madrid (EUR)
- Onboarding gamificado de agentes con recompensas
- "Tu Ano Viajero" wrapped (resumen anual tipo Spotify)
- Evaluacion de IA conversacional (solo cuando haya datos suficientes)
- Posible expansion SaaS a otras agencias (decisiones arquitectonicas internas lo permiten)
