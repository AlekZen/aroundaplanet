# Executive Summary

AroundaPlanet es una agencia de viajes mexicana con 8 anos de operacion, ~100 agentes freelance, 8 administrativos y un producto unico en Latinoamerica y Espana: la Vuelta al Mundo en 33.8 dias ($145K MXN). Opera ~$27M MXN anuales en ventas brutas con 3,854 contactos y 12,214 ordenes en Odoo 18 Enterprise — pero su operacion critica corre sobre un grupo de WhatsApp de 42 personas donde datos sensibles, comprobantes de pago y montos quedan expuestos sin estructura, permisos ni trazabilidad.

La plataforma AroundaPlanet es una PWA construida con Next.js + Firebase que se integra bidireccionalmente con los 21 modulos ya pagados de Odoo 18 Enterprise via XML-RPC. No reemplaza Odoo — lo potencia con una capa inteligente que resuelve tres problemas concretos: (1) eliminar la exposicion de datos sensibles en WhatsApp mediante 4 portales con permisos granulares por rol, (2) dar a cada agente freelance visibilidad real de su cartera, clientes y comisiones para construir confianza y retencion, y (3) darle al director visibilidad ejecutiva en tiempo real desde Madrid, donde se muda permanentemente el 3 de marzo de 2026.

El fundador adopto esta transformacion convencido de que la IA y automatizacion son ventaja competitiva real en su vertical. La plataforma materializa esa conviccion con IA practica integrada — lectura automatica de comprobantes de pago por fotografia que elimina pasos manuales del flujo diario — y dashboards de BI con dimension temporal disenados para que un director a 7 horas de diferencia pueda dormir tranquilo.

## What Makes This Special

- **Transparencia bidireccional agente-agencia**: Por primera vez, cada agente freelance ve SUS clientes, SUS comisiones y SU cartera. Este no es un feature — es el mecanismo de adopcion para una red de 100 agentes que hoy operan con desconfianza. La confidencialidad es un beneficio; la transparencia es el killer feature.
- **IA practica, no decorativa**: OCR/lectura de comprobantes de pago con una foto. No chatbots (Noel los rechaza explicitamente), no IA generica — IA que elimina un cuello de botella real: las 5-6 interacciones manuales por cada pago procesado via WhatsApp.
- **Dashboard BI con dimension temporal**: No KPIs estaticos sino analisis con profundidad temporal, disenado visualmente para satisfacer tanto al Noel Racional (metricas a las 8 PM) como al Noel Vulnerable (tranquilidad a las 11 PM).
- **Hibrido Odoo+Custom unico en el mercado**: Ninguna plataforma existente (MOGU, Travefy, WeTravel, Lemax) combina gestion interna de agencia con flujos de verificacion, transparencia agente-agencia e integracion sobre ERP existente con 12,214 ordenes de datos reales.
