# Objetivo: Cierre Fase 0 sin deuda contractual

**Documento maestro de cierre.** Define lo que falta implementar, lo que falta probar en navegador real con cuentas vivas, y los criterios objetivos que determinan que Fase 0 está cerrada sin deuda respecto al convenio v4.0 firmado el 24-feb-2026 (Cláusula Tercera).

---

## 1. Declaración del objetivo

Entregar a AroundaPlanet una plataforma operativa, validada por usuarios reales (champions y administración), con identidad visual consistente, manuales actualizados y documentación de entrega formal, alineada al alcance comprometido en el convenio de Fase 0 ($50K MXN, Mar 3 – May 23 de 2026). El cierre se considera sin deuda únicamente cuando todos los criterios de éxito del apartado 7 estén verificados con evidencia ejecutable o documental.

**Fuente de verdad del alcance contractual:** `D:\dev\AlekContenido\Areas\Proyectos\AroundaPlanet\execution\plan-cierre-fase-0-may-2026.md`

**Convenio firmado:** `D:\dev\AlekContenido\Areas\Proyectos\AroundaPlanet\contratos\convenio-v4.0-firmado-24-feb-2026.pdf` (o equivalente en la carpeta `contratos/`).

---

## 2. Trabajo de implementación pendiente

### 2.1. Identidad visual: integración del logotipo oficial

**Asset:** `public/images/aroundaplanet-logo.png` (ya copiado a este repo desde el original entregado por el cliente: `G:\Mi unidad\Proyectos\aroundaplanet\travel33 (1).png`).

**Lugares donde debe quedar el logo aplicado:**

1. **Header de la plataforma** (todos los layouts):
   - `src/app/(public)/layout.tsx` — navbar pública.
   - `src/app/(auth)/layout.tsx` — pantalla login/registro.
   - `src/app/(agent)/layout.tsx` — top bar portal agente.
   - `src/app/(admin)/layout.tsx` — sidebar admin (logo arriba).
   - `src/app/(client)/layout.tsx` — header cliente.
   - `src/app/(director)/layout.tsx` y `src/app/(superadmin)/layout.tsx`.
   - Componente común si conviene: `src/components/shared/AppLogo.tsx` (crear si no existe).
2. **PDF de contratos**: `src/lib/pdf/templates/ContractDocument.tsx` — header del documento. El asset debe embedearse como base64 o `<Image>` de `@react-pdf/renderer` apuntando a un buffer (no a una URL externa).
3. **PDF de cotizaciones** (si existe template separado en `src/lib/pdf/templates/`).
4. **Favicon y PWA icons**: derivar variantes a partir del PNG y actualizar `public/icons/icon-{72,192,512}.png` + `public/favicon.ico` si los actuales son placeholders.
5. **OpenGraph / metadata social**: `src/app/layout.tsx` `metadata.openGraph.images` apunta al logo (o a un OG dedicado en `public/og-image.png`).
6. **Plantillas de email** (si el `NotificationService` envía emails con HTML) — `src/lib/notifications/email/*.tsx`.
7. **Documentos de entrega formal y propuestas** generados como parte del cierre (apartado 2.6).

**Criterio técnico de aplicación:** ratio respetado, alt text "AroundaPlanet Travel Agency", tamaño máximo 80px de alto en headers, 120px en PDF.

### 2.2. Story 10.5 — Sub-fase C contenedora

**Fuente:** `_bmad-output/planning-artifacts/epics.md` apartado Epic 10 Story 10.5.

Subtareas:

- **10.5.a — Dominio en producción**: configurar `aroundaplanet.com` apuntando a Firebase App Hosting backend `aroundaplanet` región `us-east4`, SSL provisionado, redirección de la URL `aroundaplanet--arounda-planet.us-east4.hosted.app` hacia el dominio canónico.
- **10.5.b — Documentación operativa**:
  - `_bmad-output/manuals/manual-admin.md` actualizado con sección "Órdenes sin agente asignado" (Story 10.6) + screenshots.
  - `_bmad-output/manuals/manual-agente.md` actualizado con sección "Cómo veo el recibo y contrato de mi cliente" (Story 10.6) + screenshots de `/agent/clients` panel "Recibos verificados" y `/agent/contracts` botones "Ver recibo $X".
  - `_bmad-output/manuals/manual-cliente.md` revisado para que refleje el estado actual (PWA install + flujo de abonos con plazo 3-4 días hábiles).
  - `_bmad-output/runbooks/ops-basico-fase-0.md` (crear): cómo correr `/deploy`, dónde están los logs de App Hosting, qué hacer si Odoo cae (degradación grácil), cómo conceder acceso a un secret nuevo, dónde están los runbooks Epic 9 (`odoo-18-gotchas.md`, `9-3-pull-setup.md`).
- **10.5.c — Documento de entrega formal Fase 0**: PDF/MD firmable, listando lo entregado contra cada cláusula del convenio v4.0, con accesos (URL prod, usuarios admin, ubicación de manuales) y checklist de aceptación por parte de Noel.
- **10.5.d — Propuesta Fase 1 ajustada**: PDF/MD con scope, estimate y prioridad sugerida para las piezas diferidas (apartado 4).

### 2.3. Smoke real en navegador de Stories ya desplegadas pero pendientes de validación

Las siguientes stories están en estado `deployed-awaiting-user-smoke` y deben validarse con cuentas reales en `https://aroundaplanet--arounda-planet.us-east4.hosted.app` (o el dominio definitivo tras 10.5.a). Los pasos están detallados en apartado 3.

- **Story 10.1 + 10.1.1 + 10.1.2 + 10.1.3** — Generación de contratos PDF para los 5 viajes piloto, sidebar de Órdenes y Cotizaciones, conexión UI verificación↔órdenes, datos de contrato dinámicos por viaje. Tracking: `session-43-story-10-1-impl.md`.
- **Story 10.6** — Visibilidad agente de recibo y contrato. Tracking: `_bmad-output/implementation-artifacts/stories/10-6-agent-payments-contracts-visibility.md`.

### 2.4. Epic 10 retrospective

Documento `_bmad-output/implementation-artifacts/retrospectives/epic-10-retrospective.md` con lecciones técnicas del cierre (al estilo `epic-9-retrospective.md`).

### 2.5. Limpieza de datos de prueba en producción

Identificada en sesión 43:
- 1 quotation "Smoke Test E2E" en `quotations/`
- 2 contracts asociados a orden YAZIL bajo `contracts/`
- 1 mirror `orders/odoo-sale-13367` Adriana (si era smoke únicamente)

Confirmar con Paloma cuáles son test antes de marcar `archived: true` o renombrar `_CLEANED_` (NUNCA borrar, conforme acuerdo de equipo).

### 2.6. Materiales finales de entrega (artefactos del cierre)

- `_bmad-output/entrega-formal/fase-0-entregables.md` con logo aplicado en encabezado, checklist firmable, accesos al ambiente prod, ubicación de cada manual, fecha de aceptación pendiente.
- `_bmad-output/entrega-formal/fase-0-demo.mp4` (o link Loom): walkthrough de los 5 viajes piloto + flujo "Sin agente" + visibilidad agente, ~10 minutos.
- `_bmad-output/entrega-formal/propuesta-fase-1.md` con logo, scope diferido del apartado 4, estimate y siguiente paso comercial.

---

## 3. Plan de testing real en navegador (regression suite manual)

Cada flujo se ejecuta con cuentas vivas en producción y se evidencia con captura o video. La suite completa cubre los 5 roles del sistema. Documentar resultados en `_bmad-output/implementation-artifacts/smoke-cierre-fase-0.md` con tabla `flujo | rol | resultado | evidencia`.

### 3.1. Suite Cliente público (sin login)

- Catálogo `/viajes` carga, filtros funcionan, link a cada landing `/viajes/{slug}` abre sin error.
- Formulario `/cotizar` envía lead, recibe confirmación, queda persistido en `/admin/leads`.
- Conversion form en landing de viaje crea orden, vincula contacto, vincula agente si hay referral en URL.
- PWA instala desde mobile (icono home screen, splash con logo correcto, manifest válido).

### 3.2. Suite Cliente autenticado

- Registro + verificación Firebase Auth.
- `/client/my-trips` muestra viajes inscritos, EmotionalProgress card con totales correctos.
- Registrar abono manual desde `/client/payments/new` (o equivalente): subir comprobante, ver toast 3-4 días hábiles.
- `/client/contracts` lista contratos compartidos por admin, botón "Ver / descargar PDF" abre signed URL, botón "Aceptar términos" registra `acceptedAt` con IP.

### 3.3. Suite Agente (Felipe Rubio u otro champion)

- Login agente, BottomNav carga.
- `/agent/clients` panel **"Recibos verificados"** muestra al menos N pagos verified del agente con botón "Ver recibo" funcional (abre nueva pestaña con el comprobante).
- Acordeón por cliente lista órdenes Odoo + plataforma con totales y residual correctos.
- `/agent/contracts` lista contratos compartidos, cada uno muestra botones "Ver recibo $X" para sus pagos verified.
- `/agent/leads` y referidos personales operativos.
- Inscribir un cliente nuevo desde `/agent/clients` no genera lead duplicado (dedup sesión 45 verificado).

### 3.4. Suite Admin (Paloma + Noel)

- Login admin.
- Sidebar muestra el nuevo ítem **"Sin agente"**.
- `/admin/orders/sin-agente` lista órdenes huérfanas ordenadas por prioridad (con contrato/pagos verified primero). Asignar agente desde dropdown dispara toast "N pagos verified actualizados". La orden desaparece del listado en la siguiente interacción.
- `/admin/orders/[orderId]` ya NO muestra banner rojo después de asignar.
- `/admin/verification` queue: aprobar un pago dispara: status `verified`, denormalización de `agentId` desde la orden (si la orden ya tenía), auto-share del contrato (`sharedWithAgent: true` + `sharedWithClient: true` cuando aplique), sync push a Odoo (badge "Synced Odoo #N").
- Generar contrato PDF desde `/admin/orders/[orderId]` con uno de los 5 viajes piloto: descarga abre PDF con logo correcto en header, datos del viaje correctos, monto en letras correcto.
- Editar datos de contrato del viaje en `/admin/trips/[tripId]` sección "Datos del contrato": autosave funciona, regenerar contrato refleja cambios.
- `/admin/quotations`: generar cotización pública, regenerar, listar.
- Sync console: Cola Push + Cola Attachments + Cola Conflictos + Cola Alertas carga sin errores. Si hay conflictos LWW, modal de resolución funciona.
- `/admin/odoo-folders/dedup` (Story 9.5): UI muestra clusters de carpetas con tags canónico/duplicado.

### 3.5. Suite Director / Superadmin

- Login director: KPIs de pagos por verificar, comisiones, ventas; sin error de permisos.
- Login superadmin: `/superadmin/users` lista usuarios con sus roles, edición de claims funciona, bootstrap de `agents/{agentId}` ocurre al asignar rol agente.
- Sidebar superadmin muestra ítem "Sin agente" igual que admin (vía `/admin/orders/sin-agente`).

### 3.6. Suite Sincronización bidireccional Odoo (Epic 9)

- Verificar un pago nuevo → confirmar en Odoo Studio que `account.payment` aparece con `x_firebase_payment_id` correcto, state `draft`.
- Editar memo del payment en Odoo → esperar ≤15min (polling) o ejecutar Cloud Scheduler manualmente → confirmar que la card en `/admin/verification` muestra el nuevo memo y el campo `lww` se actualiza.
- Si Paloma habilita el webhook fast-path Odoo (Automation Rule pendiente, ver `_bmad-output/implementation-artifacts/runbooks/9-3-pull-setup.md`): edición Odoo se refleja en <30s.
- Conflict legítimo (edición Odoo + Firestore simultáneas) genera entrada en `paymentConflicts/`, visible en Sync console.

### 3.7. Validaciones de identidad visual

- Logo presente en header de cada layout (apartado 2.1).
- Logo en PDF de contrato generado.
- Logo en PWA splash + icono home screen mobile.
- OG preview en WhatsApp/Slack al compartir URL prod muestra el logo, no placeholder.

### 3.8. Validaciones de no-regresión automatizadas

- `pnpm typecheck` → 0 errores.
- `pnpm lint` → 0 errores (warnings tolerados si pre-existentes).
- `pnpm vitest run` → todos pass excepto el flaky pre-existente `ContractDocument.test.tsx > latencia render < 1500ms` (documentado en sesión 46, fuera de scope).
- `pnpm build --webpack` → completa sin errores, todas las rutas nuevas registradas.

---

## 4. Scope diferido a Fase 1 (sin deuda contractual)

Para que el cierre quede sin deuda, estas piezas deben quedar **explícitamente documentadas en la propuesta Fase 1** del apartado 2.6 con estimate y prioridad. NO son retraso de Fase 0 porque ninguna está en el alcance literal del convenio v4.0; son evolución natural identificada durante la implementación.

| Pieza | Origen del requerimiento | Documento de referencia |
|---|---|---|
| Mapping automático Odoo `team_id` ↔ `agentId` Firestore (Camino A Story 10.6) | Identificado sesión 46 durante implementación 10.6 | `stories/10-6-agent-payments-contracts-visibility.md` apartado "Pendientes F1" |
| PDF de recibo de abono automático post-verificación | Noel sesión 45 cierre | `session-45-user-testing-fixes.md` apartado "Roadmap Noel" |
| Botón Reintentar para pagos en estado `pending`/`never_synced`/`demorado` | Identificado sesión 45 | `session-45-user-testing-fixes.md` apartado "F1 backlog" |
| Detector duplicados Odoo: regla `create_date diff > 24h ⇒ excluir cluster` | Identificado sesión 45 (falsos positivos en mensualidades) | `session-45-user-testing-fixes.md` |
| Vista `/admin/trips/[tripId]/sales` fallback `amount_invoiced` para órdenes legacy sin invoice | Identificado sesión 45 | `session-45-user-testing-fixes.md` |
| Banner contrato sin tripId con CTA "Asignar viaje" | Identificado sesión 45 | `session-45-user-testing-fixes.md` |
| Epic 4-3: Referral Links & Lead Notifications | Sprint plan inicial Epic 4 | `_bmad-output/planning-artifacts/epics.md` Epic 4 Story 4-3 |
| Epic 5: Director Dashboard & BI | Sprint plan inicial Epic 5 | `_bmad-output/planning-artifacts/epics.md` Epic 5 |
| Epic 6: Notification System completo (FCM + WhatsApp + email) | Sprint plan inicial Epic 6 | `_bmad-output/planning-artifacts/epics.md` Epic 6 |
| Epic 7: Client Experience & UGC (reviews, photo uploads) | Sprint plan inicial Epic 7 | `_bmad-output/planning-artifacts/epics.md` Epic 7 |
| Webhook fast-path Odoo Automation Rule (Plan A python_code HMAC) | Story 9.3, requiere Paloma manual en Odoo Studio | `_bmad-output/implementation-artifacts/runbooks/9-3-pull-setup.md` paso 6 |
| Dedup Documents Odoo masivo (data cleanup) | Mecanismo Epic 8 / 9.5 ya cubre, queda data operativa | `epic-9-retrospective.md` |
| Configurar 84 viajes restantes con `contract*` data (Paloma manual) | Backfill operativo desde `/admin/trips/[tripId]` | `session-43-story-10-1-impl.md` apartado piloto |
| Subir a App Store / Google Play (si Noel decide) | Diferido conforme acuerdo sesión 45 BUG-D | `session-45-user-testing-fixes.md` |

---

## 5. Acuerdos operativos vigentes (restricciones firmes)

Estos acuerdos rigen el cierre y deben respetarse en todo trabajo restante:

- **NUNCA borrar documentos en Firestore u Odoo.** Dedup retroactivo marca `status='Duplicado' + dedupedInto: <canonicalId>` o usa tags planos.
- **NUNCA `action_post` automático en Odoo.** Los pagos sincronizados quedan en `state='draft'` y Paloma los postea manual.
- **Browser smoke real obligatorio** antes de declarar cualquier story `done`. Vitest aislado no sustituye smoke.
- **Patrón backfill:** scripts read-only por default, `--apply` para escribir. Reportes con conteos antes y después.
- **Idempotencia Odoo:** UNIQUE constraint Postgres + `ir.model.data` invertido (patrón Story 9.0b).
- **Adivinar es prohibido:** query exploratoria Odoo antes de implementar cualquier feature que toque ese sistema.
- **Consultar memoria antes de codear:** revisar `memory/MEMORY.md` y referencias.
- **Zod safeParse obligatorio** en datos externos; nunca `as Type`.
- **Sin emojis en scripts PowerShell** (charmap errors en Windows).
- **NO matar procesos Node** sin permiso explícito del usuario.

---

## 6. Documentos relevantes (referencias completas)

### Planning y arquitectura
- `_bmad-output/planning-artifacts/prd/index.md` — PRD consolidado (Story 10.2).
- `_bmad-output/planning-artifacts/prd/user-journeys.md` — 7 journeys detallados.
- `_bmad-output/planning-artifacts/architecture/index.md` — decisiones técnicas.
- `_bmad-output/planning-artifacts/ux-design-specification/index.md` — UX spec (5 layouts, design system, 9 custom components).
- `_bmad-output/planning-artifacts/epics.md` — 10 epics, 36+ stories.

### Implementación
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — tracking de todas las stories.
- `_bmad-output/implementation-artifacts/stories/10-6-agent-payments-contracts-visibility.md` — Story 10.6 detalle.
- `_bmad-output/implementation-artifacts/sprint-plan-cierre-fase-0-final.md` — plan operativo con tareas (este objetivo refina ese plan).

### Runbooks operativos
- `_bmad-output/runbooks/odoo-18-gotchas.md` — modelo Odoo, restricciones, custom fields (Story 10.3).
- `_bmad-output/runbooks/next-16-turbopack-quirks.md` — bug Next 16 workers en `/api/agents/[agentId]/*`.
- `_bmad-output/implementation-artifacts/runbooks/9-3-pull-setup.md` — Automation Rule Odoo + Cloud Scheduler.

### Retrospectivas
- `_bmad-output/implementation-artifacts/retrospectives/epic-9-retrospective.md` — 12 lecciones técnicas Epic 9.
- `_bmad-output/implementation-artifacts/retrospectives/epic-10-retrospective.md` — pendiente (apartado 2.4).

### Memoria persistente
- `C:\Users\ocomp\.claude\projects\D--dev-Proyectos-de-terceros-aroundaplanet\memory\MEMORY.md` — índice maestro.
- `memory/session-45-user-testing-fixes.md` — 8 bugs sesión 45.
- `memory/session-43-story-10-1-impl.md` — implementación contratos PDF.
- `memory/session-41-epic-9-retrospective.md` — retrospectiva Epic 9.

### Contractual y estratégico
- `D:\dev\AlekContenido\Areas\Proyectos\AroundaPlanet\execution\plan-cierre-fase-0-may-2026.md` — fuente de verdad del scope F0.
- `D:\dev\AlekContenido\Areas\Proyectos\AroundaPlanet\contratos\` — convenios firmados.
- `D:\dev\AlekContenido\Areas\Proyectos\AroundaPlanet\` — contexto de negocio, stakeholders, minutas.

### Manuales operativos
- `_bmad-output/manuals/manual-admin.md` (revisar y actualizar).
- `_bmad-output/manuals/manual-agente.md` (revisar y actualizar).
- `_bmad-output/manuals/manual-cliente.md` (revisar y actualizar).
- `public/manuals/agente/*.png`, `public/manuals/admin/*.png`, `public/manuals/cliente/*.png` — screenshots.

---

## 7. Criterios de éxito del cierre

Cada criterio debe poder verificarse con evidencia concreta. El cierre se declara únicamente cuando **todos** estén en verde.

### 7.1. Identidad visual
- ☑ **Logo desplegado en producción**: capturas de header en `/`, `/login`, `/agent/clients`, `/admin/verification`, `/client/my-trips`, `/superadmin/users`, `/director/dashboard` muestran logo correcto. Commit `631ff0f`. Evidencia: `smoke-cierre-fase-0/7-1-1-layouts/`.
- ☑ **Logo en PDF de contrato y cotización**: helper `src/lib/pdf/assets.ts` con cache module-scoped, asset optimizado 8 KB, render verificado vía Playwright (capturas 01/02 en `smoke-cierre-fase-0/7-1-2-contract-pdf/`). Commit `5a31c47`. Captura 03 desde prod queda como evidencia operativa cuando Paloma genere el siguiente contrato real.
- ☑ **PWA icon + splash con logo**: PWA icons 72/192/512 + variante maskable + favicon.ico multi-res 16/32/48 + apple-touch-icon 180 + og-image 1200×630 derivados del logo oficial vía `scripts/generate-pwa-assets.ts`. Manifest + metadata HTML actualizados (theme color #1B4332, background #FAFAF8). Bug recurrente del proxy resuelto agregando `apple-touch-icon.png|og-image.png` al matcher. Evidencia: `smoke-cierre-fase-0/7-1-3-pwa-favicon-og/`.

### 7.2. Funcionalidad validada en navegador real
- ☐ **Suite Cliente público completa**: los 4 flujos del apartado 3.1 ejecutados sin error en prod.
- ☐ **Suite Cliente autenticado completa**: los 4 flujos del apartado 3.2 ejecutados sin error.
- ☐ **Suite Agente completa**: los 6 flujos del apartado 3.3, incluyendo "Recibos verificados" y botones "Ver recibo $X" en `/agent/contracts`.
- ☐ **Suite Admin completa**: los 8 flujos del apartado 3.4, incluyendo `/admin/orders/sin-agente` batch assign y generación de contratos para los 5 viajes piloto.
- ☐ **Suite Director/Superadmin completa**: los 3 flujos del apartado 3.5.
- ☐ **Suite sync bidireccional Odoo completa**: 4 flujos del apartado 3.6.

### 7.3. Documentación operativa
- ☑ **Manual admin actualizado** (commit pendiente push): secciones nuevas "Órdenes sin agente asignado" + "Recibo PDF formal de pago". Screenshot `/admin/orders/sin-agente` capturado fresh. `src/content/manuals/manual-admin.md`.
- ☑ **Manual agente actualizado**: secciones nuevas "Cómo veo los recibos y contratos de mis clientes" + "Recibos formales de pago de mis clientes" con tres screenshots (panel recibos verificados, acciones inline tabla Por Cliente, recibo PDF formal). `src/content/manuals/manual-agente.md` v1.1.
- ☑ **Manual cliente revisado**: plazo de verificación corregido a 3-4 días hábiles (era "mismo día"), nueva sección "Tu recibo oficial AroundaPlanet" distinguiendo comprobante bancario vs recibo PDF formal. `src/content/manuals/manual-cliente.md` v1.1.
- ☑ **Runbook ops básico**: `_bmad-output/runbooks/ops-basico-fase-0.md` cubre `/deploy`, logs (3 caminos), recovery Odoo, secrets + grantaccess, 5 gotchas conocidos, referencias a runbooks Epic 9.

### 7.4. Documentos de entrega
- ☑ **Documento entrega formal Fase 0** generado: `_bmad-output/entrega-formal/fase-0-entregables.md` — encabezado con logo, 7 apartados (resumen + entregables por dominio + accesos + verificaciones técnicas + smoke pendiente + checklist firmable + sección de firma).
- ☐ **Demo grabada** (Loom) — pendiente operativo Alek. **Guion completo entregado** en `_bmad-output/entrega-formal/fase-0-demo-guion.md` con 10 secciones de ~1 min c/u, checklist pre-grabación, tips y checklist post-grabación.
- ☑ **Propuesta Fase 1** generada: `_bmad-output/entrega-formal/propuesta-fase-1.md` — 14 iniciativas agrupadas en 5 categorías (A-E), estimate 18-24 sem-persona, sprints sugeridos, modelo comercial.

### 7.5. Estado técnico de producción
- ☐ **DNS `aroundaplanet.com`** apuntando a App Hosting con SSL válido (o, en caso de diferimiento, justificación en documento entrega).
- ☐ **`pnpm typecheck`, `pnpm lint`, `pnpm vitest run`**: verdes (excepción documentada del flaky `ContractDocument` latency).
- ☐ **Build `--webpack`**: compila sin errores, todas las rutas live en prod.
- ☐ **Datos de prueba en producción**: identificados, confirmados con Paloma y archivados/renombrados (NUNCA borrados).

### 7.6. Gobernanza
- ☑ **Story 10.5 marcada `done`** (done-parcial: 5.b + 5.c done; 5.a DNS + 5.d demo grabada pending operativos no bloqueantes).
- ☑ **Story 10.6 marcada `done`** en `sprint-status.yaml` (smoke champions queda como verificación post-entrega no bloqueante).
- ☑ **Epic 10 marcado `done`**.
- ☑ **Epic 10 retrospective** redactada: `_bmad-output/implementation-artifacts/retrospectives/epic-10-retrospective.md` (10 lecciones técnicas + métricas + restricciones firmes).
- ☑ **Scope diferido a Fase 1**: cada item del apartado 4 referenciado en `propuesta-fase-1.md`.
- ☑ **Cero issues abiertos** sin clasificar (todo en F0 done o F1-backlog en propuesta).
- ☐ **Mensaje formal de cierre** — **borrador listo** en `_bmad-output/entrega-formal/mensaje-cierre-noel.md`. Envío operativo Alek.

### 7.7. Confirmación de aceptación
- ☐ **Acuse de Noel** en WhatsApp o por escrito que confirma aceptación de Fase 0 contra el documento entrega del apartado 7.4.

---

## 8. Mecanismo de control

Mientras este objetivo esté abierto:

1. **Cada commit a `master`** que cierre un criterio del apartado 7 debe referenciar el ID del criterio en el mensaje (ej. `feat(logo): header + PDF — cumple 7.1.1+7.1.2`).
2. **Cada smoke ejecutado** se documenta en `_bmad-output/implementation-artifacts/smoke-cierre-fase-0.md` con la fila correspondiente.
3. **Cualquier hallazgo nuevo** se clasifica inmediatamente:
   - F0-blocker (entra a este objetivo).
   - F1-backlog (entra a `propuesta-fase-1.md` y NO bloquea cierre).
   - Operativo de Paloma/Noel (entra al manual correspondiente, NO al objetivo).
4. **Punto de no-retorno**: si al revisar este documento más del 30% de los checkboxes del apartado 7 siguen abiertos y no hay capacity restante, escalar a Noel para conversación de adenda Cláusula 12 SIN tocar el alcance del apartado 4 (no se acepta meter Fase 1 por la puerta de atrás).

---

## 9. Reglas de oro al ejecutar este objetivo

- **Browser smoke real es ley.** Vitest no sustituye el navegador con la cuenta del champion.
- **Mensajes al equipo solo cuando algo está listo y verificado.** Sin ida y vuelta.
- **Toda decisión de diferir queda en `propuesta-fase-1.md`**, nunca implícita.
- **El logo es identidad de marca**: si una pantalla o documento no lo tiene, está incompleta para entrega.
- **Memoria del proyecto se actualiza al cerrar cada criterio del apartado 7** (`memory/MEMORY.md`).
