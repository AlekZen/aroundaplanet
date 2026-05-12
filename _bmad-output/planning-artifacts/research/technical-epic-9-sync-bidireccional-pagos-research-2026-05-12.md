---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - scripts/audit-output/odoo-real-data.json
  - scripts/audit-output/firestore-real-data.json
  - scripts/audit-output/cross-match-result.json
  - memory/session-35-payments-sync-audit.md
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'Epic 9 — Sync bidireccional pagos AroundaPlanet (Firestore↔Odoo↔Documents)'
research_goals: 'Validar 8 puntos técnicos firmes (ir.model.data idempotente, custom fields x_firebase_*, webhooks vs polling, conciliación factura, equivalencia state↔status, patrón Documents PDF expediente, UI dedup 17 duplicados internos Odoo, matriz field-ownership) y formalizar Epic 9 con 7 stories. Restricciones: nunca borrar en Odoo, idempotencia obligatoria, creación solo Firestore→Odoo al verificar, legacy NO se toca solo se enlaza.'
user_name: 'Alek'
date: '2026-05-12'
web_research_enabled: true
source_verification: true
---

# Research Report: Technical — Epic 9 Sync Bidireccional Pagos

**Date:** 2026-05-12
**Author:** Alek
**Research Type:** technical
**Project:** AroundaPlanet

---

## Research Overview

Investigación técnica para Epic 9 (sync bidireccional pagos Firestore↔Odoo↔Documents). Insumos de auditoría real ya recopilados (200 account.payment Odoo + 31 pagos Firestore + cross-match 16h/12m/3l + 17 dup-internos + 26 folder-clusters). El objetivo de la investigación es validar las 8 decisiones técnicas firmes propuestas en sesión 35 contra documentación actual de Odoo 18 Enterprise Online, Firestore y Cloud Functions, antes de formalizar las 7 stories del epic.

---

## Technical Research Scope Confirmation

**Research Topic:** Epic 9 — Sync bidireccional pagos AroundaPlanet (Firestore↔Odoo↔Documents)
**Research Goals:** Validar 8 decisiones técnicas firmes antes de formalizar 7 stories del Epic 9.

**Scope Confirmed:** 2026-05-12

---

## Hallazgos por Punto de Validación

> Niveles de confianza: **A** = doc oficial Odoo 18, **B** = doc oficial + comunidad alineada, **C** = comunidad sólo, **D** = inferido / verificar empíricamente.

### 1. Idempotencia vía `ir.model.data` (external_id) — Confianza **B**

**Hallazgo clave:** External IDs son registros del modelo `ir.model.data`. Mapean un string legible (`module.name`) a un `res_id` numérico. Se pueden crear vía XML-RPC con `execute_kw` sobre `ir.model.data`.

**Patrón idempotente recomendado (cliente-side, 2 calls):**

```ts
// Paso 1: lookup external_id
const found = await odoo.searchRead('ir.model.data', [
  ['module', '=', '__aroundaplanet__'],
  ['name', '=', `payment_${firebasePaymentId}`],
  ['model', '=', 'account.payment'],
], ['res_id'], 1);

if (found.length > 0) {
  // Ya existe → update solo si hay drift autorizado
  return found[0].res_id;
}

// Paso 2: crear payment + external_id en transacción lógica
const paymentId = await odoo.create('account.payment', { ... });
await odoo.create('ir.model.data', {
  module: '__aroundaplanet__',
  name: `payment_${firebasePaymentId}`,
  model: 'account.payment',
  res_id: paymentId,
  noupdate: true,
});
```

**Riesgo identificado:** No es transacción atómica desde XML-RPC. Si Paso 2 falla, queda un `account.payment` huérfano. Mitigación: capturar exception del create de `ir.model.data` → reintentar lookup (race) → si sigue sin existir, marcar pago para reconciliación manual con log Firestore `syncLog/{paymentId}` y exposición en UI admin (Story 9.6).

**Decisión Epic 9:** Adoptar patrón `__aroundaplanet__.payment_{firebasePaymentId}` como external_id canónico. Validar atómicamente en Story 9.2 con script de smoke test contra sandbox Odoo.

_Sources:_
- [Importing External IDs via XML-RPC — Odoo forum](https://www.odoo.com/forum/help-1/importing-external-ids-via-web-servicesxmlrpc-97542)
- [External IDs and Namespaces — Cybrosys](https://www.cybrosys.com/odoo/odoo-books/odoo-16-development/data-management/external-ids-and-namespaces/)
- [External API — Odoo 18.0 docs](https://www.odoo.com/documentation/18.0/developer/reference/external_api.html)

---

### 2. Custom fields `x_firebase_payment_id` / `x_firebase_agent_uid` — Confianza **A**

**Hallazgo clave:**
- Campos custom DEBEN llevar prefijo `x_` (convención Odoo enforced).
- Crear vía Studio (UI) genera `x_studio_*`. Vía API XML-RPC sobre `ir.model.fields` con `state='manual'` permite nombres custom (p.ej. `x_firebase_payment_id`).
- **⚠️ Restricción crítica Odoo Online:** External API requiere **Custom plan**. One App Free / Standard NO tienen API XML-RPC.

**Confirmación tier AroundaPlanet:** Sesión 23 ya demostró XML-RPC funcionando (sync de 108 crm.teams), por tanto estamos en Custom plan → no hay bloqueo.

**Decisión Epic 9:**
- Crear vía Studio (Paloma + DevOps) los dos campos en `account.payment`:
  - `x_firebase_payment_id` (Char, indexed, unique=False — el unique se garantiza con `ir.model.data`)
  - `x_firebase_agent_uid` (Char, indexed)
- Documentar en runbook para reproducción en sandbox.
- **Alternativa rechazada:** crear los campos vía XML-RPC programático en deploy → riesgo de drift entre entornos. Studio + export/import es más auditable.

_Sources:_
- [Custom Fields in Odoo — Dasolo](https://www.dasolo.ai/blog/odoo-data-api-5/custom-fields-odoo-guide-131)
- [Creating Custom Fields and Views in Odoo 18](https://arsalanyasin.com.au/custom-fields-views-odoo-18-for-developers/)
- [Create custom field via XMLRPC — Odoo forum](https://www.odoo.com/forum/help-1/create-custom-field-via-xmlrpc-171760)

---

### 3. Webhooks (`base.automation`) vs polling — Confianza **A**

**Hallazgo clave:**
- Odoo 18 introdujo webhook outgoing nativo dentro de Automation Rules (Studio): trigger sobre `create/write/unlink` → server action de tipo **Webhook** que hace POST con `record._raw_payload` a URL configurada.
- Disponible en Odoo Online (Custom plan) sin módulos OCA adicionales.
- **Limitación rate XML-RPC:** ~60 req/min (consistente con nuestra observación). Webhooks evitan polling y reducen carga.

**Decisión Epic 9:**
- **Estrategia híbrida ganadora:**
  - **Push Odoo→Firestore (preferido):** Automation Rule en `account.payment` (trigger `On Save`, condición `state in ['paid','canceled','rejected']` o cambio en campos relevantes) → webhook POST a Cloud Function `/api/odoo/webhook/payment`. Verificar firma con secret compartido.
  - **Fallback polling cada 15 min:** Cloud Scheduler → función que `search_read` con `write_date > lastSyncCursor`. Cursor persistido en Firestore `syncCursors/odooPayments`. Cubre webhook drop / Odoo downtime.
- Story 9.3 (pull) implementa AMBOS caminos; webhook es optimización post-MVP si tiempo lo permite.

_Sources:_
- [Webhooks — Odoo 18.0 docs](https://www.odoo.com/documentation/18.0/applications/studio/automated_actions/webhooks.html)
- [Automation rules — Odoo 18.0 docs](https://www.odoo.com/documentation/18.0/applications/studio/automated_actions.html)
- [How to Configure Automated Actions — Cybrosys](https://www.cybrosys.com/blog/how-to-configure-automated-actions-in-odoo-18)

---

### 4. Conciliación sin factura (`invoice_status != 'invoiced'`) — Confianza **A**

**Hallazgo clave:**
- Pagos en Odoo NO requieren factura previa. Quedan como **outstanding payment** (cuenta puente "Outstanding Receipts/Payments") y aparecen como crédito disponible cuando la factura se emite después.
- Patrón "down payment / advance" sobre `sale.order` está soportado nativo: el `account.payment` se asocia a la SO; al facturar, el banner azul "Outstanding Credits" permite matchear manualmente o auto-reconcile si está habilitado.
- **Implicación contable AroundaPlanet:** Los pagos por inscripción/anticipo de viaje son típicamente PRE-factura (el viaje no se factura hasta que se entrega). Por tanto crear `account.payment` sin invoice es el flujo correcto.

**Decisión Epic 9:**
- En el push Firestore→Odoo (Story 9.2): crear `account.payment` con `partner_id`, `amount`, `journal_id`, `date`, **NO intentar reconcile** automático.
- Asociar al `sale.order` vía campo `ref` o relation custom `x_sale_order_id` (a evaluar — si la SO ya existe sincronizada, mejor `sale_order_ids` Many2many del módulo `sale`).
- Reconciliación con factura final = responsabilidad de Paloma manual en Odoo. NO la hacemos desde el sync (out-of-scope sprint 1).
- Documentar en Story 9.7: `journal_id` por método de pago (efectivo/transferencia/tarjeta) — mapeo MX se define con Paloma antes de dev.

_Sources:_
- [Payments — Odoo 18.0 docs](https://www.odoo.com/documentation/18.0/applications/finance/accounting/payments.html)
- [Odoo SO Deposits and Down Payments — Steersman](https://steersman.works/a/81-advanced-sale-order-deposits-odoo)
- [register payments without invoice — Odoo forum](https://www.odoo.com/forum/help-1/register-payments-without-invoice-173493)

---

### 5. Equivalencia `state` (Odoo) ↔ `status` (Firestore) — Confianza **B** (parcial)

**Hallazgo clave en Odoo 18:** `account.payment.state` migró en 18 a un set ampliado: `draft → in_process → paid` (+ `canceled`, `rejected`). El `in_process` aparece cuando hay validación intermedia (ej. cheques en tránsito). Para journals de efectivo/transferencia simple, normalmente salta de `draft` directo a `paid` al post + reconciliar.

**Matriz propuesta (dirección de cambios):**

| Evento en AroundaPlanet | Origen | Firestore `status` | Odoo `state` | Acción sync |
|---|---|---|---|---|
| Agente captura pago | Firestore | `pending_verification` | _(no existe aún en Odoo)_ | Solo Firestore. NO crear en Odoo. |
| Admin verifica + datos OK | Firestore | `verified` | crear → `draft` → `posted` (paid si journal auto-validate) | **Firestore→Odoo: create** |
| Admin rechaza | Firestore | `rejected` | _(no existe en Odoo)_ | Solo Firestore. NO crear. |
| Admin solicita info | Firestore | `info_requested` | _(no existe)_ | Solo Firestore. |
| Paloma cambia journal/monto en Odoo | Odoo | espejo solo lectura `odooState`, `odooReconciled`, `odooJournalId` en Firestore | `paid/canceled` | **Odoo→Firestore: update read-only fields** |
| Paloma cancela en Odoo (`canceled`) | Odoo | `status` permanece `verified`, agregar flag `odooCanceledAt` + alerta UI | `canceled` | **Odoo→Firestore: update + alerta** |

**Regla clave (NO NEGOCIABLE):** Firestore `status` y Odoo `state` viven en planos diferentes:
- `status` = ciclo de validación interna AroundaPlanet (pre-Odoo + post-Odoo).
- `state` = ciclo contable Odoo (solo existe tras `verified`).
- **No hay mapping 1:1.** Se proyectan campos espejo (`odooState`, `odooReconciledAt`) en Firestore como read-only; nunca el sync escribe Firestore `status` desde Odoo `state`.

**Decisión Epic 9:** documentar matriz en spec Story 9.1 + Story 9.7. Conflict resolution: ver punto 8.

_Sources:_
- [Skip "In Progress" and Set Directly to Paid — Odoo forum](https://www.odoo.com/forum/help-1/how-to-skip-in-progress-and-set-payment-directly-to-paid-in-odoo-18-279634)
- [Payment Transaction reference — Odoo 18.0](https://www.odoo.com/documentation/18.0/developer/reference/standard_modules/payment/payment_transaction.html)
- [account: payment state PR #181733 — odoo/odoo](https://github.com/odoo/odoo/pull/181733)

---

### 6. Documents API — append a PDF expediente — Confianza **C** (parcial, riesgo alto)

**Hallazgo clave:**
- `documents.document` es wrapper sobre `ir.attachment` con `folder_id` y `tag_ids`. La asociación a un registro se hace con `res_model` + `res_id` sobre `ir.attachment` (no sobre `documents.document` directamente).
- **⚠️ Restricción confirmada:** `res_model` y `res_id` en `ir.attachment` son **read-only por default**. Requiere bypass: o módulo bridge (`documents_account`) o crear el adjunto vía API del modelo destino (ej. `account.payment.message_post(attachment_ids=[...])`).
- **Append a PDF existente NO es operación nativa Odoo.** Odoo trata cada upload como un attachment nuevo. Para "concentrar todo en {Cliente}.pdf" hay 2 caminos:
  - **(A) Cliente-side merge:** descargar PDF existente, mergear con nuevo (pdf-lib server), volver a subir reemplazando attachment (mismo `res_id`).
  - **(B) Carpeta de comprobantes individuales:** subir cada comprobante como attachment separado al `account.payment`, ETIQUETARLOS con tag `comprobante-pago`, dejar que la UI de Odoo Documents los muestre agrupados por folder + filter.

**Recomendación firme:** **Camino (B)**. Razones:
1. Más simple, menos cirugía sobre Odoo.
2. Cada comprobante mantiene trazabilidad individual (auditable por SAT).
3. (A) genera carrera de versiones si Paloma edita en paralelo.
4. La "concentración visual en {Cliente}.pdf" es preferencia operativa, no requisito contable — se puede satisfacer con la vista filtrada de Documents.

**Decisión Epic 9 (Story 9.4):**
- Subir cada comprobante via `ir.attachment` con `res_model='account.payment'`, `res_id={paymentId}` (puede requerir bypass — investigar `mail.thread.message_post` route en spike).
- Tag `aroundaplanet_comprobante` + folder normalizado (Story 9.5).
- Documentar como mejora futura: explorar módulo OCA `documents_account_payment` si existe.
- **Spike obligatorio antes de Story 9.4:** confirmar el método de upload que respeta `res_id` en Odoo Online.

**Normalización folders (Story 9.5):** los 26 folder-clusters detectados confirman patrón `{DESTINO} {MES} {AÑO}`. Aplicar regla: lowercase + remove diacritics + colapsar variantes (`MAYO1` → `MAYO`, `MAYO 2`, `ORIGINAL`, etc.). NO unlink (restricción del usuario) → marcar duplicados con tag `folder-duplicado` + apuntar a folder canónico vía campo custom `x_canonical_folder_id`.

_Sources:_
- [Attachments to documents — Odoo forum](https://www.odoo.com/forum/help-1/attachments-to-documents-281191)
- [set res_id and res_model for ir.attachment — Odoo forum](https://www.odoo.com/forum/help-1/set-res-id-and-res-model-for-ir-attachment-192324)
- [Documents — Odoo 18.0 docs](https://www.odoo.com/documentation/18.0/applications/productivity/documents.html)
- [What's new in Documents V18 — Nalios](https://www.nalios.com/en/blog/whats-new-in-odoo-6/gain-clarity-and-control-new-features-for-organising-sharing-and-securing-your-documents-in-odoo-v18-60)

---

### 7. UI dedup Odoo (17 dup-internos) — Confianza **A** (negocio) / **B** (técnica)

**Hallazgo clave:**
- Restricción usuario: **NO unlink** en Odoo (source of truth contable).
- Odoo 18 introdujo **shortcuts** que permiten apuntar a un documento canónico sin duplicar storage. Aplica a Documents, no a `account.payment`.

**Estrategia (Story 9.1, parte UI):**
1. UI en `/admin/odoo-dedup`: lista los 17 clusters de duplicados internos Odoo (mismo partner + amount + date±1d, no enlazados a Firestore aún).
2. Paloma marca un pago como **canónico** del cluster.
3. Sync agrega tag/category `dup-canonico` al canónico y `dup-secundario` a los demás + custom field `x_canonical_payment_id` apuntando al canónico.
4. El cross-match con Firestore (heurística partner+amount±$1+date±3d) prefiere los `dup-canonico`.
5. NUNCA modifica state ni unlink — auditable.

**Decisión Epic 9:** Story 9.1 entrega esta UI + persiste decisiones en Odoo via tags + custom field. Reversible.

_Sources:_
- [Documents — Odoo 18.0 (shortcuts)](https://www.odoo.com/documentation/18.0/applications/productivity/documents.html)
- (decisión interna AroundaPlanet — restricción de negocio)

---

### 8. Matriz Field-Ownership preliminar — Confianza **B**

**Definiciones:**
- **Odoo-owned**: Odoo es source of truth. Firestore proyecta read-only mirror.
- **Firestore-owned**: Firestore es source of truth. Push a Odoo via custom field `x_*`.
- **LWW (last-write-wins)**: ambos lados editables, ganador por `lastModified` timestamp comparado (con tolerancia de skew ±30s; en conflicto verdadero → UI admin resuelve).
- **None-Odoo-side**: campo solo Firestore (Odoo no lo conoce).

| Campo lógico | Owner | Firestore field | Odoo field | Notas |
|---|---|---|---|---|
| Identidad sync | Bridge | `firestoreId` | `ir.model.data.name` | external_id idempotente (Punto 1) |
| Cliente / partner | Odoo | `clientName` (denorm) | `partner_id` | Cliente vive en `res.partner`. AroundaPlanet sync cliente como Odoo-owned (sesión 31 lo confirma) |
| Monto | LWW | `amount` (centavos) | `amount` (Monetary) | En la práctica NO debería cambiar post-verify. Si cambia: alerta UI |
| Fecha pago | LWW | `paymentDate` (Timestamp) | `date` | Tolerancia ±1 día; ver heurística cross-match |
| Concepto/memo | LWW | `memo` | `ref` | Texto libre, baja criticidad |
| Método de pago / journal | Odoo | `odooJournalId` (mirror) | `journal_id` | Paloma puede reclasificar journal post-verify; Firestore refleja |
| Estado contable | Odoo | `odooState` (mirror) | `state` | Solo Odoo→Firestore. NUNCA al revés |
| Reconciliación | Odoo | `odooReconciledAt`, `odooInvoiceId` | `reconciled`, `move_id` | Mirror, asíncrono |
| Estado validación interna | Firestore | `status` | _(no existe en Odoo)_ | Plano AroundaPlanet (Punto 5) |
| Agente que captura | Firestore | `agentId`, `agentName` | `x_firebase_agent_uid` (mirror Odoo) | Trazabilidad en Odoo para reportes Paloma |
| Datos OCR | Firestore | `ocrData.*` | _(no existe)_ | Solo Firestore |
| URL comprobante | Firestore | `receiptUrl` | `ir.attachment` (con `res_id`) | Punto 6 |
| Decisión verificación | Firestore | `verifiedBy`, `verifiedAt`, `rejectionReason` | _(no existe)_ | Plano AroundaPlanet |
| ID Odoo payment | Bridge | `odooPaymentId` | `id` interno | Llenado post-creación exitosa |

**Resolución de conflictos (LWW):**
- Vector clock liviano: cada lado escribe `{value, source: 'firestore'|'odoo', writtenAt: timestamp}` en metadata del campo.
- Sync detecta conflicto si **ambas** sources tienen `writtenAt > lastSyncCursor` desde la última reconciliación.
- En conflicto: NO auto-merge → encolar en `paymentConflicts/{paymentId}` Firestore → UI admin elige. CRDT completo es over-engineering para volumen actual (~200 pagos/60d).

**Decisión Epic 9:**
- Story 9.7 entrega tabla canónica + Zod schema del payment Firestore con todos los campos `odoo*` mirror.
- Story 9.2 (push) NUNCA escribe a Odoo campos Odoo-owned (idempotencia + safety).
- Story 9.3 (pull) NUNCA escribe a Firestore campos Firestore-owned.

_Sources:_
- [The CRDT Dictionary — Ian Duncan](https://www.iankduncan.com/engineering/2025-11-27-crdt-dictionary/)
- [Building bi-directional sync — marcel.is](https://marcel.is/bidirectional-sync/)
- [Distributed Clocks and CRDTs — Adam Wulf](https://adamwulf.me/2021/05/distributed-clocks-and-crdts/)

---

## Síntesis: Mapa de Decisiones por Story

| Story | Decisión técnica clave (de esta investigación) |
|---|---|
| **9.1** Reconciliación retroactiva + UI dedup Odoo | Read-only matching con heurística partner+amount±$1+date±3d. UI marca canónico via tags `dup-canonico`/`dup-secundario` + `x_canonical_payment_id`. NO unlink. |
| **9.2** Push idempotente Firestore→Odoo | Patrón 2-call con `ir.model.data` external_id `__aroundaplanet__.payment_{firestoreId}`. Trigger único: transición `verified`. Crear `account.payment` SIN reconcile. |
| **9.3** Pull Odoo→Firestore | Híbrido: webhook (Automation Rule) preferido + polling 15min con cursor `write_date`. Solo escribe campos `odoo*` mirror. |
| **9.4** Documents (comprobantes) | Camino B: upload individual via `ir.attachment` con `res_id=paymentId`, tag `aroundaplanet_comprobante`. **Spike previo** para confirmar bypass `res_id` read-only. |
| **9.5** Normalización 26 folder-clusters | Tag duplicados + custom field `x_canonical_folder_id`. NO unlink. Regex `{DESTINO} {MES} {AÑO}` normalizado a minúsculas sin diacríticos. |
| **9.6** UX admin (cola conflictos + dedup) | Cola `paymentConflicts/{paymentId}` para LWW. UI dedup Odoo. UI estado sync con badge per-pago. |
| **9.7** Campos + Zod schema canónico | Tabla field-ownership del Punto 8 codificada en Zod schema `paymentSchema` + custom fields Odoo Studio. Documentación operativa. |

---

## Riesgos y Spikes Recomendados (Pre-Sprint 9)

1. **[Spike A — Story 9.4]** Validar en sandbox Odoo Online que se puede crear `ir.attachment` con `res_model='account.payment'` + `res_id` respetado, vía XML-RPC. Si no se respeta, evaluar `mail.thread.message_post` o módulo bridge.
2. **[Spike B — Story 9.2]** Crear 1 `account.payment` real en sandbox con el patrón `ir.model.data`. Verificar idempotencia (ejecutar 3x el mismo payload).
3. **[Spike C — Story 9.3]** Configurar 1 Automation Rule con webhook outgoing en sandbox apuntando a endpoint stub. Confirmar payload + firma + retry de Odoo.
4. **[Riesgo R1]** Rate limit Odoo Online ~60 req/min: el push masivo retroactivo de Story 9.1 si se decidiera crear external_ids para los 200 legacy podría chocar. **Decisión:** NO crear external_ids legacy, solo enlazar Firestore→Odoo via `odooPaymentId` cuando el match es high-confidence. Los legacy permanecen sin `ir.model.data` propio.
5. **[Riesgo R2]** Studio fields requieren intervención manual: documentar pasos exactos + screenshots en runbook antes de Sprint 9.

---

## Confianza Global y Próximos Pasos

| Área | Confianza | Acción |
|---|---|---|
| Idempotencia external_id | B | Spike B antes de codear 9.2 |
| Custom fields Studio | A | Manual setup pre-sprint |
| Webhooks vs polling | A | Implementar polling primero, webhook fast-follow |
| Conciliación sin factura | A | Documentar, fuera de scope sync |
| State ↔ Status mapping | B | Validar con Paloma antes de 9.7 |
| Documents append PDF | C | **Spike A obligatorio** |
| UI dedup (17 internos) | B | Implementar en 9.1 |
| Field-ownership matrix | B | Codificar en Zod schema 9.7 |

**Listo para formalizar Epic 9** con las 7 stories esbozadas en sesión 35. Recomiendo el siguiente orden:

1. **Próximo paso inmediato:** `/bmad-bmm-create-epics-and-stories` con este documento como insumo principal + `session-35-payments-sync-audit.md`.
2. **Luego:** `/bmad-bmm-create-story` para Story 9.1.
3. **Luego:** Ejecutar Spike A y Spike B en paralelo (1 día c/u) antes de meter mano a 9.2 y 9.4.
4. **Luego:** `/bmad-bmm-dev-story` 9.1.

---
