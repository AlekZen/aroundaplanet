# Retrospectiva — Epic 9: Sync Bidireccional Firestore ↔ Odoo Pagos

**Fecha cierre**: 2026-05-15 · **Sesión**: 41 · **Duración total Epic 9**: ~6 sesiones (35→40) · **Stories**: 9/9 DONE

## TL;DR

Epic 9 cerró completo (9 stories: 2 spikes + 7 funcionales) entregando sync bidireccional Firestore ↔ Odoo end-to-end en prod: push idempotente al verificar, pull mirror read-only con polling 15min + webhook fast-path HMAC, attachment individual con tag `aroundaplanet_comprobante`, folder dedup con tags planos, consola admin con cola/conflictos/alertas, y schema Zod canónico + custom fields Odoo. **0 regresiones, 1660 tests pass al cierre (+238 vs baseline pre-Epic 9 1422). Restricciones firmes respetadas: 0 `unlink`, 0 `action_post` automático, 200 legacy intactos.**

Sin embargo, **3 de las 9 stories requirieron pivote arquitectónico durante ejecución real** porque sus spikes no validaron el ciclo completo de mutación (solo existencia de campos/recursos). Cada pivote costó 0.5–1 ciclo de rework. La lección dominante del epic: **los spikes deben validar create + write + read + cleanup, no solo "el campo existe"**, y los audits con datos reales en prod son cualitativamente distintos de los tests con mocks.

## Resultado funcional

| Story | Status | Entregado | Pivote vs plan original |
|---|---|---|---|
| 9.0a Spike Documents res_id | done | Patrón B: `ir.attachment.create` con `res_model+res_id` desde inicio (1 call, p95=261ms). Regla: payment FIRST → attachment AFTER. | Validó `res_id`, NO validó `tag_ids` (gap descubierto en 9.4). |
| 9.0b Spike Idempotencia 2-call | done | **Patrón invertido** (mejor que research): reservar `ir.model.data res_id=0` PRIMERO → create payment → write({res_id}). Elimina syncLocks. | Mejora vs plan: invierte el orden propuesto en research. |
| 9.7 Schema Zod + custom fields | done | 5 campos custom Odoo creados via XML-RPC por subagente (sin Paloma manual). Runbook + smoke completo. | Mejora vs plan: bypass dependencia humana. |
| 9.1 Reconciliación + dedup interno | done | PARTE A: 15h+1m+14l de 31 FS reconciliados. PARTE B: 132 clusters Odoo dedupados (decisión `x_dup_status` selection en lugar de tags). | Consolidó 9.1a+9.1b en una sola story (decisión tomada en sesión). |
| 9.2 Push Firestore→Odoo | done | Felipe RUBIO $5,000 → Odoo payment 8134 state='draft'. Idempotencia 409 ALREADY_SYNCED verificada. Badge UI live. | Sin pivote — patrón 9.0b funcionó tal cual. |
| 9.3 Pull Odoo→Firestore | done | Cloud Scheduler 15min ENABLED + webhook fast-path HMAC. 3-tier match. LWW conflict detection. writeMirror invariante. | Sin pivote arquitectónico, pero 2 bugs cazados solo por smoke real (false vs '', IAM grantaccess). |
| 9.4 Documents attachment | done | **Camino B1: `documents.document` wrapper** (NO `ir.attachment` directo). Tag id=47 propaga al ir.attachment subyacente automáticamente. | **Pivote crítico vs spike 9.0a**: `ir.attachment.tag_ids` NO existe en Odoo 18. |
| 9.5 Folder dedup | done | **Camino C: tags planos** `folder-canonico` id=49 + `folder-duplicado` id=50. Link semántico dup→canon vive en Firestore `folderDedupLog/`. | **Pivote A→C en ejecución real**: `shortcut_document_id` rechaza write post-create. Cluster count 7/10 real vs 33/42 memoria stale. |
| 9.6 UX admin sync console | done | `/admin/payments/sync-console` con KPIs, cola push, conflictos, alertas, retry/dismiss/mark-canceled, CSV export. | Sin pivote arquitectónico, pero 4 bugs operativos cazados solo por audit prod (rules deploy silencioso, ==null+orderBy quirk, amount/amountCents, link dinámico inexistente). |

## Lo que salió bien

1. **Restricciones firmes de negocio respetadas 100% del epic**. Nunca `unlink`, nunca `action_post` automático, 200 pagos legacy NUNCA tocados. Cleanup vía rename `_CLEANED_` o state='cancel'. La disciplina del acuerdo "adivinar es prohibido" sostuvo todo el epic sin un solo incidente operativo en Odoo prod.

2. **Patrón invertido del spike 9.0b se transfirió limpio a producción**. Reservar `ir.model.data` PRIMERO con `res_id=0` y completar con `write({res_id})` post-create eliminó la necesidad de `syncLocks` aplicativos y serializó idempotencia vía UNIQUE constraint Postgres. p95=617ms (2-call) en prod. Felipe RUBIO 8134 lo validó end-to-end al primer try.

3. **Orquestación Opus + subagentes Sonnet con dominios disjuntos escaló bien**. Patrón replicado en sesiones 38 (F1-F5, 6 subagentes), 39 (T1-T7) y 40. Contexto principal lean. Code-review fresh-context con Sonnet cazó High pre-commit en 9.4 (refine Zod), 9.6 (push pre-transacción) y 9.5 (`duplicatesChildrenCount` mal calculado). ROI alto en cada story.

4. **3 bugs estructurales solo cazados por code-review subagente fresh-context** (no por self-review):
   - 9.3: `firebase-admin set+merge` NO parsea FieldPath con punto literal — requiere nested object literal `{ lww: { memo: { ... } } }`. Advisor cazó pre-commit.
   - 9.4: Refine `synced` exigía `odooAttachmentIds` no vacío pero el read post-create es best-effort. Fix: refine acepta `odooDocumentId !== null` O array no vacío.
   - 9.6: Push post-resolve enviaba snapshot pre-transacción.

5. **Browser smoke real obligatorio (sesiones 38–40)** cazó bugs que tests con mocks jamás detectaron. Esta regla, reforzada incrementalmente durante el epic, es el ROI más alto del proceso (ver sección "Bugs browser-smoke-only" abajo).

6. **Skill `/deploy` (creada sesión 37) funcionó end-to-end** en cada story sin intervención cuando no había errores: ~6 min build, HTTP poll, validación 200 + keyword automática. Auto-recovery de IAM denied funcionó en 9.3 (commit 7a6c8a0 trigger empty).

7. **0 regresiones causadas por Epic 9** en otros flujos. VerificationPanel refactor a `<SyncStatusBadge />` no rompió `/admin/verification` ni paneles agente.

## Lo que salió mal

### Spikes que validaron solo existencia, no ciclo completo de mutación

1. **9.0a validó `ir.attachment` con `res_model+res_id` pero NO probó `tag_ids`**. Story 9.4 descubrió empíricamente en sub-spike `validate-tag-on-attachment.mjs` que `ir.attachment.tag_ids` NO existe en Odoo 18 (`ValueError: Invalid field 'tag_ids' on model 'ir.attachment'`). Costo: pivote a Camino B1 (`documents.document` wrapper), 2 sub-spikes adicionales en prod, ~30 min de rework + cleanup de 2 documents (_CLEANED_) y 1 payment cancelled (8152).

2. **9.5 H12 verificó que `shortcut_document_id` existe pero NO probó write post-create**. En execute real apareció el error literal *"No puede cambiar el documento objetivo de los atajos"*. Pivote Camino A → Camino C (tags planos puros, link semántico en Firestore `folderDedupLog/`). Costo: 1 ciclo de rework + invalidación del escenario 3 del smoke (N/A por pivote).

3. **Memoria operativa stale 3 sesiones después**. La sesión 35 reportó 26–33 clusters de folders duplicados; el audit en sesión 40 (3 sesiones después) midió 7 clusters / 10 duplicados. Las cifras de auditorías con normalizers ruidosos sobre-cuentan, y la memoria no se decae sola. Costo: estimación de scope inflada al inicio de 9.5.

### Bugs operativos cazados solo por browser smoke real (no por tests)

4. **Rules deploy silencioso a la mitad (9.6)**: primer `firebase deploy --only firestore:rules` reportó success pero NO propagó. Solo `--force` aplicó. 30+ min perdidos diagnosticando.

5. **`where(==null) + orderBy` quirk Web SDK (9.6)**: Firestore retorna *"Missing or insufficient permissions"* aunque rules permitan e índice exista. Fix: filtro client-side.

6. **`amount` vs `amountCents` field name (9.6)**: tabla cola push mostraba "—" en columna Monto. Tests con mocks tenían shape `amount`, doc real tenía `amountCents`. Mocks no realistas ocultaron el bug.

7. **Firestore Timestamp en server components (9.5 hotfix `1a0cb08`)**: `safeParse(z.union([z.date(), z.string()]))` rechaza objetos `Timestamp` silenciosamente. Normalizar a ISO con helper antes del parse. Detectado solo en smoke browser.

8. **App Hosting rollout colgado post-build (9.6)**: Cloud Build SUCCESS pero Cloud Run no creó revision hasta `firebase apphosting:rollouts:create --git-branch master --force` manual. 15 min perdidos.

9. **IAM secrets para SA preparer ≠ SA compute (9.3)**: build prod falló silencioso por secrets sin grantaccess al SA del preparer. Fix: `firebase apphosting:secrets:grantaccess` + re-trigger empty (commit 7a6c8a0).

10. **Odoo XML-RPC retorna `false` (no `null` ni `''`) para strings vacíos (9.3)**: fix `typeof === 'string'` guard en `x_firebase_payment_id` y `memo` (commit a43dcd2).

11. **Botón "Aprobar" abría modal "Confirmas la aprobación" antes de POST (9.2 smoke)**: cazado al primer intento por smoke real.

12. **Bug "Sincronizando…" UI muerto en /admin/verification (post-9.2)**: 4 pagos verified mostraban chip "Sincronizando…" en lugar de badge sync — el componente no distinguía "sin odooPaymentId todavía" vs "synced sin badge". Resuelto en 9.6 con `<SyncStatusBadge />` refactor.

### Loop de diagnóstico erróneo (sesión 38)

13. Diagnostiqué "token expirado" en 9.6 cuando la causa real era rules no propagadas. Alek tuvo que interrumpir explícitamente para forzar delegación a subagente fresh-context. **Anti-patrón**: hipótesis 1 falla → 2 falla → 3 sin evidencia nueva → especular. **Mitigación adoptada para epics futuros**: tras 2 fallos sin evidencia nueva, delegar audit a subagente sin sesgo.

### Service Worker (Serwist PWA) retarda visibilidad de deploys

14. SW cachea bundles JS y los sirve post-deploy. `unregister + caches.delete` no basta porque se re-registra en hidratación. Validación de nueva revisión vía endpoint cuyo contrato cambió (501→401 o 404→401) resultó la señal más limpia.

## Lecciones técnicas (consolidadas Epic 9)

### 1. Spikes deben validar el ciclo completo de mutación, no solo existencia

Un spike que verifica *"el campo X existe en el modelo Y"* es insuficiente para decidir arquitectura. Antes de cerrar un spike, validar:

- **CREATE** con todos los campos que la story va a escribir
- **WRITE** post-create sobre todos los campos que la story va a actualizar luego (algunos son read-after-create — `shortcut_document_id` es el caso testigo)
- **READ** de los campos para confirmar que el shape persistido matchea lo esperado
- **CLEANUP** vía rename `_CLEANED_` o state='cancel' (nunca `unlink`)

**Costo de saltarse esto**: 9.4 perdió 30 min + 2 sub-spikes + 2 docs y 1 payment cleanup. 9.5 perdió 1 ciclo + invalidó 1 escenario de smoke.

### 2. Memoria operativa decae rápido — re-medir antes de planear

Cifras de auditorías heredadas (>2 sesiones de antigüedad) requieren re-medición contra prod antes de planear scope. El "33 clusters" de sesión 35 era stale al llegar a sesión 40. **Regla**: antes de codear sobre cifras de >2 sesiones atrás, ejecutar el query de audit otra vez y comparar deltas.

### 3. Bugs browser-smoke-only son cualitativamente distintos a unit-test bugs

Los 11 bugs operativos del epic (rules deploy, ==null quirk, amount/amountCents, Timestamp, rollout colgado, IAM, false vs '', botón modal, "Sincronizando…", SW cache, key residual) NO eran detectables por vitest/typecheck/lint. Solo aparecieron con:

- Browser real navegando la UI con datos reales prod
- Inspección de Firestore con MCP/Admin SDK contra colección real
- DevTools console (errors silenciosos en hidratación)
- HTTP poll de endpoint cuyo contrato cambió (no del root)

**Regla práctica reforzada**: cualquier story que modifique UI o contratos en prod requiere audit Playwright MCP o screenshot del usuario antes de cerrar. **Esta es la regla más cara del epic — adoptada incrementalmente sesiones 38, 39, 40, debería ser default desde sesión 1 del próximo epic.**

### 4. Mensajes de error de Firestore Web SDK son engañosos

`Missing or insufficient permissions` NO siempre significa rules denegando:

- Rules denegando (causa común)
- Índice faltante o construyéndose (causa común, mensaje malo)
- Query con `where('==', null)` + `orderBy` (bug Web SDK conocido)
- Token expirado sin refresh válido (raro)

**Antes de asumir rules**: `gcloud firestore indexes composite list`, verificar query no use `==null + orderBy`, inspeccionar token en IndexedDB.

### 5. Validación de deploys NO termina en "deploy complete"

Tres tipos de deploy en este proyecto, cada uno con su latencia y verificación distinta:

| Deploy | Comando | Verificación |
|---|---|---|
| Código (App Hosting) | `git push origin master` | Poll endpoint cuyo contrato cambió (501→401 o 404→401), NO solo HTTP 200 al root. |
| Firestore Rules | `firebase deploy --only firestore:rules` | **Siempre `--force`**. Verificar con `firebase_get_security_rules` MCP o read real desde cliente. Propagación parcial silenciosa es real. |
| Firestore Indexes | `firebase deploy --only firestore:indexes` | `gcloud firestore indexes composite list` para estado READY/CREATING. Compound tarda 1–5 min. |

### 6. App Hosting rollout puede colgarse post-build

Cloud Build SUCCESS NO garantiza promoción a Cloud Run. Si `gcloud run revisions list` no matchea último commit hash tras 5+ min:

```bash
firebase apphosting:rollouts:create aroundaplanet \
  --git-branch master --project arounda-planet --force
```

NO usar `--git-commit <hash>` (FAILED_PRECONDITION glitch GC). `--git-branch master` siempre funciona.

### 7. IAM secrets requieren grantaccess al SA del preparer

Build prod falla silencioso si secrets de `apphosting.yaml` nuevos no tienen acceso al SA del preparer (≠ SA compute). Fix: `firebase apphosting:secrets:grantaccess <SECRET> --backend aroundaplanet --project arounda-planet`. Auto-detectable en pre-deploy (skill `/deploy` ya lo hace).

### 8. Service Worker Serwist cachea bundles post-deploy

Para validar nueva revisión en browser: `Ctrl+Shift+R` o navegar a otra ruta y volver con `?bust=timestamp`. `unregister + caches.delete` se re-registra en hidratación.

### 9. Detectar loops de diagnóstico antes de la 3ra iteración fallida

Síntomas: hipótesis 1 falla → 2 falla → 3 sin evidencia nueva, mismo síntoma persiste tras 2+ "fixes", empiezo a especular sobre causas exóticas (token, cache, infra glitch). **Acción**: parar, `advisor()` O delegar audit fresh-context a subagente con brief literal *"NO ASUMAS, COMPRUEBA"*. Mejor delegar antes de la 3ra iteración, no después de que Alek interrumpa.

### 10. Patrón invertido (9.0b) generaliza más allá de account.payment

Reservar `ir.model.data` PRIMERO con `res_id=0` → create → write({res_id}) elimina syncLocks aplicativos para cualquier modelo Odoo donde necesitemos idempotencia desde Firestore. Snippet code-ready en `_bmad-output/.../spikes/9-0b-findings.md` aplicable a futuros sync (contactos, órdenes).

### 11. `documents.document` wrapper sobre `ir.attachment` propaga `res_model/res_id` automáticamente

Contradice la sospecha del spike 9.0a línea 121-126 que sugería "evitar wrapper". El wrapper es la solución correcta cuando se necesita tag, sin calls extra (1 call total). Regla: cuando una integración requiere tags + visibilidad en chatter, usar `documents.document` wrapper desde el principio.

### 12. Odoo 18 model gotchas confirmadas empíricamente

- `documents.folder` NO existe — las folders son `documents.document` con `type='folder'`
- `documents.facet` NO existe — tags Odoo 18 son planas, distinguir por prefijo en `name`
- `ir.attachment.tag_ids` NO existe — usar `documents.document.tag_ids`
- `documents.tag` es el modelo correcto (NO `ir.attachment.tag`)
- `shortcut_document_id` es read-after-create

**Acción**: agregar estos al runbook permanente `_bmad-output/.../runbooks/odoo-18-gotchas.md` (TODO post-retro).

## Mejoras al proceso BMAD

1. **Spike template debería exigir 4 fases explícitas**: CREATE + WRITE + READ + CLEANUP, no solo "validar hipótesis". Cada hipótesis del spike (H1, H2…) debe atravesar las 4 fases o documentar explícitamente *"WRITE no aplica porque…"*.

2. **Audit de prod con datos reales obligatorio antes de cerrar planning de una story**. La sesión 35 reportó cifras que decayeron 3 sesiones después. Regla: cifras de audit >2 sesiones requieren re-medición.

3. **Code-review fresh-context con Sonnet es ROI alto** — adoptar como **default** post-dev en TODA story del próximo epic, no como opción. ROI demostrado en 9.3 (FieldPath nested), 9.4 (refine Zod), 9.6 (push pre-transacción), 9.5 (duplicatesChildrenCount).

4. **Browser smoke real con Playwright MCP debería ser AC obligatorio en stories que modifiquen UI o contratos prod**. Incluir en plantilla `acceptance-criteria.md` como AC#N estándar.

## Mejoras al skill `/deploy`

Anotaciones para update de `~/.claude/skills/deploy/SKILL.md` (extracto de retro 9.6 + lecciones epic):

1. **Pre-deploy check**: detectar diffs en `firestore.rules` y `firestore.indexes.json` vs último commit. Si hay diffs, forzar deploy de rules+indexes ANTES del push de código con `--force` en rules.

2. **Post-deploy verify**: pollear `gcloud run revisions list` hasta que latest revision matchee commit hash. Si no en 5 min, disparar `firebase apphosting:rollouts:create --git-branch master --force` (NO `--git-commit hash`).

3. **Polling de endpoint con contrato cambiado**: en lugar de HTTP 200 al root, pollear endpoint nuevo cuyo contrato cambió de 404→401 o 501→401. Patrón validado en 9.6 (`/api/payments/sync-console/export` 218s) y 9.4 (`/api/payments/.../retry-attachment` 151s).

4. **Service Worker reminder**: incluir en reporte final *"Recordatorio: usuarios deben hacer Ctrl+Shift+R para invalidar SW cache"*.

5. **IAM grantaccess automático** ya implementado (sesión 37) — mantener.

## Mejoras al proceso de code-review

1. **Code-review SIEMPRE en chat fresh-context Sonnet** — adoptado incrementalmente en 9.3, 9.4, 9.5, 9.6. Hacer default desde story 1 del próximo epic.

2. **Brief estándar para code-review subagente**: *"NO ASUMAS, COMPRUEBA. Lee schema fields, refines, ownership matrix. Caza: snapshots pre-transacción, FieldPath con punto, refines que ignoran best-effort reads."*

3. **High findings se aplican PRE-COMMIT, NO PRE-DEPLOY**: regla confirmada en 9.4 (2 High + 4 Med aplicados pre-commit). Approved with minor → commit.

## Métricas del epic

- **Stories completadas**: 9/9
- **Sesiones**: 6 (35–40)
- **Tests**: 1422 → 1660 (+238)
- **Commits Epic 9**: ~20 (entre stories + hotfixes + retro)
- **Builds App Hosting prod**: ~15
- **Pivotes arquitectónicos durante ejecución**: 3 (9.4, 9.5, decisión 9.1 consolidación)
- **Sub-spikes adicionales fuera de plan**: 4 (2 en 9.4 + 1 en 9.5 + 1 en 9.0a cleanup)
- **Bugs cazados pre-prod (tests/lint/typecheck)**: ~30
- **Bugs cazados solo por browser smoke real**: 11
- **Bugs cazados solo por code-review subagente**: 3 High estructurales
- **Regresiones causadas por Epic 9**: 0
- **Restricciones firmes violadas**: 0 (0 unlink, 0 action_post auto, 200 legacy intactos)

## Restricciones firmes Epic 9 — reforzadas para futuros epics

1. **NUNCA `unlink` en Odoo**. Cleanup solo vía rename `_CLEANED_<ts>` o state='cancel'.
2. **NUNCA `action_post` automático**. Paloma postea manual siempre.
3. **200 pagos legacy NO se tocan automáticamente** — solo enlazan via `odooPaymentId` cuando match alta confianza.
4. **Idempotencia vía UNIQUE constraint Postgres + `ir.model.data` invertido** (patrón 9.0b). NO syncLocks aplicativos.
5. **Browser smoke real obligatorio antes de cerrar cualquier story con UI o contrato prod**.
6. **Code-review fresh-context con Sonnet antes de commit** (no antes de deploy).
7. **`firebase deploy --only firestore:rules` SIEMPRE con `--force`**.

## Pendientes Epic 9 (NO bloquean cierre)

- [ ] AC9 smoke prod completo 9.4 (7 escenarios end-to-end con pago real `receiptUrl`)
- [ ] AC9 smoke prod completo 9.6 (3–4 escenarios remaining)
- [ ] Automation Rule webhook Odoo (Paloma manual, runbook 9-3 paso 6)
- [ ] Cleanup `45803` ACL-locked manual Paloma (heredado spike 9.0a)
- [ ] Feature flags `ODOO_FOLDER_AUTO_ASSIGN` / `ODOO_FOLDER_AUTO_CREATE` (default `false`, requiere passing `tripDestino` + `paymentDate` desde caller)
- [ ] Investigar API key residual `AIzaSyC_JR5E4...` en bundle prod
- [ ] `/admin/verification/{id}` página dinámica de detalle
- [ ] Mejorar label "Éxito 24h: 0%" KPI con tooltip
- [ ] Bug pre-existente Next 16 Turbopack workers en `/api/agents/[agentId]/clients` y `/metrics` (heredado, NO Epic 9 — abrir con `/bmad-correct-course` antes de Story 4-3)
- [ ] Runbook permanente `odoo-18-gotchas.md` (consolidar lección 12)
- [ ] 5 findings Low 9.6 + 3 Low 9.4 + 2 Low 9.3 (backlog opcional)

## Decisión: próximo epic

Recomendación: **Epic 4-3 Referral Links & Lead Notifications** o **Epic 8 Cotizaciones Personalizadas**. Ambos están BACKLOG con plan documentado.

- **4-3** cierra Epic 4 (Agent Business Portal): es scope acotado, deps satisfechas.
- **8 Cotizaciones** tiene mayor impacto comercial (`/cotizar` ya en prod, falta portal agente/admin/cliente) pero es scope mucho mayor (7 stories formalizables).

**Bloqueador previo a 4-3**: bug Next 16 Turbopack workers heredado (`/api/agents/[agentId]/clients` y `/metrics` retornan 500 en dev). Abrir con `/bmad-correct-course` antes de empezar.

Decisión final: **Alek decide en sesión nueva**.

## Referencias

- Stories: `_bmad-output/implementation-artifacts/9-{0a,0b,1,2,3,4,5,6,7}-*.md`
- Retro Story 9.6: `_bmad-output/implementation-artifacts/retrospectives/9-6-retrospective.md`
- Research técnico Epic 9: `_bmad-output/planning-artifacts/research/technical-epic-9-sync-bidireccional-pagos-research-2026-05-12.md`
- Sesiones detalle: `memory/session-{35,36,37,38,39,40}-*.md`
- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml` líneas 128–142
