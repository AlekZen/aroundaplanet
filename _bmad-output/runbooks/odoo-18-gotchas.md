# Odoo 18 — Gotchas, Patrones y Restricciones (AroundaPlanet)

> Runbook permanente. Sustituye Story 10.3 "Mapeo Odoo completo".
> Destilado de Epic 9 (stories 9.0a, 9.0b, 9.2, 9.3, 9.4, 9.5, 9.7) y sesiones 35-43.
> Sesión 44 · 2026-05-16.

---

## 1. TL;DR (5 líneas)

1. **Modelo Odoo 18 ≠ documentación pública**: `documents.folder`, `documents.facet`, `ir.attachment.tag_ids` NO existen. Validar empíricamente vía `ir.model` antes de codear.
2. **Idempotencia obligatoria**: patrón invertido `ir.model.data` reservado primero con `res_id=0` → create → write({res_id}). Elimina syncLocks (UNIQUE Postgres serializa). NUNCA usar locks aplicativos.
3. **Restricciones firmes inviolables**: NUNCA `unlink`, NUNCA `action_post` automático, NUNCA tocar 200 pagos legacy, NUNCA omitir browser smoke real antes de cerrar story con UI prod.
4. **Quirks de transporte**: XML-RPC devuelve `false` (no `null`/`''`) para strings vacíos. Custom fields exigen `firebase apphosting:secrets:grantaccess`. Rules deploy SIEMPRE con `--force`.
5. **Audiencia**: devs y agentes IA que toquen integración Odoo después de Epic 9. Lee esto antes de cualquier write a Odoo.

---

## 2. Modelo de datos Odoo 18 — gotchas empíricos

Todos validados con `models.execute_kw` real contra `aroundaplanet.odoo.com` durante Epic 9.

| Lo que parece existir | Realidad Odoo 18 | Story | Workaround |
|---|---|---|---|
| `documents.folder` | NO existe | 9.5 | Folders = `documents.document` con `type='folder'` (auto-referente via `folder_id`) |
| `documents.facet` (categorías de tags) | NO existe | 9.5 | Tags planos. Convenio interno: prefijo en `name` (`folder-canonico`, `folder-duplicado`) |
| `ir.attachment.tag_ids` | NO existe (ValueError) | 9.4 | Usar `documents.document.tag_ids`. Propaga automáticamente al `ir.attachment` subyacente al crear con `res_model`+`res_id` |
| `ir.attachment.tag` (modelo) | NO existe | 9.4 | El modelo correcto es `documents.tag` |
| `shortcut_document_id` write post-create | Read-after-create only | 9.5 | No se puede escribir tras crear. Forzó pivote Camino A→C (tags planos). |
| `ir.attachment` con `active` filtrable | Campo `active` existe pero NO indexable en search | 9.0a | Cleanup vía rename `_CLEANED_<ts>` + `state='cancel'` (NO unlink) |

**Regla de oro**: antes de cualquier write a un campo Odoo, ejecuta query `ir.model.fields.search_read` filtrando por `model_id.model` para confirmar que el campo existe y su tipo. Ahorra horas de debug.

---

## 3. Patrón invertido de idempotencia (Story 9.0b)

**Problema**: crear payments idempotentes en Odoo cuando Firestore puede reintentar la operación. Locks aplicativos (`syncLocks` collection) son frágiles y race-prone.

**Solución**: aprovechar UNIQUE constraint Postgres en `ir.model.data.(module, name)` para serializar a nivel DB. Postgres rechaza el segundo insert con conflict → segundo proceso lee y reutiliza.

**Snippet code-ready (TypeScript, OdooClient)**:

```typescript
// PATRÓN INVERTIDO — Story 9.0b (p95 = 617ms 2-call, ~900ms 3-call)
// Elimina la necesidad de syncLocks aplicativos.
async function createPaymentIdempotent(client: OdooClient, firebasePaymentId: string, paymentVals: Record<string, unknown>) {
  const xmlid = `aroundaplanet.firebase_payment_${firebasePaymentId}`

  // PASO 1: reservar ir.model.data PRIMERO con res_id=0
  // UNIQUE (module, name) Postgres serializa. Si otro proceso ya reservó,
  // recibimos el id existente y short-circuit (idempotencia).
  let imdId: number
  try {
    imdId = await client.create('ir.model.data', {
      module: 'aroundaplanet',
      name: `firebase_payment_${firebasePaymentId}`,
      model: 'account.payment',
      res_id: 0, // placeholder — se actualiza en PASO 3
    })
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Otro proceso ya creó este payment. Lee el id existente.
      const existing = await client.searchRead('ir.model.data', [
        ['module', '=', 'aroundaplanet'],
        ['name', '=', `firebase_payment_${firebasePaymentId}`],
      ], ['res_id'])
      return { paymentId: existing[0].res_id, alreadyExisted: true }
    }
    throw e
  }

  // PASO 2: create account.payment (state='draft' SIEMPRE, NUNCA action_post)
  const paymentId = await client.create('account.payment', {
    ...paymentVals,
    x_firebase_payment_id: firebasePaymentId,
  })

  // PASO 3: actualizar res_id del ir.model.data (cierra el link)
  await client.write('ir.model.data', [imdId], { res_id: paymentId })

  return { paymentId, alreadyExisted: false }
}
```

**Notas**:
- `state='draft'` SIEMPRE. Paloma postea manual (`action_post`) en Odoo UI.
- En errores intermedios, el `ir.model.data` con `res_id=0` queda como "reservación huérfana" — el siguiente intento la reutiliza (idempotente).
- Detalles completos: `_bmad-output/implementation-artifacts/spikes/9-0b-findings.md`.

---

## 4. Custom fields creados via XML-RPC (Story 9.7)

Creados en `account.payment` sin Paloma manual (subagente XML-RPC). IDs vigentes en prod:

| Field name | Field ID | Propósito |
|---|---|---|
| `x_firebase_payment_id` | 22927 | Link a Firestore `payments/{paymentId}`. Filtrable, indexado en code path. |
| `x_firebase_agent_uid` | 22933 | Link a `agents/{agentId}` Firebase. |
| `x_ocr_confidence` | 22935 | Score OCR 0-1 (Gemini 2.5-flash-lite). |
| `x_canonical_payment_id` | 22937 | Story 9.1 dedup: apunta al canónico cuando este es duplicado. |
| `x_dup_status` | 22939 | Story 9.1 dedup: `canonical` / `duplicate` / `null`. |

**Cuidado**: en lecturas XML-RPC, Odoo retorna `false` para string vacío (ver §7). Usar guard `typeof value === 'string'` antes de operar.

Setup: `_bmad-output/implementation-artifacts/runbooks/9-7-odoo-studio-custom-fields.md`.

---

## 5. Tags y folders convencionales (vigentes en prod)

| Recurso | ID prod | Modelo | Uso |
|---|---|---|---|
| `aroundaplanet_comprobante` | 47 | `documents.tag` | Story 9.4. Tag para attachments de comprobantes pago. Propaga vía `documents.document.create` con `res_model='account.payment'`. |
| `folder-canonico` | 49 | `documents.tag` | Story 9.5. Marca folder canónico tras dedup. |
| `folder-duplicado` | 50 | `documents.tag` | Story 9.5. Marca folder duplicado (NO unlink, solo etiqueta). |

Firestore mirror: `appConfig/odoo.attachmentReceiptTagId = 47`.

---

## 6. Restricciones firmes (negocio + técnicas)

Inviolables. Cualquier story que las quiebre debe escalar a Alek + Noel antes de implementar.

1. **NUNCA `unlink`** en Odoo. Cleanup vía rename `_CLEANED_<timestamp>` + `state='cancel'`. Justificación: trail de auditoría fiscal SAT.
2. **NUNCA `action_post` automático**. Paloma postea manual desde Odoo UI tras revisar. AroundaPlanet ≠ ERP black-box.
3. **200 pagos legacy NO se tocan** automáticamente. Solo se enlazan vía `odooPaymentId` desde Firestore cuando hay match high-confidence (Story 9.1).
4. **Idempotencia = UNIQUE Postgres + ir.model.data invertido** (§3). NUNCA usar `syncLocks` aplicativos (deprecated por Story 9.0b).
5. **Browser smoke real obligatorio** antes de cerrar story con UI o contrato prod-facing. Unit tests no detectan: rate-limits, ACL Storage, IAM impersonation, CDN cache, SW caching, race conditions de Firestore listeners.
6. **Code-review fresh-context obligatorio** antes de commit (no antes de deploy). Subagente con contexto limpio caza falsos-positivos del autor.
7. **`firebase deploy --only firestore:rules` SIEMPRE con `--force`**. Deploy silencioso parcial sin la flag (CLI no aborta pero descarta cambios).

---

## 7. Quirks operativos (trampas reales en prod)

1. **XML-RPC retorna `false` para strings vacíos** (no `null`, no `''`). Aplica a TODOS los `Char` fields Odoo. Fix:
   ```typescript
   const memo = typeof raw === 'string' ? raw : ''
   ```
   Cazado en sesión 9.3 commit `a43dcd2`.

2. **`firebase-admin set+merge` NO parsea FieldPath con punto literal**. `{ "lww.memo.value": x }` se persiste como key literal con punto, no como path. Fix: estructura como objeto nested literal:
   ```typescript
   { lww: { memo: { value: x } } }
   ```
   Cazado por advisor pre-commit en Story 9.3.

3. **Firestore Web SDK quirk `where(==null) + orderBy`**. Combinación devuelve resultados inconsistentes. Workaround: filtro client-side post-query.

4. **App Hosting rollout colgado post-build**. Si el rollout queda en `IN_PROGRESS` >10min:
   ```bash
   firebase apphosting:rollouts:create --git-branch master --force
   ```
   NO usar `--git-commit <hash>` (CLI lo rechaza silenciosamente en ciertas versiones).

5. **IAM SA preparer ≠ SA compute** para secrets. Tras agregar secret nuevo a `apphosting.yaml`:
   ```bash
   firebase apphosting:secrets:grantaccess <secret-name>
   ```
   Sin esto, build verde pero runtime falla con "permission denied on secret".

6. **Service Worker Serwist cachea bundles post-deploy**. Usuarios ven versión vieja hasta `Ctrl+Shift+R` o agregar `?bust=<ts>` al endpoint. Considera bump de versión SW en deploys que cambien shapes API.

7. **Self-impersonation IAM para signed URLs v4 con Admin SDK** (Story 10.1):
   ```bash
   gcloud iam service-accounts add-iam-policy-binding \
     firebase-app-hosting-compute@arounda-planet.iam.gserviceaccount.com \
     --member="serviceAccount:firebase-app-hosting-compute@arounda-planet.iam.gserviceaccount.com" \
     --role="roles/iam.serviceAccountTokenCreator"
   ```
   Sin esto: `SigningError: Permission iam.serviceAccounts.signBlob denied`.

8. **Rules deploy silencioso parcial**. SIEMPRE `--force`:
   ```bash
   firebase deploy --only firestore:rules --force
   ```

---

## 8. Validación de deploys (3 tipos distintos)

| Tipo | Cómo validar |
|---|---|
| **Código App Hosting** | Poll endpoint con contrato cambiado. Ej: si el cambio añade verificación de auth, espera `401` donde antes era `501`/`404`. NO confiar en "build verde". |
| **Firestore Rules** | MCP `firebase_get_security_rules` o read real desde cliente sin auth (debe negar). SIEMPRE deploy con `--force`. |
| **Firestore Indexes** | `gcloud firestore indexes composite list` filtrando por READY/CREATING. Demora 1-5min. Si query falla con `FAILED_PRECONDITION: index is currently building`, espera y reintenta. |

---

## 9. Cleanup heredado pendiente (no urgente)

1. **`ir.attachment` 45803** ACL-locked. Requiere Paloma manual desde Odoo UI (spike 9.0a). No bloquea operación.
2. **Automation Rule webhook Odoo** (Paloma manual). Setup en `_bmad-output/implementation-artifacts/runbooks/9-3-pull-setup.md` paso 6. Sin esto, latencia push p50 ~7min (polling). Con esto, <30s.

---

## 10. Referencias

Rutas relativas a `_bmad-output/`:

- Retrospectiva Epic 9: `implementation-artifacts/retrospectives/epic-9-retrospective.md`
- Spike 9.0a (ir.attachment con res_id): `implementation-artifacts/spikes/9-0a-findings.md`
- Spike 9.0b (patrón invertido): `implementation-artifacts/spikes/9-0b-findings.md`
- Runbook pull Odoo→Firestore: `implementation-artifacts/runbooks/9-3-pull-setup.md`
- Runbook attachment tag: `implementation-artifacts/runbooks/9-4-attachment-tag-setup.md`
- Runbook custom fields: `implementation-artifacts/runbooks/9-7-odoo-studio-custom-fields.md`
- Schema canónico Zod: `../src/schemas/paymentSchema.ts`
- OdooClient: `../src/lib/odoo/client.ts`

---

**Mantenimiento**: cualquier nueva gotcha empírica → agregar a §2 o §7 con story/sesión que la cazó. Cualquier nuevo custom field Odoo → §4. Convención: solo añadir lo que se haya tocado en prod (no especulación).
