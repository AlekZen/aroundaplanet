# Ops básico Fase 0 — AroundaPlanet

> Runbook operativo de mantenimiento post-cierre Fase 0. Cubre los flujos que Alek (o quien lo sustituya) ejecutará en producción de forma recurrente: deploys, lectura de logs, recuperación ante caídas de Odoo, gestión de secrets, gotchas conocidos.

**Backend**: Firebase App Hosting · Backend ID `aroundaplanet` · Project `arounda-planet` · Region `us-east4`
**URL prod**: `https://aroundaplanet--arounda-planet.us-east4.hosted.app`
**Repo**: `AlekZen/aroundaplanet` · Rama de prod: **`master`** (NO `main`)

---

## 1. Deploy a producción — `/deploy`

El skill `/deploy` automatiza el ciclo completo. Definición canónica en `~/.claude/skills/deploy/SKILL.md`. Pasos que ejecuta:

1. **Pre-flight** (bloqueante si falla):
   - `pnpm typecheck` — 0 errores requeridos
   - `pnpm lint` — 0 errores (warnings tolerados)
   - `pnpm vitest run` — todos los tests pasan (excepto flaky pre-existentes documentados en MEMORY.md)
2. **Git status check** — confirma que hay commits para pushear y no hay cambios sin stagear inesperados.
3. **Detección de secrets nuevos** en `apphosting.yaml`:
   - Si hay `+ secret: NOMBRE` en el diff, ejecuta automáticamente
     `firebase apphosting:secrets:grantaccess NOMBRE --backend aroundaplanet --location us-east4 --project arounda-planet`
   - Sin este paso el build falla con `IAM_PERMISSION_DENIED: secretmanager.versions.get` (incidente Story 9.3).
4. **`git push origin master`** — único trigger; App Hosting auto-watcha `master`.
5. **Monitoreo del build** vía HTTP probe a la URL prod. Espera transición de tamaño de respuesta o probe de endpoint nuevo (404 → 401 = revisión activa).

**NUNCA usar `firebase deploy --only apphosting`** — crea una segunda revisión desincronizada del repo. El push a master es el único mecanismo válido.

**Build típico**: 5-10 min · Cloud Run revision activa ~30 s adicionales.

---

## 2. Lectura de logs de App Hosting

Tres caminos según urgencia:

### 2.1 Firebase Console (manual, navegador)

`console.firebase.google.com/project/arounda-planet/apphosting` → backend `aroundaplanet` → tab **Logs**.

Filtros útiles:
- `severity >= ERROR`
- `resource.labels.revision_name="aroundaplanet-build-YYYY-MM-DD-NNN"`
- Texto libre: `IAM_PERMISSION_DENIED`, `Misconfigured Secret`, `ELIFECYCLE`, `error TS`

### 2.2 MCP Firebase desde Claude Code

```
mcp__plugin_firebase_firebase__apphosting_fetch_logs(
  backend="aroundaplanet",
  buildLogs=true|false  // true para logs del build, false para runtime
)
```

Devuelve los últimos N logs. Para investigar un build específico, primero `apphosting_list_backends` para confirmar el build ID actual.

### 2.3 gcloud CLI (terminal)

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="aroundaplanet"' \
  --project=arounda-planet --limit=50 --format=json
```

---

## 3. Recuperación ante caídas de Odoo

**La app NO se cae cuando Odoo cae**. Diseño explícito de Epic 9:

- **Clientes y agentes** siguen registrando pagos en Firestore. El push a Odoo se reintenta automáticamente con backoff exponencial (1s→2s→4s, max 3 intentos por ciclo).
- **Admin verifica pagos** normalmente — solo el badge `Sincronizando…` se queda colgado hasta que Odoo vuelva.
- **Pull de Odoo** (Cloud Scheduler `odoo-payments-pull` cada 15 min) falla silenciosamente y reintenta en el siguiente tick.
- **Catálogo de viajes** se sirve desde el último snapshot Firestore (caché 24h trips, 1h contacts, etc.).

### Qué hacer durante una caída

1. **Verifica que Odoo realmente está caído**: `curl -s https://aroundaplanet.odoo.com` o panel de status si existe.
2. **NO fuerces retries manuales** ni edites pagos pendientes — el sistema reintenta solo.
3. **Avisa a Paloma** que `account.payment` nuevos no aparecerán en Odoo hasta restauración. Los pagos quedan `verified` en Firestore con `odooSyncStatus: 'pending'` o `'error'`.
4. **Cuando Odoo vuelva**, el siguiente ciclo de retry (~15 min) recupera todo. Verifica `/admin/payments/sync-console` que los errores se vacían.

> Si una caída dura más de 4 horas, considera marcar los pagos pendientes como `dismissed` con razón explícita (Story 9.6) y re-pushear manualmente cuando Odoo vuelva.

---

## 4. Gestión de secrets

### 4.1 Crear o rotar un secret

```bash
# Subir valor nuevo
firebase apphosting:secrets:set NOMBRE_DEL_SECRET --project arounda-planet

# Conceder acceso al backend (CRÍTICO — sin esto el build falla)
firebase apphosting:secrets:grantaccess NOMBRE_DEL_SECRET \
  --backend aroundaplanet --location us-east4 --project arounda-planet
```

`grantaccess` concede permisos para **dos** service accounts:
- `firebase-app-hosting-compute@arounda-planet.iam.gserviceaccount.com` (runtime)
- El SA del preparer que construye la imagen (distinto, no el mismo)

Sin grantaccess al preparer el build falla con `IAM_PERMISSION_DENIED: secretmanager.versions.get` aunque el runtime tenga acceso (caso real Story 9.3).

### 4.2 Referenciar desde apphosting.yaml

```yaml
env:
  - variable: MI_VAR
    secret: NOMBRE_DEL_SECRET
    availability:
      - BUILD
      - RUNTIME
```

`/deploy` detecta diffs en `apphosting.yaml` y ejecuta `grantaccess` automáticamente si hay secrets nuevos.

---

## 5. Gotchas conocidos

### 5.1 Proxy matcher para assets sueltos en `public/` raíz

**Síntoma**: un asset estático en `public/foo.png` retorna 307 redirect a `/login` aunque exista físicamente.

**Causa**: `src/proxy.ts` matcher excluye solo paths específicos. Cualquier path no excluido se considera ruta protegida y se redirige a login si no hay sesión.

**Solución (recurrente, encontrada 3 veces en Batches A/B/C)**:

Opción 1 — mover el asset a un subdir ya excluido:
```
public/foo.png  →  public/images/foo.png    (excluido por matcher)
                   public/icons/foo.png
                   public/manuals/foo.png
```

Opción 2 — agregar el filename al matcher en `src/proxy.ts`:
```typescript
matcher: [
  '/((?!api|_next/static|_next/image|favicon.ico|apple-touch-icon.png|og-image.png|manuals|icons|images|sw.js|manifest.webmanifest).*)',
],
```

Convenciones nativas (favicon, apple-touch-icon, og-image) deben quedar en raíz por estándar web — agrégalas al matcher. Assets arbitrarios → muévelos a subdir.

### 5.2 Next 16 + Serwist requiere `--webpack` en build

```bash
pnpm build --webpack
```

Sin el flag, Next 16 usa Turbopack por defecto y `@serwist/next` no inyecta el SW (incompatible con Turbopack). Documentado en `_bmad-output/runbooks/next-16-turbopack-quirks.md`.

Dev sigue usando Turbopack (faster HMR, Serwist deshabilitado en dev igual).

### 5.3 Turbopack rompe workers de algunos endpoints en dev

4 endpoints `/api/agents/[agentId]/{clients,metrics,orders,validate}` crashean el worker child de Turbopack en dev. Stack: `ChildProcessWorker.initialize → next/dist/compiled/jest-worker`.

**NO afecta producción** (que usa webpack). Workaround para TDD local: `pnpm build --webpack && pnpm start`. Runbook completo en `_bmad-output/runbooks/next-16-turbopack-quirks.md`.

### 5.4 Firebase Admin SDK local: usar `K_SERVICE` no `NODE_ENV`

`src/lib/firebase/admin.ts` detecta Cloud Run con `process.env.K_SERVICE` (variable que Cloud Run setea). Si usas `NODE_ENV === 'production'` para detectar prod, `pnpm start` local rompe auth con 401 silencioso (porque local es `NODE_ENV=production` pero NO Cloud Run → necesita JSON admin SDK key).

Runbook: `_bmad-output/runbooks/firebase-admin-local.md`.

### 5.5 Odoo 18 attachment patterns (Epic 9)

`_bmad-output/runbooks/odoo-18-gotchas.md` cubre:
- `ir.attachment.tag_ids` NO existe → usar `documents.document` wrapper con `tag_ids`.
- `documents.folder` y `documents.facet` NO existen → tags planos.
- Crear payment FIRST, luego attachment con `res_id` real (huérfanos son ACL-locked irreversibles).
- Patrón invertido idempotente: reservar `ir.model.data` `res_id=0` → create payment → write `res_id` real.

---

## 6. Referencias a otros runbooks

| Archivo | Cubre |
|---|---|
| `_bmad-output/runbooks/odoo-18-gotchas.md` | Restricciones de Odoo 18: account.payment, ir.attachment, documents.document, custom fields |
| `_bmad-output/runbooks/next-16-turbopack-quirks.md` | Quirks específicos Next.js 16 (proxy.ts vs middleware, --webpack flag, Serwist, workers) |
| `_bmad-output/runbooks/firebase-admin-local.md` | Auth Admin SDK en local vs Cloud Run + K_SERVICE detection |
| `_bmad-output/implementation-artifacts/runbooks/9-3-pull-setup.md` | Cloud Scheduler `odoo-payments-pull` + Automation Rule Odoo + webhook HMAC |
| `_bmad-output/implementation-artifacts/runbooks/9-7-execution-log.md` | Schema Zod + custom fields creados via XML-RPC subagente |
| `_bmad-output/implementation-artifacts/retrospectives/epic-9-retrospective.md` | 12 lecciones técnicas Epic 9 |

---

## 7. Contactos críticos

- **Alek (técnico)**: dueño del repo, despliegues, bugs, IAM, secrets.
- **Paloma (administración Ocotlán)**: operación diaria, Odoo posteos, atención a agentes.
- **Noel (dirección general)**: aceptación de Fase 0, decisiones de scope, escalación cliente.

---

*Runbook v1.0 — 2026-05-20 · AroundaPlanet Fase 0 cierre.*
