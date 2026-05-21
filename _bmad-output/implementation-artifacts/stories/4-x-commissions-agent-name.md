# Story 4.X — UX bug: mostrar agentName en tabla Comisiones

## Status
backlog (Fase 1 — NO bloquea cierre F0)

## Story
Como **admin/superadmin revisando comisiones**, quiero **ver el nombre del agente
asignado a cada comisión** en lugar del agentId crudo (Firebase UID), para
**identificar rápidamente a quién corresponde sin tener que cruzar IDs en Firestore
Console**.

## Acceptance Criteria
- **AC1** — `GET /api/commissions` devuelve `agentName: string | null` por cada
  ítem, resuelto via `users/{agentId}.displayName` (o `firstName + lastName`) con
  fallback a `odooAgents/{agentId}.name`.
- **AC2** — La columna "Agente" en la tabla (rutas `/admin/commissions` y
  `/superadmin/commissions`) muestra `agentName` en lugar de `agentId`. Si
  `agentName` está ausente muestra el agentId truncado como fallback visual.
- **AC3** — Si el agente fue eliminado (ningún documento en `users/` ni `odooAgents/`),
  la columna muestra `"Agente eliminado"` en lugar de un string vacío o el UID crudo.
- **AC4** — Ambas rutas `/admin/commissions` y `/superadmin/commissions` muestran
  el nombre (comparten el mismo componente, por lo que AC2 las cubre a ambas con un
  solo cambio).
- **AC5** — El enrichment usa una `Map` de cache dentro del request (mismo patrón que
  `/api/payments`) para evitar N lecturas Firestore cuando múltiples comisiones
  pertenecen al mismo agente. No hay regresión de latencia perceptible con ≤200
  comisiones (límite actual de la query).

## Investigación previa (ya hecha)
- **Componente UI:** `src/app/(admin)/admin/commissions/page.tsx` (superadmin
  re-exporta exactamente el mismo componente). Línea 199 renderiza `{c.agentId}`.
  La interfaz `CommissionItem` no tiene campo `agentName`.
- **Endpoint:** `src/app/api/commissions/route.ts` — hace `snapshot.docs.map(doc => ({id, ...doc.data()}))` sin ningún enrichment. El schema Zod (`commissionSchema.ts`) tampoco expone `agentName` en el response.
- **Escritura de comisiones:** `src/app/api/payments/[paymentId]/verify/createCommission.ts` — NO persiste `agentName` en el documento Firestore (solo guarda `agentId`). Nota: línea 54-55 contiene un bug secundario (usa `paymentData.agentName` como fallback de `clientName`; out of scope de este story).
- **Helper reutilizable:** `resolveAgentName()` en `src/app/api/payments/route.ts` líneas 17-31 — ya implementa el patrón correcto: `users/{agentId}` → `displayName` || `firstName+lastName` → fallback `odooAgents/{agentId}.name`. Candidato a extraerse a `src/lib/agents/resolveAgentName.ts`.
- **Causa raíz:** Bug en el **endpoint** (no solo UI). El endpoint no enriquece `agentName` antes de retornar. La UI muestra lo que recibe.

## Implementation Notes
1. **Extraer helper** `resolveAgentName` de `src/app/api/payments/route.ts` a
   `src/lib/agents/resolveAgentName.ts` para reutilización. Actualizar el import en
   `payments/route.ts`.
2. **Modificar `src/app/api/commissions/route.ts`**: después de obtener los docs,
   añadir enrichment con cache de `agentId → agentName` (Map local, mismo patrón que
   payments). Retornar `agentName` en cada item.
3. **Modificar `CommissionItem` interface** en `page.tsx`: agregar
   `agentName?: string | null`.
4. **Modificar renderizado** línea 199 de `page.tsx`:
   ```tsx
   <td>{c.agentName ?? c.agentId.slice(0, 8) + '…'}</td>
   ```
   Si `agentName` es `null` y viene de un agente eliminado, el endpoint debe retornar
   `agentName: "Agente eliminado"` o la UI lo puede inferir.
5. **Opcional / separado:** Persistir `agentName` en `createCommission.ts` al momento
   de escritura para evitar lookups futuros (denormalización). Evaluarlo en un
   follow-up.

## Alternativas consideradas
1. **Lazy-enrich en el endpoint (RECOMENDADA):** enrichment al leer, sin cambios en
   schema de escritura. Costo: N lookups Firestore por request (mitigado con cache Map
   dentro del request). Ventaja: no requiere backfill de datos históricos.
2. **Denormalización en escritura:** persistir `agentName` en el doc de comisión al
   crearlo (en `createCommission.ts`) y al actualizarlo. Requiere backfill de los ~6+
   documentos existentes y coordinación con el webhook de Odoo. Mejor a largo plazo
   pero más riesgo.
3. **Client-side lookup (JOIN en UI):** la UI hace fetch de `/api/agents` para
   resolver nombres. Descartado: duplica requests, complejidad innecesaria, no sigue
   el patrón del proyecto.

**Se recomienda opción 1** por consistencia con el patrón ya establecido en
`/api/payments` y por ser el cambio de menor riesgo.

## Tests requeridos
- **Unit (vitest co-located) en `src/app/api/commissions/route.test.ts`:**
  - Mock de `adminDb.collectionGroup('commissions')` retorna docs con `agentId` pero
    sin `agentName`.
  - Mock de `adminDb.collection('users').doc(agentId).get()` retorna displayName.
  - Verificar que el response incluye `agentName` correcto.
  - Caso: agente no existe en `users/` ni `odooAgents/` → `agentName` es `null` o
    `"Agente eliminado"`.
  - Caso: múltiples comisiones mismo agentId → solo 1 lookup Firestore (cache).
- **E2E (Playwright) en `e2e/`:**
  - Login como superadmin, navegar a `/superadmin/commissions`, verificar que la
    columna "Agente" no muestra un UID de 28+ caracteres.
  - Login como admin, misma verificación en `/admin/commissions`.

## Out of scope
- NO modifica los documentos históricos de comisiones en Firestore (no hay backfill).
- NO cambia el endpoint público ni las reglas Firestore.
- NO toca la integración Odoo.
- NO corrige el bug secundario en `createCommission.ts` línea 54-55 (clientName/agentName
  mixup) — ese va en un story separado.
- NO agrega paginación a la tabla de comisiones.

## Estimate
2-3 horas (1 dev):
- Extraer helper y modificar endpoint: ~1h
- Modificar UI y tipos: ~30min
- Tests unitarios y E2E: ~1h

## Riesgos
1. **Latencia en requests con muchas comisiones de agentes distintos:** con el límite
   actual de 200 docs y cache Map, el worst case es 200 lookups Firestore en paralelo.
   Mitigar con `Promise.all` + cache, igual que `/api/payments`.
2. **agentId en Firestore que no corresponde a `users/` ni `odooAgents/`:** si el
   agente fue eliminado de ambas colecciones, el campo retorna `null`. La UI debe
   tener fallback explícito para no mostrar un campo vacío.
3. **El helper `resolveAgentName` en `payments/route.ts` no está exportado:** extraerlo
   implica tocar `payments/route.ts` y actualizar sus tests — riesgo bajo pero hay que
   correr `vitest` antes de merge.
