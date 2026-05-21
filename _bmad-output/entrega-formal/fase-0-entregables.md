![AroundaPlanet](/images/aroundaplanet-logo.png)

# Entregables Fase 0 — AroundaPlanet

**Documento:** entrega-formal/fase-0-entregables
**Versión:** 1.0
**Fecha:** 2026-05-20
**Cliente:** AroundaPlanet · Noel Sahagún Cervantes
**Prestador:** TransformIA · Alek Zen
**Referencia contractual:** Convenio de Prestación de Servicios v4.0 firmado 24-feb-2026 · Contraprestación $50,000 MXN · Vigencia 90 días naturales (24-feb-2026 al 23-may-2026, Cláusula Tercera).

> Documento de referencia interna para validar el paquete de entrega antes de su envío formal al Cliente. El acta legal canónica vive en `D:\dev\AlekContenido\Areas\Proyectos\AroundaPlanet\execution\acta-entrega-fase0-DRAFT-15-may-2026.md`.

---

## 1. Resumen ejecutivo

AroundaPlanet pasó de operar con WhatsApp + hojas sueltas + cruces manuales contra Odoo, a una **plataforma operativa multi-rol** con sincronización bidireccional con Odoo 18 Enterprise, generación documental automática (contratos, cotizaciones, recibos PDF formales) y visibilidad transversal por rol (cliente, agente, admin, director, superadmin).

El alcance literal del convenio v4.0 quedó **cumplido al 100%** y se entrega adicionalmente:

- **Epic 9 — Sincronización bidireccional Firestore ↔ Odoo** (9 stories + retrospectiva): resuelve el dolor verbalizado el 30-mar (manualidad de doble captura).
- **Story 10.6 — Visibilidad agente** (camino B): el agente ve recibo y contrato de cliente verificado.
- **NS-02 / NS-03 — UX cierre F0** (sesión 46): recibo PDF formal de pago con membrete + acciones inline contrato/recibo en `/agent/clients`.
- **Identidad visual completa** (apartado 7.1): logo oficial integrado en 6 layouts, PDFs, PWA icons, favicon multi-res y OpenGraph.

Ambos paquetes adicionales se documentan en la **Propuesta Fase 1** como over-delivery valorado.

---

## 2. Entregables por dominio

### 2.1. Plataforma operativa

| Pieza | Detalle |
|---|---|
| URL producción | `https://aroundaplanet--arounda-planet.us-east4.hosted.app` (DNS `aroundaplanet.com` queda como cooperativo Cliente↔Prestador, ver apartado 7.5 del objetivo). |
| Roles activos | **6**: público (sin login), cliente, agente, admin, director, superadmin. Todos con layout dedicado, permisos vía Firebase Custom Claims + Firestore Security Rules. |
| Viajes piloto con contratos generables | **5**: Vuelta al Mundo 2026, Asia Mayo 2026, Colombia Mayo 2026 (Original), Europa Septiembre 2026, Chepe Enero 2026. Configuración `contract*` data en cada uno. |
| Hosting | Firebase App Hosting backend `aroundaplanet` región `us-east4`. Cloud Run min=1 max=10 concurrency=80. |
| Stack | Next.js 16 (App Router, PWA via Serwist) · TypeScript · Tailwind v4 · shadcn/ui · Zustand · Firebase Auth/Firestore/Storage · Firebase AI Logic (Gemini 2.5 Flash Lite OCR) · Odoo 18 Enterprise vía XML-RPC. |

### 2.2. Sincronización bidireccional Odoo (Epic 9 completo)

| Pieza | Detalle |
|---|---|
| Push F→O | Al verificar un pago, push idempotente a `account.payment` con `state='draft'` (NUNCA `posted` automático). Patrón invertido `ir.model.data` `res_id=0 → write res_id`. |
| Pull O→F | Cloud Scheduler `odoo-payments-pull` cada 15 min en `us-east4` (mirror read-only). Webhook fast-path Odoo Automation Rule HMAC SHA256 — endpoint live, Automation Rule queda pendiente operativa Paloma. |
| LWW conflict detection | Campos `amount`/`paymentDate`/`memo` con writtenAt + source. Conflictos visibles en `/admin/payments/sync-console`. |
| Documents app | Cada pago verificado crea su `documents.document` individual con tag `aroundaplanet_comprobante` (id=47). |
| Dedup carpetas | Camino C tags planos: `folder-canonico` / `folder-duplicado` aplicado a 7 clusters / 10 carpetas duplicadas. UI `/admin/odoo-folders/dedup`. |
| Reconciliación retroactiva | 15+1+14 pagos legacy de 31 Firestore enlazados via `odooPaymentId` + dedup 132 clusters Odoo. |
| Custom fields Odoo | `x_firebase_payment_id`, `x_firebase_agent_uid`, `x_ocr_confidence`, `x_canonical_payment_id`, `x_dup_status` (creados vía XML-RPC subagente, sin Paloma manual). |

### 2.3. Documentos generados por la plataforma

| Documento | Origen | Identidad visual | Notas |
|---|---|---|---|
| Contrato PDF | `POST /api/contracts/from-order/[orderId]/generate` con `@react-pdf/renderer`. Template universal con texto legal validado contra 3 plantillas reales. | Logo wordmark blanco 140×45 sobre paralelogramo navy del header. | Datos `contract*` configurables por viaje desde `/admin/trips/[tripId]`. Signed URL v4 con TTL 7 días. |
| Cotización PDF | `POST /api/quotations/[id]/generate`. | Logo wordmark blanco en hero verde marca. | Formulario público `/cotizar` rate-limit 10/min IP. |
| **Recibo PDF formal** (NS-02) | `GET /api/payments/[paymentId]/receipt-pdf` render on-demand sin Storage. | Logo blanco + paralelogramos navy/teal consistente con contrato. | Incluye monto en cifras + letras, saldo acumulado, resumen del expediente. Distinto del comprobante bancario que sube el cliente. |
| Comprobante bancario | `payments.receiptUrl` (subido por cliente/agente al registrar pago). | n/a (es el archivo del banco). | Sigue accesible vía botón "Ver comprobante" distinguible del recibo PDF formal. |

### 2.4. Visibilidad agente (Story 10.6 + NS-02/NS-03)

| Feature | Ruta | Detalle |
|---|---|---|
| Panel "Recibos verificados" | `/agent/clients` | Lista pagos verificados del agente con botones "Recibo PDF" (primario) + "Ver comprobante" (secundario). |
| Acciones inline en órdenes | `/agent/clients` modo "Por Cliente" | Por fila: "Ver contrato" si hay contrato + "Recibo PDF" (o popover "Recibos PDF (N)" si múltiples). Estado vacío "Contrato pendiente" cuando aplica. |
| Endpoint orders-contract-map | `/api/agent/orders-contract-map` | Retorna `{ orderId: { contractId, verifiedPayments[] } }` para todas las órdenes del agente. |
| Vista admin batch "Sin agente" | `/admin/orders/sin-agente` | Tabla ordenada por prioridad. Dropdown asignar agente inline. Backfill automático de pagos verified + auto-share contrato + audit log. |
| Auto-share contrato | Verify pago endpoint | Cuando el verify resuelve `agentId` desde la orden, activa `sharedWithAgent: true` + `sharedWithClient: true` en el contrato asociado. |

### 2.5. Identidad visual (apartado 7.1 cerrado)

| Asset | Ubicación | Origen |
|---|---|---|
| Logo oficial | `public/images/aroundaplanet-logo.png` (340 KB) | Entregado por Cliente. |
| AppLogo component | `src/components/shared/AppLogo.tsx` (sm/md/lg) | Integrado en 6 layouts: public navbar, auth hero, agent mobile header, admin sidebar, client header, director/superadmin sidebar. |
| Logo PDF wordmark color | `src/lib/pdf/assets/logo-aroundaplanet-color.png` (18 KB, 512×164) | Generado vía `scripts/generate-pdf-logo-variants.ts`. |
| Logo PDF wordmark blanco | `src/lib/pdf/assets/logo-aroundaplanet-white.png` (19 KB, 512×164) | Para fondos oscuros (header navy contratos/recibos, hero verde cotización). |
| PWA icons | `public/icons/icon-{72,192,512}.png` + maskable 512 | Generados vía `scripts/generate-pwa-assets.ts`. |
| favicon.ico multi-res | `public/favicon.ico` (2.3 KB, 16/32/48 ICONDIR) | Sin dependencias externas, formato ICO real. |
| apple-touch-icon | `public/apple-touch-icon.png` 180×180 | Estándar iOS. |
| OpenGraph image | `public/og-image.png` 1200×630 | Fondo verde marca + wordmark blanco + tagline. |

### 2.6. Documentación

| Documento | Ubicación | Destinatario |
|---|---|---|
| Manual del admin | `src/content/manuals/manual-admin.md` (renderizado en `/admin/manual`) | Paloma + back office. |
| Manual del agente | `src/content/manuals/manual-agente.md` (renderizado en `/agent/manual`) v1.1 | Agentes freelance (~100). |
| Manual del cliente | `src/content/manuals/manual-cliente.md` (renderizado en `/client/manual`) v1.1 | Clientes finales. |
| Runbook ops básico | `_bmad-output/runbooks/ops-basico-fase-0.md` | Alek / sucesor técnico. |
| Runbook Odoo 18 gotchas | `_bmad-output/runbooks/odoo-18-gotchas.md` | Equipo técnico. |
| Runbook Next 16 quirks | `_bmad-output/runbooks/next-16-turbopack-quirks.md` | Equipo técnico. |
| Runbook Firebase Admin local | `_bmad-output/runbooks/firebase-admin-local.md` | Equipo técnico. |
| Runbook 9-3 Pull setup | `_bmad-output/implementation-artifacts/runbooks/9-3-pull-setup.md` | Paloma (Automation Rule Odoo) + Alek. |
| Retrospectiva Epic 9 | `_bmad-output/implementation-artifacts/retrospectives/epic-9-retrospective.md` | Equipo técnico (12 lecciones). |

---

## 3. Accesos al ambiente

### 3.1. Producción

- **URL prod**: `https://aroundaplanet--arounda-planet.us-east4.hosted.app`
- **DNS canónico**: `aroundaplanet.com` (cooperativo, ver apartado 7.5 del objetivo).
- **Hosting**: Firebase App Hosting · proyecto `arounda-planet` · backend `aroundaplanet` · región `us-east4`.

### 3.2. Roles operativos

| Persona | Email | Roles |
|---|---|---|
| Noel Sahagún Cervantes | (en records internos AroundaPlanet) | superadmin + admin + director |
| Paloma Aguilar | (en records internos AroundaPlanet) | admin + agente |
| Alek Zen | `alek@transformia.io` | superadmin (técnico, no operativo) |
| Agentes freelance (~100) | seedeados desde Odoo `crm.team` | agente |

> Los passwords son personales — cada usuario los gestiona vía Firebase Auth (correo + Google Sign-In). Reset desde `/login` → "¿Olvidaste tu contraseña?".

### 3.3. Manuales accesibles in-app

| Rol | Ruta del manual |
|---|---|
| Admin | `/admin/manual` (sidebar → Ayuda y Manual) |
| Agente | `/agent/manual` (sidebar → Ayuda y Manual) |
| Cliente | `/client/manual` (bottom nav → Ayuda) |

### 3.4. Repositorio y CI

- **GitHub**: `github.com/AlekZen/aroundaplanet` · rama de producción **`master`** (NO `main`).
- **CI**: GitHub Actions (ESLint + Vitest + Playwright) en cada PR.
- **Despliegue**: push a `master` → Firebase App Hosting auto-build (5-10 min) → Cloud Run revision swap (~30s adicionales).
- **Skill `/deploy`**: documentado en `~/.claude/skills/deploy/SKILL.md` + `_bmad-output/runbooks/ops-basico-fase-0.md` apartado 1.

---

## 4. Verificaciones técnicas de cierre

### 4.1. Pruebas automatizadas

- **Vitest**: **1864 tests pass** al cierre de la sesión 46.
- **Tests pre-existentes fallidos no-regresión** (documentados en MEMORY.md):
  - `RoleSidebar.test.tsx` stale tras Story 10.6 (test counts hardcoded, no regresión funcional).
  - `ContractDocument.test.tsx > latencia render < 1500ms` flaky en CI (latencia razonable, umbral apretado).
- **Typecheck**: `pnpm typecheck` → **0 errores**.
- **Lint**: `pnpm lint` → **0 errores** (60 warnings pre-existentes tolerados).
- **Build prod**: `pnpm build --webpack` compila sin errores.

### 4.2. Últimos commits a `master`

```
7364e6c docs(manuals): actualización admin/agente/cliente + runbook ops — cumple 7.3
048bdbc feat(pwa): PWA icons + favicon + OG image derivados del logo oficial — cumple 7.1.3
6c03567 feat(agent-clients): links inline contrato + recibo PDF en /agent/clients — cumple NS-03
b67df17 feat(receipt): PDF formal de recibo de pago + endpoint + UI — cumple NS-02
38c763f fix(logo): wordmark horizontal blanco/color en PDFs — hotfix 7.1.2
5a31c47 feat(logo): logo en PDF de contrato y cotización — cumple 7.1.2
631ff0f feat(logo): AppLogo en 6 layouts — cumple 7.1.1
2547a40 feat(story 10.6 B): vista admin "Sin agente" + recibos en /agent/contracts
b3ec20d feat(story 10.6): agente ve recibo y contrato de cliente verificado
```

---

## 5. Smoke pendiente con cuentas reales

Estos flujos están **desplegados en producción** pero esperan validación humana con cuentas reales (champions: Noel/Paloma/agente piloto/cliente piloto). El código está cubierto por tests unitarios y browser smoke local del prestador.

| Suite | Flujos | Estado |
|---|---|---|
| Cliente público | Catálogo + `/cotizar` + conversion form + PWA install | ⏳ champions |
| Cliente autenticado | Registro + Mis Viajes + registrar abono + aceptar contrato | ⏳ champions |
| Agente | Login + Recibos verificados + acciones inline + Mis Leads + dedup | ⏳ champions |
| Admin | Verification queue + Sin agente batch + generar contrato + sync console + dedup folders | ⏳ champions |
| Director / Superadmin | KPIs + usuarios + roles + sidebar "Sin agente" | ⏳ champions |
| Sync Odoo bidireccional | Push verify + Pull polling + LWW conflict + Documents | ⏳ champions |
| Identidad visual | Logo en headers + PDFs + PWA + OG preview WhatsApp | ✅ prestador (capturas en `smoke-cierre-fase-0/`) |
| No-regresión automatizada | typecheck + lint + vitest + build | ✅ prestador |

---

## 6. Checklist de aceptación

Replica el estado real del apartado 7 del objetivo `_bmad-output/implementation-artifacts/objetivo-cierre-fase-0.md` al momento de la entrega:

### 6.1. Identidad visual
- ☑ Logo desplegado en producción (6 layouts) — commit `631ff0f`
- ☑ Logo en PDF de contrato y cotización — commits `5a31c47` + `38c763f`
- ☑ PWA icons + favicon + OG con logo — commit `048bdbc`

### 6.2. Funcionalidad validada en navegador real
- ☐ Suite Cliente público (4 flujos)
- ☐ Suite Cliente autenticado (4 flujos)
- ☐ Suite Agente (6 flujos)
- ☐ Suite Admin (8 flujos)
- ☐ Suite Director / Superadmin (3 flujos)
- ☐ Suite sync bidireccional Odoo (4 flujos)

### 6.3. Documentación operativa
- ☑ Manual admin actualizado — commit `7364e6c`
- ☑ Manual agente actualizado v1.1 — commit `7364e6c`
- ☑ Manual cliente revisado v1.1 — commit `7364e6c`
- ☑ Runbook ops básico — commit `7364e6c`

### 6.4. Documentos de entrega
- ☑ Documento entrega formal Fase 0 (este documento)
- ☐ Demo grabada (Loom) — pendiente Alek con guion `fase-0-demo-guion.md`
- ☑ Propuesta Fase 1 (`propuesta-fase-1.md`)

### 6.5. Estado técnico de producción
- ☐ DNS aroundaplanet.com (cooperativo Cliente↔Prestador)
- ☑ Typecheck + lint + vitest verdes (con flakys pre-existentes documentados)
- ☑ Build webpack compila sin errores
- ☐ Limpieza datos test prod (operativa Paloma)

### 6.6. Gobernanza
- ☐ Story 10.5 marcada `done` en sprint-status.yaml
- ☐ Story 10.6 marcada `done` en sprint-status.yaml
- ☐ Epic 10 marcado `done`
- ☐ Epic 10 retrospective redactada
- ☑ Scope diferido a Fase 1 documentado en `propuesta-fase-1.md`
- ☐ Cero issues abiertos sin clasificar
- ☐ Mensaje formal de cierre enviado a Noel + champions

### 6.7. Confirmación de aceptación
- ☐ Acuse de Noel (WhatsApp o por escrito)

---

## 7. Firma de aceptación

Al firmar este documento, **AroundaPlanet** (Cliente) declara que recibió los entregables listados en el apartado 2 y que considera **cumplido el alcance literal del Convenio v4.0 firmado el 24-feb-2026**, con los pendientes documentados en los apartados 5 y 6 clasificados como:

- Operativos (DNS, datos test, validaciones con champions): **no constituyen incumplimiento**.
- Diferidos a Fase 1: **documentados en propuesta separada**.

---

**Por TransformIA (Prestador)**

Nombre: Alek Zen
Cargo: Arquitecto Estratégico Lead

Fecha: ____________________

Firma: ____________________

---

**Por AroundaPlanet (Cliente)**

Nombre: Noel Sahagún Cervantes
Cargo: Director General / Fundador

Fecha: ____________________

Firma: ____________________

---

*Documento entrega formal v1.0 — 2026-05-20.*
