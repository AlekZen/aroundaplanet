# Retrospectiva — Story 9.6: UX Admin de Sync (Cola Conflictos, Alertas, Estado)

**Fecha cierre**: 2026-05-14 · **Sesión**: 38 · **Duración total**: ~6 horas (dev + 4 hotfixes + audit prod + UX polish)

## TL;DR

Story 9.6 se desarrolló completa en una sola sesión con orquestación Opus + subagentes Sonnet (F1-F5 = 6 subagentes). Build inicial pasó validaciones locales (1513/1513 tests) y deployó OK, pero el audit en producción cazó **4 bugs operativos** que las validaciones automatizadas no detectaron. La causa raíz del bug principal **NO era el código**, era la **propagación silenciosa de Firestore Rules**. Diagnostiqué incorrectamente "token expirado" y caí en un loop de hipótesis erradas hasta que un subagente fresh-context (a pedido explícito de Alek) encontró la causa real. Lecciones críticas sobre cómo validar deploys, cómo interpretar errores de Firestore, y cómo evitar loops de diagnóstico.

## Lo que salió bien

1. **Orquestación Opus + Sonnet subagentes funcionó**: 6 subagentes Sonnet hicieron toda la implementación (F1 fundación, F2a/F2b endpoints paralelos, F3a/F3b/F3c UI paralelos, F4+F5 E2E+validación). Contexto Opus se mantuvo lean (no leí bundle, no escribí código directo en F1-F5). 1513/1513 tests pass al primer try.

2. **Audit con browser real cazó lo que tests no**: el KPI count "Cola de push: 5" funcionaba (Server Component Admin SDK) pero la tabla mostraba "—" en Cliente/Monto (bug field name `amount` vs `amountCents`). Esto NO lo detectó vitest porque los mocks tenían el shape esperado, no el real. **Lección**: para componentes que renderizan datos Firestore, los tests con mocks no sustituyen a queries reales en prod.

3. **Subagente fresh-context resolvió loop de diagnóstico**: cuando me cicle en hipótesis erradas sobre "token expirado", Alek pidió delegar con contexto limpio. El subagente Sonnet identificó la causa raíz real (rules no propagadas + key inválida secundaria) en 5 minutos sin mis sesgos previos.

4. **Cero regresiones en otras pantallas**: refactor de `VerificationPanel` para usar `<SyncStatusBadge />` no rompió flujos existentes. Smoke en `/admin/verification` verificó OK.

5. **Decisiones de scope con criterio**: F4 dejó Playwright E2E en `test.skip` por falta de helper auth — buena decisión, no escalé a infra nueva fuera de scope.

## Lo que salió mal

1. **Primer `firebase deploy --only firestore:rules` propagó silencioso a la mitad**: el CLI reportó "released rules", pero algunas colecciones (`paymentConflicts`, `paymentAlerts`, `syncCursors`, `syncLog`) seguían cayendo al DEFAULT DENY en prod. El segundo deploy con `--force` SÍ aplicó. **Bloqueador principal de la sesión: 30+ minutos perdidos diagnosticando rules**.

2. **App Hosting build SUCCESS pero rollout colgado**: Cloud Build de commit `5bc1ed1` terminó SUCCESS a las 19:33 UTC pero Cloud Run no creó revision 005 hasta que disparé manualmente `firebase apphosting:rollouts:create --git-branch master`. **15 minutos perdidos** esperando un rollout automático que nunca llegó.

3. **Loop de diagnóstico erróneo**: enfoqué en "token expirado" porque el IndexedDB mostraba `exp: 2026-03-31` (hace 6 semanas). Pero los network requests `securetoken.googleapis.com` retornaban 200 con la key buena — el SDK SÍ refrescaba. El verdadero bloqueador eran las rules. **Alek tuvo que interrumpir explícitamente** ("te veo ciclado, delega a un subagente"). Yo no detecté el loop solo.

4. **Subagente F4+F5 reportó imprecisamente**: dijo "Playwright tests test.skip por falta de auth E2E" y "1 error pre-existente F2b en mark-canceled" pero **NO mencionó** que los chunks JS del build se servirían con cache CDN de App Hosting + Service Worker Serwist que retardaría visibilidad de cambios. Cuando re-auditaba con browser, asumí que la nueva versión estaba activa cuando no lo estaba (build no había rolled out).

5. **API key inválida residual en bundle**: el bundle de prod tenía `AIzaSyC_JR5E4v9hHwSH6v_ZsKRy0dXfXzg8jU` (key que NO existe en Secret Manager) que daba 400 en algunos refresh. Sin causar bloqueo total porque el SDK reintenta con otra key, pero es deuda pendiente. **Origen desconocido**: no está en `.env.local` (esa tiene otra similar pero diferente), no está en el repo. Probable: residuo de algún build anterior con `.env.local` filtrado.

6. **El KPI "Éxito 24h: 0%" es confuso**: matemáticamente correcto (0 actualizados / 2 fetched = 0%) pero sugiere problema cuando en realidad solo significa "no hubo updates desde el último pull". Necesita label más claro o tooltip.

7. **UX inicial era ininteligible para usuario final**: aunque pasaba tests, las filas mostraban "—" en columnas críticas. Alek lo cazó al ver la pantalla en su browser real. **Sin audit visual, este bug habría llegado a Paloma**.

## Bugs cazados en producción que tests no detectaron

1. **`p.amount` vs `p.amountCents`** — tests usaban mocks con `amount`, doc real tiene `amountCents`. Solución: cambiar field name + agregar mock realista.
2. **Pagos legacy sin `clientName`** — solo `agentName`/`registeredByName`. Solución: fallback en cascada.
3. **Link `/admin/verification/{id}` no existe** — la ruta dinámica no se creó nunca. Solución: link a `/admin/verification` (lista) hasta que exista detalle.
4. **Bug `where(==null) + orderBy`** — Firestore Web SDK retorna "Missing or insufficient permissions" cuando este patrón se usa, aunque rules permitan y índice exista. Solución: filtro client-side.

## Lecciones técnicas (anotar en memoria para futuras stories)

### 1. Validación de deploys NO termina con "deploy complete"

Hay 3 tipos de deploy distintos en este proyecto, cada uno con su latencia y verificación:

| Deploy | Comando | Cómo verificar que aplicó |
|---|---|---|
| Código (App Hosting) | `git push origin master` | Cloud Run latest revision = commit hash. **NO** confiar solo en HTTP 200 (zero-downtime sirve revision vieja). Mejor: pollear chunk JS hash. |
| Firestore Rules | `firebase deploy --only firestore:rules` | **¡USAR `--force` siempre!** El deploy puede reportar success pero NO propagar. Verificar con `firebase__firebase_get_security_rules` (Firebase MCP) o probando una read real desde un cliente. |
| Firestore Indexes | `firebase deploy --only firestore:indexes` | `gcloud firestore indexes composite list` para ver estado READY/CREATING. Compound indexes tardan 1-5min en construirse. |

### 2. Mensajes de error de Firestore Web SDK son engañosos

`Missing or insufficient permissions` NO siempre significa "rules denegando":
- Puede ser rules denegando (causa común)
- Puede ser índice faltante o construyéndose (causa común, mensaje malo)
- Puede ser query con `where('==', null)` combinado con `orderBy` (bug Web SDK)
- Puede ser token expirado sin refresh válido (raro)

**Antes de asumir rules**: verificar `gcloud firestore indexes composite list` para ver estado, verificar que la query no use `==null + orderBy`, verificar el ID token en IndexedDB.

### 3. App Hosting rollout puede colgarse post-build

Cloud Build SUCCESS NO garantiza promoción a Cloud Run. Si `gcloud run revisions list` muestra que la última revision NO matchea el último commit hash tras 5+ minutos del SUCCESS:

```bash
firebase apphosting:rollouts:create aroundaplanet \
  --git-branch master \
  --project arounda-planet --force
```

NO usar `--git-commit <hash>` porque a veces da `FAILED_PRECONDITION` glitch GC. `--git-branch master` siempre funciona.

### 4. Service Worker (Serwist PWA) retarda visibilidad de deploys

El SW cachea chunks JS y los sirve incluso post-deploy. Durante debug, **siempre limpiar**:

```js
const regs = await navigator.serviceWorker.getRegistrations();
for (const r of regs) await r.unregister();
const names = await caches.keys();
for (const n of names) await caches.delete(n);
```

Anotar en `/deploy` skill: instruir a Paloma a hacer `Ctrl+Shift+R` post-deploy.

### 5. Subagentes implementadores no sustituyen audit real con browser

Validaciones de subagentes (`typecheck`, `vitest`, `lint`) verifican corrección de código, NO corrección de feature. El feature solo se valida con:
- Browser real navegando la UI
- Inspección de Firestore con MCP/Admin SDK
- DevTools console (errors silenciosos)

**Regla práctica**: después de cualquier deploy de UI, audit con Playwright MCP (o pedir a usuario screenshot).

### 6. Detectar loops de diagnóstico antes de que Alek los detecte

Síntomas de loop:
- Hipótesis 1 falla → hipótesis 2 falla → hipótesis 3 sin evidencia nueva
- Mismo síntoma persiste tras 2+ "fixes"
- Empiezo a especular sobre causas exóticas (token, cache, infra glitch)

**Acción**: parar, llamar advisor() O delegar audit fresh-context a subagente con brief que diga "NO ASUMAS, COMPRUEBA". Mejor delegar antes de la 3ra iteración fallida.

## Mejoras al skill `/deploy`

Anotaciones para futuro update de `~/.claude/skills/deploy/SKILL.md`:

1. **Pre-deploy check**: detectar diffs en `firestore.rules` y `firestore.indexes.json` vs último commit. Si hay diffs, forzar deploy de rules+indexes ANTES del push de código.
2. **Post-deploy verify**: poll `gcloud run revisions list` hasta que latest revision matchee commit hash actual. Si no en 5 min, disparar `firebase apphosting:rollouts:create --git-branch master`.
3. **Validación final**: navegar prod con Playwright MCP (o curl GET de chunk JS hash) y comparar con bundle local generado por `pnpm build`.
4. **Service Worker tip**: incluir en el reporte final "Recordatorio: usuarios deben hacer Ctrl+Shift+R para invalidar SW cache".

## Pendientes Story 9.6 (no bloquean cierre)

- [ ] Task 8.2 Playwright E2E fixtures (necesita helper auth E2E)
- [ ] 5 findings Low del code-review (nits documentados en story file)
- [ ] AC9 browser smoke completo (3-4 escenarios remaining)
- [ ] Investigar API key residual `AIzaSyC_JR5E4...` en bundle (de dónde sale)
- [ ] `/admin/verification/{id}` página dinámica de detalle (sería útil para link directo desde sync console)
- [ ] Mejorar label "Éxito 24h" en KPI dashboard (confunde a usuarios)

## Métricas de la sesión

- **Commits**: 4 (`17817d9`, `334e80f`, `5bc1ed1`, `4e11f54`)
- **Builds App Hosting**: 5 (003, 004, 005-stuck, 007 manual rollout, 008 en curso)
- **Deploys Firestore**: 3 rules + 2 indexes
- **Tests pass**: 1513 → 1516 (al cierre del UX fix)
- **Bugs detectados en prod**: 4 (rules no propagadas, ==null quirk, sidebar entry, UX field mismatch)
- **Bugs detectados pre-prod**: 8 (durante code review + audits)

## Acuerdos de equipo reforzados en esta sesión

1. **"Adivinar es prohibido"** — query exploratoria antes de implementar. Reforzado tras loop de diagnóstico erróneo.
2. **Audit con browser real obligatorio antes de cerrar story** — los tests unitarios no detectan bugs UX.
3. **Delegar a subagentes fresh-context cuando me cicle** — Alek no debería tener que interrumpir.
4. **Deploys de rules/indexes SIEMPRE con `--force`** — la propagación parcial silenciosa es real.

## Referencias

- Story file: `_bmad-output/implementation-artifacts/9-6-ux-admin-sync-conflictos-alertas.md`
- Sesión 38 detalle: `memory/session-38-story-9-6-sync-console.md`
- Code review section: dentro del story file ("Senior Developer Review (AI)")
