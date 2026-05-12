# Story 9.0a (Spike A): Validar Documents `res_id` en `ir.attachment`

Status: ready-for-dev

> **Tipo:** Technical Spike (timebox: 1 día / 8h)
> **Bloquea:** Story 9.4 (Comprobantes en Odoo Documents)
> **Bloqueada por:** ninguna (puede correr en paralelo con 9.0b y 9.7)

## Story

As a **developer (Alek/Quick-Dev)**,
I want to validar empíricamente cómo crear `ir.attachment` en Odoo 18 Enterprise Online respetando `res_model='account.payment'` + `res_id`,
so that la Story 9.4 puede implementar el upload de comprobantes con un patrón confirmado, sin sorpresas en producción.

## Contexto del Spike

El research técnico (sesión 36) identificó que `res_model` y `res_id` en `ir.attachment` son **read-only por default** en Odoo estándar. Esto representa **Riesgo Confianza C** para Story 9.4 — necesitamos validar empíricamente cuál de los 3 caminos funciona en nuestro tenant Odoo Online Custom plan antes de comprometer 5 días de dev.

**Caminos a probar (orden de preferencia):**

1. **Camino 1 — `ir.attachment.create` directo con `res_id`:** crear el attachment via XML-RPC pasando `res_model='account.payment'` + `res_id={paymentId}` desde el inicio (no update post-hoc).
2. **Camino 2 — `mail.thread.message_post`:** subir attachment via `message_post` sobre el `account.payment`, que internamente crea `ir.attachment` con `res_id` poblado.
3. **Camino 3 — write post-create:** crear attachment huérfano y luego intentar `write` para setear `res_id` (esperado: falla read-only, pero documentar para descartarlo).

> **Restricción operativa:** Si no hay sandbox Odoo disponible, ejecutar en producción con prefijo `TEST_AROUNDA_2026-05-12_` en `partner_id.name` + `account.payment.ref` + `ir.attachment.name`. **TODO test data debe ser eliminado al final** con confirmación explícita de Alek antes de cualquier `unlink` (recordatorio: el negocio prohíbe unlink en producción; solo aplica a registros TEST creados por este spike).

## Acceptance Criteria

### AC1: Setup del entorno de pruebas

**Given** Alek confirma si hay sandbox Odoo disponible
**When** se inicia el spike
**Then** se documenta en `_bmad-output/planning-artifacts/spikes/9.0a-documents-res-id-findings.md`:
- URL del tenant usado (sandbox o producción con marker)
- Credenciales XML-RPC usadas (referencia env, NUNCA inline)
- Fecha y hora exacta del spike

**Given** se usa producción (sin sandbox)
**When** se crean los registros TEST
**Then** todos llevan prefijo `TEST_AROUNDA_2026-05-12_` en campos visibles
**And** se mantiene una lista en `findings.md` de IDs creados: `partner_id`, `account.payment.id`, `ir.attachment.id[]`
**And** al cierre del spike, Alek aprueba explícitamente la limpieza ANTES de cualquier `unlink`

### AC2: Camino 1 — `ir.attachment.create` con `res_id` desde el inicio

**Given** existe un `account.payment` TEST con id `{paymentId}`
**When** ejecuto via XML-RPC:
```python
attachment_id = models.execute_kw(db, uid, password,
    'ir.attachment', 'create', [{
        'name': 'TEST_AROUNDA_comprobante.pdf',
        'datas': base64_pdf,
        'res_model': 'account.payment',
        'res_id': paymentId,
        'mimetype': 'application/pdf',
    }])
```
**Then** documento la respuesta:
- Si retorna `attachment_id` numérico: SUCCESS
- Si retorna error: el mensaje exacto

**Given** el attachment se creó
**When** verifico con `search_read('ir.attachment', [('id','=',attachment_id)], ['res_model','res_id','name'])`
**Then** documento si `res_model` y `res_id` quedaron correctamente persistidos
**And** verifico en la UI Odoo abriendo el `account.payment` que el adjunto aparece en el chatter / sección Documents

### AC3: Camino 2 — `mail.thread.message_post` (fallback)

**Given** Camino 1 falla o no persiste `res_id`
**When** intento alternativa via `message_post`:
```python
# Primero crear attachment huérfano (sin res_id)
attachment_id = models.execute_kw(db, uid, password,
    'ir.attachment', 'create', [{
        'name': 'TEST_AROUNDA_comprobante.pdf',
        'datas': base64_pdf,
        'mimetype': 'application/pdf',
    }])

# Luego asociar via message_post
models.execute_kw(db, uid, password,
    'account.payment', 'message_post', [paymentId],
    {'body': 'Comprobante TEST_AROUNDA', 'attachment_ids': [attachment_id]})
```
**Then** documento si `res_id` queda poblado en el attachment después del `message_post`
**And** verifico en UI Odoo que el adjunto aparece en el chatter del payment

### AC4: Camino 3 — write post-create (esperado falla)

**Given** los caminos 1 y 2 ya fueron probados
**When** intento setear `res_id` después de crear el attachment huérfano:
```python
attachment_id = models.execute_kw(db, uid, password,
    'ir.attachment', 'create', [{'name': 'huerfano.pdf', 'datas': base64_pdf}])

result = models.execute_kw(db, uid, password,
    'ir.attachment', 'write', [[attachment_id], {
        'res_model': 'account.payment', 'res_id': paymentId
    }])
```
**Then** documento si:
- Retorna `True` y `res_id` queda actualizado (sorpresa positiva — el read-only no aplica en Odoo Online Custom)
- Retorna `True` pero `res_id` sigue `False` (read-only silencioso)
- Falla con excepción explícita

### AC5: Verificación cross — visibilidad en Odoo Documents app

**Given** uno de los caminos resultó exitoso
**When** abro la app Odoo Documents en la UI
**Then** verifico si el attachment aparece automáticamente
**And** documento el folder por defecto donde aparece (probablemente "Inbox" o no aparece sin tag explícito)
**And** verifico si agregar `tag_ids: [(6,0,[tagId])]` al `ir.attachment` (o vía `documents.document` wrapper) lo mueve a un folder específico

### AC6: Reporte final con código copy-paste para 9.4

**Given** los 3 caminos fueron probados
**When** finalizo el spike
**Then** `_bmad-output/planning-artifacts/spikes/9.0a-documents-res-id-findings.md` contiene:
- **Conclusión binaria:** ¿qué camino usa Story 9.4? (1, 2, o un híbrido)
- **Snippet de código TypeScript** que el dev de 9.4 copia literal (usando nuestro `OdooClient` de `lib/odoo/client.ts`):
  ```typescript
  async function uploadPaymentReceipt(
    paymentId: number,
    receiptBuffer: Buffer,
    fileName: string
  ): Promise<number> {
    // ...código probado en spike
  }
  ```
- **Latencias observadas** por call (ms) — importante para evaluar rate limit 60 req/min
- **Edge cases** descubiertos (max file size, mimetype restrictions, etc.)
- **Decisión sobre tags/folders:** cómo agregar `aroundaplanet_comprobante` y enviar al folder canónico

### AC7: Cleanup TEST data (si se usó producción)

**Given** Alek confirmó NO hay sandbox y se usó producción
**When** el spike termina
**Then** muestro a Alek la lista de IDs TEST creados (partner, payment, attachments)
**And** espero confirmación explícita por escrito antes de ejecutar `unlink`
**And** al ejecutar el unlink, lo hago en orden: attachments → payment → partner
**And** confirmo cada unlink con `search_read` retornando vacío
**And** documento en `findings.md` el log de limpieza con timestamps

## Tasks / Subtasks

- [ ] **Task 1 — Setup** (AC1)
  - [ ] Confirmar con Alek si existe sandbox Odoo o se usa producción con prefijo TEST
  - [ ] Crear archivo `_bmad-output/planning-artifacts/spikes/9.0a-documents-res-id-findings.md` con frontmatter (tenant, fecha, autor)
  - [ ] Crear script `scripts/spike-9-0a-documents-res-id.mjs` que conecta a Odoo via XML-RPC reutilizando `OdooClient`
- [ ] **Task 2 — Crear fixtures TEST** (AC1, AC7)
  - [ ] Crear `res.partner` con nombre `TEST_AROUNDA_2026-05-12_partner` — guardar id
  - [ ] Crear `account.payment` con `partner_id`, `amount=100`, `journal_id=bank_default`, `ref='TEST_AROUNDA_payment'`, `date=hoy` — guardar id
  - [ ] Generar un PDF dummy en memoria (base64) para usar como datas
- [ ] **Task 3 — Camino 1: create con res_id directo** (AC2)
  - [ ] Ejecutar `ir.attachment.create` con `res_model` + `res_id` desde el inicio
  - [ ] Verificar persistencia con `search_read`
  - [ ] Verificar visibilidad en UI Odoo (chatter del payment)
  - [ ] Documentar resultado en findings.md
- [ ] **Task 4 — Camino 2: message_post** (AC3)
  - [ ] Crear attachment huérfano
  - [ ] Asociar via `account.payment.message_post(attachment_ids=[...])`
  - [ ] Verificar que `res_id` queda poblado post-message_post
  - [ ] Documentar resultado
- [ ] **Task 5 — Camino 3: write post-create** (AC4)
  - [ ] Crear attachment huérfano
  - [ ] Intentar `write({'res_id': ...})`
  - [ ] Documentar si funciona, si silencia, o si falla con error
- [ ] **Task 6 — Verificación Documents app + tags** (AC5)
  - [ ] Abrir Odoo Documents UI manualmente y buscar el attachment
  - [ ] Probar agregar tag `aroundaplanet_comprobante` (si existe, sino crear pre-test)
  - [ ] Documentar comportamiento (aparece, en qué folder, requiere wrapper `documents.document`)
- [ ] **Task 7 — Snippet TypeScript para 9.4** (AC6)
  - [ ] Escribir función `uploadPaymentReceipt` en TypeScript usando `OdooClient` de `src/lib/odoo/client.ts`
  - [ ] Incluir error handling con `AppError` pattern
  - [ ] Incluir retry con backoff 1s→2s→4s
  - [ ] Pegar el snippet completo en findings.md sección "Recomendación final"
- [ ] **Task 8 — Cleanup** (AC7)
  - [ ] Mostrar lista de IDs TEST creados a Alek
  - [ ] Esperar confirmación explícita
  - [ ] Ejecutar `unlink` en orden: attachments → payment → partner
  - [ ] Verificar limpieza completa con `search_read` retornando vacío
  - [ ] Documentar log de cleanup en findings.md

## Dev Notes

### Restricciones de negocio que aplican al spike

- **NUNCA `unlink` en producción** salvo registros con prefijo `TEST_AROUNDA_2026-05-12_` creados por este spike, y solo con confirmación explícita de Alek post-spike.
- El spike NO debe crear `ir.model.data` con `module='__aroundaplanet__'` para los registros TEST (eso queda para 9.0b/9.2 y NO debe ensuciar el namespace de producción).
- El spike NO debe modificar ningún `account.payment` existente — solo crear nuevos TEST.

### Conexión Odoo

- Reutilizar `src/lib/odoo/client.ts` (`OdooClient` con XML-RPC). Si el script es `.mjs` puro, replicar la auth con `xmlrpc` npm package directo.
- Credenciales en `.keys/` (no commitear) o env `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`.
- Rate limit: ~60 req/min — el spike total no debería pasar de 20 calls.

### Patrones del proyecto a respetar

- TypeScript estricto (`pnpm typecheck` debe pasar al final).
- Zod safeParse para cualquier respuesta de Odoo que se persista a Firestore (no aplica al spike directamente porque solo es exploración, pero el snippet final SÍ debe incluir Zod).
- Error handling: `AppError { code, message, retryable }` (ver `src/lib/errors.ts`).
- NO inline secrets, NO console.log de tokens/passwords.

### Source tree components a tocar

**Nuevos archivos:**
- `scripts/spike-9-0a-documents-res-id.mjs` — script del spike (puede borrarse post-spike o mantenerse en `scripts/audit-output/` como referencia)
- `_bmad-output/planning-artifacts/spikes/9.0a-documents-res-id-findings.md` — reporte final (debe persistir, es el deliverable)

**Sin cambios:**
- `src/lib/odoo/client.ts` — solo se consume, no se modifica.
- Cualquier route `/api/odoo/*` — el spike NO toca APIs productivas.

### Testing standards

- No aplica testing automatizado al spike (es exploración manual scriptada).
- El snippet TypeScript final de AC6 SÍ debe ir acompañado de un test plan (no implementarlo, solo describir) para Story 9.4.

## Referencias

- **Research técnico (Punto 6 — Documents):** `_bmad-output/planning-artifacts/research/technical-epic-9-sync-bidireccional-pagos-research-2026-05-12.md#6-documents-api`
- **Epic 9 narrative + ACs originales:** `_bmad-output/planning-artifacts/epics.md` (sección "Story 9.0a (Spike A)")
- **Auditoría real Documents:** `scripts/audit-output/odoo-real-data.json` (106 `documents.document` + 182 folders)
- **Memoria sesión 35 (decisiones técnicas firmes):** `memory/session-35-payments-sync-audit.md`
- **OdooClient existente:** `src/lib/odoo/client.ts`
- **Restricciones negocio (CLAUDE.md):** integración Odoo, never unlink, idempotencia

### Sources

- [Set res_id and res_model for ir.attachment — Odoo forum](https://www.odoo.com/forum/help-1/set-res-id-and-res-model-for-ir-attachment-192324)
- [Attachments to documents — Odoo forum](https://www.odoo.com/forum/help-1/attachments-to-documents-281191)
- [Documents — Odoo 18.0 docs](https://www.odoo.com/documentation/18.0/applications/productivity/documents.html)
- [External API — Odoo 18.0 docs](https://www.odoo.com/documentation/18.0/developer/reference/external_api.html)

## Project Structure Notes

- Outputs viven en 2 lugares: `scripts/spike-9-0a-*.mjs` (código exploratorio) y `_bmad-output/planning-artifacts/spikes/9.0a-*.md` (deliverable narrativo).
- El snippet TypeScript final NO se commitea a `src/` en este spike — eso lo hace Story 9.4 cuando lo implementa con ZodSchema + tests.

## Dev Agent Record

### Agent Model Used

(se completa al implementar)

### Debug Log References

(se completa al implementar — logs del script, respuestas crudas Odoo)

### Completion Notes List

- [ ] Spike ejecutado dentro del timebox de 1 día (8h)
- [ ] findings.md completo con conclusión binaria + snippet TS
- [ ] TEST data limpio (si aplica) con confirmación de Alek
- [ ] Story 9.4 actualizada con la decisión técnica antes de marcarse ready-for-dev

### File List

(se completa al implementar)
- `scripts/spike-9-0a-documents-res-id.mjs` (NEW)
- `_bmad-output/planning-artifacts/spikes/9.0a-documents-res-id-findings.md` (NEW)
- `_bmad-output/planning-artifacts/epics.md` (UPDATE — anotar decisión técnica en Story 9.4)
