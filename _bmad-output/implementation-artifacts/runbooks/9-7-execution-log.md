# Runbook 9.7 — Execution Log

## Metadatos

| Campo | Valor |
|-------|-------|
| Timestamp inicio | `2026-05-12T19:35:32.813Z` |
| Timestamp fin | `2026-05-12T19:35:53.501Z` |
| Odoo URL | https://aroundaplanet.odoo.com |
| auth uid | 2 |
| ir.model id (account.payment) | 455 |

## Resumen

| Métrica | Valor |
|---------|-------|
| Fields procesados | 5 |
| Creados | 5 |
| Skipped (ya existían) | 0 |
| Errores | 0 |

## Detalle por Field

| name | ttype | status | Odoo ID |
|------|-------|--------|---------|
| x_firebase_payment_id | char | ✅ creado | 22927 |  verify.allOk=true
| x_firebase_agent_uid | char | ✅ creado | 22933 |  verify.allOk=true
| x_ocr_confidence | float | ✅ creado | 22935 |  verify.allOk=true
| x_canonical_payment_id | many2one | ✅ creado | 22937 |  verify.allOk=true
| x_dup_status | selection | ✅ creado | 22939 |  verify.allOk=true

## IDs Odoo creados (para soft-rollback si se necesita)

- **x_firebase_payment_id**: id=22927 (ir.model.fields)
- **x_firebase_agent_uid**: id=22933 (ir.model.fields)
- **x_ocr_confidence**: id=22935 (ir.model.fields)
- **x_canonical_payment_id**: id=22937 (ir.model.fields)
- **x_dup_status**: id=22939 (ir.model.fields)

## Verificación Final

| field | existe | id | ttype | state |
|-------|--------|----|-------|-------|
| x_firebase_payment_id | ✅ | 22927 | char | manual |
| x_firebase_agent_uid | ✅ | 22933 | char | manual |
| x_ocr_confidence | ✅ | 22935 | float | manual |
| x_canonical_payment_id | ✅ | 22937 | many2one | manual |
| x_dup_status | ✅ | 22939 | selection | manual |

## Observaciones

- Sin errores de creación.


## Soft-rollback (solo si orquestador lo pide)

Para revertir fields creados, ejecutar en Odoo shell (NO aquí):
```python
# SOLO ejecutar si el orquestador lo solicita explícitamente
env['ir.model.fields'].browse([22927, 22933, 22935, 22937, 22939]).unlink()
```
