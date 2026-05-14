# Runbook 9.3 — Configuración Pull Odoo → Firestore (Producción)

## Metadatos

| Campo | Valor |
|-------|-------|
| Story | 9.3 Pull Odoo → Firestore (mirror read-only) |
| Responsable técnico | Alek |
| Apoyo operativo Odoo | Paloma |
| Fecha creación runbook | 2026-05-14 |
| Proyecto GCP | `arounda-planet` |
| Región | `us-east4` |
| URL producción | `https://aroundaplanet--arounda-planet.us-east4.hosted.app` |

---

## Índice

1. Generar secrets
2. Subir secrets a Cloud Secret Manager
3. Descomentar bloque en `apphosting.yaml` y hacer deploy
4. Configurar Cloud Scheduler
5. Bootstrap inicial del cursor (UNA SOLA VEZ)
6. Configurar Automation Rule en Odoo (Paloma)
7. Procedimiento de rotación de secrets sin downtime
8. Validación post-setup
9. Operación normal y monitoreo

---

## 1. Generar secrets

Necesitas dos valores aleatorios de 32+ bytes. Ejecuta uno por uno y guarda los valores en un lugar seguro (gestor de contraseñas) antes de continuar.

```bash
# Secret para Cloud Scheduler (protege el endpoint /api/odoo/sync/pull-payments)
openssl rand -base64 32
# Ejemplo de output: Xk9mP2QrT7vW4nLsJ3dF8bHcA6yE1uZo+Nq0Rm5VpI=

# Secret para webhooks Odoo (protege el endpoint /api/odoo/webhook/payment)
openssl rand -base64 32
# Ejemplo de output: Bj6wK1oS9xD3aY7tG4hN8cM2vU5iFpL0Qe+Rn3Zk7Xw=
```

Guarda ambos valores. Se referencian aquí como `$SCHEDULER_SECRET` y `$WEBHOOK_SECRET`.

---

## 2. Subir secrets a Cloud Secret Manager

Asegúrate de estar autenticado con `gcloud auth login` y con el proyecto correcto:

```bash
gcloud config set project arounda-planet
```

### 2.1 Crear el secret del scheduler

```bash
# Sustituye el valor real entre comillas
SCHEDULER_SECRET="TU_VALOR_AQUI"

echo -n "$SCHEDULER_SECRET" | gcloud secrets create prod-odoo-pull-scheduler-secret \
  --data-file=- \
  --replication-policy="user-managed" \
  --locations="us-east4"
```

### 2.2 Crear el secret del webhook

```bash
WEBHOOK_SECRET="TU_VALOR_AQUI"

echo -n "$WEBHOOK_SECRET" | gcloud secrets create prod-odoo-webhook-secret \
  --data-file=- \
  --replication-policy="user-managed" \
  --locations="us-east4"
```

### 2.3 Otorgar acceso al service account de App Hosting

El service account que usa Cloud Run / App Hosting necesita leer estos secrets en runtime.

```bash
SA="firebase-app-hosting-compute@arounda-planet.iam.gserviceaccount.com"

gcloud secrets add-iam-policy-binding prod-odoo-pull-scheduler-secret \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding prod-odoo-webhook-secret \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor"
```

Verifica que los bindings quedaron con:

```bash
gcloud secrets get-iam-policy prod-odoo-pull-scheduler-secret
gcloud secrets get-iam-policy prod-odoo-webhook-secret
```

---

## 3. Descomentar bloque en `apphosting.yaml` y hacer deploy

En el archivo `apphosting.yaml` (raíz del proyecto), localiza el bloque comentado correspondiente a Story 9.3 y descoméntalo:

```yaml
# Descomentarlo queda así:
environmentVariables:
  - variable: ODOO_PULL_SCHEDULER_SECRET
    secret: prod-odoo-pull-scheduler-secret
  - variable: ODOO_WEBHOOK_SECRET
    secret: prod-odoo-webhook-secret
```

Después haz deploy a producción:

```bash
git add apphosting.yaml
git commit -m "chore(epic-9): habilita secrets 9.3 pull scheduler + webhook en apphosting.yaml"
git push origin master
```

Firebase App Hosting detecta el push y despliega automáticamente. Espera a que el deploy esté en estado `SUCCEEDED` en la consola de Firebase antes de continuar con los siguientes pasos.

---

## 4. Configurar Cloud Scheduler

### 4.1 Mediante GCP Console

1. Ve a **Cloud Scheduler** en GCP Console (proyecto `arounda-planet`).
2. Haz clic en **Create job**.
3. Rellena los campos:

| Campo | Valor |
|-------|-------|
| Nombre | `odoo-payments-pull` |
| Región | `us-east4` |
| Frecuencia | `*/15 * * * *` |
| Timezone | `America/Mexico_City` |
| Target type | HTTP |
| URL | `https://aroundaplanet--arounda-planet.us-east4.hosted.app/api/odoo/sync/pull-payments` |
| HTTP method | POST |
| Body | `{}` |
| Content-Type header | `application/json` |
| X-Scheduler-Secret header | `<valor de SCHEDULER_SECRET>` |

4. En la sección **Retry configuration**:
   - Max retry attempts: `3`
   - Max retry duration: `5m`
   - Min backoff duration: `1m`
   - Max doublings: `2`

5. Haz clic en **Create**.

### 4.2 Mediante gcloud (referencia equivalente)

```bash
SCHEDULER_SECRET="TU_VALOR_AQUI"
URL="https://aroundaplanet--arounda-planet.us-east4.hosted.app/api/odoo/sync/pull-payments"

gcloud scheduler jobs create http odoo-payments-pull \
  --location="us-east4" \
  --schedule="*/15 * * * *" \
  --time-zone="America/Mexico_City" \
  --uri="${URL}" \
  --http-method="POST" \
  --headers="X-Scheduler-Secret=${SCHEDULER_SECRET},Content-Type=application/json" \
  --message-body="{}" \
  --max-retry-attempts=3 \
  --max-retry-duration=5m \
  --min-backoff=1m \
  --max-doublings=2
```

### 4.3 Verificar que el job quedó activo

```bash
gcloud scheduler jobs describe odoo-payments-pull --location="us-east4"
```

El campo `state` debe ser `ENABLED`.

---

## 5. Bootstrap inicial del cursor (UNA SOLA VEZ)

Este paso debe ejecutarse ANTES de habilitar el scheduler por primera vez. El bootstrap procesa todos los `account.payment` de Odoo con `write_date` mayor que epoch (1970), lo que puede tardar varios minutos dependiendo del volumen.

**IMPORTANTE**: ejecutar solo una vez. Si se ejecuta dos veces crea duplicados en Firestore o sobreescribe datos con información antigua.

### 5.1 Preparar el entorno local

```bash
# Desde la raíz del proyecto
# Asegúrate de que .env.local tiene ODOO_PULL_SCHEDULER_SECRET con el valor real
# o expórtalo temporalmente:
export ODOO_PULL_SCHEDULER_SECRET="TU_VALOR_AQUI"
```

### 5.2 Ejecutar bootstrap

```bash
node scripts/trigger-9-3-pull.mjs --bootstrap
```

Output esperado (ejemplo):

```json
{
  "status": 200,
  "body": {
    "pulled": 47,
    "skipped": 0,
    "errors": 0,
    "cursor": "2026-05-14 18:32:11",
    "bootstrapMode": true
  }
}
```

### 5.3 Verificar cursor en Firestore

En Firebase Console > Firestore > colección `syncCursors` > documento `odooPayments`:

```json
{
  "lastCursor": "2026-05-14 18:32:11",
  "lastRunAt": "2026-05-14T18:35:00.000Z",
  "lastError": null,
  "consecutiveErrors": 0
}
```

El campo `lastCursor` debe corresponder al `write_date` del payment más reciente en Odoo.

### 5.4 Habilitar el scheduler

Una vez confirmado el cursor, activa el Cloud Scheduler job desde GCP Console o con:

```bash
gcloud scheduler jobs resume odoo-payments-pull --location="us-east4"
```

A partir de este momento el scheduler corre automáticamente cada 15 minutos y solo descarga pagos con `write_date > lastCursor`.

---

## 6. Configurar Automation Rule en Odoo (requiere ayuda de Paloma)

Esta sección requiere acceso de administrador a Odoo. Paloma realiza estos pasos directamente en la interfaz de Odoo 18.

### 6.1 Crear la Automation Rule

1. Ir a **Settings > Technical > Automation > Automated Actions**.
2. Hacer clic en **New**.
3. Configurar los campos principales:

| Campo | Valor |
|-------|-------|
| Name | `AroundaPlanet - Webhook payment sync` |
| Model | `Account Payment (account.payment)` |
| Trigger | `Based on a timed condition` → cambiar a `On save (creation and update)` |
| Before Update Filter | dejar vacío (dispara en todos los cambios) |
| Action To Do | `Execute a server action` |

> Nota: si se quiere reducir el volumen de llamadas, se puede agregar un filtro `state != 'draft'` en **Before Update Filter** para disparar solo cuando el pago cambia de estado. Dejar vacío es más seguro para no perder actualizaciones.

### 6.2 Configurar el Server Action (Plan A con HMAC)

En la pestaña **Actions**, seleccionar tipo **Execute Python Code** y usar el siguiente código:

```python
import hmac
import hashlib
import json
import urllib.request

# Configuración
webhook_url = "https://aroundaplanet--arounda-planet.us-east4.hosted.app/api/odoo/webhook/payment"
webhook_secret = "TU_WEBHOOK_SECRET_AQUI"  # Sustituir con el valor real

# Construir payload con los campos del payment
payload = {
    "id": record.id,
    "state": record.state,
    "journal_id": record.journal_id.id if record.journal_id else None,
    "journal_name": record.journal_id.name if record.journal_id else None,
    "partner_id": record.partner_id.id if record.partner_id else None,
    "partner_name": record.partner_id.name if record.partner_id else None,
    "amount": record.amount,
    "date": str(record.date) if record.date else None,
    "memo": record.ref or record.name,
    "write_date": str(record.write_date) if record.write_date else None,
    "reconciled_invoice_ids": record.reconciled_invoice_ids.ids if record.reconciled_invoice_ids else [],
    "x_firebase_payment_id": record.x_firebase_payment_id or None,
    "x_firebase_agent_uid": record.x_firebase_agent_uid or None,
}

body_bytes = json.dumps(payload).encode("utf-8")

# Calcular firma HMAC-SHA256
signature = hmac.new(
    webhook_secret.encode("utf-8"),
    body_bytes,
    hashlib.sha256
).hexdigest()

# Enviar request
req = urllib.request.Request(
    webhook_url,
    data=body_bytes,
    headers={
        "Content-Type": "application/json",
        "X-Odoo-Signature": signature,
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        pass  # Ignorar respuesta, el webhook es fire-and-forget
except Exception:
    pass  # No bloquear el save de Odoo si el webhook falla
```

> ADVERTENCIA: el `webhook_secret` está hardcodeado en el script. Paloma debe tratarlo como dato sensible y no compartirlo por WhatsApp o correo sin cifrar. Si Odoo 18 Enterprise soporta Variables de Entorno en Server Actions (depende de la versión exacta), usar esa alternativa.

### 6.3 Plan B: secret como query param (fallback si Plan A es complejo)

Si Paloma no puede ejecutar Python con `hmac` en la versión exacta de Odoo 18 Enterprise Online, usar esta alternativa más simple:

**URL del webhook con secret embebido:**

```
https://aroundaplanet--arounda-planet.us-east4.hosted.app/api/odoo/webhook/payment?secret=TU_WEBHOOK_SECRET_AQUI
```

El endpoint de la API debe aceptar este modo y verificar el query param en lugar del header `X-Odoo-Signature`.

> NOTA PARA ALEK: documentar en el código del endpoint que el Plan B es temporal. Story 9.6 o una tarea de hardening posterior debe migrar al Plan A con HMAC.

### 6.4 Guardar y activar la regla

1. Hacer clic en **Save**.
2. Verificar que el campo **Active** esté marcado.
3. Hacer un cambio menor a un `account.payment` de prueba (ej: editar el memo) y verificar en los logs de Cloud Run que llegó el webhook.

---

## 7. Procedimiento de rotación de secrets sin downtime

Aplica tanto para `ODOO_PULL_SCHEDULER_SECRET` como para `ODOO_WEBHOOK_SECRET`. El flujo usa una variable `_PREV` para aceptar ambos valores durante la transición.

### 7.1 Rotación del scheduler secret

```bash
# Paso 1: generar nuevo secret
NEW_SECRET=$(openssl rand -base64 32)
echo "Nuevo secret: $NEW_SECRET"

# Paso 2: crear nueva versión en Secret Manager
echo -n "$NEW_SECRET" | gcloud secrets versions add prod-odoo-pull-scheduler-secret --data-file=-

# Paso 3: crear secret _PREV con el valor antiguo
OLD_SECRET="TU_VALOR_ANTIGUO_AQUI"
echo -n "$OLD_SECRET" | gcloud secrets create prod-odoo-pull-scheduler-secret-prev \
  --data-file=- \
  --replication-policy="user-managed" \
  --locations="us-east4"

# Otorgar acceso al service account al secret _PREV también
SA="firebase-app-hosting-compute@arounda-planet.iam.gserviceaccount.com"
gcloud secrets add-iam-policy-binding prod-odoo-pull-scheduler-secret-prev \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor"
```

```bash
# Paso 4: descomentar en apphosting.yaml la variable _PREV y hacer deploy
# apphosting.yaml agrega:
#   - variable: ODOO_PULL_SCHEDULER_SECRET_PREV
#     secret: prod-odoo-pull-scheduler-secret-prev

git add apphosting.yaml
git commit -m "chore: rotacion scheduler secret - habilita _PREV"
git push origin master
# Esperar deploy exitoso
```

```bash
# Paso 5: actualizar Cloud Scheduler con el nuevo secret
gcloud scheduler jobs update http odoo-payments-pull \
  --location="us-east4" \
  --headers="X-Scheduler-Secret=${NEW_SECRET},Content-Type=application/json"
```

```bash
# Paso 6: esperar 1 ciclo (15 min) y confirmar que los logs muestran 200
# Paso 7: limpiar _PREV de apphosting.yaml y eliminar el secret temporal
git add apphosting.yaml
git commit -m "chore: rotacion scheduler secret - limpia _PREV"
git push origin master

gcloud secrets delete prod-odoo-pull-scheduler-secret-prev --quiet
```

### 7.2 Rotación del webhook secret

El mismo flujo aplica para `prod-odoo-webhook-secret` y su variable `ODOO_WEBHOOK_SECRET_PREV`. Adicionalmente, después del deploy, Paloma debe actualizar el `webhook_secret` en el Server Action de Odoo con el nuevo valor antes de eliminar el secret `_PREV`.

---

## 8. Validación post-setup

Ejecutar estas tres verificaciones en orden antes de considerar el setup completo.

### 8.1 Verificar rechazo con secret incorrecto

```bash
URL="https://aroundaplanet--arounda-planet.us-east4.hosted.app/api/odoo/sync/pull-payments"

curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$URL" \
  -H "X-Scheduler-Secret: secret-incorrecto" \
  -H "Content-Type: application/json" \
  -d "{}"
# Esperado: 401
```

### 8.2 Verificar respuesta exitosa con secret correcto

```bash
SCHEDULER_SECRET="TU_VALOR_AQUI"

curl -s \
  -X POST "$URL" \
  -H "X-Scheduler-Secret: ${SCHEDULER_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{}" | python3 -m json.tool
# Esperado: JSON con "pulled", "skipped", "errors", "cursor"
```

### 8.3 Verificar documento cursor en Firestore

```bash
# Via Firebase CLI (requiere firebase login)
firebase firestore:get syncCursors/odooPayments --project arounda-planet
# Esperado: documento con lastCursor no nulo
```

O en Firebase Console: Firestore > `syncCursors` > `odooPayments` > campo `lastCursor` poblado.

---

## 9. Operación normal y monitoreo

### 9.1 Logs de Cloud Run

Los logs de cada ejecución del pull se observan en GCP Console > Cloud Run > `arounda-planet` > Logs. Filtrar por:

```
jsonPayload.story="9.3" OR textPayload:"pull-payments"
```

Cada ejecución del scheduler emite un log estructurado al inicio y al final con el resumen del pull.

### 9.2 Documento cursor en Firestore

El documento `syncCursors/odooPayments` tiene la siguiente estructura:

```json
{
  "lastCursor": "2026-05-14 18:32:11",
  "lastRunAt": "2026-05-14T18:35:00.000Z",
  "lastError": null,
  "consecutiveErrors": 0
}
```

Si `lastError` queda poblado durante más de 2 runs consecutivos (`consecutiveErrors >= 2`), hay un problema que requiere atención. Revisar los logs de Cloud Run para el detalle del error.

### 9.3 Alerta manual de emergencia

Mientras Story 9.6 agrega la UI admin de sync, la forma de verificar manualmente es:

```bash
# Ejecutar un pull delta inmediato y ver el output
node scripts/trigger-9-3-pull.mjs
# O contra producción:
node scripts/trigger-9-3-pull.mjs --prod
```

### 9.4 Campos Firestore que son read-only (propiedad de Odoo en este contexto)

Los siguientes campos en la colección `payments` se actualizan exclusivamente por el pull de Odoo. No deben modificarse manualmente:

- `odooState`
- `odooJournalId` / `odooJournalName`
- `odooReconciled` / `odooReconciledInvoiceIds`
- `odooCanceledAt`
- `odooSyncedAt`
- `odooLastError`

Los campos `status`, `agentId`, `clientName`, `receiptUrl`, `ocrData`, `verifiedBy`, `verifiedAt` siguen siendo propiedad de Firestore. La política LWW (Last Write Wins) de Story 9.6 manejará conflictos futuros.

---

## Apendice A: Comandos de rollback de emergencia

Si el pull introduce datos incorrectos masivamente:

```bash
# Pausar el scheduler inmediatamente
gcloud scheduler jobs pause odoo-payments-pull --location="us-east4"

# Deshabilitar la Automation Rule en Odoo (Paloma, desde Odoo Studio)
# Settings > Technical > Automation > AroundaPlanet - Webhook payment sync > Active = false
```

Los datos de Firestore NO se borran automáticamente. Si se necesita revertir campos Odoo en Firestore, requiere un script manual caso por caso.

---

## Apendice B: Orden de ejecucion completo (checklist)

- [ ] Generar `SCHEDULER_SECRET` y `WEBHOOK_SECRET` con `openssl rand -base64 32`
- [ ] Crear `prod-odoo-pull-scheduler-secret` en Secret Manager
- [ ] Crear `prod-odoo-webhook-secret` en Secret Manager
- [ ] Otorgar `secretmanager.secretAccessor` al service account de App Hosting en ambos secrets
- [ ] Descomentar bloque en `apphosting.yaml` y hacer push a master
- [ ] Esperar deploy exitoso en Firebase Console
- [ ] Ejecutar bootstrap: `node scripts/trigger-9-3-pull.mjs --bootstrap`
- [ ] Verificar `syncCursors/odooPayments.lastCursor` poblado en Firestore
- [ ] Crear Cloud Scheduler job `odoo-payments-pull` (frecuencia `*/15 * * * *`)
- [ ] Verificar rechazo 401 con secret incorrecto
- [ ] Verificar 200 con secret correcto
- [ ] Paloma configura Automation Rule en Odoo (Plan A o Plan B)
- [ ] Paloma hace cambio de prueba en un payment y confirma que llega el webhook a Cloud Run logs
