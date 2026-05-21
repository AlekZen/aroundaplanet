# Sprint Plan: cierre Fase 0 (3 días restantes)

**Generado:** 2026-05-20 sesión 46
**Deadline contractual:** 2026-05-23 (sábado, Cláusula Tercera convenio v4.0)
**Días útiles restantes:** jueves 21 + viernes 22 + sábado 23 (entrega)
**Fuente de verdad:** `D:\dev\AlekContenido\Areas\Proyectos\AroundaPlanet\execution\plan-cierre-fase-0-may-2026.md`

---

## Estado al cierre miércoles 20

### ✅ Entregado y desplegado en producción
- Epic 1-9: completos
- Story 10.1 + 10.1.1 + 10.1.2 + 10.1.3: deployed (PDFs contratos + 5 viajes piloto + UI órdenes/cotizaciones)
- Story 10.2: PRD consolidado
- Story 10.3: runbook `odoo-18-gotchas.md`
- Story 10.4: roadmap transformación visual
- Story 10.6: agente ve recibo + contrato (deployed hoy, awaiting user smoke)

### ⏳ Pendiente para cierre
- Story 10.5: Sub-fase C (DNS + manuales + entrega formal + propuesta F1)
- Smoke usuarios pendiente: 10.1 / 10.1.3 / 10.6 (champions confirman en grupo WhatsApp)
- Epic 10 retrospective

### ⚠️ Bugs activos abiertos
- Ninguno crítico al momento. 1 reporte WhatsApp Noel (visibilidad agente) → resuelto y desplegado hoy.

### 🔮 Diferido formalmente a Fase 1 (NO bloquea cierre)
- Story 10.6 Camino A: mapping automático `odoo_team_id → agentId Firestore`
- PDF de abono automático post-verificación (Noel solicitó)
- Botón Reintentar para pagos "Sync demorado" (hoy solo `error`/`orphan`)
- Detector duplicados Odoo: regla `diff create_date > 24h ⇒ excluir cluster`
- Vista `/admin/trips/[tripId]/sales`: fallback `amount_invoiced` para órdenes legacy sin invoice
- Banner contrato sin tripId: CTA "Asignar viaje"
- Epic 4-3: Referral Links & Lead Notifications
- Epic 5-7: dashboard director, notificaciones, UGC cliente

---

## Plan por día

### 🟢 Miércoles 20 (HOY) — RESTANTE

| # | Tarea | Estimate | Responsable | Status |
|---|---|---|---|---|
| 1 | Enviar mensaje WhatsApp al grupo con instrucciones de smoke Story 10.6 + ayer | 5min | Alek | Listo para enviar |
| 2 | Monitorear grupo WhatsApp por reportes en tiempo real | tarde | Alek + Claude | activo |
| 3 | Triage rápido de cualquier bug reportado: ¿blocker cierre o F1? | reactivo | Claude | reactivo |

**Definition of Done día**: mensaje enviado + champions notificados + cero bugs blocker abiertos al cerrar el día.

---

### 🟡 Jueves 21 — Sub-fase C arranca + smoke triage

**P0 (bloquea cierre)**

| # | Tarea | Estimate | Status |
|---|---|---|---|
| 1 | Triage matutino reportes WhatsApp del día anterior | 30min | pending |
| 2 | Fix de blockers de smoke (si surgen) — *capacity 2-3h reservada* | hasta 3h | reactivo |
| 3 | **10.5.a** DNS: configurar `aroundaplanet.com` apuntando a App Hosting + SSL cert | 1-2h | pending |
| 4 | **10.5.b1** Manual operativo admin: revisar `_bmad-output/manuals/manual-admin.md`, actualizar con flujo "Sin agente" recién creado + screenshots | 1.5h | pending |
| 5 | **10.5.b2** Manual operativo agente: revisar `manual-agente.md`, agregar sección "Recibos y contratos de mis clientes" (Story 10.6) + screenshots | 1.5h | pending |

**P1 (deseable cierre)**

| # | Tarea | Estimate | Status |
|---|---|---|---|
| 6 | **10.5.b3** Manual cliente: revisar `manual-cliente.md` está al día con PWA install + abonos | 45min | pending |
| 7 | **10.5.b4** Runbook ops básico: cómo correr `/deploy`, dónde están los logs, qué hacer si Odoo cae | 1h | pending |

**Definition of Done día**: DNS funcionando + 3 manuales revisados con Story 10.6 incorporada + runbook ops mínimo.

---

### 🟡 Viernes 22 — Cierre formal

**P0 (bloquea cierre)**

| # | Tarea | Estimate | Status |
|---|---|---|---|
| 1 | Triage matutino reportes WhatsApp | 30min | pending |
| 2 | Fix de blockers que queden — *capacity 2h reservada* | hasta 2h | reactivo |
| 3 | **10.5.c1** Documento entrega formal Fase 0: redactar PDF/MD con lo entregado vs convenio v4.0 Cláusula Tercera (checklist firmable) | 2h | pending |
| 4 | **10.5.c2** Demo grabada (Loom o similar): walkthrough de los 5 viajes piloto + flujo Sin agente + ver recibo agente, ~10min | 1.5h | pending |
| 5 | **10.5.d** Propuesta Fase 1 ajustada: documento con lo diferido (Camino A 10.6, PDF abonos, dashboards director, notificaciones, Epic 5-7) + estimate + nuevo deal | 2h | pending |

**P1**

| # | Tarea | Estimate | Status |
|---|---|---|---|
| 6 | Epic 10 retrospective | 1h | pending |

**Definition of Done día**: documento entrega listo para firma + demo grabada + propuesta F1 lista para conversar con Noel.

---

### 🔴 Sábado 23 — DEADLINE entrega

| # | Tarea | Estimate | Status |
|---|---|---|---|
| 1 | Smoke final: prod responde, todos los flujos críticos funcionan | 30min | pending |
| 2 | Enviar a Noel: documento entrega + demo + propuesta F1 + acceso final a manuales | 30min | pending |
| 3 | Mensaje formal WhatsApp grupo: "Fase 0 entregada" | 10min | pending |
| 4 | **Freeze de cambios en master** salvo bugs P0 reportados explícitamente | resto del día | guard |

**Definition of Done día / Fase 0**: 
- Documento entrega enviado y acusado
- Plataforma viva sirviendo sin incidentes
- Cero issues abiertos sin clasificar
- Propuesta F1 sobre la mesa

---

## Capacity y riesgo

**Capacity restante**: ~16 horas útiles distribuidas (jue 8h + vie 8h + parte sáb).
**Bookings**: ~13.5h en P0 + P1 según tabla.
**Buffer**: ~2.5h para imprevistos / smoke fixes / iteración en docs.

### Top 3 riesgos

1. **Champions reportan blocker grave en smoke 10.6 o 10.1.3** (probabilidad: media; impacto: alto)
   - Mitigación: capacity de fixes reservada (3h jue + 2h vie). Si exceden, escalar a Noel para mover a F1.

2. **DNS aroundaplanet.com tarda en propagar** (probabilidad: baja; impacto: medio)
   - Mitigación: ejecutar primer cambio DNS jueves AM. Si no propaga en 24h, entregar Fase 0 con URL `aroundaplanet--arounda-planet.us-east4.hosted.app` y diferir cambio a Fase 1.

3. **Sub-fase C documentación se hace más larga que estimate** (probabilidad: media; impacto: bajo)
   - Mitigación: usar plantillas existentes en `manual-*.md` + ediciones quirúrgicas. NO redactar desde cero.

### Punto de no-retorno

**Viernes 22 mediodía** — si en ese punto NO hay documento entrega y demo grabados, convocar a Noel para conversación de adenda Cláusula 12 (extensión Sub-fase C a primera semana de junio sin cambio de scope F1).

---

## Lo que NO entra a este sprint (firme)

Para gestionar expectativas con el equipo y evitar scope creep en los últimos 3 días, estas piezas se reservan para Fase 1 con su deal correspondiente:

- Mapping automático agentes Odoo↔plataforma (Camino A Story 10.6)
- PDF recibo abono automático post-verificación
- Botón Reintentar para pagos "Sync demorado"
- Detector duplicados Odoo regla 24h
- Vista ventas con fallback amount_invoiced
- Epic 4-3 (referral links + lead notifications)
- Epic 5 (dashboard director)
- Epic 6 (notificaciones FCM + WhatsApp)
- Epic 7 (UGC cliente + reviews)
- Documents Odoo dedup retroactivo masivo (Epic 8 ya cubre el mecanismo, queda data cleanup que es operativo de Paloma)

Estas piezas se documentan en la propuesta F1 (tarea vie 22) con estimate y prioridad para conversar con Noel.

---

## Comunicación al equipo

- **Hoy 20 PM**: mensaje WhatsApp con instrucciones de smoke (ya redactado, pendiente enviar)
- **Jue 21 AM**: ack de reportes recibidos + plan del día
- **Vie 22 EOD**: aviso "mañana entrego documento formal"
- **Sáb 23**: entrega formal + freeze
