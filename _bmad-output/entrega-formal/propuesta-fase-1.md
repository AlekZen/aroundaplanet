![AroundaPlanet](/images/aroundaplanet-logo.png)

# Propuesta Fase 1 — AroundaPlanet

**Documento:** entrega-formal/propuesta-fase-1
**Versión:** 1.0
**Fecha:** 2026-05-20
**Cliente:** AroundaPlanet · Noel Sahagún Cervantes
**Prestador:** TransformIA · Alek Zen

> Documento de referencia interna. La propuesta comercial canónica con pricing detallado vive en `D:\dev\AlekContenido\Areas\Proyectos\AroundaPlanet\execution\pricing-catalogo-upsell-fase1-16-may-2026.md`. Este documento integra el scope técnico identificado durante Fase 0 con la propuesta comercial para revisión interna previa a la conversación con Noel.

---

## 1. Contexto

Fase 0 cerró con el alcance literal del Convenio v4.0 cumplido al 100% más dos paquetes de over-delivery (Epic 9 sync bidireccional + Story 10.6 visibilidad agente). Durante la implementación y los smokes con champions se identificaron **14 iniciativas** que constituyen la **evolución natural** de la plataforma. Ninguna es retraso de F0; todas son ampliación del alcance.

Esta propuesta agrupa las 14 iniciativas en 5 categorías de valor, con complejidad técnica y dependencias por iniciativa.

---

## 2. Catálogo de iniciativas Fase 1

### Categoría A — Automatización del sync Odoo (sigue Epic 9)

#### A.1 — Mapping automático `team_id` Odoo → `agentId` Firestore (Camino A Story 10.6)

**Descripción**: hoy `odooAgents` no tiene `linkedUserId`. Cuando un pago verificado pertenece a un agente Odoo (`team_id`), el sistema no puede resolver automáticamente el `agentId` Firebase del agente y queda como huérfano. La solución temporal F0 (Camino B) es la vista batch `/admin/orders/sin-agente` donde Paloma asigna manual. Camino A: bootstrap automático al crear/editar agente en Odoo Studio, escribir `linkedUserId` en el doc Firestore, mapping persistente.

**Complejidad**: Media. Requiere Cloud Function activada por webhook Odoo + sync inverso `users.agentId ↔ odooAgents.linkedUserId`.
**Dependencias**: Story 10.6 Camino B (entregado F0).
**Valor de negocio**: alto — elimina la operación manual de Paloma cada vez que aparece un agente nuevo o pago huérfano.

#### A.2 — Webhook fast-path Odoo (Automation Rule Plan A python_code HMAC)

**Descripción**: endpoint `/api/odoo/webhook/payment` está live esperando configuración en Odoo Studio. Con Automation Rule activa, las ediciones en Odoo se reflejan en Firestore en <30s en lugar de los ~7min del polling. Pendiente operativa Paloma con runbook `9-3-pull-setup.md`.

**Complejidad**: Baja (operativo, no código).
**Dependencias**: ninguna. Endpoint live.
**Valor de negocio**: medio — mejora UX del sync, no es bloqueante.

#### A.3 — Detector duplicados Odoo regla `create_date diff > 24h`

**Descripción**: el dedup actual detecta clusters de pagos con mismo partner + monto + fecha. Caso de falso positivo identificado en sesión 45: mensualidades del mismo cliente al mismo viaje crean clusters falsos. Regla nueva: si `create_date diff > 24h`, excluir del cluster automáticamente.

**Complejidad**: Baja.
**Dependencias**: Epic 9 dedup (entregado F0).
**Valor de negocio**: medio — reduce ruido en `/admin/odoo/duplicates`.

#### A.4 — Botón "Reintentar" para pagos en estado `pending`/`never_synced`/`demorado`

**Descripción**: la consola de sync muestra pagos con sync demorado pero no permite forzar retry desde UI. Hoy se hace vía Cloud Scheduler manual o re-trigger de Cloud Function.

**Complejidad**: Baja.
**Dependencias**: Sync console Story 9.6 (entregado F0).
**Valor de negocio**: medio — autonomía operativa Paloma sin esperar al técnico.

### Categoría B — UX restantes identificados durante smoke

#### B.1 — Vista `/admin/trips/[tripId]/sales` con fallback `amount_invoiced`

**Descripción**: órdenes legacy Odoo sin invoice tienen `amount_total = 0`. Hoy se ven como vacías. Fallback: usar `amount_invoiced` o `amount_residual` para mostrar montos históricos.

**Complejidad**: Baja.
**Dependencias**: ninguna.
**Valor de negocio**: medio — mejora reporting histórico.

#### B.2 — Banner contrato sin tripId con CTA "Asignar viaje"

**Descripción**: contratos legacy sin `tripId` no permiten generar PDF (banner rojo). Hoy el admin tiene que editar manual desde Firestore console. Fix UI: banner con dropdown.

**Complejidad**: Baja.
**Dependencias**: ninguna.
**Valor de negocio**: medio — backfill de contratos viejos sin tocar DB directo.

#### B.3 — Configurar 84 viajes restantes con `contract*` data

**Descripción**: solo 5 viajes piloto tienen los datos contractuales configurados. Los 84 restantes muestran banner rojo al intentar generar contrato. Trabajo operativo Paloma desde `/admin/trips/[tripId]`.

**Complejidad**: Operativo (no código).
**Dependencias**: ninguna.
**Valor de negocio**: alto — habilita generación de contratos para todo el catálogo.

### Categoría C — Features de negocio (Epics planificados)

#### C.1 — Epic 4-3: Referral Links & Lead Notifications

**Descripción**: notificaciones push o WhatsApp al agente cuando alguien entra a su link de referido. Tracking de conversion. Estadísticas de link.

**Complejidad**: Media.
**Dependencias**: NotificationService (Epic 6).
**Valor de negocio**: alto — feedback inmediato al agente, motivacional.

#### C.2 — Epic 5: Director Dashboard & BI completo

**Descripción**: KPIs avanzados, gráficas de tendencias, alertas semáforo, drill-down. Hoy `/director/dashboard` existe pero es básico.

**Complejidad**: Media-alta.
**Dependencias**: Epic 9 (datos consistentes).
**Valor de negocio**: alto — visión gerencial para Noel.

#### C.3 — Epic 6: Notification System completo (FCM + WhatsApp + email)

**Descripción**: NotificationService declarativo con reglas de fallback multi-canal. Hoy solo hay infra base sin reglas activas. Casos: pago verificado/rechazado → cliente + agente; lead nuevo → agente; contrato emitido → cliente.

**Complejidad**: Alta (integración WhatsApp Odoo, FCM iOS Apple Developer, plantillas).
**Dependencias**: Apple Developer Program (Cliente debe inscribirse).
**Valor de negocio**: muy alto — cierre del loop comunicacional.

#### C.4 — Epic 7: Client Experience & UGC (reviews, photo uploads)

**Descripción**: clientes suben fotos de su viaje, dejan reviews, comparten testimonios. Moderación admin. Display en landing pública para SEO.

**Complejidad**: Media.
**Dependencias**: Firebase Storage rules + moderación.
**Valor de negocio**: medio-alto — marketing orgánico.

### Categoría D — Distribución móvil

#### D.1 — App Store / Google Play (si Noel decide)

**Descripción**: hoy la PWA cubre el 95% del UX móvil sin App Store. Si Noel quiere presencia formal en stores (branding + descubrimiento), opciones: TWA Android + Capacitor iOS.

**Complejidad**: Media-alta (compliance Apple, presupuesto Apple Developer $99/año, revisión).
**Dependencias**: decisión del Cliente.
**Valor de negocio**: medio (descubrimiento + percepción).

### Categoría E — Cumplimiento documental operativo

#### E.1 — PDF de recibo de abono automático post-verificación (push email/WhatsApp)

**Descripción**: hoy el recibo PDF formal (NS-02) se genera on-demand. Fase 1: envío proactivo automático al cliente + agente al momento de verificar (vía NotificationService Epic 6).

**Complejidad**: Baja una vez que Epic 6 está listo.
**Dependencias**: Epic 6.
**Valor de negocio**: alto — el cliente recibe su recibo sin pedirlo.

#### E.2 — Dedup Documents Odoo masivo (data cleanup operativo)

**Descripción**: el mecanismo de dedup (Epic 8 + Story 9.5) está en producción. Falta correrlo masivamente contra el inventario histórico para limpiar las decenas de clusters acumulados. Trabajo operativo Paloma + Alek con scripts read-only + apply.

**Complejidad**: Operativo (no código nuevo).
**Dependencias**: tiempo dedicado Paloma + Alek.
**Valor de negocio**: medio — limpieza de inventario, no funcional.

---

## 3. Estimate global y propuesta de prioridad

### 3.1. Estimate por categoría (semanas-persona)

| Categoría | Iniciativas | Esfuerzo estimado | Notas |
|---|---|---|---|
| A — Sync Odoo automatización | A.1 + A.2 + A.3 + A.4 | 3-4 semanas | A.2 es operativo, A.1 es la pieza grande. |
| B — UX cierre F0 | B.1 + B.2 + B.3 | 1-2 semanas | B.3 es operativo Paloma. |
| C — Features de negocio | C.1 + C.2 + C.3 + C.4 | 8-10 semanas | Epic 6 es la pieza más grande y bloquea C.1 + E.1. |
| D — App Stores | D.1 | 4-6 semanas (si se decide) | Depende de Apple Developer + compliance. |
| E — Operativo documental | E.1 + E.2 | 2 semanas | E.1 depende de C.3. |
| **Total Fase 1 completa** | **14 iniciativas** | **18-24 semanas** | ~5 meses calendario con 1 persona técnica + Paloma operativa. |

### 3.2. Sprints sugeridos (2-3 semanas c/u)

**Sprint 1 (3 sem)** — Cierre técnico inmediato post-F0:
- A.1 Mapping automático team_id (alto valor, elimina dolor recurrente).
- A.4 Botón Reintentar (rápido, autonomía Paloma).
- B.1 + B.2 fallbacks UX (rápidos, mejor reporting).
- B.3 operativo: configurar viajes restantes (Paloma + Alek soporte).

**Sprint 2 (3 sem)** — Comunicación con el cliente:
- C.3 Epic 6 Notification System base (FCM Android web + email).
- E.1 PDF recibo push post-verificación.
- A.2 Webhook fast-path activado.

**Sprint 3 (2 sem)** — Visión gerencial:
- C.2 Director Dashboard avanzado.
- A.3 Detector duplicados regla 24h.

**Sprint 4 (2 sem)** — Marketing orgánico:
- C.1 Referral notifications.
- C.4 UGC base (reviews + uploads + moderación).

**Sprint 5 (3 sem opcional)** — Distribución:
- D.1 App Stores (solo si Noel confirma presupuesto Apple).

**Sprint 6 (2 sem operativo)** — Cleanup:
- E.2 Dedup Documents masivo.

---

## 4. Modelo comercial sugerido

Mismo formato que Fase 0 — deal por sprints con entregables claros:

| Sprint | Esfuerzo | Sugerencia pricing | Notas |
|---|---|---|---|
| Sprint 1 | 3 sem | (pricing TransformIA) | Quick wins, recupera momentum. |
| Sprint 2 | 3 sem | (pricing TransformIA) | Pieza más sensible operativamente. |
| Sprint 3 | 2 sem | (pricing TransformIA) | Valor gerencial Noel. |
| Sprint 4 | 2 sem | (pricing TransformIA) | Diferenciador marketing. |
| Sprint 5 | 3 sem | (pricing TransformIA + Apple $99/año) | Opcional. |
| Sprint 6 | 2 sem | (pricing TransformIA) | Operativo. |

> **Pricing detallado**: ver `D:\dev\AlekContenido\Areas\Proyectos\AroundaPlanet\execution\pricing-catalogo-upsell-fase1-16-may-2026.md` que ya integra el catálogo upsell formal de Fernando.

Alternativa: paquete cerrado Fase 1 completa (18-24 sem) con descuento por compromiso temporal.

---

## 5. Items diferidos NO incluidos en esta propuesta

Documentados como **upsell explícito** en el catálogo Fernando (no cortesía):

| ID | Compromiso original F0 | Razón diferimiento | Destino |
|---|---|---|---|
| F0-B5 | Benchmark UX operadores turísticos | Sub-fase B concentró energía en plataforma. | Catálogo upsell D1. |
| F0-B6 | Especialista Odoo búsqueda | Pertinente con alcance F1 decidido. | Catálogo upsell D2. |
| F0-B7 | Asesores fiscales binacionales | Madrid operativa post-F0. | Catálogo upsell D3. |
| F0-B12 | Ruta personalizada AlekLearn | Requiere baseline real champions. | Catálogo upsell D4. |

---

## 6. Siguiente paso

**Reunión con Noel** para:

1. Revisar este documento + el acta de entrega `fase-0-entregables.md`.
2. Validar el catálogo de 14 iniciativas y priorizar por valor de negocio.
3. Acordar modelo (sprints individuales o paquete cerrado).
4. Firmar adenda Cláusula 12 del convenio v4.0 que documenta:
   - Items diferidos F0 → catálogo upsell.
   - Alcance Fase 1 acordado.
   - Vigencia y pricing.

**Fecha sugerida**: posterior al acuse formal de aceptación de Fase 0 por parte de Noel.

---

*Propuesta Fase 1 v1.0 — 2026-05-20 · AroundaPlanet · TransformIA.*
