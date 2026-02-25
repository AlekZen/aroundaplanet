# User Journeys

## Journey 1: Visitante Anonimo → Cliente (Conversion Organica)

**Protagonista:** Diego, 32 anos, CDMX. Vio un reel de AroundaPlanet en Instagram sobre la Vuelta al Mundo.

**Opening Scene:** Diego scrollea Instagram a las 10 PM. Ve un reel con fotos espectaculares de la Vuelta al Mundo — fotos REALES de viajeros anteriores publicadas desde su portal (UGC). El reel tiene link en bio.

**Rising Action:**
1. Click en link → llega a `/viajes/vuelta-al-mundo-33-dias` (landing publica). UTM capturado: `utm_source=instagram&utm_medium=social`
2. Ve: galeria (fotos profesionales + UGC viajeros reales), itinerario interactivo, precio ($145K MXN), ocupacion "80% — quedan 7 lugares" (Odoo Events), testimonios reales con fotos
3. Click **"Cotizar / Apartar mi lugar"** → selecciona fecha de salida disponible (multiples salidas via Odoo Events)
4. Modal login/registro → crea cuenta con Google (1 click) → automaticamente rol **Cliente**
5. Se crea orden en estado **"Interesado"** (no confirmado)
6. Si llego con `?ref=lupita` → se asigna automaticamente a Lupita como agente (primer toque gana). Si llego sin ref → admin recibe push "Nuevo lead desde landing" y asigna agente (round-robin o manual)
7. Agente asignado recibe push: "Nuevo prospecto: Diego — VaM Julio" → deep link a `/agente/mis-clientes/diego`
8. Firebase Analytics registra: `sign_up` + `begin_checkout` + atribucion UTM/ref

**Climax:** Diego aterriza en `/mis-viajes`. Ve "Vuelta al Mundo 33.8 dias — Interesado". Agente lo contacta para cerrar. Cuando confirma, la orden pasa a "Confirmado" y arranca flujo de pagos con plan de pagos asignado.

**Resolution:** Si no confirma inmediato, push de seguimiento a los 3 dias: "Tu Vuelta al Mundo te espera — quedan 5 lugares" → deep link. Lead queda en pipeline de conversion (Odoo CRM).

**Error paths:**
- Registro falla → error claro con retry, no pierde viaje seleccionado
- No confirma nunca → lead en CRM para recuperacion (Fase 1)
- ref de agente conflictivo → primer toque gana, historial de atribucion visible

**Requisitos revelados:** Landing pages publicas SEO con UGC, registro frictionless, paso cotizacion/interesado antes de pago, asignacion agente por ref o round-robin, multiples salidas por viaje (Odoo Events), atribucion UTM, transicion seamless publico→privado.

---

## Journey 2: Carmen — Cliente Recurrente con Historial

**Protagonista:** Carmen, 45 anos, Guadalajara. 3 viajes completados con AroundaPlanet ($280K pagados). Pagando su 4to: Vuelta al Mundo.

**Opening Scene:** Carmen abre la PWA (instalada en home screen). Login automatico.

**Rising Action:**
1. `/inicio` → viaje activo "Vuelta al Mundo — 69% pagado", ultimo pago verificado hace 3 dias
2. `/mis-viajes` → 4 viajes: Europa 2024 (completado), Asia 2025 (completado), Argentina 2025 (completado), Vuelta al Mundo (en curso)
3. Click Europa 2024 (viaje pasado, habilitado post-viaje) → ve su experiencia: fotos que subio, resena, calificacion 5 estrellas
4. Sube 5 fotos nuevas → toggle por foto: **"Publicar en landing"** (on/off). Fotos marcadas aparecen en `/viajes/europa` para visitantes. Admin modera antes de publicar
5. Click **"Compartir mi experiencia"** → genera card para redes: "Mi viaje a Europa con AroundaPlanet" + foto + link con `utm_source=ugc&utm_campaign=carmen`
6. Regresa a viaje activo. Ve plan de pagos:
   - Total: $145,000
   - Pagado: $100,000 (69%)
   - Siguiente pago sugerido: $15,000 (fecha limite: 15 marzo)
   - O pagar otra cantidad: [____]
7. Click **"Realizar pago"** → sube foto comprobante transferencia BBVA
8. Firebase AI Logic analiza: extrae $20,000, fecha, referencia, banco. Carmen confirma con 1 tap → enviado
9. Push a admin (Mariana): "Nuevo pago de Carmen — $20K VaM"
10. `/mis-pagos` → timeline completa de TODOS sus viajes, todos los pagos con status

**Climax:** 2 horas despues, push: "Tu pago de $20,000 fue verificado — llevas 83% de tu Vuelta al Mundo" → deep link a `/mis-viajes/vuelta-al-mundo`. Barra de progreso se mueve.

**Resolution:** Carmen tiene historial completo visible, sus fotos generan trafico organico a landings. Datos fiscales en `/mi-perfil` ya completos para facturacion automatica.

**Timeline UGC por estado del viaje:**
- Antes del viaje → solo itinerario, documentos, progreso pagos
- Durante el viaje (fecha inicio <= hoy <= fecha fin) → se habilita "Subir fotos del viaje" en tiempo real
- Despues del viaje → se habilita "Compartir experiencia": fotos, resena, calificacion, toggle publicar en landing
- Siempre → puede ver y editar sus fotos/resenas previas

**Error paths:**
- IA no lee comprobante (foto borrosa) → campos vacios para llenado manual, nunca se traba
- Pago rechazado → push: "Tu pago necesita correccion: [motivo]" → deep link a `/mis-pagos/[id]`
- Foto UGC inapropiada → moderacion admin antes de publicar en landing

**Requisitos revelados:** Historial multi-viaje, plan de pagos con sugerencia, galeria UGC con toggle publico/privado y moderacion, compartir en redes con atribucion, timeline pagos cross-viaje, IA comprobantes con fallback manual.

---

## Journey 3: Lupita — Agente Freelance (Reporta Pago + Ve Su Negocio)

**Protagonista:** Lupita, 29 anos, Cancun. Agente freelance, 12 clientes activos. Tambien pagando su propio viaje a Peru.

**Opening Scene:** Roberto (cliente de Lupita) manda WhatsApp: "Ya transferi $15,000 para la Vuelta al Mundo". Lupita abre la PWA.

**Rising Action:**
1. Login → `/inicio`. Sidebar unificado muestra todas sus secciones:
   - Mi Portal (viajera): Inicio, Mis Viajes, Mis Pagos
   - Mi Negocio (agente): Mis Clientes, Mis Comisiones, Catalogo
2. Navega a **Mi Negocio → `/agente/mis-clientes`**. Ve 12 clientes con status. Busca "Roberto"
3. Click Roberto → perfil, viaje activo (VaM, 45% pagado), historial pagos
4. Click **"Reportar pago"** → camara abre, foto del comprobante que Roberto mando
5. IA extrae: $15,000, HSBC, ref 8834721, fecha hoy. Lupita confirma → 3 toques total
6. Push a Mariana (admin): "Nuevo pago — Roberto via Lupita, $15K VaM"
7. `/agente/mis-comisiones` → comision acumulada mes: $18,500 de 4 pagos verificados. Detalle por cliente
8. `/agente/catalogo` → viajes disponibles. Copia link personalizado: `aroundaplanet.com/viajes/vuelta-al-mundo?ref=lupita`. Lo pega en su story de Instagram
9. Si alguien crea cuenta desde ese link → autoasignado a Lupita. Push: "Nuevo cliente desde tu link: [nombre]"
10. Cambia a **Mi Portal → `/mis-viajes`** → su viaje a Peru (60% pagado). Sube su propio comprobante como Cliente

**Climax:** En UN lugar: 12 clientes, $180K ventas del mes, comision, Y su propio viaje. Nadie mas ve sus datos.

**Resolution:** Push lunes: "Esta semana: 3 pagos verificados ($45K), comision +$5,400. Tu viaje a Peru: 60%" → deep link a `/agente/resumen`.

**Error paths:**
- Roberto no tiene cuenta → Lupita reporta pago en nombre de Roberto (admin asigna despues)
- Comision no cuadra → detalle de calculo visible, puede enviar disputa
- Lead crea cuenta sin ref → admin asigna manualmente, regla primer toque gana para ref existente

**Requisitos revelados:** Sidebar unificado sin toggle, reporte pago en nombre de cliente, link atribucion agente con autoasignacion, comisiones detalladas, contexto agente↔cliente seamless.

---

## Journey 4: Mariana — Admin Verifica Pagos

**Protagonista:** Mariana, 34 anos, oficina Ocotlan. 9 AM.

**Opening Scene:** Push resumen 8 AM: "Hoy: 7 pagos pendientes (2 urgentes >48h), 15 verificados ayer" → deep link a `/admin/verificacion`.

**Rising Action:**
1. `/admin/verificacion` → cola priorizada: 2 urgentes (amarillo) arriba, 5 nuevos debajo
2. Click pago urgente #1: split-screen. Izquierda: comprobante (foto) + datos IA prellenados (monto $15K, HSBC, ref 8834721). Derecha: datos resaltados para comparacion manual con banca en linea (MVP no tiene API bancaria)
3. Datos coinciden → click **"Verificar"** (1 clic). NotificationService dispara:
   - Push a Lupita (agente): "Pago de Roberto verificado — $15K" → `/agente/mis-clientes/roberto`
   - Push a Roberto (cliente): "Tu pago fue verificado — llevas 60%" → `/mis-viajes/vuelta-al-mundo`
   - Incluido en resumen nocturno de Noel (si >umbral)
   - WhatsApp Odoo template a Roberto: confirmacion de pago
   - Registro en Odoo `account.move`
4. Pago #2: datos IA no coinciden (monto diferente). Click **"Rechazar"** → motivo: "Monto no coincide". Push a agente con motivo y deep link
5. Verifica 4 de los 5 nuevos en 3 minutos. El 5to es de cliente sin agente (creo cuenta solo desde landing) → verifica y asigna agente
6. 9:15 AM — cola vacia. `/admin/clientes` → cliente necesita factura → datos fiscales ya en su perfil → genera factura Odoo 1 click

**Climax:** 7 pagos en 8 minutos. Antes eran 45 minutos de WhatsApp.

**Resolution:** Final del dia, `/admin/metricas`: 23 pagos verificados, tiempo promedio 1.2 min/pago, 0 pendientes. Sin registro manual.

**Error paths:**
- IA extrajo datos incorrectos → Mariana corrige manualmente, feedback mejora modelo
- Comprobante duplicado → sistema detecta referencia duplicada, alerta
- Pago de cliente sin cuenta → procesa, sistema guarda para cuando cliente cree cuenta

**Requisitos revelados:** Cola priorizada con urgencia visual, split-screen verificacion con comparacion manual asistida por IA (MVP), rechazo con motivo, asignacion agente desde admin, deteccion duplicados, metricas productividad automaticas.

---

## Journey 5: Noel — Director Remoto desde Madrid

**Protagonista:** Noel, 37 anos, Madrid, 11 PM (4 PM Mexico).

**Opening Scene:** Push resumen diario: "Hoy: 12 pagos verificados ($187K), VaM al 85%, 0 alertas. Todo en orden." → deep link a `/dashboard`.

**Rising Action:**
1. `/dashboard` → panel ejecutivo: ventas brutas mes con comparativa vs anterior, ocupacion por viaje (semaforo), ranking top 5 agentes, cobranza pendiente
2. Cambia dimension temporal: mes → trimestre → ano. Tendencia: +15% YoY. Comparativa feb 2025 vs feb 2026
3. Click "Vuelta al Mundo" → `/dashboard/viajes/vuelta-al-mundo`: 34/40 lugares, $4.2M facturado, 6 pagos pendientes, lista viajeros con % pagado
4. Widget "De donde vienen mis clientes": Instagram 45%, Google 20%, agentes 30%, otros 5%. Click Instagram → posts que mas convirtieron
5. Widget "Performance agentes": Lupita #1, 8 leads desde links este mes. Click → detalle por lead
6. `/dashboard/cobranza` → $14.9M pendientes. Filtra >30 dias: 3 clientes atrasados significativos
7. Cambia a **Mi Portal → `/viajes`** → compra viaje Europa para su esposa como regalo. Sube comprobante como Cliente

**Climax:** Madrid 11 PM. Todo bien. Dashboard dice todo sin preguntar a nadie. Ademas compro viaje para su familia. Cierra celular, duerme.

**Resolution:** Push lunes 9 AM Madrid: "Semana 8: $890K ventas brutas (+12%), 34 pagos verificados, 3 agentes nuevos activos, VaM 85%. Top: Lupita" → `/dashboard/semanal`.

**Error paths:**
- Alerta excepcion: "Agente Marco inactivo >7 dias" → push → `/dashboard/agentes/marco`
- Dato raro → drill-down hasta orden individual en Odoo via proxy
- Internet inestable Madrid → PWA muestra ultimo snapshot cacheado con indicador "ultima actualizacion: hace 2h"

**Requisitos revelados:** Dashboard BI multi-temporal con drill-down, widgets trafico y performance agentes, alertas excepcion, resumenes programados, PWA cache offline, Director tambien es Cliente.

---

## Journey 6: SuperAdmin (Alek) — Gestion de Usuarios y Sistema

**Protagonista:** Alek, administrando la plataforma.

**Opening Scene:** Noel manda WhatsApp: "Tengo 5 agentes nuevos. Y Sofia ya no trabaja con nosotros."

**Rising Action:**
1. `/admin/usuarios` → Panel SuperAdmin (solo Noel + Alek)
2. Click **"Sincronizar con Odoo"** → jala usuarios nuevos de `res.users`. 5 contactos sin rol
3. Para cada uno: asignar rol **Agente** desde dropdown. Sistema crea acceso, envia invitacion email + push
4. Busca "Sofia" → toggle **Desactivar**. Pierde acceso Agente pero historial Cliente permanece. Sus clientes quedan sin agente → alerta a Mariana para reasignar
5. Noel pide acceso dashboard para su esposa (read-only). Busca perfil → ya tiene cuenta Cliente. Agrega rol **Director** read-only
6. `/admin/configuracion` → ajusta umbral "pago grande" de $50K a $30K para pushes de Noel

**Climax:** 5 agentes con acceso en 3 minutos. Sofia desactivada sin perder datos. Esposa con dashboard. Sin tocar codigo.

**Resolution:** 5 agentes reciben email bienvenida con link PWA. Al login ven sus clientes seeded desde Odoo.

**Error paths:**
- Agente no esta en Odoo → crear usuario manual sin seed
- Error sincronizacion → log errores visible en panel, retry manual
- Permiso especifico fuera de roles estandar → backlog para permisos granulares custom

**Requisitos revelados:** CRUD usuarios, asignacion roles UI, sync Odoo, desactivacion sin borrar, roles read-only, configuracion umbrales/horarios, log errores sync.

---

## Journey 7: Agente Resistente — Edge Case No-Adopcion

**Protagonista:** Marco, 52 anos, agente freelance de vieja guardia.

**Opening Scene:** Marco sigue mandando comprobantes por WhatsApp. El grupo ya tiene menos actividad.

**Rising Action:**
1. Su cliente Fernanda llama a oficina por saldo. Mariana abre `/admin/clientes/fernanda` → ve todo inmediato
2. Mariana reporta pago de Fernanda EN NOMBRE de Marco (admin como proxy). Flujo funciona sin Marco
3. Marco NO ve comisiones, clientes, pushes. Lupita si — y presume en grupo de agentes
4. Noel ve en dashboard: "Marco: 0 pagos en plataforma, 100% via admin proxy". Dato objetivo
5. Noel habla con Marco. "Tus companeros ya ven todo. Tu tambien puedes"
6. Marco cede, instala PWA. Login → ve SUS 8 clientes, comisiones. "Esto si esta bueno"

**Climax:** Adopcion sin forzar. Sistema funciono sin el. Ventaja visible de adoptantes creo presion social natural.

**Resolution:** Marco activo. WhatsApp pierde otro miembro. Masa critica en plataforma crece.

**Requisitos revelados:** Admin como proxy agente, sistema funcional con adopcion parcial, metricas adopcion por agente visibles para Director.

---

## Journey Requirements Summary

| Capability | Journeys | Prioridad |
|-----------|----------|-----------|
| Landing pages publicas SEO con UGC y testimonios | J1, J2 | P1 Pre-Madrid |
| Registro frictionless → Cliente automatico | J1, J2 | P1 |
| Paso cotizacion/interesado antes de confirmar | J1 | P1 |
| Roles aditivos (todos son Cliente base) | J3, J5, J6 | P1 |
| Panel SuperAdmin gestion usuarios/roles | J6, J7 | P1 |
| Dashboard BI multi-temporal con drill-down | J5 | P1 |
| PWA instalable con cache offline | J2, J5 | P1 |
| Firebase Analytics + UTMs + Meta Pixel + Google Tag | J1, J5 | P1 |
| Sidebar unificado dinamico por roles (sin toggle) | J3, J5 | P1 |
| Reporte pago con IA (foto → datos → confirma) | J2, J3 | P2 |
| Cola verificacion admin split-screen con IA asistida | J4 | P2 |
| NotificationService push+WA+email con deep links | J2, J3, J4, J5 | P2 |
| Plan de pagos con sugerencia de proximo pago | J2 | P2 |
| Preferencias notificacion dinamicas por rol | J2, J3, J4, J5 | P2 |
| Historial multi-viaje por cliente | J2 | P2 |
| Asignacion agente por ref (autoasignacion) o round-robin | J1, J3 | P2 |
| Portal agente: clientes, comisiones, catalogo | J3 | P3 |
| Link agente con atribucion por viaje | J3, J1 | P3 |
| Galeria fotos UGC con toggle publico/privado + moderacion | J2 | P3 |
| Compartir experiencia en redes con atribucion | J2, J1 | P3 |
| CRUD viajes Odoo↔Firestore con multiples salidas (Events) | J1, J5 | P3 |
| Admin como proxy del agente resistente | J4, J7 | P3 |
| Perfil unificado (foto, fiscales, banco, notificaciones) | J2, J3 | Transversal |
| Navegacion dual publica/privada | Todos | Transversal |
| Deteccion duplicados comprobantes | J4 | Transversal |
| Firebase Storage estructura organizada | J2, J4 | Transversal |
| Metricas adopcion por agente | J5, J7 | Transversal |

## Reglas de Asignacion de Leads

| Prioridad | Regla |
|-----------|-------|
| 1 | Si tiene `?ref=agentId` → asignar a ese agente (atribucion directa, primer toque gana) |
| 2 | Si referido por cliente existente (futuro) → asignar al agente del cliente referente |
| 3 | Sin ref → lead sin agente → admin asigna (round-robin o manual) |
| 4 | Conflicto reasignacion → agente original mantiene atribucion en historial |

## Firebase Storage Structure

```
storage/
├── users/{uid}/
│   ├── profile/avatar.jpg
│   ├── documents/passport.jpg
│   └── fiscal/constancia-sf.pdf
├── payments/{paymentId}/
│   └── receipt.jpg
├── trips/{tripId}/
│   ├── hero/                    ← fotos oficiales landing
│   ├── gallery/                 ← fotos curadas por admin
│   └── ugc/{uid}/               ← fotos viajeros (por usuario)
│       ├── photo1.jpg
│       └── photo2.jpg
└── bank-statements/{date}/
    └── statement.pdf
```
