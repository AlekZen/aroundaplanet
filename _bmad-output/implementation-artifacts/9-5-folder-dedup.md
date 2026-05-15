# Story 9.5: Folder Dedup Odoo Documents (33 clusters, shortcut nativo + tags)

Status: draft

> **Tipo:** Feature (S/M)
> **Bloqueada por:** 9.4 (attachment individual ✅ live — tag `aroundaplanet_comprobante` id=47, attachmentReceiptTagId en config)
> **Bloquea:** Retrospectiva Epic 9 (última story funcional)
> **Insumos:**
> - `_bmad-output/planning-artifacts/epics.md#Story-9.5` (líneas 1850-1880) — plan original
> - `memory/session-35-payments-sync-audit.md` — 26 clusters reportados (auditoría inicial)
> - `memory/session-39-story-9-4-documents-attachment.md` — lecciones tag + chatter Odoo 18
> - `_bmad-output/implementation-artifacts/9-4-documents-attachment-individual.md` — shape de story replicado
> - `scripts/audit-output/9-5-folder-dedup.json` + `9-5-folder-dedup-v2.json` + `9-5-folder-explorer-v3.json` — outputs spike H1-H6
> - `scripts/audit-output/9-5-hybrid.json` + `9-5-hybrid-v2.json` — outputs spike H7-H12
> - `src/lib/odoo/payments-attachments.ts` (Story 9.4) — patrón de upload, no se modifica salvo task 4 opcional
> - `appConfig/odoo` Firestore — donde se persisten tagIds

## Story

Como **sistema y admin (Paloma)**,
quiero **que los 33 clusters de folders duplicados en Odoo Documents queden marcados con `shortcut_document_id` nativo apuntando al canónico de cada cluster + tag plano `folder-canonico` o `folder-duplicado` para filtrado nativo**,
para **que Paloma navegue Documents sin ver duplicados (filtro nativo "ocultar `folder-duplicado`") y para que la UI Odoo entienda los duplicados como atajos al canónico sin lógica custom**, **sin borrar ni mover ningún documento existente**.

## Contexto

### Hallazgos del spike (anti-trampa: leer antes de codear)

1. **`documents.folder` NO existe en Odoo 18**. La memoria sesión 35 asumía que era un modelo separado. La realidad: folders son `documents.document` con `type='folder'` (selection: `[url, binary, folder]`). 1,283 binary + 182 folder = 1,465 docs total en prod.
2. **`documents.facet` tampoco existe**. Las tags en Odoo 18 son planas — sin agrupación por facet. La integración con Documents se hace por prefijo en el nombre del tag (`folder-canonico` / `folder-duplicado`).
3. **`shortcut_document_id` es campo NATIVO**: Many2one self en `documents.document`, type=`many2one relation=documents.document string="Source Document"`. **0 docs lo usan actualmente** — terreno limpio. La UI Documents lo entiende como alias del canónico sin Studio ni custom field. **Esta es la elección de Alek: máxima integración con Documents.**
4. **`folder_id` (NO `parent_folder_id`)** es el self-FK que apunta al folder padre. La memoria reportaba `parent_folder_id` — corregido.
5. **Conteo real: 33 clusters / 75 folders duplicados** (no 26). La auditoría sesión 35 quedó corta. 42 writes (75 − 33 canónicos) para resolver dedup completa.
6. **Validado empíricamente en H11**: write `tag_ids = [[6,0,[tagId]]]` sobre un folder LIVE (id=1998 "CHIAPAS SEPTIEMBRE 2026") y rollback `[[6,0,[]]]` — sin AccessError ACL. uid=2 (Noel service account) tiene permiso. Es seguro escribir tag_ids sobre folders type='folder'.
7. **Tags spike pendientes (estado prod actual)**:
   - id=48 `spike_9_5_test_<TS>_no_facet_CLEANED`
   - id=49 `spike_9_5_canonico_<TS>_CLEANED`
   - id=50 `spike_9_5_duplicado_<TS>_CLEANED`
   - Estrategia: la Task 1 los **renombra a los productivos** `folder-canonico` y `folder-duplicado` vía `ir.model.fields` write (mismo patrón que Story 9.7 ejecutó custom fields desde XML-RPC sin Studio manual). El tag 48 se renombra `_CLEANED_<ts>` y se olvida.
8. **Custom field `x_spike_9_5v2_..._canon` id=22941 ya creado en prod** (Many2one self sobre `documents.document`) — **se descarta** con rename `_CLEANED_` porque Alek eligió `shortcut_document_id` nativo. NO se borra (Odoo Online no permite drop fields manuales desde XML-RPC sin riesgo).

### Heurística canónico (decidida por Alek)

**Auto: folder con más `children_ids` (docs hijos) gana; tie-breaker = id más bajo (más antiguo).**

Razón: el folder que ya concentra más documentos es el más "real" para Paloma. Tie por id bajo prefiere el folder original sobre los que se crearon después por accidente (típico patrón "ASIA MAYO" original, "ASIA MAYO1" duplicado por re-creación).

NO hay override manual en MVP. La UI `/admin/odoo-folders/dedup` es solo lectura/auditoría. Si Paloma quiere cambiar canónico de un cluster específico tras el run inicial, lo hace manualmente en Odoo Studio o ejecutando el script con un override file (out-of-scope MVP, agregar a backlog 9.5b si surge).

### Enchufe 9.4 → 9.5 (resolver folder canónico al subir comprobante)

**Decisión: OPCIONAL en MVP, implementado como Task 4 con feature flag**. Story 9.4 ya está LIVE sin asignar `folder_id` (Odoo lo permite). Si esta story implementa el helper `resolveCanonicalFolderId(destino, mes, año)` y lo enchufa en `uploadPaymentReceipt`, los nuevos comprobantes caerán automáticamente en el canónico correcto. Si no, quedan sin folder hasta que Paloma los mueva manual (NO automatizar moves).

MVP: implementar helper como **dry-run + read-only** detrás de feature flag `ODOO_FOLDER_AUTO_ASSIGN=false` por default. Task 4 lo deja code-ready, post-deploy se prueba con un pago real, si OK se activa flag en config Firestore. Bajo riesgo, alto valor.

### Restricciones firmes (heredadas del Epic 9)

- **NUNCA `unlink`** sobre folders ni documentos.
- **NUNCA mover documentos existentes** entre folders. Los duplicados existentes mantienen sus docs hijos donde están. Solo los **nuevos** comprobantes (Task 4 opcional) van al canónico.
- **NUNCA `action_post`** automático (no aplica aquí pero se reitera para anti-regresión).
- **200 pagos legacy NO se tocan** — los attachments que ya están en folders duplicados quedan ahí.
- **Browser smoke real obligatorio** antes de marcar story `done` (regla sesión 38/39).
- Cleanup spike artifacts via rename `_CLEANED_<ts>`, NO drop.

## Acceptance Criteria

### AC1 — Setup tags `folder-canonico` + `folder-duplicado` en `documents.tag` y config Firestore

**Given** la story arranca con Odoo 18 producción y los 3 tags spike (48, 49, 50) existen con prefijo `spike_` y sufijo `_CLEANED`
**When** se ejecuta `scripts/setup-9-5-folder-tags.mjs` (patrón equivalente a `setup-9-4-attachment-tag.mjs`)
**Then**:
- El script busca por name si ya existen tags `folder-canonico` y `folder-duplicado` en `documents.tag`. Si no: renombra los spike tags 49→`folder-canonico` y 50→`folder-duplicado` vía `documents.tag.write`. Si sí: usa los existentes.
- El tag 48 `spike_9_5_test_<TS>_no_facet_CLEANED` queda sin tocar (es residual del spike H8, no productivo).
- Imprime `folderCanonicoTagId` y `folderDuplicadoTagId`.

**And** los IDs se persisten en Firestore `appConfig/odoo`:
```ts
{ folderCanonicoTagId: number, folderDuplicadoTagId: number }
```

**And** runbook `_bmad-output/implementation-artifacts/runbooks/9-5-folder-tags-setup.md` documenta los pasos + output capturado + IDs finales.

**And** cleanup del custom field 22941 `x_spike_9_5v2_..._canon`: el script lo renombra a `x_cleaned_9_5_<ts>` vía `ir.model.fields.write` (NO drop). Documentar.

### AC2 — Script auditoría `scripts/audit-9-5-folder-clusters.mjs`

**Given** se necesita el snapshot reproducible de los 33 clusters
**When** se ejecuta el script
**Then**:
- Query `documents.document` con `domain=[['type','=','folder']]`, fields `['id','name','folder_id','tag_ids','shortcut_document_id','create_date']`.
- Para cada folder, calcula `children_count` via `search_count` sobre `documents.document` con `folder_id=<id>` (1 call por folder; total 182 calls — aceptable, no es operación frecuente).
- Normaliza nombre: lowercase + NFD diacrítico-strip + colapsar espacios múltiples + strip sufijos numéricos finales (`/\d+$/` → ej. "ASIA MAYO1" → "asia mayo").
- Agrupa por nombre normalizado. Cluster = grupo con ≥2 folders.
- Aplica heurística canónico: max `children_count` gana; tie = min `id`.
- Output JSON a `scripts/audit-output/9-5-folder-clusters-<ts>.json` con shape:
```ts
{
  generatedAt: ISO,
  totalFolders: number, // 182
  totalClusters: number, // 33
  totalDuplicates: number, // 42
  clusters: Array<{
    normalizedKey: string,
    canonical: { id, name, childrenCount, createDate },
    duplicates: Array<{ id, name, childrenCount, createDate, currentShortcutDocumentId, currentTagIds }>
  }>
}
```

**And** el script NO escribe nada en Odoo — pura auditoría.
**And** se ejecuta una vez para validar conteo, output queda como snapshot de referencia.

### AC3 — Script execute `scripts/execute-9-5-folder-dedup.mjs`

**Given** existe el snapshot AC2 y los tags AC1 están listos
**When** se ejecuta el script execute
**Then**:
- Carga el snapshot JSON más reciente (o se le pasa por arg).
- Por cada cluster, para cada duplicado:
  1. Si `currentShortcutDocumentId === canonical.id` Y `folderDuplicadoTagId IN currentTagIds` → skip (ya procesado, idempotencia).
  2. Si no: write sobre `documents.document` id=duplicate.id:
     ```ts
     {
       shortcut_document_id: canonical.id,
       tag_ids: [[6, 0, [...currentTagIds.filter(t => t !== folderCanonicoTagId), folderDuplicadoTagId]]],
     }
     ```
     (Replace tag_ids preservando otros tags existentes, sustituyendo `folder-canonico` si lo tenía por error, agregando `folder-duplicado`.)
- Por cada cluster, para el canónico:
  1. Si `folderCanonicoTagId IN currentTagIds` Y `currentShortcutDocumentId === false` → skip.
  2. Si no: write
     ```ts
     {
       tag_ids: [[6, 0, [...currentTagIds.filter(t => t !== folderDuplicadoTagId), folderCanonicoTagId]]],
     }
     ```
     (NO toca `shortcut_document_id` del canónico — los canónicos no son atajos de nadie.)

**And** log a Firestore `folderDedupLog/{normalizedKey}` con shape:
```ts
{
  normalizedKey: string,
  canonicalId: number,
  canonicalName: string,
  duplicateIds: number[],
  executedAt: serverTimestamp(),
  executedBy: 'script-9-5-execute',
  totalChildrenInCanonical: number,
  totalChildrenInDuplicates: number,
  snapshotFile: string,
}
```

**And** retry con backoff `[1s, 2s, 4s]` por write (patrón heredado).
**And** rate-limit cap: max 30 writes/min (cap Odoo 60 req/min, deja headroom). Total 42+33=75 writes → ~3 min ejecución.
**And** el script es **idempotente**: re-correr no duplica writes ni cambia estado si ya está aplicado (skip por condición arriba).
**And** dry-run mode: arg `--dry-run` solo imprime las writes que haría sin ejecutarlas. Obligatorio antes de la corrida real.

### AC4 — Helper `resolveCanonicalFolderId` (enchufe 9.4 opcional con feature flag)

**Given** los nuevos comprobantes 9.4 actualmente NO asignan `folder_id`
**When** se quiere routarlos al folder canónico de su destino+mes+año
**Then**:
- Crear `src/lib/odoo/folder-canonical.ts` con función:
  ```ts
  async function resolveCanonicalFolderId(
    tripDestino: string,
    paymentDate: Date,
    options?: { dryRun?: boolean }
  ): Promise<{ folderId: number | null, source: 'canonical-tag' | 'fallback-create' | 'disabled' | 'no-match' }>
  ```
- Lee feature flag `ODOO_FOLDER_AUTO_ASSIGN` de `appConfig/odoo` (default `false`). Si false → retorna `{folderId: null, source: 'disabled'}`.
- Construye nombre normalizado `{destino}-{mes}-{año}` (mismo normalizer que AC2).
- Query `documents.document` con `domain=[['type','=','folder'], ['tag_ids','in',[folderCanonicoTagId]]]`. Trae todos los canónicos (33 esperados).
- Hace match por nombre normalizado en JS. Si encuentra → retorna `{folderId, source: 'canonical-tag'}`.
- Si no encuentra Y feature flag `ODOO_FOLDER_AUTO_CREATE=true` (default `false`) → crea folder nuevo con name = `{DESTINO} {MES} {AÑO}` (capitalizado, formato Paloma) + tag `folder-canonico`. Retorna `{folderId, source: 'fallback-create'}`.
- Si no encuentra Y no auto-create → retorna `{folderId: null, source: 'no-match'}`.
- Cache in-memory por proceso de los canónicos (TTL 10min) — patrón heredado.

**And** integración con 9.4: Task 4 modifica `uploadPaymentReceipt` para que **opcionalmente** acepte `folderId?: number` en input, y `syncVerifiedPaymentToOdoo` resuelva el folder pre-upload:
```ts
const folderResult = await resolveCanonicalFolderId(tripDestino, paymentDate);
const folderId = folderResult.folderId ?? undefined;
await uploadPaymentReceipt({ ...input, folderId });
```
Si el upload incluye `folderId`, el call a Odoo agrega `folder_id` al payload del attachment/document. Si no, el attachment queda sin folder (comportamiento actual 9.4).

**And** unit tests con mock de `appConfig/odoo` + 4 escenarios: flag off / canonical match / no-match / fallback-create.

**And** el helper NO se activa en prod inicialmente. Post-deploy AC8 valida en dry-run, luego Paloma o Alek prenden el flag manualmente cuando se valida con 1 pago real.

### AC5 — UI `/admin/odoo-folders/dedup` (solo lectura)

**Given** existen los 33 clusters procesados y log en `folderDedupLog/`
**When** admin navega a la nueva ruta
**Then** ve una tabla con:
- Columna "Cluster" (nombre normalizado, ej. "asia mayo")
- Columna "Canónico" (link al folder Odoo + nombre original)
- Columna "Duplicados" (count + tooltip con lista)
- Columna "# Docs canónico" / "# Docs duplicados" (children count)
- Columna "Procesado" (timestamp `executedAt` del log)
- Filtro por nombre normalizado

**And** la página es **read-only**: NO permite cambiar canónico ni re-ejecutar el script (eso vive en CLI). Si Paloma quiere override de un cluster: comando manual + actualizar `folderDedupLog`.

**And** ruta `/admin/odoo-folders/dedup` (NO confundir con `/admin/odoo/duplicates` que es de payments).

**And** layout: `(admin)` route group + `AdminDesktopLayout` sidebar.

**And** server component lee `folderDedupLog` y enriquece con `documents.tag` ids desde `appConfig/odoo` para el link a Odoo UI.

**And** test co-localizado: `page.test.tsx` con mock de Firestore + render.

### AC6 — Schema Zod + Firestore rules

**Given** se agregan nuevos docs a Firestore
**When** se crean los schemas
**Then**:
- `src/schemas/folderDedupLogSchema.ts` con el shape de AC3 (campos `normalizedKey`, `canonicalId`, etc.).
- `src/schemas/appConfigOdooSchema.ts` (si existe se extiende; si no se crea): agregar `folderCanonicoTagId`, `folderDuplicadoTagId` opcionales (con refine: si uno está, el otro también).
- `firestore.rules`: `folderDedupLog/{logId}` lectura solo admin (`request.auth.token.admin == true`), escritura solo server (Admin SDK). `appConfig/odoo` ya tiene reglas heredadas de 9.4.
- Tests Zod: valid/invalid casos.

### AC7 — Cleanup spike artifacts

**Given** los IDs de spike (48, 49, 50, 22941) están en prod
**When** se ejecuta el setup AC1
**Then**:
- Tag 49 renombrado a `folder-canonico` (reutilizado).
- Tag 50 renombrado a `folder-duplicado` (reutilizado).
- Tag 48 renombrado a `_CLEANED_<ts>_spike_9_5_h3_facet_test` (descartado).
- Field 22941 renombrado a `x_cleaned_9_5_<ts>` (descartado, NO se borra — Odoo Online riesgo).
- Folder spike anterior `_CLEANED_<ts>_9-0a` (ids 2018, 2019) sin tocar (son de Story 9.4, no de esta).

**And** documentar en runbook `9-5-folder-tags-setup.md` qué se renombró y por qué.

### AC8 — Smoke prod end-to-end con browser real

**Given** la story está deployada a prod
**When** Alek ejecuta el smoke
**Then** verifica los 6 escenarios:

1. **Conteo verificado**: navegar a `/admin/odoo-folders/dedup` → ver los 33 clusters listados. Spot-check 3 clusters al azar contra Odoo UI directamente (ej. "ASIA MAYO" vs "ASIA MAYO1") → confirmar que el canónico tiene más children que los duplicados.
2. **Filtros nativos Odoo**: en Odoo UI Documents, filtrar por tag `folder-canonico` → aparecen 33 folders. Filtrar por `folder-duplicado` → aparecen 42 folders. Filtrar excluyendo `folder-duplicado` → la lista de folders se reduce a ~140 (182 − 42).
3. **Shortcut nativo Odoo**: abrir un folder duplicado en Odoo UI (ej. "ASIA MAYO1") → la UI debe renderizar el shortcut visualmente (icono o link al canónico). Si NO lo renderiza (sorpresa Odoo Online vs Community), documentar pero NO bloquear story — el campo está set y queda como link semántico para queries.
4. **Re-run idempotencia**: ejecutar `execute-9-5-folder-dedup.mjs --dry-run` después del run real → output debe ser "0 writes pendientes" en todos los 33 clusters.
5. **Helper AC4 dry-run**: con `ODOO_FOLDER_AUTO_ASSIGN=false`, simular una llamada a `resolveCanonicalFolderId('ASIA', new Date('2026-05-01'))` desde un script de prueba → retorna `{folderId: null, source: 'disabled'}`. Activar flag temporalmente, repetir → retorna `{folderId: <canónico>, source: 'canonical-tag'}`. Apagar flag.
6. **No regresión 9.4**: subir un pago de prueba (mismo flujo que 9.4 smoke) → confirma que el attachment se crea normal (sin folder asignado, comportamiento actual). Si AC4 flag se prendió en escenario 5, confirmar que ese pago de prueba SÍ tiene `folder_id` set al canónico.

**And** los 6 escenarios pasan o quedan documentados con bug + plan.
**And** smoke con browser real Playwright MCP (regla sesión 38).

## Tasks

### Task 1 — Setup tags productivos + config Firestore + cleanup spike artifacts (AC1, AC7)
1.1 Script `scripts/setup-9-5-folder-tags.mjs`: renombra tags 49→`folder-canonico`, 50→`folder-duplicado`. Renombra tag 48 y field 22941 con sufijo `_CLEANED_`.
1.2 Persistir `folderCanonicoTagId` + `folderDuplicadoTagId` en `appConfig/odoo` vía Admin SDK.
1.3 Helper `src/lib/odoo/config.ts` extender con `getFolderCanonicoTagId()` + `getFolderDuplicadoTagId()` con cache 10min.
1.4 Runbook `_bmad-output/implementation-artifacts/runbooks/9-5-folder-tags-setup.md` documenta paso a paso.

### Task 2 — Schema Zod + rules (AC6)
2.1 `src/schemas/folderDedupLogSchema.ts` nuevo.
2.2 `src/schemas/appConfigOdooSchema.ts` extender (crear si no existe).
2.3 `firestore.rules` agregar regla `folderDedupLog`.
2.4 Tests Zod co-localizados.

### Task 3 — Script auditoría 33 clusters (AC2)
3.1 `scripts/audit-9-5-folder-clusters.mjs` con normalizer + agrupador + heurística canónico.
3.2 Ejecutar 1 vez, output a `scripts/audit-output/9-5-folder-clusters-<ts>.json`.
3.3 Validar conteo manual vs spike (33 clusters, 75 folders, 42 dup).
3.4 Documentar normalizer exacto en comentario top del script para futuras stories que necesiten match.

### Task 4 — Helper `resolveCanonicalFolderId` + enchufe 9.4 opcional (AC4)
4.1 `src/lib/odoo/folder-canonical.ts` con función + cache + feature flags.
4.2 Modificar `src/lib/odoo/payments-attachments.ts` `uploadPaymentReceipt` para aceptar `folderId?: number` opcional.
4.3 Modificar `src/lib/odoo/payments-push.ts` `syncVerifiedPaymentToOdoo` para resolver folder pre-upload (solo si flag on).
4.4 Tests co-localizados (`folder-canonical.test.ts`) con 4 escenarios: flag off / canonical match / no-match / fallback-create.
4.5 Tests extensión `payments-attachments.test.ts`: upload sin folder (default) / upload con folder válido.
4.6 Tests extensión `payments-push.test.ts`: integración flag on/off con mock.

### Task 5 — Script execute dedup (AC3)
5.1 `scripts/execute-9-5-folder-dedup.mjs` con --dry-run + retry + rate-limit + idempotencia.
5.2 Persiste log a `folderDedupLog/` por cluster.
5.3 Validar `pnpm typecheck` 0 errores (el script TS por consistencia con audit-*).

### Task 6 — UI `/admin/odoo-folders/dedup` (AC5)
6.1 Crear `src/app/(admin)/admin/odoo-folders/dedup/page.tsx` server component.
6.2 Lee `folderDedupLog` desde Firestore Admin SDK.
6.3 Componente tabla con filtros (Vitest + RTL).
6.4 Link a Odoo UI por folder id: `https://aroundaplanet.odoo.com/odoo/documents/{folderId}` (validar shape de URL en Odoo 18 SaaS).
6.5 Tests co-localizados.

### Task 7 — Deploy + smoke prod (AC8)
7.1 Deploy via skill `/deploy` (typecheck + lint + vitest + push master + monitor + valida HTTP).
7.2 Ejecutar `setup-9-5-folder-tags.mjs` en prod (CLI desde local con creds prod).
7.3 Ejecutar `audit-9-5-folder-clusters.mjs --output` y guardar snapshot.
7.4 Ejecutar `execute-9-5-folder-dedup.mjs --dry-run` → revisar output → si OK ejecutar sin `--dry-run`.
7.5 Smoke con Playwright MCP los 6 escenarios AC8.
7.6 Confirmación visual con Paloma o cuenta admin disponible.
7.7 Marcar story `done` en `sprint-status.yaml` + actualizar `MEMORY.md`.

## Dev Notes (anti-trampas)

1. **`documents.folder` NO existe — todo es `documents.document` con `type='folder'`**. Si te tienta hacer `client.searchRead('documents.folder', ...)` recordá el error literal del spike: `XML-RPC fault: Object documents.folder doesn't exist`. Usar siempre `documents.document` con domain filter `[['type','=','folder']]`.
2. **`folder_id` NO `parent_folder_id`**. La memoria sesión 35 estaba mal. El self-FK al padre es `folder_id`.
3. **`shortcut_document_id` puede no renderizarse visualmente en Odoo Online SaaS sobre folders**. El campo SÍ existe (spike H12) y el write es válido. Pero la UI nativa quizá lo trata diferente vs binary docs. Si AC8 escenario 3 falla visualmente: el campo sigue siendo útil para queries y para futura migración, NO es bloqueante.
4. **Tags planas, sin facet — distinguir por nombre del tag**. `documents.facet` no existe Odoo 18. La UI Documents filtra por tag directamente sin agrupación. Lo importante es que los names sean reconocibles (`folder-canonico` / `folder-duplicado`).
5. **Heurística canónico (más children + tie id bajo)** está implementada en JS, NO en Odoo. Si Paloma quiere override de un cluster específico: backlog 9.5b, no MVP.
6. **Idempotencia del execute script es OBLIGATORIA**. Re-correr no debe duplicar writes. Validar antes de cada write si ya está aplicado. Validar tag_ids preservando otros tags existentes (NO sobreescribir con replace ciego — usar set difference + add).
7. **Rate-limit Odoo 60 req/min**: 42+33=75 writes, ~3 min. Si se agrega Task 4 enchufe en producción, cada upload de comprobante 9.4 suma 1 call a `resolveCanonicalFolderId` (cache 10min lo absorbe).
8. **Service Worker Serwist**: post-deploy UI nueva `/admin/odoo-folders/dedup` puede no renderizar si SW cachea bundle viejo. Validar con nav + bust query string.
9. **Browser smoke obligatorio** (regla sesión 38). Tests con mocks NO detectan UI Odoo Online vs Community differences en cómo renderiza shortcut.
10. **NO unlink, NO mover docs existentes, NO action_post**. Reiteración firme. Toda dedup es marcado vía shortcut + tag. Si en futuro Paloma quiere consolidar docs hijos al canónico: spike + story 9.5b separada con plan de move documentado.
11. **Si te cicla 2 veces en una hipótesis** (regla retro 9.6): delegar audit fresh-context a subagente Sonnet con brief "NO ASUMAS, COMPRUEBA".
12. **Custom field 22941 NO se borra, se renombra `_CLEANED_`**. Odoo Online + XML-RPC permite create/write de `ir.model.fields` pero el `unlink` puede dejar tablas en estado inconsistente. Rename es safe.

## Test Plan (resumen)

| Capa | Casos clave |
|---|---|
| Unit `folderDedupLogSchema.test.ts` | valid / invalid (missing fields, wrong types) |
| Unit `appConfigOdooSchema.test.ts` | refine: ambos tagIds presentes o ninguno |
| Unit `folder-canonical.test.ts` | flag off → disabled / match canónico / no-match / fallback-create |
| Unit `payments-attachments.test.ts` ext | upload sin folderId (default) / upload con folderId válido propaga al payload |
| Unit `payments-push.test.ts` ext | flag on resuelve folder pre-upload / flag off skip resolver |
| Unit `/admin/odoo-folders/dedup/page.test.tsx` | render 33 clusters / filtro funciona / link a Odoo correcto |
| Integration (manual) | script audit ejecutado contra prod retorna 33 clusters / script execute --dry-run output válido |
| Smoke prod (Playwright MCP) | 6 escenarios AC8 |

## Senior Developer Review (AI) — placeholder

Se completa post-implementación con subagente Sonnet fresh-context (patrón sesión 38/39).

## Definition of Done

- [ ] AC1-AC8 satisfechos.
- [ ] `pnpm typecheck` 0 errores.
- [ ] `pnpm lint` 0 errores.
- [ ] `pnpm test` verde (baseline 1593 de 9.4 + nuevos).
- [ ] Code-review subagente Sonnet outcome no peor que "approved with minor".
- [ ] Deploy prod via skill `/deploy` exitoso, Cloud Run revision matchea commit.
- [ ] Setup AC1 ejecutado en prod (tags renombrados, config Firestore set).
- [ ] Audit AC2 ejecutado, snapshot guardado, 33 clusters confirmados.
- [ ] Execute AC3 ejecutado (dry-run + real), 42 duplicados marcados + 33 canónicos tagged.
- [ ] Smoke prod AC8 6/6 escenarios validados (o 5/6 con escenario 3 documentado si Odoo Online no renderiza shortcut visualmente).
- [ ] `_bmad-output/implementation-artifacts/sprint-status.yaml` story 9.5 → `done`.
- [ ] `MEMORY.md` actualizada con resumen + lecciones nuevas.
- [ ] (Opcional) Retro Epic 9 — última story funcional cierra el epic.

## Pendientes documentados (NO bloquean DoD)

- **AC4 feature flags `ODOO_FOLDER_AUTO_ASSIGN` y `ODOO_FOLDER_AUTO_CREATE`**: quedan `false` en deploy inicial. Alek/Paloma deciden cuándo prenderlos. Cuando se prendan, 9.4 nuevos comprobantes empiezan a recibir `folder_id` auto.
- **Override manual de canónico**: backlog 9.5b si Paloma identifica clusters mal resueltos por la heurística.
- **Consolidación docs hijos a canónico**: explícitamente fuera de scope (NO mover docs). Backlog 9.5c con plan de move documentado si surge.
- **Migración 200 pagos legacy**: si Paloma quiere subir comprobantes históricos a folders canónicos: backlog 9.4c (heredado).
- **Shortcut visual en Odoo SaaS**: si AC8 escenario 3 muestra que la UI no renderiza shortcut sobre folders, abrir issue Odoo support o documentar como limitación.

## Estimación

- **Tamaño**: S/M. Razón: 2 scripts + 1 helper + 1 schema + 1 UI read-only + setup + smoke. Sin endpoint nuevo, sin lógica orquestadora compleja. La heurística canónico está bien definida.
- **Esfuerzo estimado**: 1-1.5 días dev + 0.5 día smoke prod = ~1.5-2 días totales.
- **Riesgo principal**: que `shortcut_document_id` no rendere visualmente en folders en Odoo Online SaaS (no documentado oficialmente para folders). Mitigación: el campo sigue siendo útil para queries y link semántico — escenario 3 AC8 documenta pero no bloquea.
