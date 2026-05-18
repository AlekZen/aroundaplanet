# Deuda Técnica — Backlog F1

**Última actualización**: 2026-05-18 (batch deuda técnica post-Epic 9 / Story 10.1)

Este documento consolida los ítems de deuda técnica declarados conscientemente,
con justificación explícita y estimación de esfuerzo para Fase 1.

---

## Items DISMISSED F1

| # | Item | Archivo | Razón dismiss | Estimación F1 | Plan F1 |
|---|---|---|---|---|---|
| D1 | Rate-limit in-memory `quotations` multi-instancia (#10.1-M2) | `src/app/api/quotations/route.ts:15-28` | 1-2h migrar a Firestore TTL. Suficiente para Cloud Run min=1 (frena bursts simples); defensa real son Firestore rules de create. No urgente antes de tráfico real. | 2h | Reemplazar `ipBuckets` Map por doc `rateLimits/{ip}` en Firestore con TTL 60s. Usar transacción para count atómico. |
| D2 | `summary.updated` cuenta todos los upserts (no distingue created/updated) (#8-1b-M1) | `src/lib/odoo/documents-pull.ts:427,442,453` | Distinguir requeriría `get()` previo por doc antes del `batch.set` — costoso (N reads adicionales por run). El schema ya documenta la semántica de "upsert" en comentario inline. | 3h | Agregar `get()` en batch pre-write para comparar snapshot existente; incrementar `created` si `!snap.exists`, `updated` si ya existe. Evaluar impacto en latencia (100 docs/page × get() = costoso). Alternativa: Firestore trigger que lleve contador. |
| D3 | `DocumentsPanel.tsx` ~605 líneas denso (#8-1c-L1) | `src/components/custom/DocumentsPanel.tsx` | Refactor mayor de componente: extraer sub-componentes DocumentsList, FolderMappingPanel, DocumentDetailSheet. Fuera de scope del batch de fixes. | 4-6h | Aplicar split en sprint dedicado. Pre-requisito: asegurarse de que todos los sub-componentes tienen tests de unidad antes de extraer. |
| D4 | `mark-unrelated` permissive JSON parse (#8-1c-L2) | `src/app/api/odoo/documents/[documentId]/mark-unrelated/route.ts` | Decisión documentada en story 8-1d: el endpoint es interno (solo accede admin autenticado con permiso `documents:manage`). Validación permissiva aceptada conscientemente. | WON'T FIX | Documentado como decisión de diseño. El permiso `documents:manage` restringe acceso. |

---

## Items WON'T FIX

| # | Item | Razón | Documentado en |
|---|---|---|---|
| W1 | `director` puede leer `paymentAlerts`/`paymentConflicts` (#9.6-L6) | El Director General (Noel) necesita visibilidad del estado de sync para gestión. Decisión intencional aunque no documentada en el AC7. | `firestore.rules:193-212`. Agregar comentario en rules. |
| W2 | `const field` en `resolve/route.ts:165` "dead code" (#9.6-L8) | Falso positivo del code review: `field` sí se usa en línea 170 (`const canPushField = field !== 'memo'`) y en `FIELD_MAP[field]`. No es dead code. | `src/app/api/payment-conflicts/[conflictId]/resolve/route.ts:165-188` |
| W3 | Test AC8-1 con "comentario contradictorio" (#9.6-L7) | El test fue actualizado entre el code review y la implementación final. El nombre actual `AC8-1 firestore-wins: actualiza lww + resuelve; memo skippea push` es correcto y consistente. No hay contradicción real. | `resolve/route.test.ts:86` |

---

## Items APPLIED (en este batch)

| # | Item | Commit | Notas |
|---|---|---|---|
| A1 | TOCTOU en POST `/contracts/[id]/accept` (#10.1-L2) | ver commits | `runTransaction` envuelve lectura+update atómico |
| A2 | Sort por string ISO con createdAt nullable (#10.1-L3) | ver commits | Null explícito al final; no depende de `''` vacío |
| A3 | Stale lock duck-typing (#8-1b-M2) | ver commits | `instanceof Timestamp` con fallback duck-type para mocks de test |
| A4 | Hard cap 20k sin warning (#8-1b-M3) | ver commits | Log warning + `summary.warnings[]` cuando i===99 y página completa |
| A5 | "Body inválido" sin echo Zod (#8-1b-L1) | ver commits | Incluye `issues` solo en NODE_ENV !== 'production' |
| A6 | `errored` no cuenta safeParse fails (#8-1b-L2) | ver commits | `fetchDocumentsPage` retorna `{rows, parseErrors}` y el caller acumula |
| A7 | `since` acepta solo ISO-8601 pero cursor interno usa formato Odoo (#8-1b-L3) | ver commits | Schema acepta ambos formatos con regex ODOO_DATETIME_REGEX |
| A8 | `summary.updated` documentado como "upserted" (#8-1b-M1 partial) | ver commits | Rename completo descartado (6+ consumers UI); schema documenta semántica |
| A9 | CSV export `status=all` sin documentación (#9.6-L9) | ver commits | Comentario inline explicando comportamiento intencional |
| A10 | Input amount sin max (#9.6-L10) | ver commits | `max={9999999}` + placeholder mejorado |

---

## 32 Tests TODO (securityRules.test.ts)

**Estado**: Intencional. Patrón `it.todo` (no `it.skip`).

**Archivo**: `src/lib/auth/securityRules.test.ts`

**Razón**: Los tests de Firestore Security Rules requieren `@firebase/rules-unit-testing`
con Firebase Emulator activo. El emulador no está configurado en el entorno CI/CD del proyecto
(GitHub Actions no tiene emulador de Firestore). Los 32 `it.todo` sirven como matriz de
regresión documentada — verificada manualmente vía Firebase Console Rules Playground y
`firebase deploy --only firestore:rules` (validación de compilación).

**Plan F1**: Configurar `@firebase/rules-unit-testing` + Firebase Emulator en CI
(`firebase-tools` + `--project demo-test` en GitHub Actions). Implementar los 32 tests.
Estimación: 4-6h (setup CI + implementación de fixtures).

---

## Items Epic 9 — Pendientes externos / diferidos

Los siguientes ítems NO son deuda de código sino pendientes operativos documentados
en `retrospectives/epic-9-followup-triage.md`:

- **#1/#2**: AC9 smokes prod 9.4/9.6 — ejecución continua durante operación normal (equipo AroundaPlanet)
- **#3**: Automation Rule webhook Odoo — responsabilidad Paloma (runbook 9-3 paso 6)
- **#4**: Cleanup attachment 45803 ACL-locked — responsabilidad Paloma manual
- **#5**: Feature flags `ODOO_FOLDER_AUTO_ASSIGN` / `ODOO_FOLDER_AUTO_CREATE` — backlog F1
- **#7**: `/admin/verification/{id}` página dinámica — backlog F1 (mejora UX)

---

## Permission Audit — Resultado

Endpoints auditados: `/api/auth/claims`, `/api/agents/[id]/validate`, `/api/orders`, `/api/users/[uid]/profile`

| Endpoint | Tipo authz | Conclusión |
|---|---|---|
| GET `/api/auth/claims` | Self-auth-check puro | Correcto: verifica `__session` cookie propia. Sin acceso a datos de otros usuarios. |
| POST `/api/auth/claims` | Feature authz (superadmin) | Correcto: `roles.includes('superadmin')` desde token verificado. |
| GET `/api/agents/[id]/validate` | Sin auth (público) | Correcto: endpoint público que solo expone `{valid: boolean}`. Sin datos sensibles. |
| POST `/api/orders` | Sin auth (público) + rate-limit para guests | Correcto: rate-limit por IP para guests. Datos guardados sin PII más allá del contacto del formulario. |
| PATCH `/api/users/[uid]/profile` | Self O `requirePermission('users:manage')` | Correcto: patrón `caller.uid !== uid → requirePermission` ya implementado. |

**Sin cambios necesarios** en ninguno de los 4 endpoints.
