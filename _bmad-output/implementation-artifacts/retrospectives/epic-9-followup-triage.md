# Epic 9 — Triage de Pendientes Post-Retrospectiva

**Fecha**: 2026-05-16 (sesión 44)
**Insumo**: `epic-9-retrospective.md` líneas 229-241 (10 pendientes documentados al cierre Epic 9)
**Contexto**: cierre Fase 0 (deadline 23-may). Clasificar cada pendiente por owner y decidir si entra al cierre F0, queda como deuda declarada F1, o es responsabilidad externa (Paloma).

## Tabla de clasificación

| # | Pendiente | Owner | Decisión cierre F0 | Justificación |
|---|---|---|---|---|
| 1 | AC9 smoke prod completo 9.4 (7 escenarios end-to-end con pago real `receiptUrl`) | **Equipo AroundaPlanet** (Paloma + agentes piloto) | **Diferido — no bloquea entrega F0** | Requiere pagos reales en prod. NO es trabajo de código nuestro. Story 9.4 ya está `done` con code review Approved with minor. Documentar como "smoke continuo durante operación normal". |
| 2 | AC9 smoke prod completo 9.6 (3-4 escenarios remaining) | **Equipo AroundaPlanet** | **Diferido — no bloquea entrega F0** | Igual que 1. Story 9.6 `done`. Consola de sync admin live en prod, los 3-4 escenarios remaining requieren cola con datos reales acumulados. |
| 3 | Automation Rule webhook Odoo (Paloma manual, runbook 9-3 paso 6) | **Paloma (Odoo admin)** | **Externa — comunicar en entrega formal** | Configuración en Odoo Studio que solo Paloma puede hacer. Sin esto, latencia pull es p50 7min en lugar de <30s. Webhook endpoint LIVE esperando. Documentado en runbook 9-3 paso 6 con Plan A (python_code HMAC) y Plan B (query param). |
| 4 | Cleanup `45803` ACL-locked manual Paloma (heredado spike 9.0a) | **Paloma (Odoo admin)** | **Externa — comunicar en entrega formal** | 1 attachment `ir.attachment` con `res_id=0` huérfano. NO afecta operación. NUNCA `unlink` desde nuestro lado (restricción firme). |
| 5 | Feature flags `ODOO_FOLDER_AUTO_ASSIGN` / `ODOO_FOLDER_AUTO_CREATE` (default `false`) | **Nosotros — F1 explícito** | **Diferido F1** | Solo se necesitan si hay demanda de auto-assignación. Default `false` significa que hoy no se invoca. Requiere también passing `tripDestino` + `paymentDate` desde caller. NO bloquea cierre F0. |
| 6 | Investigar API key residual `AIzaSyC_JR5E4...` en bundle prod | **Nosotros — apply F0 si tiempo permite** | **🟡 Investigar entre 18-20 may** | Bundle de prod tiene una API key que no está en `.env.local` ni en repo. Origen desconocido (probable residuo de build anterior). NO bloquea (SDK reintenta), pero ensucia entrega formal. Investigar en sesión próxima; si fix es trivial, aplicar; si requiere rebuild profundo, declarar como deuda F1 documentada. |
| 7 | `/admin/verification/{id}` página dinámica de detalle | **Nosotros — F1 explícito** | **Diferido F1** | Mejora UX, no entregable contractual. Hoy el detalle se ve en panel derecho de `/admin/verification`. NO bloquea F0. |
| 8 | Mejorar label "Éxito 24h: 0%" KPI con tooltip | **Nosotros — apply F0** | **🟢 Apply 20-may** | Es una mejora UX de 30 min. Aclara qué significa el KPI a Paloma/Noel cuando vean la consola de sync. Bajo costo, alto retorno de claridad para entrega formal. |
| 9 | Bug pre-existente Next 16 Turbopack workers en `/api/agents/[agentId]/clients` y `/metrics` (heredado, NO Epic 9) | **Nosotros — apply F0 con `/bmad-correct-course`** | **🔴 Apply 19-may (diagnóstico) — workaround o fix** | Bug visible en prod (500 reales reportados en MEMORY.md). Bloquea Epic 4 Story 4-3 (F1). Si fix es factible en 2-3h, aplicar. Si requiere rework de proxy/middleware, documentar workaround específico (ej: fallback handler) y declarar como deuda F1 con riesgo conocido. NO declarar `done` silenciosamente. |
| 10 | Runbook permanente `odoo-18-gotchas.md` (consolidar lección 12) | **Nosotros — apply F0 (REEMPLAZA Story 10.3)** | **🟢 Apply 17-18 may** | Convenio Sub-fase B pide "Mapeo completo de Odoo". Ya existe en repo de estrategia (`execution/infraestructura/odoo/`) pero los gotchas técnicos Epic 9 viven solo en retrospectiva. Runbook destila los 12 hallazgos técnicos a un solo archivo accionable. Reemplaza Story 10.3 admin. |
| 11 | 5 findings Low 9.6 + 3 Low 9.4 + 2 Low 9.3 = **10 Low findings sin aplicar** | **Nosotros — decisión batch** | **🟡 Decisión 20-may (apply batch o dismissal documentado)** | Los review docs existen pero los findings Low no se aplicaron. Opciones: (a) sesión de batch-apply 20-may (~1h), (b) dismissal explícito documentado en epic-9-retrospective como "aceptados conscientemente como deuda". Preferencia: (a) si tiempo permite. |

## Resumen por bucket

### 🔴 Bloqueante para entrega "chingón" (apply F0)

- **#9** Bug Next 16 Turbopack `/api/agents/[agentId]/*` — diagnosticar 19-may, fix o workaround documentado

### 🟡 Apply F0 si tiempo permite

- **#6** Investigar API key residual (18-20 may)
- **#10** 10 Low findings batch-apply (20-may)
- **#8** Tooltip "Éxito 24h" KPI (20-may, 30 min)

### 🟢 Apply F0 como sustituto de Story 10.3

- **#10 retro** Runbook `odoo-18-gotchas.md` (17-18 may) — REEMPLAZA Story 10.3 admin

### Diferidos F1 (deuda declarada en propuesta F1 ajustada)

- **#1** AC9 smoke 9.4 — ejecución continua durante operación
- **#2** AC9 smoke 9.6 — ejecución continua durante operación
- **#5** Feature flags folder auto-assign/auto-create
- **#7** `/admin/verification/{id}` página dinámica

### Externos (responsabilidad Paloma — comunicar en entrega formal)

- **#3** Automation Rule webhook Odoo (runbook 9-3 paso 6 entregado a Paloma)
- **#4** Cleanup `45803` ACL-locked manual

## Acciones para entrega formal Fase 0 (22-may)

El documento de entrega formal (lo escribe el agente del repo de estrategia) debe incluir:

1. **Sección "Estado del sync bidireccional Firestore↔Odoo"** explicando que Epic 9 está cerrado en prod con 7 stories funcionales + 2 spikes, 1660 tests pass, 0 regresiones.
2. **Pendientes externos para Paloma** (#3, #4) con runbook adjunto (runbook 9-3 paso 6 ya existe en este repo).
3. **Deuda técnica declarada F1** (#1, #2, #5, #7) con justificación de por qué difieren.
4. **Mejoras aplicadas pre-entrega** (#6, #8, #9, #10) con commit hashes.

## Decisión

Los items #1, #2, #3, #4 NO se cierran como "abandonados" — quedan documentados como pendientes operativos normales (smoke continuo) o externos (Paloma). Los items #5, #7 entran al backlog F1 explícito. Los items #6, #8, #9, #10 (retro) + runbook odoo-18-gotchas se trabajan entre 17-20 may en el plan revisado.

Este triage se incorpora al cierre del Epic 9 — NO requiere reabrir el epic ni reescribir la retrospectiva. Sirve como insumo para la entrega formal Fase 0 (22-may) y para el agente del repo de estrategia.
