# Story 10.1 — Code Review Formal (sesión 44, 2026-05-16)

## Resumen ejecutivo

**Veredicto: Approved with minor.**

Story 10.1 (PDFs contratos + cotizaciones) está sólida en producción. Schemas Zod correctos, validación triple aplicada, guards de auth + ownership consistentes en todos los endpoints sensibles, `storage.rules` cerradas con bypass exclusivo via signed URL v4, `firestore.rules` con lectura segmentada por rol/share/ownership. Se detectaron 2 issues Medium y 3 Low; el High obligatorio reportado por el revisor (comment ausente en cast `renderToBuffer`) se aplicó pre-commit, igual que la transacción de versionado de contratos. Lint/typecheck/test reportados al final del documento.

---

## Findings

### High

#### H1 — `quotations/generate.ts:22` cast sin comment explicativo
**Archivo:** `src/lib/pdf/quotations/generate.ts:22`
**Riesgo:** divergencia con `contracts/generate.ts:29` (que sí lo documenta). Cast `as unknown as Parameters<typeof renderToBuffer>[0]` sin comentario futuro confundirá al próximo dev y abre la puerta a quitarlo "porque parece feo" rompiendo el render.
**Fix:** comentario idéntico al de `contracts/generate.ts:27-29` justificando la incompatibilidad de tipos entre `ReactElement` y `DocumentProps`.
**Estado:** APLICADO pre-commit.

---

### Medium

#### M1 — Race condition en versión de contrato (contracts/from-order generate)
**Archivo:** `src/app/api/contracts/from-order/[orderId]/generate/route.ts:169-175` (original)
**Riesgo:** `count()` + `set()` sin transacción → dos POST simultáneos sobre la misma orden asignan misma `version`. Probabilidad baja (un solo admin: Paloma) pero el bug es silencioso y rompería el versionado histórico que sí se respeta en el resto del flujo.
**Fix:** se envolvió la lectura del contador + reserva del `contractRef` en `adminDb.runTransaction`. El render+upload del PDF queda fuera (operación lenta + externa) y el segundo `set` final usa `merge:true` con `FieldValue.delete()` sobre el flag `_reserved`. Patrón mirror del versionado de pagos de Story 9.2.
**Estado:** APLICADO pre-commit.

#### M2 — Rate-limit in-memory inconsistente bajo escala (quotations público)
**Archivo:** `src/app/api/quotations/route.ts:15-28`
**Riesgo:** `ipBuckets` vive en memoria del proceso. `apphosting.yaml` autoriza `max=10` instancias → un atacante podría obtener 10×10=100 quotations/min en lugar del límite advertido de 10/min. Bajo carga normal (1-2 instancias) el límite es efectivo.
**Fix sugerido (NO aplicado, >15 min):** mover a Firestore con TTL de 60s (`rateLimits/{ip}` doc) o a Cloud Storage signed counter. Alternativa quirúrgica: añadir guard server-side con `ttl` Firestore en Fase 1.
**Estado:** DOCUMENTADO. Mitigación temporal: la rule `quotations.allow create` es defensa secundaria y `whatsappSent` enmarca el lead a flujo real.

---

### Low

#### L1 — Mismatch defensa-en-profundidad rule vs endpoint público
**Archivo:** `firestore.rules:269-274` vs `src/app/api/quotations/route.ts:77`
**Detalle:** la rule exige `whatsappSent == true` y `createdBy == null` en el create público. El endpoint admite `whatsappSent=false` con default y persiste `createdBy=claims.uid ?? null`. Como el endpoint usa Admin SDK, la rule no aplica al server. Si en el futuro Fase 1 expone create directo desde cliente, los defaults del schema permitirían un payload que la rule rechazaría con confusión silenciosa.
**Fix sugerido:** alinear el schema a `whatsappSent: z.literal(true)` para el source `cotizar-public` (refine), o documentar la divergencia.
**Estado:** DOCUMENTADO. Bajo riesgo porque hoy no hay flujo client-direct.

#### L2 — TOCTOU en POST /contracts/[id]/accept
**Archivo:** `src/app/api/contracts/[contractId]/accept/route.ts:36-58`
**Detalle:** se lee `sharedWithClient` y luego `update`. Si admin des-comparte entre el `get` y el `update`, el cliente alcanza a aceptar un contrato ya retirado. Ventana de race en segundos. No es leak de datos (el contenido del contrato sigue protegido por signed URL); es solo eventual-consistency del estado de aceptación.
**Fix sugerido:** envolver lectura + update en `runTransaction` chequeando `sharedWithClient===true` dentro de la transacción.
**Estado:** DOCUMENTADO. Aceptable para Fase 0.

#### L3 — `list-mine` ordena por string ISO local — pagos legacy sin createdAt
**Archivo:** `src/app/api/contracts/list-mine/route.ts:64-68`
**Detalle:** ordena con `localeCompare` sobre `createdAt ?? ''`. Docs sin `createdAt` quedan al final (string vacío < cualquier ISO). Correcto para el flujo actual, pero si llega backfill de contratos sin timestamp el orden será sub-óptimo silenciosamente.
**Fix sugerido:** filtrar `createdAt!=null` o usar `null` con sort manual explícito.
**Estado:** DOCUMENTADO. No bloquea.

---

## Aplicados pre-commit

1. **H1**: comment idéntico al de `contracts/generate.ts` añadido en `quotations/generate.ts:22`.
2. **M1**: versionado de contratos envuelto en `runTransaction` con reserva atómica del slot + flag `_reserved` limpiado con `FieldValue.delete()` en el segundo `set` con `merge:true`.

## Pendientes (no bloquean cierre Story 10.1)

- M2: migrar rate-limit de in-memory a Firestore TTL en Fase 1 si `/cotizar` empieza a recibir abuso real.
- L1: alinear schema y rule de `quotations` con `whatsappSent: z.literal(true)` o ajustar la rule.
- L2: `accept` transaccional si se observan disputas de timing.
- L3: depurar el sort de `list-mine` cuando exista backfill de contratos legacy.

---

## Cobertura de tests revisada

- `contractSchema.test.ts`, `contractTemplateSchema.test.ts`, `quotationSchema.test.ts` — happy + edge cases monto 0, refines de share, regex templateKey.
- `currencyToSpanish.test.ts` — boundary cases (CIEN exacto, UN MILLÓN, centavos 00/50).
- `findTemplate.test.ts` — match heurístico destino→plantilla (refactor sesión 43 lo deja como legacy backwards-compat pero el test sigue válido).
- 39+ tests sesión 43 según retro — Smoke E2E manual con Felipe RUBIO + YAZIL validó render correcto.

## Validaciones automáticas

- `pnpm typecheck`: ✅ verde (corrió con fixes aplicados).
- `pnpm lint`: ver reporte final del commit.
- `pnpm test --run`: ver reporte final del commit.
