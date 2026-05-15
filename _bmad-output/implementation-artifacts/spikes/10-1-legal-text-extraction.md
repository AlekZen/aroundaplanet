# Spike 10.1 — Extracción de texto legal de plantillas piloto

**Generado:** 2026-05-15T19:52:01.767Z
**Fuente:** Odoo Documents `documents.document.read` campo `datas` (base64 .docx) → `mammoth.extractRawText`

## Resumen

| Key | Destino | Odoo ID | Estado | Tamaño | Caracteres | Párrafos | Warnings |
|---|---|---|---|---|---|---|---|
| `vuelta-al-mundo` | VUELTA AL MUNDO 2024 | 532 | ✓ ok | 1282881b | 12711 | 56 | 0 |
| `asia` | ASIA CONTRATO | 232 | ✓ ok | 217895b | 12466 | 53 | 0 |
| `europa-septiembre` | EUROPA SEPTIEMBRE CONTRATO | 221 | ✓ ok | 222136b | 12969 | 71 | 0 |
| `colombia-mayo` | COLOMBIA MAYO CONTRATO | 233 | ✓ ok | 221748b | 12632 | 62 | 0 |
| `chepe-enero` | CHEPE ENERO CONTRATO | 202 | ✓ ok | 222306b | 13140 | 76 | 0 |

## Archivos generados

- **vuelta-al-mundo** (`CONTRATO LA VUELTA AL MUNDO 2024 .docx`):
  - Texto plano: `scripts/audit-output/10-1-legal-text/vuelta-al-mundo.txt`
  - .docx original respaldado: `scripts/audit-output/10-1-legal-text/vuelta-al-mundo.docx`
- **asia** (`ASIA CONTRATO.docx`):
  - Texto plano: `scripts/audit-output/10-1-legal-text/asia.txt`
  - .docx original respaldado: `scripts/audit-output/10-1-legal-text/asia.docx`
- **europa-septiembre** (`EUROPA SEPTIEMBRE CONTRATO.docx`):
  - Texto plano: `scripts/audit-output/10-1-legal-text/europa-septiembre.txt`
  - .docx original respaldado: `scripts/audit-output/10-1-legal-text/europa-septiembre.docx`
- **colombia-mayo** (`COLOMBIA MAYO CONTRATO.docx`):
  - Texto plano: `scripts/audit-output/10-1-legal-text/colombia-mayo.txt`
  - .docx original respaldado: `scripts/audit-output/10-1-legal-text/colombia-mayo.docx`
- **chepe-enero** (`CHEPE ENERO CONTRATO.docx`):
  - Texto plano: `scripts/audit-output/10-1-legal-text/chepe-enero.txt`
  - .docx original respaldado: `scripts/audit-output/10-1-legal-text/chepe-enero.docx`

## Validación con Paloma (siguiente paso)

1. Alek revisa los `.txt` y confirma que el contenido legal coincide con lo que recuerda.
2. Paloma valida visualmente el `.docx` respaldado (es el mismo que ella usa hoy en Odoo) — sin cambios.
3. Alek convierte cada `.txt` en componente React-PDF en `src/lib/pdf/templates/contracts/{key}.tsx`:
   - Texto legal hardcoded (validado).
   - Variables dinámicas: `{nombre_cliente}`, `{viaje_destino}`, `{viaje_temporada}`, `{fecha_salida}`, `{fecha_regreso}`, `{monto_total_mxn}`, `{monto_total_letras}`, `{anticipo_mxn}`, `{saldo_mxn}`, `{agente_nombre}`, `{fecha_firma}`, `{contract_id}`.
4. Paloma valida 1-2 PDFs renderizados antes de cerrar Task 7.

## Restricción heredada Epic 9

Los `.docx` originales en Odoo Documents **NO se tocan**. Paloma los sigue usando manual si quiere. Las plantillas React-PDF son source-of-truth de aquí en adelante para PDFs generados desde la plataforma.
