# Audit Report — Story 8.1 Odoo Documents Backoffice

**Fecha:** 2026-05-16
**Auditor:** Claude (Opus 4.7) — sesión cierre Epic 8 audit
**Status previo:** `review` (desde sesión donde GPT-5 Codex la dejó)
**Veredicto:** ❌ **REGRESS TO IN-PROGRESS**

## a) AC × Estado

| AC | Implementado | Tests | Smoke | Notas |
|---|---|---|---|---|
| AC1 Módulo Admin/SuperAdmin | ✅ parcial | ❌ no | ❌ no | Páginas `/admin/documents` + `/superadmin/documents` existen, sidebar item presente. **Usa `claims.roles.includes('admin')` en `route.ts:8` y `sync/route.ts:8` en lugar de `requirePermission('documents:read')` / `documents:manage'`** aunque `seedPermissions.ts:27-132` ya define los permisos. Permisos seedeados pero ignorados. |
| AC2 Separar `product.document` de `documents.document` | ✅ | ❌ | ❌ | `documents.ts` distingue conceptualmente; overview separa product vs backoffice. |
| AC3 Backoffice desde `documents.document` + metadata-only + sin binarios | ⚠️ parcial | ❌ | ❌ | Lectura segura de Odoo OK (no binarios). **NO persiste en Firestore** — `sync/route.ts:19-26` solo regenera overview en memoria y reporta `created: 0`. Spec exige colecciones `/odooDocuments`, `/odooDocumentFolders`, `/odooDocumentFolderMappings` — NINGUNA existe. |
| AC4 Folder-to-product matching + persistencia mapeos confirmados | ⚠️ parcial | ❌ | ❌ | Matching engine in-memory en `documents.ts:70-95` (exact + token overlap). **No persiste mappings confirmados.** Admin no puede confirmar suggested ni ignorar — no hay endpoint `folder-mappings`. |
| AC5 Vista "Sin relacionar" + relación manual | ⚠️ parcial | ❌ | ❌ | Tab "Sin relacionar" existe en `DocumentsPanel.tsx`, pero **no hay acción** para relacionar manualmente ni marcar intencionalmente unrelated. Solo lectura. |
| AC6 Clasificación operacional + override manual | ⚠️ parcial | ❌ | ❌ | `classifyFolder()` (`documents.ts:58-68`) infiere scope. **Sin override** — admin no puede corregir clasificaciones. |
| AC7 Search/filters/detail | ✅ parcial | ❌ | ❌ | Panel tiene búsqueda + tabs (Relacionados/Sin relacionar/Carpetas/Públicos). Falta detail view conjunta product+backoffice por trip. |
| AC8 Write probe guarded | ✅ | n/a | ✅ histórico | Ejecutado manual 2026-05-08, `product.template` id 1937 archivado. Documentado en story spec líneas 237-256. |
| AC9 Tests | ❌ **0 tests** | — | — | Spec lista 7 archivos `.test.ts/.tsx`; **0 existen** para esta story (typecheck pass, lint pass, pero sin coverage del feature). |

**Resumen:** 1/9 AC completo (AC8). 5/9 parcial sin persistencia ni manual ops. 1/9 (AC9 tests) totalmente ausente.

## b) Code review adversarial

### High

1. **`src/app/api/odoo/documents/route.ts:8-10` y `sync/route.ts:8-10` — Bypass del sistema de permisos.**
   Usa role-check ad-hoc en vez de `requirePermission('documents:read' | 'documents:manage')`. Los permisos `documents:read` y `documents:manage` ya están seedeados (`seedPermissions.ts:27-132`) pero ningún endpoint los consume. Cualquier futuro role override granular (revocar `documents:read` a un admin específico) no funcionará. Spec AC1 lo exige explícitamente ("controlled through a new permission `documents:read`").

2. **`src/app/api/odoo/documents/sync/route.ts:19-26` — sync que no sincroniza.**
   El endpoint llamado "sync" no escribe a Firestore. Devuelve `created: 0` y reporta `updated: <counts>` aunque no haya actualizado nada — engaña al consumidor. Re-llama a Odoo en cada visita al panel (no hay cache TTL ni cursor incremental). Spec AC3 exige metadata persistida con `lastSyncTimestamp`.

3. **Cero tests para 6 archivos nuevos.** `documents.ts` (250L matching + clasificación), `odooDocumentsSchema.ts`, los 3 route handlers, `DocumentsPanel.tsx` — todos sin test. AC9 listaba 7 archivos `.test.ts` obligatorios. Riesgo: cualquier cambio en `matchFolderToProduct()` o `classifyFolder()` puede romper relaciones silenciosamente.

### Medium

4. **`src/app/api/odoo/documents/route.ts:19-30` — sin rate-limit, sin cache.**
   Cada GET dispara llamadas Odoo (overview con productLimit 800 + folderLimit 250 + backofficeDocumentLimit 500). Odoo está rate-limited (~60 req/min). Un admin recargando la página dispara 4+ búsquedas XML-RPC. Falta debounce/cache server-side.

5. **`src/lib/odoo/models/documents.ts:90-95` — heurística token overlap sin documentación de threshold.** El match suggested usa "tokens >3 chars", sin umbral de confidence persistido. Puede producir suggested falsos masivos cuando dos productos comparten un destino (e.g. "ASIA MAYO" y "ASIA MAYO1").

6. **`src/components/custom/DocumentsPanel.tsx` — 385L sin separar concerns.** Mezcla fetch, estado, filtros, tabs, render. Difícil de testear y sin AbortController limpio (declarado `controller` en `fetchDocuments` pero no manejo el unmount).

### Low

7. **`src/app/(admin)/admin/documents/page.tsx` (19L)** — server component que delega 100% a panel cliente. No hay metadata SEO ni headers de cache (correcto, pero faltaría `dynamic = 'force-dynamic'` explícito si depende de auth en cookies).

8. **`odooDocumentsSchema.ts` (31L)** — exporta `normalizeOdooDocumentName` pero schemas Zod no cubren respuestas Odoo (la mapping engine asume tipos sin `safeParse`). Anti-pattern listado explícitamente en spec ("Do not use `as Type` for Odoo records; use Zod `safeParse`").

### Restricciones firmes Odoo

- ✅ **NO unlink:** confirmado — no hay llamadas `unlink` en el código.
- ✅ **NO action_post auto:** N/A para este módulo (lectura).
- ✅ **NO binarios:** confirmado — `documents.ts` excluye `datas`, `raw`, `db_datas`.
- ✅ **NO public exposure:** ruta authenticated, role-gated.
- ⚠️ **Pagination respetada:** sí (productLimit/folderLimit) pero sin cursor incremental para datasets >100.

## c) Veredicto

### ❌ REGRESS TO IN-PROGRESS

**Gap estructural:**
- AC3 persistencia Firestore: 0% implementado (sync no escribe nada)
- AC4 mappings confirmados persistidos: 0% (no endpoint, no colección)
- AC5 acciones manuales relate/unrelate: 0%
- AC6 override clasificación: 0%
- AC9 tests: 0/7 archivos

**Esto NO es "review" — es "first-pass scaffolding"**, como el propio dev (GPT-5 Codex) admitió en `Completion Notes` del spec línea 359: *"Manual folder mapping, download proxy, Firestore persistence, and automated tests remain as follow-up work before calling the full story complete."*

**Trabajo restante estimado:** 4-6 sesiones (no <2h). Requiere:
1. Sub-story 8.1.a — Persistencia Firestore (`/odooDocuments`, `/odooDocumentFolders`, `/odooDocumentFolderMappings`) + sync incremental con cursor
2. Sub-story 8.1.b — Endpoints `POST /api/odoo/documents/folder-mappings` (confirm/ignore) + `PATCH /api/odoo/documents/[id]` (manual relate, scope override)
3. Sub-story 8.1.c — UI acciones (relate, unrelate, mark unrelated, override scope)
4. Sub-story 8.1.d — Tests (7 archivos según spec AC9)
5. Hardening — `requirePermission('documents:read' | 'documents:manage')` en routes, rate-limit, cache TTL, Zod `safeParse` en model layer

**Recomendación orquestador:** dado que Epic 8 está deprioritizado detrás del cierre Fase 0 (Epic 10), Story 8.1 debe quedar **in-progress** sin tocar hasta cierre Fase 0. NO mover a `done` bajo ninguna circunstancia.

## Validaciones técnicas ejecutadas

- ✅ Spec leído completo (376L)
- ✅ Filesystem auditado (8 source files, 0 test files, 0 folder-mappings endpoint)
- ✅ Permisos seedeados verificados (`seedPermissions.ts:27-132`)
- ✅ Sidebar verificado (`RoleSidebar.tsx:70,156`)
- ✅ Routes leídas (route.ts, sync/route.ts) — bypass de permisos confirmado
- ✅ Restricciones firmes Odoo: respetadas en lo construido

## Acción tomada

- Sprint-status: `8-1-odoo-documents-backoffice: review` → `in-progress`
- Commit: `chore(epic-8): regress Story 8-1 a in-progress + audit report`
- NO push (regla del audit)
- NO se tocó código fuente
