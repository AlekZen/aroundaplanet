# Success Metrics

## Metricas de Exito por Usuario

**Noel (Director)** — Medir: visibilidad ejecutiva
- Tiempo para obtener estado del negocio (de "preguntar por WA y esperar" a "abrir app y ver")
- Cantidad de KPIs disponibles en dashboard sin pedir reporte a nadie
- Frecuencia de uso (indica si la herramienta le genera valor real)

**Lupita (Agente)** — Medir: confianza y eficiencia
- Visibilidad de cartera propia (clientes asignados visibles vs total)
- Tiempo para reportar un pago (comparar con flujo WA anterior)
- Personas con acceso a datos de sus clientes (de grupo abierto a acceso restringido)

**Mariana (Admin)** — Medir: productividad
- Tiempo de ciclo pago completo: desde que agente reporta hasta que cliente recibe confirmacion
- Pasos manuales por pago (interacciones WA eliminadas)
- Notificaciones automaticas vs manuales

**Carmen (Cliente)** — Medir: autoservicio
- Consultas de saldo autoservicio en portal (metrica que sube, no que baja en WA)
- Acceso a documentos propios sin intermediario (descargas desde portal)

## Business Objectives

**Fase 0 (90 dias)**:

| Objetivo | Criterio de validacion |
|----------|----------------------|
| Plataforma mostrable | Demo exitosa + PWA instalada en celular de Noel antes del 3 marzo |
| Flujo pagos digital operando | Al menos 1 ciclo completo end-to-end en plataforma |
| Adopcion agentes (early adopters) | Grupo inicial usando la plataforma activamente |
| Conexion Odoo estable | Lectura de datos reales sin caidas |
| Datos financieros contextualizados | Dashboard usa terminologia correcta (ventas brutas, no "ingresos") — alineado con como Noel entiende sus numeros |

**Fase 1 (iguala mensual)**:

| Objetivo | Criterio |
|----------|----------|
| Adopcion masiva de agentes | Mayoria de la red activa en plataforma |
| Grupo WA de pagos obsoleto | Pagos se reportan por plataforma |
| Portal cliente activo | Clientes consultan saldo sin contactar admin |
| Revenue de features nuevas | Iguala justificada por valor entregado |

## Key Performance Indicators

**KPIs operativos** (instrumentar desde dia 1 en plataforma):

| KPI | Por que importa | Fuente |
|-----|----------------|--------|
| Tiempo de ciclo pago completo | Mide la mejora core vs proceso WA | Timestamps en plataforma |
| Pagos procesados en plataforma | Mide adopcion real del nuevo flujo | Conteo en Firestore |
| Usuarios activos por rol (7 dias) | Mide adopcion por segmento | Firebase Auth + logs |
| Consultas autoservicio en portal | Mide reduccion de carga admin | Logs de acceso portal cliente |

**KPIs financieros** (disenar con datos de Odoo, calibrar con Noel):

| KPI | Que podemos extraer de Odoo | Que necesitamos de Noel |
|-----|----------------------------|------------------------|
| Ventas brutas por periodo | `sale.order` confirmadas con `amount_total` — datos limpios confirmados por EDA | Definicion de "venta" en su lenguaje |
| Cartera pendiente de cobro | `account.move` con `amount_residual > 0` — EDA confirmo existencia de saldo pendiente significativo | Si pagos parciales son normales o anomalia |
| Ordenes sin facturar | `sale.order` con `invoice_status = to_invoice` — identificadas en EDA | Por que se confirman sin facturar |
| Tasa de cobranza | Cobrado vs facturado — calculable con datos actuales | Tolerancia normal de pendientes |
| Ticket promedio | Calculable desde `sale.order` | Si incluye o excluye ciertos tipos de orden |
| Margen/rentabilidad | **NO disponible en Odoo** — no hay campo de costo en lineas de venta | Margen promedio por destino o tipo de viaje |
| Cotizaciones convertidas | `sale.order` draft vs confirmed — volumen significativo de drafts identificado en EDA | Cuales son cotizaciones reales vs pruebas |

**Nota EDA**: La auditoria de datos confirmo que los datos de ventas en Odoo son de alta calidad (<0.7% de ajustes necesarios), pero las cifras son ventas brutas (valor del paquete al viajero), no ingreso neto de AroundaPlanet. El dashboard debe reflejar esta distincion. Los KPIs de rentabilidad requieren el dato de margen que no esta en Odoo y debe ser proporcionado por Noel.

## Garantias Contractuales

| Garantia | Condicion | Consecuencia |
|----------|-----------|--------------|
| Pre-Madrid (dia 11) | Plataforma mostrable el 3 marzo | Reembolso 100% |
| Sistema Cobros (dia 90) | Flujo de pagos funcionando | 30 dias trabajo gratis |

## Principios de Metricas

1. **Nunca hardcodear valores** — todo viene de Odoo API o se captura en plataforma en tiempo real
2. **Terminologia alineada con Noel** — "Ventas Brutas" no "Ingresos", hasta que el margen este definido
3. **Medir lo que sube en plataforma**, no lo que baja en WhatsApp (lo primero es medible, lo segundo no)
4. **Calibrar con datos reales** antes de fijar targets — la EDA da el mapa de lo disponible, Noel da el contexto de negocio

---
