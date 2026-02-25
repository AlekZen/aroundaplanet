# Success Criteria

## User Success

**Noel (Director)** — Visibilidad ejecutiva desde Madrid
- Abre la app desde su celular y obtiene estado del negocio en <10 segundos
- Dashboard BI con dimension temporal completa (semana/mes/trimestre/ano, comparativas YoY, tendencias)
- Resumen diario nocturno push a las 10 PM hora Madrid — un push que resume todo
- Resumen semanal ejecutivo los lunes con comparativa vs semana anterior
- Alertas por excepcion solo cuando algo va mal
- Widget "De donde vienen mis clientes" — fuentes de trafico, embudo de conversion, performance de agentes en redes

**Lupita (Agente ~100 freelance)** — Confianza y eficiencia
- Ve SUS clientes, comisiones y cartera desde el primer login
- Reporta pago en <=3 toques: foto → IA extrae datos → confirma → envia
- Push inmediato cuando admin verifica/rechaza su pago
- Link unico por viaje con atribucion (`?ref=agentId`) para compartir en redes/WhatsApp
- Resumen semanal de su cartera
- Tambien es Cliente — puede comprar viajes para si misma

**Mariana (Admin, 8 personas)** — Productividad
- Tiempo de ciclo pago: de 24-48 hrs a <4 hrs
- Verificacion 1 clic: comprobante + datos IA prellenados lado a lado con banco
- Push cuando entra nuevo pago + escalamiento automatico >48h
- Resumen diario de operacion a las 8 AM

**Carmen (Cliente)** — Autoservicio y experiencia
- Crea cuenta desde landing de viaje sin intervencion de nadie — Cliente automatico
- Ve progreso de pagos con barra visual, descarga documentos 24/7
- Push en hitos emocionales (25/50/75/100%) y cuando su pago es verificado
- Datos fiscales en perfil para facturacion automatica

## Business Success

**Fase 0 (90 dias, $50K MXN):**

| Objetivo | Criterio medible |
|----------|-----------------|
| Plataforma mostrable Pre-Madrid | PWA instalada + demo exitosa antes del 3 marzo |
| Flujo pagos con IA | Ciclo completo end-to-end con lectura automatica de comprobante >90% precision |
| Adopcion agentes early adopters | Los que Noel identifique usando plataforma activamente |
| Conexion Odoo estable | Lectura/escritura datos reales via XML-RPC |
| IA comprobantes funcional | Firebase AI Logic con gemini-2.5-flash-lite extraccion monto, fecha, referencia, banco |
| Dashboard BI operando | KPIs con dimension temporal completa (semana/mes/trimestre/ano + YoY + tendencias) |
| Paginas publicas + landing viajes | Catalogo sincronizado Odoo, SEO, flujo conversion visitante→cliente |
| Analytics instrumentado | Firebase Analytics + Meta Pixel + Google Tag capturando desde dia 1 |
| Panel SuperAdmin | Gestion usuarios, roles aditivos, seed desde Odoo |
| Notificaciones push operando | FCM con deep links, NotificationService centralizado, preferencias por rol |

**Fase 1 (iguala mensual):**

| Objetivo | Criterio |
|----------|----------|
| Adopcion masiva agentes | Mayoria de ~100 activa en plataforma |
| Grupo WA pagos obsoleto | Pagos por plataforma |
| Portal cliente completo | UX emocional, gamificacion |
| Revenue features nuevas | Landings optimizadas, atribucion, marketing automation |
| ROI de campanas medible | Costo por adquisicion por canal |

## Technical Success

| Criterio | Target |
|----------|--------|
| Firebase AI Logic | gemini-2.5-flash-lite OCR comprobantes, extraccion de campos |
| Firebase Cloud Messaging | VAPID keys listas, push con deep links a seccion relevante |
| NotificationService centralizado | Registro declarativo, dispatch unico, 3 canales (push/WhatsApp/email) |
| Permisos granulares | Roles aditivos (Cliente base + extras). Agente X no ve datos de Agente Y |
| Navegacion dual | Publica (viajes, landings) + privada (dashboard dinamico por roles) |
| CRUD viajes Odoo↔Firestore | Datos core Odoo + contenido rico Firestore, landing pages SSG/ISR |
| Perfil unificado | Foto, datos fiscales, cuenta bancaria, preferencias notificacion dinamicas por rol |
| Analytics completo | Firebase Analytics + Meta Pixel + Google Tag + UTMs + atribucion agente + pixels conversion |
| PWA | Instalable, responsive 375px+, mobile-first |
| Performance | Dashboard <3s, reporte pago <30s incluyendo IA |

## Measurable Outcomes

| KPI | Fuente | Por que importa |
|-----|--------|----------------|
| Tiempo ciclo pago completo | Timestamps Firestore | Mejora core vs proceso WA |
| Pagos procesados en plataforma | Conteo Firestore | Adopcion real |
| Precision IA comprobantes | Validacion admin vs datos extraidos | Confiabilidad |
| Usuarios activos por rol (7d) | Firebase Auth + logs | Adopcion por segmento |
| Fuente de trafico por cliente | Firebase Analytics UTMs | Que canal convierte |
| Leads por link de agente | Atribucion ref | Performance agentes en redes |
| Embudo conversion landing→cuenta→contratacion | Firebase Analytics | Efectividad paginas publicas |
| Push click-through rate | FCM + Analytics | Engagement notificaciones |

## Garantias Contractuales

| Garantia | Condicion | Consecuencia |
|----------|-----------|--------------|
| Pre-Madrid (dia 11) | Plataforma mostrable el 3 marzo | Reembolso 100% |
| Sistema Cobros (dia 90) | Flujo de pagos funcionando | 30 dias trabajo gratis |
