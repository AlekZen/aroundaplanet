# Runbook 9.4 Task 1 — Setup Tag de Attachments en Odoo

## Metadatos

| Campo | Valor |
|-------|-------|
| Fecha | `2026-05-14T21:40:29.441Z` |
| Comando | `node scripts/setup-9-4-attachment-tag.mjs` |
| Entorno | Produccion (https://aroundaplanet.odoo.com) |
| auth uid | 2 |

## Resultado

| Campo | Valor |
|-------|-------|
| Modelo usado | `documents.tag` |
| Tag name | `aroundaplanet_comprobante` |
| tagId | `47` |
| Accion | `created` |
| Firestore actualizado | Si — `appConfig/odoo` con merge |

## Campos escritos en Firestore `appConfig/odoo`

```json
{
  "attachmentReceiptTagId": 47,
  "attachmentReceiptTagName": "aroundaplanet_comprobante",
  "attachmentReceiptTagModel": "documents.tag",
  "updatedAt": "<serverTimestamp>"
}
```

## Leccion operativa

### Rotar el tag si cambia el name

Si en el futuro se necesita renombrar el tag (p.ej. de `aroundaplanet_comprobante` a otro nombre),
el proceso correcto es:

1. Crear el nuevo tag via `documents.tag.create({name: 'nuevo_nombre'})` — obtener el nuevo `tagId`.
2. Actualizar `appConfig/odoo.attachmentReceiptTagId` con el nuevo id.
3. Actualizar `appConfig/odoo.attachmentReceiptTagName` con el nuevo nombre.
4. Los attachments existentes con el tag viejo NO se deshabilitan (Odoo conserva el historial).
5. El helper TypeScript `getReceiptTagId()` invalida su cache al detectar que `attachmentReceiptTagId` cambio en Firestore.

### Invalidar cache del helper TypeScript futuro

El helper `getReceiptTagId()` (Task siguiente de 9.4) cachea el tagId en memoria por ~10 minutos
para evitar leer Firestore en cada operacion. Para forzar invalidacion inmediata:

1. Redeployer la funcion/servidor (Cloud Run recicla instancias).
2. O bien: cambiar `attachmentReceiptTagId` a `-1` en Firestore y luego al valor correcto
   — el helper detectara el -1 como invalido y releeera en la siguiente llamada.

### Si ningun modelo de tags existe

Los modelos probados en orden son: ir.attachment.tag, documents.tag.
Si un tenant nuevo no tiene ninguno, instalar el modulo "Documents" de Odoo (Configuracion > Apps)
y volver a ejecutar este script. El script es idempotente y seguro de re-ejecutar.

## Output JSON

Archivo: `scripts/audit-output/9-4-attachment-tag-setup.json`
