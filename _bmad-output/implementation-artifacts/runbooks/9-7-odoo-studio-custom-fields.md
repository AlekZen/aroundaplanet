# Runbook 9.7 — Setup Odoo Studio: Custom Fields + Tags para Epic 9

**Quién lo ejecuta:** Paloma (admin Odoo) acompañada de un dev.
**Cuándo:** Antes de desplegar Stories 9.1, 9.2, 9.3, 9.4 a producción.
**Dónde:** Primero en **sandbox** (si está disponible) o duplicado de base; producción solo tras validar end-to-end.
**Reversible:** Sí — todos los cambios son aditivos. Sección "Rollback" al final.

> ⚠️ **NO ejecutar este runbook sin haber leído primero:**
> - `_bmad-output/planning-artifacts/epics.md` sección Epic 9
> - `_bmad-output/planning-artifacts/research/technical-epic-9-sync-bidireccional-pagos-research-2026-05-12.md` puntos 2, 7

## Prerequisitos

- [ ] Acceso a Odoo 18 Enterprise Online con permiso de Studio (Custom plan activo)
- [ ] Usuario admin Odoo confirmado por Paloma
- [ ] **Sandbox/duplicado disponible** (recomendado) o ventana de mantenimiento si se hace directo en producción
- [ ] Pantalla compartida con el dev acompañante para capturar screenshots y validar cada paso
- [ ] Acceso a `https://aroundaplanet.odoo.com` con sesión activa

## Resumen de lo que se va a crear

| # | Modelo Odoo | Campo / objeto | Tipo | Indexed | Propósito |
|---|---|---|---|---|---|
| 1 | `account.payment` | `x_firebase_payment_id` | Char (80) | ✅ | ID Firestore para idempotencia del sync (Story 9.2) |
| 2 | `account.payment` | `x_firebase_agent_uid` | Char (80) | ✅ | UID agente Firebase que reportó/verificó (auditoría) |
| 3 | `account.payment` | `x_ocr_confidence` | Float | ❌ | Confianza OCR del comprobante (opcional, métrica) |
| 4 | `account.payment` | `x_canonical_payment_id` | Many2one → `account.payment` | ✅ | Apunta al pago canónico cuando hay duplicado interno (Story 9.1) |
| 5 | `account.payment` | `x_is_canonical_duplicate` | Boolean | ❌ | True si Paloma marcó este pago como canónico del cluster (Story 9.1) |
| 6 | `account.payment.tag_ids`* | Tag `dup-canonico` | Tag | — | Marcador visual del canónico en listas/kanban Odoo |
| 7 | `account.payment.tag_ids`* | Tag `dup-secundario` | Tag | — | Marcador visual de los duplicados secundarios |

*Si `account.payment` no tiene tag_ids nativo en este tenant, se usa el campo booleano #5 + un tag análogo en `documents.tag` para los comprobantes (a confirmar en el paso de validación).

---

## Paso 1 — Login y activación de Studio

1. Ir a `https://aroundaplanet.odoo.com` y loguearse como Paloma.
2. Verificar en la barra superior que aparece el icono de **Studio** (cuadrado naranja con engranaje). Si no aparece, contactar al Customer Success de Odoo: el plan no incluye Studio.
3. Ir a **Accounting → Customers → Payments** para abrir la lista de `account.payment`.

> 📸 **Screenshot esperado:** `_bmad-output/runbooks/assets/9-7/01-payments-list.png`

## Paso 2 — Crear `x_firebase_payment_id`

1. Con la lista de Payments abierta, click en el icono **Studio** (cuadrado naranja arriba).
2. En el panel derecho, abrir la vista **Form** del payment (click en cualquier registro o usar "+ New").
3. Localizar una sección apropiada en el form (sugerencia: bajo "Memo" o en una pestaña nueva "Aroundaplanet Sync").
4. Arrastrar el componente **Text** desde el menú izquierdo de Studio al form.
5. Configurar el campo:
   - **Label:** `Firebase Payment ID`
   - **Technical Name:** `x_firebase_payment_id`
   - **Type:** `Char`
   - **Size limit:** `80`
   - **Indexed:** ✅ (importante para performance de búsquedas en Story 9.2)
   - **Tooltip / Help:** `ID de Firestore para idempotencia del sync con AroundaPlanet. NO editar manualmente.`
   - **Readonly:** Recomendado ON para evitar edición manual
6. Guardar el form (botón ✓ arriba a la derecha).

> 📸 `_bmad-output/runbooks/assets/9-7/02-x-firebase-payment-id.png`

### Validación vía XML-RPC (el dev acompañante):

```bash
# Reemplazar credenciales con las del runbook secrets manager
curl -s -X POST "$ODOO_URL/jsonrpc" -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0","method":"call","params":{
    "service":"object","method":"execute_kw",
    "args":["'$ODOO_DB'",'$UID',"'$PASSWORD'",
      "ir.model.fields","search_read",
      [[["model","=","account.payment"],["name","=","x_firebase_payment_id"]]],
      {"fields":["name","ttype","state","index"]}
    ]
  }
}'
```

Resultado esperado: 1 registro con `ttype: "char"`, `state: "manual"`, `index: true`.

## Paso 3 — Crear `x_firebase_agent_uid`

Repetir Paso 2 con:
- **Label:** `Firebase Agent UID`
- **Technical Name:** `x_firebase_agent_uid`
- **Type:** `Char`, **Size limit:** `80`, **Indexed:** ✅
- **Help:** `UID del agente Firebase que reportó o verificó este pago.`
- **Readonly:** ON

> 📸 `_bmad-output/runbooks/assets/9-7/03-x-firebase-agent-uid.png`

## Paso 4 — Crear `x_ocr_confidence`

Repetir con:
- **Label:** `Confianza OCR`
- **Technical Name:** `x_ocr_confidence`
- **Type:** `Float`
- **Digits:** `(3, 2)` (formato 0.00 — 9.99)
- **Indexed:** ❌
- **Help:** `Confianza del OCR del comprobante (0 a 1). Generado por Firebase AI Logic.`
- **Required:** ❌ (es opcional, los pagos legacy no tienen)

> 📸 `_bmad-output/runbooks/assets/9-7/04-x-ocr-confidence.png`

## Paso 5 — Crear `x_canonical_payment_id` (Many2one)

1. En Studio sobre el form de Payment, arrastrar el componente **Many2one** desde el menú izquierdo.
2. Configurar:
   - **Label:** `Pago Canónico (Dedup)`
   - **Technical Name:** `x_canonical_payment_id`
   - **Related Model:** `account.payment`
   - **Indexed:** ✅
   - **Help:** `Si este pago es duplicado interno, apunta al canónico elegido por admin (Story 9.1 AroundaPlanet).`
3. Guardar.

> 📸 `_bmad-output/runbooks/assets/9-7/05-x-canonical-payment-id.png`

> ⚠️ **NO** marcar este campo como `Required` ni `Readonly`. Debe poder editarse desde la UI de dedup (Story 9.1).

## Paso 6 — Crear `x_is_canonical_duplicate` (Boolean)

Repetir con:
- **Label:** `Es Canónico de Cluster Duplicado`
- **Technical Name:** `x_is_canonical_duplicate`
- **Type:** `Boolean`
- **Default:** `False`
- **Help:** `True cuando admin marcó este pago como canónico de un cluster (los demás duplicados apuntan aquí).`

> 📸 `_bmad-output/runbooks/assets/9-7/06-x-is-canonical-duplicate.png`

## Paso 7 — Crear tags `dup-canonico` y `dup-secundario`

> 🔍 **Validar primero** si `account.payment` tiene un campo `tag_ids` nativo:
>
> 1. Abrir un payment en la UI estándar (sin Studio).
> 2. Buscar un campo "Tags" o "Etiquetas".
> 3. Si **existe**: ir a **Settings → Technical → Database Structure → Models → account.payment.tag** y crear los 2 tags ahí.
> 4. Si **NO existe**: omitir este paso. Los booleanos `x_is_canonical_duplicate` + `x_canonical_payment_id` son suficientes para el dedup. Los tags `dup-*` se aplicarán a los attachments en Story 9.4 vía `documents.tag` (otro runbook).

### Si `account.payment.tag_ids` existe:

1. Ir a **Settings → Technical → Database Structure → Models → account.payment.tag** (o similar).
2. **Create**: Name = `dup-canonico`, Color = verde (#28a745 si está disponible).
3. **Save**.
4. **Create**: Name = `dup-secundario`, Color = amarillo (#ffc107).
5. **Save**.

> 📸 `_bmad-output/runbooks/assets/9-7/07-tags-dup.png`

## Paso 8 — Verificación cruzada final

Validar via XML-RPC que TODOS los campos quedaron creados:

```bash
curl -s -X POST "$ODOO_URL/jsonrpc" -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0","method":"call","params":{
    "service":"object","method":"execute_kw",
    "args":["'$ODOO_DB'",'$UID',"'$PASSWORD'",
      "ir.model.fields","search_read",
      [[["model","=","account.payment"],["name","like","x_"]]],
      {"fields":["name","ttype","state","index","relation"]}
    ]
  }
}'
```

**Resultado esperado** (5 registros):

| name | ttype | state | index | relation |
|---|---|---|---|---|
| x_firebase_payment_id | char | manual | true | — |
| x_firebase_agent_uid | char | manual | true | — |
| x_ocr_confidence | float | manual | false | — |
| x_canonical_payment_id | many2one | manual | true | account.payment |
| x_is_canonical_duplicate | boolean | manual | false | — |

Pegar el output en el ticket de la story 9.7 (sección "Validación post-deploy").

## Paso 9 — Configurar permisos / read-only

En Studio sobre el form del payment:

1. Para `x_firebase_payment_id`, `x_firebase_agent_uid`, `x_ocr_confidence`:
   - **Visible only to:** Admin/Accountant (NO operadores externos)
   - **Readonly:** ✅ (estos campos los escribe el sync, no humanos)
2. Para `x_canonical_payment_id`, `x_is_canonical_duplicate`:
   - **Visible only to:** Admin
   - **Readonly:** ❌ (Paloma los edita desde la UI dedup de AroundaPlanet)

## Paso 10 — Smoke test desde la app AroundaPlanet

> ⏸ **Solo ejecutar después de desplegar Stories 9.2 y 9.1**

1. Verificar en sandbox/dev de AroundaPlanet un pago de prueba con `status='verified'`.
2. Confirmar via XML-RPC `search_read` que el pago creado en Odoo tiene `x_firebase_payment_id` poblado con el ID Firestore correcto.
3. Repetir 2 verificaciones más (re-ejecuciones del mismo pago) — confirmar idempotencia: solo 1 `account.payment` en Odoo.

---

## Rollback

Si algo sale mal en sandbox y se necesita revertir:

1. Ir a **Settings → Technical → Database Structure → Models → account.payment → Fields**.
2. Filtrar por `name like 'x_'`.
3. Para cada campo creado por este runbook: click → **Delete** (solo se borran los campos `state: manual`; los `base` están protegidos).
4. Si se crearon tags `dup-canonico`/`dup-secundario` y NO se aplicaron a ningún payment: **Delete** desde el modelo de tag.
5. Si los tags **ya fueron aplicados** a payments productivos: **NO borrar** (restricción de negocio Epic 9). En su lugar renombrarlos a `dup-canonico-deprecated` para señalar que se ignoren.

> ⚠️ **NUNCA** borrar campos en producción una vez que Stories 9.2/9.3 estén live — quedarían huérfanos los pagos sincronizados.

## Pendientes para otros runbooks

- **Tags en Documents** (`documents.tag`): `aroundaplanet_comprobante`, `folder-canonico`, `folder-duplicado`. Se documenta en runbook de Story 9.4 después del Spike A.
- **Custom field `x_canonical_folder_id`** en `documents.folder`: documentado en runbook de Story 9.5.
- **Automation Rule + Webhook saliente**: documentado en runbook de Story 9.3 (necesita URL del endpoint Cloud Function ya desplegada).

## Tracking de ejecución

| Campo | Sandbox creado | Validado XML-RPC | Producción creado | Validado producción |
|---|---|---|---|---|
| x_firebase_payment_id | ☐ | ☐ | ☐ | ☐ |
| x_firebase_agent_uid | ☐ | ☐ | ☐ | ☐ |
| x_ocr_confidence | ☐ | ☐ | ☐ | ☐ |
| x_canonical_payment_id | ☐ | ☐ | ☐ | ☐ |
| x_is_canonical_duplicate | ☐ | ☐ | ☐ | ☐ |
| Tag dup-canonico | ☐ | ☐ | ☐ | ☐ |
| Tag dup-secundario | ☐ | ☐ | ☐ | ☐ |

Marcar con ✅ + fecha + ejecutor cuando cada paso quede confirmado.
