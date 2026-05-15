# Story 10.1: Generación de PDFs de contratos y cotizaciones desde panel admin

Status: in_progress (v3 — implementado, smoke local ✓, pendiente deploy + smoke prod)

## CAMBIOS v2 → v3 (sesión 43, 2026-05-15)

Tras revisar el convenio firmado (Cláusula 2 Sub-fase B literal: *"PDFs generados desde la plataforma según nivel determinado por el diagnóstico"*) Alek detuvo el plan de CloudConvert. El "nivel" lo determina el diagnóstico — o sea nosotros — por lo que el stack se simplificó dramáticamente:

| Decisión v2 (descartada) | Decisión v3 (implementada) |
|---|---|
| `docxtemplater` + CloudConvert API ($8/mes) | `@react-pdf/renderer` puro (0 SaaS, 0 cuenta nueva) |
| 33 plantillas `.docx` Odoo como source-of-truth | 1 template universal `<ContractDocument>` (texto legal hardcoded) |
| Bulk re-upload `.docx` con placeholders a Odoo | Cero escritura a Odoo Documents |
| API key SaaS + Secret Manager | Cero secrets nuevos |
| `contractTemplates/{id}.odooDocumentId` | `contractTemplates/{id}.templateKey` + anexos en Firestore |
| 5 templates React-PDF separados (decisión inicial v3) | 1 template universal — los 5 .txt extraídos por mammoth confirmaron texto legal 95% idéntico entre destinos |
| AC1 spike placeholders + GATE Paloma | Spike `spike-10-1-extract-legal-text.mjs` ejecutado, texto legal directo en componente (sin gate intermedio — Alek decidió implementar UI primero, iterar contenido después) |
| `getSignedUrl` vs `makePublic` | Signed URL v4 7 días (cazado por advisor) — `storage.rules` cerrado |

**Spike adicional (sesión 42):** las 33 plantillas `.docx` en Odoo Documents siguen ahí intactas (restricción Epic 9 NUNCA unlink). Paloma las sigue usando manual si quiere. Los componentes React-PDF son source-of-truth de aquí en adelante para PDFs generados desde la plataforma.

> **Tipo:** Feature (M-L)
> **Epic:** 10 — Cierre Fase 0 (16-23 may 2026, deadline contractual 23-may)
> **Prioridad:** 🔴 CRÍTICO — Quick Win contractual literal Cláusula 2 Sub-fase B
> **Estimación:** 3 sesiones (~20-24h) — revisada al alza tras descubrir 33+ plantillas reales
> **Tests target:** +50-80 (schemas + endpoints + templating + componentes UI)
> **Bloquea:** Stories 10.2-10.5
> **Bloqueada por:** ninguna técnica
>
> **Spike completado (2026-05-15):**
> - `scripts/spike-10-1-find-templates.mjs` → `scripts/audit-output/10-1-templates-discovery.json`
> - **33+ plantillas `.docx` reales** en Odoo Documents (folders 1467 internacional + 1443 nacional + 1435 formatos)
> - **Cotizaciones** en Odoo son hojas de cálculo nativas (`application/o-spreadsheet`) — NO portables al cliente
> - Output histórico mensual: ~100+ PDFs firmados nominales en folders 1446/1457/1454/1892
>
> **Insumos (leer antes de codear):**
> - `D:\dev\AlekContenido\Areas\Proyectos\AroundaPlanet\execution\plan-cierre-fase-0-may-2026.md` §3 Story 10.1
> - `scripts/audit-output/10-1-templates-discovery.json` — inventario completo de plantillas Odoo
> - `src/types/order.ts` + `src/schemas/orderSchema.ts` — shape de `orders/{id}`
> - `src/app/(public)/cotizar/CotizacionForm.tsx` + `cotizacionMessage.ts` — flujo lead actual (solo WhatsApp, NO persiste)
> - `src/lib/odoo/client.ts` — patrón XML-RPC para descargar `documents.document.datas` (campo binary base64)
> - `_bmad-output/implementation-artifacts/9-4-documents-attachment-individual.md` — patrón Storage + persistencia URL
>
> **Decisiones técnicas firmes (Alek sesión 42 vía AskUserQuestion):**
> 1. **Contratos:** `docxtemplater` + **CloudConvert API** (.docx → PDF). Preserva las 33+ plantillas `.docx` de Paloma como source-of-truth.
> 2. **Cotizaciones:** `@react-pdf/renderer` — template NUEVO universal (formato actual hoja-de-cálculo Odoo no es portable a cliente externo).
> 3. **Placeholders en plantillas:** Claude auto-detecta heurísticamente en bulk, Paloma valida muestreo (3-5 representativas) antes de bulk re-upload.

## Story

Como **admin (Paloma) y agente (Champions)**,
quiero **generar PDFs desde el panel: (a) contratos de adhesión por orden usando las plantillas `.docx` que Paloma ya tiene en Odoo Documents como source-of-truth, y (b) cotizaciones formales presentables al cliente final con datos del lead `/cotizar`**, guardando los PDFs en Firebase Storage con URL firmada,
para **cumplir el compromiso contractual Sub-fase B sin destruir los 33+ plantillas legales que Paloma mantiene en Word, y darle a Paloma un entregable tangible que reemplace el armado manual**.

## Contexto

### Compromiso contractual literal

Convenio v4.0 (firmado 24-feb-2026) Cláusula 2 Sub-fase B: *"Generación de contratos y cotizaciones — PDFs generados desde la plataforma según nivel determinado por el diagnóstico"*.

### Realidad operativa descubierta (spike 2026-05-15)

**Contratos** — Paloma tiene un sistema manual maduro:
- 33+ plantillas `.docx` maestras por **destino + temporada** en Odoo Documents folders `CONTRATOS TOUR INTERNACIONAL` (1467, 16 docs: ASIA, COLOMBIA por mes, EUROPA por mes, MEDIO ORIENTE, PERÚ, TURQUIA&DUBAI, VUELTA AL MUNDO 2024), `CONTRATOS TOURS NACIONALES` (1443, 17 docs: CHEPE, CHIAPAS por mes, GUAYABITOS, PUNTA MITA, PLAYA DEL CARMEN, MÉXICO PUEBLA, HUASTECA POTOSINA), `FORMATOS` (1435, `RESPONSIVA.docx` y otros formatos auxiliares).
- Flujo manual actual: Paloma copia `.docx` maestra → rellena cliente/monto/fecha en Word → exporta PDF → sube a folder mensual (`DICIEMBRE 2024`/`NOVIEMBRE 2024`/`OCTUBRE 2024`/`CONTRATOS MES DE ABRIL`).
- Texto legal validado por años de operación — **NO se re-escribe en código**.

**Cotizaciones** — caso completamente distinto:
- 12+ hojas de cálculo `application/o-spreadsheet` (formato Odoo Documents nativo) por agente: ARLENN/ALONDRA/CRISTO/DANIELA/PALOMA/KAREN/MITZI/NORMA/FANNY/MARIO/DANIEL/FANNY IMPORTANTE.
- Son herramienta **interna del agente** — NO presentables al cliente externo (formato propietario Odoo, sin branding, sin estructura comercial).
- `/cotizar` público (Epic 8 quick spec, commit `8608249`) HOY solo captura leads via WhatsApp — no persiste en Firestore.

### Stack técnico revisado

| Componente | Lib | Versión | Razón |
|---|---|---|---|
| Fill `.docx` placeholders | `docxtemplater` + `pizzip` | docxtemplater ^3.x, pizzip ^3.x | Estable, ampliamente usado, ~250KB. Sintaxis `{cliente}` / loops `{#items}{/items}` |
| `.docx` → PDF | **CloudConvert API v2** | API key via Secret Manager | $8/mes plan básico cubre 500 créditos (1 credit/min). ~50 conversiones/mes estimadas = ~50 créditos. SaaS, zero infra, latencia 5-15s típica |
| Cotización PDF (template nuevo) | `@react-pdf/renderer` | ^4.x | Compatible Next 16 App Router (fix 14.1.1+), ~2MB, render <400ms |
| Storage | Firebase Storage existente | — | Patrón ya usado en Story 9.4 |

**Por qué CloudConvert y no Gotenberg self-hosted (descartado):** Firebase App Hosting Cloud Run no incluye LibreOffice. Gotenberg requiere contenedor Docker separado ($5-10/mes idle + per-request, mantenimiento extra). CloudConvert SaaS = decisión más simple para volumen actual; si volumen escala >500 conv/mes en Fase 1 → migrar a Gotenberg. Documentado como punto de evolución, no de bloqueo.

**Por qué NO `@react-pdf/renderer` para contratos:** re-implementar 33+ plantillas en React-PDF destruye conocimiento legal validado, fuerza divergencia, impide que Paloma mantenga sin dev. Riesgo legal real.

### Restricciones firmes heredadas

- **Browser smoke real obligatorio** antes de `done` — 4 escenarios prod (ver AC10).
- **Code review fresh-context Sonnet** antes de merge.
- **`pnpm typecheck` + `pnpm lint` + `pnpm test` verdes**.
- **0 regresiones** en Epic 1-9.
- **NUNCA `unlink` Odoo, NUNCA `action_post` auto**, 200 legacy pagos intactos (heredado Epic 9).
- **R3 plan §8**: bug Next 16 Turbopack workers en `/api/agents/[agentId]/*` NO debería tocar esta story. Verificar pre-flight Task 0.

### Scope MVP contractual (NO scope creep)

✅ **SÍ incluye:**
- Modelos Firestore `contracts/{contractId}` + `quotations/{quotationId}` (snapshot al momento de generar).
- Persistencia mínima del lead `/cotizar` en `quotations/{id}` (foundation para Epic 8).
- Pipeline contratos: descargar `.docx` template Odoo → fill con docxtemplater → CloudConvert → PDF en Storage → ref en Firestore.
- Template `@react-pdf/renderer` universal para cotización.
- 2 endpoints admin-only de generación + 1 endpoint público de persistencia lead.
- UI: botón en `/admin/orders/[orderId]` + página `/admin/quotations`.
- Catálogo `contractTemplates/{templateId}` en Firestore que mapea **destino → `odooDocumentId` de plantilla `.docx`**.
- Esquema canónico de placeholders consensuado con Paloma (subset, NO todo lo que esté en .docx).

❌ **NO incluye (defer F1 explícito):**
- Portal cliente con visor.
- Firma electrónica.
- Generación automática on-create (siempre manual desde botón admin).
- Itinerarios personalizados con IA.
- Cupones (CUPONES COMPRAS folder 1466 — no en compromiso contractual literal).
- Migración export hoja-de-cálculo Odoo a PDF (out-of-scope, defer F1 si Paloma lo pide).
- Self-hosted PDF conversion (CloudConvert es la decisión, Gotenberg evolución F1).
- Bulk re-upload de las 33 plantillas con placeholders al cierre Fase 0 — **piloto de 5 destinos representativos**, resto F1.

## Acceptance Criteria

### AC1 — Spike de placeholders + validación con Paloma

**Given** las 33+ plantillas `.docx` en Odoo Documents existen sin placeholders explícitos
**When** se ejecuta `scripts/spike-10-1-extract-placeholders.mjs`
**Then**:
- Descarga 5 plantillas representativas (sugerido: VUELTA AL MUNDO 2024 id=532, ASIA CONTRATO id=232, EUROPA SEPTIEMBRE CONTRATO id=221, COLOMBIA MAYO CONTRATO id=233, CHEPE ENERO CONTRATO id=202) via `documents.document.read` campo `datas` (base64).
- Extrae texto plano de cada `.docx` con `mammoth` o `docx` package.
- Auto-detecta candidatos a placeholder con heurísticas:
  - Patrones tipo "CLIENTE:", "NOMBRE:", "MONTO:", "TOTAL:", "FECHA DE SALIDA:", "ITINERARIO:" seguidos de blanks/líneas.
  - Líneas con nombres de cliente hardcoded de contratos previos (cross-referencia con folders `DICIEMBRE 2024`/etc.).
  - Tokens monetarios `$X,XXX.XX MXN`.
- Genera reporte `_bmad-output/implementation-artifacts/spikes/10-1-placeholders-proposal.md` con tabla por plantilla: campo detectado, ubicación (párrafo N), placeholder sugerido (`{nombre_cliente}`, `{monto_total_mxn}`, etc.), confidence high/medium/low.

**And** **esquema canónico de placeholders** propuesto basado en common subset:
```
{nombre_cliente}            -- str, ej "FELIPE DE JESUS RUBIO RUIZ"
{nombre_acompanantes}       -- str | empty, ej "Y MA TERESA VIDAÑA SALAS"
{viaje_destino}             -- str, ej "ASIA", "COLOMBIA MAYO"
{viaje_temporada}           -- str, ej "MAYO 2026"
{fecha_salida}              -- str DD/MM/YYYY
{fecha_regreso}             -- str | empty
{monto_total_mxn}           -- str formateado "$145,000.00"
{monto_total_letras}        -- str "CIENTO CUARENTA Y CINCO MIL PESOS 00/100 M.N."
{anticipo_mxn}              -- str | empty
{saldo_mxn}                 -- str | empty
{agente_nombre}             -- str, ej "Paloma Aguilar"
{fecha_firma}               -- str DD/MM/YYYY (autocompletada generatedAt)
{contract_id}               -- str, FK Firestore
```

**And** Alek revisa el reporte ANTES de seguir con AC2 — si Paloma necesita validar 3-5 representativas en sesión async, se hace post-AC1 + pre-AC2.

---

### AC2 — Schemas Zod `contractSchema`, `quotationSchema`, `contractTemplateSchema`

**Given** spike AC1 completado y placeholders canónicos definidos
**When** se crean `src/schemas/contractSchema.ts`, `src/schemas/quotationSchema.ts`, `src/schemas/contractTemplateSchema.ts`
**Then**:

```ts
// contractTemplateSchema (catálogo destino → plantilla Odoo)
{
  templateId: string,
  destinoKey: string,           // 'asia' | 'colombia-mayo' | 'vuelta-al-mundo' | ...
  destinoLabel: string,
  odooDocumentId: number,       // FK documents.document.id
  odooDocumentName: string,
  placeholdersUsed: string[],   // subset del esquema canónico que esta plantilla acepta
  active: boolean,
  uploadedAt: Timestamp,
  uploadedBy: string,
  notes: string | null,
}

// contractSchema (instancia generada)
{
  contractId: string,
  orderId: string,
  templateId: string,
  snapshot: {
    nombreCliente: string,
    nombreAcompanantes: string | null,
    viajeDestino: string,
    viajeTemporada: string,
    fechaSalida: string,
    fechaRegreso: string | null,
    montoTotalCents: number,
    montoTotalMxnFormatted: string,
    montoTotalLetras: string,
    anticipoCents: number | null,
    saldoCents: number | null,
    agenteId: string | null,
    agenteName: string | null,
  },
  pdfUrl: string,
  pdfStoragePath: string,
  cloudConvertJobId: string,    // para debugging/retries
  generatedBy: string,
  generatedByName: string,
  generatedAt: Timestamp,
  version: number,
}

// quotationSchema (lead + PDF opcional)
{
  quotationId: string,
  source: 'cotizar-public' | 'admin-manual',
  leadSnapshot: { contactName, contactPhone, contactEmail?, destino, mes, personas, presupuesto?, notas? },
  pdfUrl: string | null,
  pdfStoragePath: string | null,
  pdfGeneratedBy: string | null,
  pdfGeneratedAt: Timestamp | null,
  pdfVersion: number,
  status: 'lead' | 'pdf-generated' | 'sent' | 'closed',
  createdAt: Timestamp,
  createdBy: string | null,
  whatsappSent: boolean,
}
```

**And** tests co-located cubren happy path + 3 invalid cases c/u (regla acuerdo equipo "Zod safeParse obligatorio").

---

### AC3 — Catálogo `contractTemplates/{id}` poblado con piloto de 5 destinos

**Given** AC1 generó propuesta de placeholders
**When** se ejecuta `scripts/seed-contract-templates.mjs`
**Then**:
- Marca 5 plantillas piloto con placeholders en Word (Claude descarga, modifica, re-sube a Odoo con sufijo `_TEMPLATE_v1`):
  1. VUELTA AL MUNDO 2024 (id=532) — producto bandera
  2. ASIA CONTRATO (id=232) — volumen internacional
  3. EUROPA SEPTIEMBRE CONTRATO (id=221) — volumen Europa
  4. COLOMBIA MAYO CONTRATO (id=233) — volumen LATAM
  5. CHEPE ENERO CONTRATO (id=202) — volumen nacional
- Por cada plantilla piloto: descarga `datas` base64, modifica con `docx` library agregando placeholders en posiciones detectadas en AC1, re-sube a Odoo Documents con `name='<original>_TEMPLATE_v1.docx'`, captura nuevo `documents.document.id`.
- Crea documento `contractTemplates/{templateId}` por cada plantilla con `placeholdersUsed` real validado.
- **NO se borran los originales** (restricción heredada Epic 9). Quedan en Odoo como histórico.
- Output: runbook `_bmad-output/implementation-artifacts/runbooks/10-1-templates-seed.md` con tabla destino → odooDocumentId.

**And** las 28+ plantillas restantes quedan documentadas en runbook como **F1 incremental backlog** (con justificación: piloto cubre los destinos de mayor volumen Odoo histórico — verificar en `audit-output/` Epic 9).

**And** Paloma valida visualmente 1-2 plantillas con placeholders ANTES de Task 4 (pipeline pruebas). Si rechaza, iterar.

---

### AC4 — Pipeline contratos: descarga template Odoo + fill + CloudConvert

**Given** las plantillas piloto AC3 subidas con placeholders
**When** se construye `src/lib/pdf/contracts/pipeline.ts`
**Then** el módulo expone:

```ts
async function generateContractPdf(input: {
  templateId: string,
  snapshot: ContractSnapshot,
}): Promise<{ pdfBuffer: Buffer, cloudConvertJobId: string }>
```

con flujo:
1. Lee `contractTemplates/{templateId}` Firestore → obtiene `odooDocumentId`.
2. Llama Odoo `documents.document.read([id], fields=['datas','mimetype','name'])` para obtener `.docx` base64.
3. `docxtemplater.render({ data: snapshot })` produce `.docx` rellenado en memoria.
4. Sube `.docx` rellenado a CloudConvert via API v2 (job con tasks: `import/upload` → `convert` engine=`office`, output_format=`pdf` → `export/url`).
5. Espera el job (poll cada 2s, timeout 60s; CloudConvert envía webhook pero polling es más simple para MVP).
6. Descarga PDF resultante.
7. Devuelve `{ pdfBuffer, cloudConvertJobId }`.

**And**:
- `CLOUDCONVERT_API_KEY` se guarda en Secret Manager + referencia en `apphosting.yaml`.
- Manejo de errores AppError pattern (`code='cloudconvert-timeout' | 'cloudconvert-failed' | 'odoo-template-not-found' | 'docxtemplater-render-error'`).
- Tests: mock de Odoo + mock de CloudConvert API (Vitest) verifican happy path + 3 fail modes.

---

### AC5 — Endpoint `POST /api/contracts/from-order/[orderId]/generate` (admin)

**Given** un admin autenticado con roles `'admin' | 'superadmin'`
**When** llama el endpoint con body `{ templateId, snapshotOverrides?: Partial<ContractSnapshot> }`
**Then**:
- Verifica auth + roles (401/403).
- Lee `orders/{orderId}` (404 si no existe).
- Resuelve `tripName`, `agentName`, `montoTotalLetras` (helper `numberToSpanishCurrency`).
- Construye `ContractSnapshot` aplicando `snapshotOverrides` para edge cases (ej. nombre completo con acentos que Paloma ajusta).
- Llama `generateContractPdf()` (AC4).
- Sube PDF a Storage `contracts/{orderId}/{contractId}.pdf`.
- Genera signed URL 7 días.
- Crea `contracts/{contractId}` Firestore.
- Actualiza `orders/{orderId}.contractId`, `orders/{orderId}.contractPdfUrl`.
- Devuelve `{ contractId, pdfUrl, version }`.

**And** idempotencia: si ya existe, incrementa `version`, crea nuevo `contractId`, no falla.

---

### AC6 — Endpoint `POST /api/quotations` (público, persistencia lead)

**Given** `/cotizar` hoy solo abre WhatsApp sin persistir
**When** se actualiza `CotizacionForm.tsx` para hacer `POST /api/quotations` ANTES de `wa.me/`
**Then**:
- Body `{ leadSnapshot, source: 'cotizar-public' }`.
- Rate-limit 10 req/min por IP (anti-spam mínimo).
- Sin auth (form público).
- Crea `quotations/{id}` con `status='lead'`, `whatsappSent=true`, `pdfUrl=null`, `pdfVersion=0`.
- Devuelve `{ quotationId }` o `AppError` (400/429/500).
- **Graceful degradation:** si POST falla, WhatsApp aún se abre. Lead no se pierde en handoff.

---

### AC7 — Endpoint `POST /api/quotations/[id]/generate` + template `<QuotationDocument />` (`@react-pdf/renderer`)

**Given** un admin y un `quotations/{id}` con `status='lead'`
**When** llama el endpoint
**Then**:
- Verifica auth + roles admin.
- Lee `quotations/{id}` (404).
- Renderiza `<QuotationDocument props={leadSnapshot} />` server-side via `renderToBuffer` de `@react-pdf/renderer`.
- Sube PDF a Storage `quotations/{quotationId}/{quotationId}.pdf`.
- Actualiza Firestore: `pdfUrl`, `pdfStoragePath`, `pdfGeneratedAt`, `pdfVersion: prev+1`, `status: 'pdf-generated'`.
- Devuelve `{ pdfUrl, pdfVersion }`.

**And** template incluye:
- Header logo + #cotización + fecha generación.
- Datos cliente.
- Datos solicitud (destino, mes, personas, presupuesto, notas).
- Bloque "Próximos pasos" estándar.
- Vigencia "7 días desde generación".
- Footer datos AroundaPlanet (dirección Ocotlán + tel + email).
- Página numerada.

**And** font registration UNA SOLA VEZ al cargar módulo (evita race condition documentada en research web).

---

### AC8 — UI admin: botón en `/admin/orders/[orderId]` + página `/admin/quotations`

**Given** admin autenticado en panel admin
**When** navega a `/admin/orders/[orderId]`
**Then**:
- Card "Contrato" muestra:
  - Selector de plantilla (`contractTemplates` activos) — pre-seleccionado por destino del viaje si match.
  - Botón "Generar contrato PDF" (variant=primary). Si existe contrato previo: "Regenerar (v2)" + link "Ver actual".
  - Form opcional `snapshotOverrides` (nombre completo, acompañantes) — defaults desde `orders/{id}`.
- Loading state: Skeleton (regla CLAUDE.md, NO spinner genérico).
- Toast éxito con link PDF o error con `code+message`.

**And** página nueva `/admin/quotations/page.tsx`:
- Lista paginada (20/pág) de `quotations/*` orden `createdAt desc`.
- Columnas: cliente, destino, mes, personas, status, fecha, acciones.
- Filtros: status (`lead`, `pdf-generated`, `sent`, `closed`).
- Botón por fila: "Generar PDF" o "Ver PDF/Regenerar".
- Layout coherente con `/admin/payments`, `/admin/verification`.

---

### AC9 — Firestore + Storage Security Rules

**Given** colecciones nuevas
**When** se actualizan `firestore.rules` + `storage.rules`
**Then**:
- `contracts/*`: read admin/superadmin; write Admin SDK only.
- `contractTemplates/*`: read admin/superadmin; write Admin SDK only.
- `quotations/*`:
  - create público SOLO si `source=='cotizar-public'` AND `whatsappSent==true` AND `pdfUrl==null` AND `pdfVersion==0` AND `status=='lead'` AND `createdBy==null` (anti-abuse).
  - read admin/superadmin.
  - update/delete Admin SDK only.
- Storage `contracts/*` y `quotations/*`: read solo via signed URL; write Admin SDK only.

---

### AC10 — Browser smoke prod (obligatorio antes de `done`)

**Given** deploy verde a prod
**When** Alek + opcionalmente Paloma ejecutan smoke
**Then** se completan 4 escenarios documentados en `runbooks/10-1-smoke-prod.md`:

1. **Contrato VUELTA AL MUNDO desde orden real**: orden Confirmada existente → seleccionar plantilla `vuelta-al-mundo` → generar → descargar PDF → Paloma valida visualmente que el texto legal es idéntico al `.docx` original y que los datos del cliente/monto/fecha están correctos.
2. **Contrato CHEPE ENERO** desde otra orden → validar plantilla nacional + monto formato MXN + monto en letras.
3. **Cotización pública**: enviar `/cotizar` real → aparece en `/admin/quotations` con `status='lead'` → generar PDF → validar template visualmente.
4. **Regeneración (versionado)**: re-generar contrato del paso 1 → `version=2`, archivo Storage actualizado, signed URL nueva.

**And** runbook documenta: signed URLs (OK que expiren), screenshots, `contractId`/`quotationId` generados, `cloudConvertJobId`, latencias observadas (esperado: 5-15s contratos, <1s cotizaciones).

**And** 0 regresiones en flujos Epic 1-9 (validar con suite + smoke `/admin/orders` + `/admin/payments` + `/admin/verification` + `/cotizar` público sigue mandando a WhatsApp).

---

## Tasks

### Task 0 — Pre-flight checks

- [ ] Re-leer `plan-cierre-fase-0-may-2026.md` §3 + §8 (riesgos).
- [ ] Verificar que `/admin/orders/[orderId]` (detalle) existe — si no, mapear archivos a crear minimal.
- [ ] Confirmar que el bug Next 16 Turbopack workers NO toca rutas nuevas a crear (`/api/contracts/*`, `/api/quotations/*`, `/admin/quotations`).
- [ ] **Crear cuenta CloudConvert** (alek@), generar API key con scope `task.read,task.write,user.read`. Guardar en Secret Manager: `firebase apphosting:secrets:set CLOUDCONVERT_API_KEY`. Añadir a `apphosting.yaml`.
- [ ] Validar con curl que CloudConvert v2 funciona desde una máquina local: `.docx` minimal → PDF.

### Task 1 — Spike placeholders (AC1)

- [ ] `pnpm add -D mammoth docx` (dev deps, solo para spike).
- [ ] `scripts/spike-10-1-extract-placeholders.mjs`: descarga 5 plantillas, extrae texto, auto-detecta candidatos.
- [ ] Generar `_bmad-output/implementation-artifacts/spikes/10-1-placeholders-proposal.md`.
- [ ] **GATE:** Alek revisa, ajusta esquema canónico si necesario, marca approval ANTES de Task 2.

### Task 2 — Schemas Zod (AC2)

- [ ] `src/schemas/contractTemplateSchema.ts` + test.
- [ ] `src/schemas/contractSchema.ts` + test.
- [ ] `src/schemas/quotationSchema.ts` + test.
- [ ] `pnpm typecheck` verde.

### Task 3 — Seed plantillas piloto (AC3)

- [ ] `pnpm add docx` (prod dep, para modificar `.docx` en script seed).
- [ ] `scripts/seed-contract-templates.mjs`: download 5 plantillas, inserta placeholders, re-upload Odoo con sufijo `_TEMPLATE_v1`, popula `contractTemplates/*` Firestore.
- [ ] Runbook `runbooks/10-1-templates-seed.md` con tabla destino → odooDocumentId nuevo.
- [ ] **GATE:** Paloma valida 1-2 plantillas con placeholders en Word visualmente (verbal OK suficiente).

### Task 4 — Pipeline contratos (AC4)

- [ ] `pnpm add docxtemplater pizzip`.
- [ ] `src/lib/pdf/contracts/pipeline.ts` + `cloudconvert.ts` client.
- [ ] Helper `numberToSpanishCurrency(cents): string` ("CIENTO CUARENTA Y CINCO MIL PESOS 00/100 M.N.") — usar lib `numero-a-letras` o equivalente, validar con casos edge ($0, $100, $1,234,567.89).
- [ ] Tests Vitest con mocks Odoo + CloudConvert.

### Task 5 — Cotización template + pipeline (AC7)

- [ ] `pnpm add @react-pdf/renderer`.
- [ ] `src/lib/pdf/templates/QuotationDocument.tsx`.
- [ ] `src/lib/pdf/quotations/pipeline.ts` con `renderToBuffer`.
- [ ] Font registration al cargar módulo (anti-race).
- [ ] Tests render con fixtures.

### Task 6 — Endpoints (AC5, AC6, AC7)

- [ ] `POST /api/contracts/from-order/[orderId]/generate` (admin guard, Node runtime).
- [ ] `POST /api/quotations` (público, rate-limit IP).
- [ ] `POST /api/quotations/[id]/generate` (admin guard).
- [ ] Helper `uploadPdfToStorage(buffer, path)` reutilizable.
- [ ] Tests integration.

### Task 7 — UI admin (AC8)

- [ ] Card "Contrato" en `/admin/orders/[orderId]` con selector de plantilla + form overrides + botón generar.
- [ ] Página `/admin/quotations/page.tsx` con lista + filtros + botón generar.
- [ ] Componente `<GeneratePdfButton />` reutilizable (Skeleton loading).
- [ ] Tests Vitest componentes.
- [ ] Update `CotizacionForm.tsx` para POST antes de `wa.me/` (AC6 client-side).

### Task 8 — Security rules (AC9)

- [ ] `firestore.rules` + `storage.rules` actualizados.
- [ ] Deploy `firebase deploy --only firestore:rules,storage`.

### Task 9 — Validación pre-deploy

- [ ] `pnpm typecheck` 0 errores.
- [ ] `pnpm lint` 0 warnings nuevos.
- [ ] `pnpm test` verde (baseline 1660 + nuevos).
- [ ] Code review fresh-context Sonnet → aplicar findings High obligatorio.

### Task 10 — Deploy + smoke prod (AC10)

- [ ] `/deploy`.
- [ ] Validar HTTP 200.
- [ ] Ejecutar 4 escenarios AC10.
- [ ] Documentar runbook `10-1-smoke-prod.md`.

### Task 11 — Cierre

- [ ] `sprint-status.yaml`: `10-1-pdf-contratos-cotizaciones: done`.
- [ ] Memoria: `MEMORY.md` Epic 10 + `session-NN-story-10-1-pdfs.md`.
- [ ] Commit final con co-author Claude.

## Riesgos específicos

| # | Riesgo | Prob | Mitigación |
|---|---|---|---|
| S1 | docxtemplater no preserva formato Word exacto (negritas, alineación, saltos de página) | Baja | docxtemplater preserva todo XML del .docx, solo reemplaza placeholders. Tests con plantilla real validan. |
| S2 | CloudConvert latencia >30s degrada UX | Media | UI con loading Skeleton + polling backend. p95 esperado 5-15s (Office docs pequeños). Si excede consistentemente → considerar Gotenberg F1. |
| S3 | CloudConvert API key compromise | Baja | Secret Manager + apphosting.yaml + rate-limit Cloud Run. Rotación documentada en runbook. |
| S4 | Placeholders auto-detectados con false positives → contrato roto | Alta | **GATE Task 1 + Task 3:** Alek + Paloma validan ANTES de seguir. Empezar con 5 plantillas piloto, no 33. |
| S5 | Paloma rechaza el aspecto del PDF generado vs el .docx original | Media | CloudConvert preserva el .docx fielmente. Si rechaza estructura React-PDF de cotización → iterar template (out-of-scope cosmético menor). |
| S6 | Monto en letras incorrecto en español MX | Media | Tests con casos edge. Validación verbal Paloma. |
| S7 | `@react-pdf/renderer` choque con Next 16 App Router | Baja | Research confirma fix desde 14.1.1+. Server-only render. Si falla: pivot a Puppeteer + HTML template solo para cotizaciones (contratos no se afectan). |
| S8 | Volumen real >>500 conversiones/mes en Fase 0 | Baja | 50 esperadas. Si excede → escalar plan CloudConvert ($16-24 plan medio). |
| S9 | Cleanup spike artifacts en Odoo (plantillas viejas) | Baja | Restricción Epic 9: NUNCA unlink. Re-upload con sufijo `_TEMPLATE_v1` y olvidar originales. |

## Definition of Done

- [ ] AC1-AC10 cumplidos.
- [ ] Tests verdes: baseline 1660 + 50-80 nuevos.
- [ ] `pnpm typecheck` + `pnpm lint` 0 errores.
- [ ] Code review fresh-context aprobado, findings High aplicados.
- [ ] Deploy prod verde, smoke AC10 documentado en runbook con screenshots.
- [ ] 5 plantillas piloto activas en `contractTemplates/*` y validadas por Paloma.
- [ ] 0 regresiones Epic 1-9.
- [ ] CloudConvert API key en Secret Manager, runbook de rotación.
- [ ] Sprint-status + memoria actualizados.
- [ ] Commit en español con co-author Claude.

---

*Generado v1: 2026-05-15 sesión 42 · Reescrito v2 tras spike Odoo Documents discovery + decisiones AskUserQuestion · Source of truth: plan-cierre-fase-0-may-2026.md §3 + scripts/audit-output/10-1-templates-discovery.json*
