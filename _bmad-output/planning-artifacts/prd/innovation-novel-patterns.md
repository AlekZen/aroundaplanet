# Innovation & Novel Patterns

## Detected Innovation Areas

1. **IA practica para OCR de comprobantes** — Firebase AI Logic (gemini-2.5-flash-lite) analiza fotos de comprobantes bancarios y extrae automaticamente monto, fecha, referencia y banco. No es IA decorativa — elimina el cuello de botella real de 5-6 interacciones manuales por pago via WhatsApp. Ninguna plataforma turistica existente ofrece esto.

2. **UGC como motor de conversion organica** — Los viajeros publican fotos reales desde su portal con toggle publico/privado. Las fotos marcadas como publicas alimentan las landing pages de viajes. Botones de compartir en redes generan trafico organico con atribucion UTM. El contenido mas persuasivo lo generan los propios clientes, no el equipo de marketing.

3. **Hibrido ERP+Custom con capa inteligente** — PWA custom que potencia 21 modulos de Odoo 18 Enterprise existentes via XML-RPC en vez de reemplazarlos. MOGU, Travefy, WeTravel y Lemax son SaaS cerrados sin integracion ERP bidireccional. No existe plataforma en el mercado que combine gestion interna de agencia + flujos de verificacion + transparencia agente-agencia sobre ERP existente.

4. **Agente como emprendedor (modelo Shopify del turismo)** — Link personalizado con atribucion por viaje, dashboard "Mi Negocio", comisiones en tiempo real, autoasignacion de leads por ref. El agente no es usuario de un CRM — es dueno de su negocio dentro de la plataforma. Esto no existe en ninguna herramienta del sector.

5. **NotificationService como arquitectura reutilizable** — Registro declarativo de notificaciones, dispatch unico multi-canal (push FCM + WhatsApp Odoo + email), deep links, preferencias dinamicas por rol. Innovacion arquitectonica que permite agregar notificaciones editando config, no codigo.

## Market Context & Competitive Landscape

| Competidor | Que hace bien | Que le falta vs AroundaPlanet |
|-----------|--------------|------------------------------|
| MOGU | SaaS simple para agencias pequenas | No integra ERP, no tiene flujo pago interno, no soporta 100 agentes |
| Travefy | Itinerarios + tracking comisiones | No tiene OCR de comprobantes, no integra Odoo, no es PWA |
| WeTravel | Pagos compartidos por viaje | No tiene transparencia agente-agencia, no es para operacion interna |
| Lemax | Rentabilidad por viaje, ERP propio | ERP cerrado, no se integra sobre Odoo existente |
| Wetu | Contenido reutilizable por destino | No tiene gestion de pagos ni dashboard ejecutivo |

**Hueco del mercado:** Ninguna plataforma existente combina gestion operativa interna (pagos, verificacion, comisiones, roles) + IA practica + UGC como motor de conversion + integracion sobre ERP existente con datos reales.

## Validation Approach

| Innovacion | Como validar | Cuando | Criterio de exito |
|-----------|-------------|--------|-------------------|
| IA comprobantes | 50 comprobantes reales de Odoo + feedback admins | Primeras 2 semanas de flujo pagos | >90% precision en monto, fecha, referencia |
| UGC en landings | Medir trafico organico fotos compartidas vs stock | Post-lanzamiento portal cliente | Incremento medible en visitas desde redes |
| Atribucion agente | Comparar leads con ref vs sin ref | Primeras semanas con agentes activos | >20% leads con atribucion directa |
| Modelo emprendedor | Encuesta satisfaccion agentes + retention rate | 60 dias post-adopcion | Agentes reportan mayor confianza y control |

## Risk Mitigation

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| IA no lee comprobante (foto borrosa/formato raro) | Media | Bajo | Fallback a campos manuales — flujo nunca se rompe |
| UGC no genera trafico significativo | Media | Bajo | Landings funcionan con fotos profesionales, UGC es bonus |
| Agentes no comparten links | Alta inicialmente | Medio | Admin asigna leads manualmente como hoy, adopcion gradual |
| Odoo cambia terminos API | Baja | Alto | Capa abstraccion ligera desacopla la plataforma de Odoo directo |
| WhatsApp templates rechazados por Meta | Baja | Medio | Fallback a push FCM + email para notificaciones |
| Precision IA baja en produccion | Baja | Medio | Admin siempre verifica, IA asiste pero no decide |
