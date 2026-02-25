# Core Vision

## Problem Statement

AroundaPlanet tiene un equipo operativo competente y un negocio con traccion real (~$80M en ventas brutas en 3 anos) — pero sus herramientas no corresponden a su volumen. La operacion critica corre sobre un grupo de WhatsApp de 42 personas sin estructura, permisos ni trazabilidad:

1. **Privacidad en riesgo**: Comprobantes de pago, datos de clientes y montos se comparten en un grupo donde cualquier agente ve los clientes de todos. Agentes que manejan clientes VIP y casos sensibles (parejas discretas, viajeros de alto perfil) quedan expuestos.
2. **Agentes con desconfianza**: Los ~100 agentes freelance no tienen visibilidad de su propia cartera ni comisiones. Sospechan que la agencia captura a "sus" clientes cuando estos llaman directo. El miedo es a perder su negocio, no solo su privacidad.
3. **Director sin visibilidad**: Noel (fundador) se muda a Madrid permanentemente el 3 de marzo. Sin dashboard, metricas ni alertas, pierde los "ojos y oidos" sobre su negocio. Hoy toma decisiones con lo que le reportan por chat.
4. **Administrativos saturados con herramientas manuales**: 8 personas procesan cupones, fichas de deposito, contratos y PDFs de cotizacion. Cada pago genera 5-6 interacciones manuales por WhatsApp. El equipo es capaz — la herramienta no.
5. **Clientes sin autoservicio**: Para saber cuanto llevan pagado, mandan WhatsApp y esperan. Sin portal, sin documentos accesibles, sin transparencia sobre el estado de su viaje.

## Problem Impact

- **Confirmacion de pago toma 24-48 hrs** (el admin recibe por WhatsApp, verifica manualmente, responde por WhatsApp) cuando deberia ser <4 hrs
- **42 personas con acceso a datos sensibles** cuando deberian ser solo los involucrados directos en cada transaccion
- **Riesgo real de fuga de agentes** por desconfianza — la red de 100 agentes es el activo mas valioso y no tiene ninguna herramienta que los retenga
- **Productividad admin consumida en tareas manuales**: 5-6 interacciones por pago x miles de transacciones anuales = cientos de horas en trabajo que un sistema resuelve con un flujo automatizado
- **Fundador operando a ciegas desde otro continente** a partir de marzo — sin datos en tiempo real, cada decision es reactiva

## Why Existing Solutions Fall Short

**MOGU** ($29-95 USD/mes): SaaS generico para agencias pequenas. No integra Odoo, no soporta flujos de pago custom (agente reporta -> admin verifica -> director supervisa), no ofrece dashboard ejecutivo remoto avanzado, no tiene PWA para operadores. Bueno para agencias de 1-5 personas sin ERP existente.

**Travefy, WeTravel, TravelJoy, Wetu, Lemax, FareHarbor, Bokun**: Cada uno resuelve un fragmento (itinerarios, pagos compartidos, inventario) pero ninguno ofrece: integracion ERP bidireccional + flujos de verificacion internos + transparencia agente-agencia + control remoto del director. Estan disenados para operadores simples, no para agencias con 100 agentes freelance y operacion binacional.

**El hueco del mercado**: No existe plataforma que combine gestion interna de agencia (pagos, verificacion, comisiones, roles) integrada sobre un ERP existente, con la escalabilidad para crecer con el negocio.

## Proposed Solution

Plataforma PWA custom construida con **Next.js + Firebase + Odoo API** que opera como capa inteligente sobre los 21 modulos existentes de Odoo 18 Enterprise.

**Principio rector**: "No duplicar Odoo". Lo que Odoo hace, se jala via API. Lo que no existe, se construye custom.

**4 portales por rol**:

- **Director (Noel)**: Dashboard ejecutivo con KPIs reales, alertas por excepcion, ranking agentes, ocupacion viajes, feed de actividad del equipo.
  > *Noel en Madrid, 11 PM. Abre el celular. 3 pagos verificados hoy. Vuelta al Mundo al 80% de ocupacion. Su mejor agente cerro una venta. Todo esta bien. Cierra el celular y duerme.*

- **Agente (~100 freelance)**: Mis clientes, mis comisiones, mi cartera. Reporte de pago en 3 toques. Catalogo de viajes con material de venta.
  > *Lupita abre la app. Ve sus 12 clientes, $180K en ventas del mes, su comision acumulada. Reporta un pago de $15K — foto del comprobante, 3 toques, listo. Le llega confirmacion cuando admin verifica. Su negocio, visible y protegido.*

- **Administrativo (8 personas)**: Cola de verificacion priorizada, vista lado a lado con banco, cadena de notificacion completa automatica, generacion de contratos/PDFs.
  > *Mariana ve 3 pagos pendientes en cola. Abre uno, compara comprobante con movimiento bancario, un clic: verificado. El sistema notifica automaticamente a agente, cliente y contabilidad. Lo que tomaba 6 mensajes de WhatsApp tomo 10 segundos.*

- **Cliente**: Progreso de pago con barra visual, documentos siempre disponibles, historial completo, posibilidad de subir comprobante directo.
  > *Carmen abre su portal. Ve "$100,000 de $145,000 pagados — 69%". Descarga su contrato. Revisa el itinerario. No tuvo que preguntar a nadie.*

**Integracion Odoo**: 8-12 modelos clave en los primeros 90 dias (contactos, ventas, pagos, productos, CRM, empleados, eventos, helpdesk). 7 WhatsApp templates ya aprobados en Meta listos para notificaciones sin codigo. Datos reales existentes: 3,854 contactos, 12,214 ordenes, 1,545 productos.

## Key Differentiators (cara al cliente)

**3 pilares**:

1. **Confianza**: Transparencia bidireccional agente-agencia (cada agente ve SUS clientes y comisiones por primera vez) + cadena de notificacion completa por pago (un pago dispara 5+ notificaciones automaticas a todos los stakeholders — lo que hoy son 5-6 interacciones manuales por WhatsApp).

2. **Control**: Dashboard ejecutivo real-time para direccion remota desde Madrid + integracion Odoo-first que potencia los 21 modulos ya pagados en vez de reemplazarlos.

3. **Experiencia**: Plataforma donde el agente es tratado como emprendedor (ve "su negocio", no un CRM que lo controla) + portal cliente que transforma "pagar un viaje" en una experiencia con progreso visible.

## Oportunidades Descubiertas

- **9,594 cotizaciones en draft** (79% no convierten) = potencial de ~$15M MXN en revenue recuperable con seguimiento automatizado
- **54 articulos de Knowledge en Odoo** = base de contenido para tips de viajero sin crear desde cero
- **2,731 social posts historicos** = contenido reutilizable para landing pages por destino
- **Events module activo** = viajes como eventos con tickets, registraciones y capacidad — activable sin codigo

## Vision Estrategica (roadmap de valor interno)

**Fase 0 (90 dias, $50K MXN)**: Construir la operacion digital completa — login con roles, paneles con datos reales, flujo de pagos, transparencia agentes. Incluye silenciosamente features de experiencia del viajero (barra de progreso, portal emocional) y de ventas/marketing (landings por destino, atribucion de leads) con costo marginal.

**Fase 1 (iguala mensual)**: Monetizar las features construidas en silencio durante Fase 0. La UX emocional del viajero, las landing pages optimizadas, la recuperacion de cotizaciones muertas y las automatizaciones de marketing se presentan como valor nuevo de la iguala — pero ya estan parcial o totalmente construidas.

## Decisiones Arquitectonicas Internas (no visibles al cliente)

1. **Abstraccion ligera de Odoo**: Un servicio proxy que envuelve las llamadas XML-RPC. No una capa ERP-agnostica completa de dia 1, pero lo suficiente para no acoplar directamente y poder evolucionar.
2. **Single-tenant sin impedir multi-tenant**: No construir tenant isolation, pero no hacer nada que lo impida. Disenar sin acoplar a un solo cliente.
3. **Permisos granulares desde dia 1**: Seed de usuarios y roles desde Odoo activos. No hardcodear 4 roles — configuracion flexible.

---
