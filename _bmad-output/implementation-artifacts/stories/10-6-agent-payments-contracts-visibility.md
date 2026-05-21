# Story 10.6 — Agente: visibilidad de pagos y contratos de sus clientes

## Status
ready-for-dev (Fase 0 — cierre 2026-05-23, **bloquea** entrega contractual)

## Story
Como **agente freelance autenticado en el portal**, quiero **poder ver y descargar el recibo de pago verificado y el contrato de mis clientes**, para **dar seguimiento sin depender de pedirle el archivo a admin por WhatsApp ni perder credibilidad frente al cliente**.

## Contexto del reporte
Sesión 46 (2026-05-20) — Noel (Director General y champion) reportó por WhatsApp: *"Como anotación, intenté al meterme como agente y ver el pago de mi cliente que ya aceptó el pago administración y no me deja ver o descargar el recibo de pago. O el contrato."* El cliente está verificado en `/admin/verification`, pero el agente no ve ni recibo ni contrato.

## Causa raíz (ya investigada)
1. **Recibo — gap funcional, no bug**:
   - `src/app/api/my-payments/route.ts:18` filtra por `where('registeredBy', '==', claims.uid)`. Solo retorna pagos que el agente **registró él mismo**.
   - Si el cliente o el admin subió el pago, el agente nunca lo ve.
   - No existe endpoint para "pagos de mis clientes" ni UI `/agent/payments`.
2. **Contrato — bug doble**:
   - `src/app/api/contracts/list-mine/route.ts:25-31` exige **dos condiciones simultáneas**: `agentId == claims.agentId` Y `sharedWithAgent === true`.
   - **Bug A**: `sharedWithAgent` default `false` y solo se activa manual en `/admin/orders/[orderId]`. Admin no sabe que tiene que activarlo.
   - **Bug B**: el `agentId` del contrato proviene del `team_id` Odoo de la orden mirror (`orders/odoo-sale-*`). El mapping `agentName Odoo → agentId Firestore` está pendiente F1 documentado en memoria (cierre sesión 43). Si el `agentId` no se resuelve al mirror de la orden, el contrato queda con `agentId` vacío y ningún agente lo ve aunque `sharedWithAgent` esté en `true`.

## Acceptance Criteria

- **AC1 — Mapping agentName→agentId al mirror de órdenes**: cuando `/api/orders/from-odoo-sale` (`src/app/api/orders/from-odoo-sale/route.ts`) hace mirror de un `sale.order` con `team_id` Odoo no nulo, resuelve el `agentId` Firestore vía `odooAgents/{odooTeamId}.linkedUserId` (o el campo equivalente que conecta team_id Odoo → uid Firebase). Si no hay mapping persiste `agentId: null` y registra log estructurado `{level: 'warn', odooTeamId, orderId}` (no falla la sincronización).
- **AC2 — Auto-share al verificar pago**: cuando admin marca un pago como `verified` en `/api/payments/[paymentId]/verify`, si la orden asociada tiene `contractId` y el contrato tiene `agentId` resuelto (no null), el endpoint actualiza el contrato a `sharedWithAgent: true` y `sharedWithClient: true` (transacción) salvo que ya estén en true. Audit log en `contractEvents/` con `actor: claims.uid`, `action: 'auto-shared-on-verify'`.
- **AC3 — Endpoint `/api/agent/client-payments`**: nuevo endpoint GET, requiere `claims.agentId`. Devuelve `payments[]` con `status === 'verified'` cuya `agentId == claims.agentId` (denormalizado en el documento de pago al momento del verify) **o** cuyo `clientId` aparece en `agent-contacts/{contactId}` con `agentId == claims.agentId`. Cada item incluye `id`, `tripName`, `clientName`, `amountCents`, `paymentMethod`, `bankName`, `bankReference`, `verifiedAt`, `receiptUrl` (signed URL fresh v4, 7 días). No incluye pagos no verificados.
- **AC4 — UI "Ver recibo" en `/agent/clients`**: en `src/app/(agent)/agent/clients/GroupedByClientView.tsx`, dentro del acordeón de cada cliente, los pagos verified muestran un botón **"Ver recibo"** que abre el `receiptUrl` en nueva pestaña (`target="_blank"`, `rel="noopener noreferrer"`). Si la signed URL expiró (>7 días), botón llama a `/api/agent/client-payments` para refrescar antes de abrir.
- **AC5 — Banner orden sin agentId resuelto**: en `/admin/orders/[orderId]` (`src/app/(admin)/admin/orders/[orderId]/page.tsx`), si la orden tiene `odooTeamId` pero `agentId === null`, mostrar banner rojo: *"Esta orden no tiene agente asignado en la plataforma. Asignar para que el agente vea contrato y recibos."* con dropdown de agentes (`odooAgents/` con `linkedUserId != null`) y botón **Asignar**. Al asignar, el contrato heredá el `agentId` y se aplica AC2 si ya hay pagos verificados.
- **AC6 — Sin regresiones de visibilidad**: clientes siguen viendo solo sus contratos (`clientUserId == uid AND sharedWithClient`). Admins siguen viendo todo. La regla Firestore `contracts/{contractId}` permite read si `sharedWithAgent && resource.data.agentId == request.auth.token.agentId`.
- **AC7 — Tests**: vitest unit para `from-odoo-sale` (mapping AC1), `verify` (auto-share AC2), `agent/client-payments` (AC3, incluyendo caso sin `agentId` claim → 403). E2E Playwright: login como agente Felipe (tiene Adriana Alfaro S13367 con pago verified), navegar `/agent/clients`, verificar botón "Ver recibo" visible y que abre PDF; navegar `/agent/contracts`, verificar contrato listado.

## Implementation Notes

1. **Resolver agentId al mirror** (`src/app/api/orders/from-odoo-sale/route.ts`):
   - Antes de persistir `orders/odoo-sale-{id}`, hacer `odooAgents.where('odooTeamId', '==', teamId).limit(1).get()` y leer `linkedUserId`.
   - Si no existe, log warn y persistir `agentId: null`.
   - Helper reutilizable: `src/lib/agents/resolveAgentIdByOdooTeam.ts` (cache Map dentro del request).
2. **Denormalizar `agentId` en pagos** (`src/app/api/payments/[paymentId]/verify/route.ts`):
   - Al verificar, leer la orden asociada (`orders/{orderId}`), copiar `agentId` al doc de pago. Esto permite el query directo en AC3 sin join.
3. **Auto-share contrato**:
   - Dentro del mismo verify endpoint, si `order.contractId != null`, leer el contrato y si `agentId != null` y `sharedWithAgent != true` → update `sharedWithAgent: true` + audit log.
   - Igual para `sharedWithClient` si el contrato tiene `clientUserId`.
4. **Endpoint nuevo** `src/app/api/agent/client-payments/route.ts`:
   - Requiere `claims.agentId`, retorna 403 si falta.
   - Query: `payments.where('agentId', '==', claims.agentId).where('status', '==', 'verified').orderBy('verifiedAt', 'desc').limit(100)`.
   - Genera signed URL v4 fresh para cada `receiptStoragePath` (no devolver URLs viejas guardadas).
   - Enrichment de `clientName` y `tripName` con cache Map.
5. **UI agente**:
   - Hook nuevo `useAgentClientPayments()` (SWR o fetch directo) en `GroupedByClientView.tsx`.
   - Botón "Ver recibo" condicional: solo si `payment.status === 'verified' && payment.receiptUrl != null`.
6. **UI admin (banner)**:
   - En `/admin/orders/[orderId]`, leer `order.odooTeamId` y `order.agentId`. Si team está pero agent es null → banner.
   - Dropdown: `GET /api/admin/agents-list` (puede existir, si no crear) listando `odooAgents` con `linkedUserId != null`.
   - Botón Asignar → `PATCH /api/admin/orders/[orderId]` con `{agentId}`.
7. **Firestore rules** (`firestore.rules`):
   - Verificar que `contracts/{contractId}` allow read si `resource.data.sharedWithAgent == true && resource.data.agentId == request.auth.token.agentId`.
   - Verificar que `payments/{paymentId}` allow read si `resource.data.agentId == request.auth.token.agentId && resource.data.status == 'verified'`.

## Backfill mínimo necesario
- **Script one-off** `scripts/backfill-agent-id-on-orders.ts`: itera `orders/odoo-sale-*` con `agentId == null` y `odooTeamId != null`, intenta resolver. Reporta cuántos se resolvieron.
- **Script** `scripts/backfill-agent-id-on-verified-payments.ts`: para pagos `verified` sin `agentId`, leer orden asociada y copiar.
- **Script** `scripts/backfill-auto-share-verified-contracts.ts`: para contratos cuya orden tenga pagos verified + `agentId != null` + `sharedWithAgent == false`, marcar `sharedWithAgent: true`.
- Correr los 3 scripts **una vez en prod** después del deploy. Idempotentes.

## Out of scope
- NO implementa firma SAT (sigue Fase 1).
- NO crea UI `/agent/payments` standalone (los pagos viven dentro de `/agent/clients` por cliente; revisar en F1 si se necesita vista plana).
- NO modifica la heurística de matching de duplicados entre Odoo y Firestore.
- NO toca push notifications al agente cuando hay pago nuevo verificado (F1).
- NO permite al agente registrar pagos en nombre del cliente (separate story).
- NO cambia los toggles manuales `sharedWithAgent` / `sharedWithClient` de `/admin/orders/[orderId]` — quedan disponibles para override manual; el auto-share solo activa, nunca desactiva.

## Tests requeridos

**Unit (vitest co-located):**
- `src/lib/agents/resolveAgentIdByOdooTeam.test.ts`: mapping existe → devuelve uid; no existe → null + log warn.
- `src/app/api/orders/from-odoo-sale/route.test.ts`: mirror persiste `agentId` correcto cuando team mapeado.
- `src/app/api/payments/[paymentId]/verify/route.test.ts`: al verificar copia `agentId` de la orden al pago Y activa auto-share del contrato.
- `src/app/api/agent/client-payments/route.test.ts`: sin `claims.agentId` → 403; con agentId → solo pagos `verified` de ese agente; signed URL incluida.

**E2E (Playwright en `/e2e/`):**
- `agent-can-see-verified-payment-receipt.spec.ts`: login Felipe (agente con Adriana S13367 verified), `/agent/clients` → expandir Adriana → botón "Ver recibo" visible → click abre nueva tab con PDF.
- `agent-can-see-shared-contract.spec.ts`: login mismo agente, `/agent/contracts` → contrato Adriana listado.
- `admin-banner-when-order-missing-agent.spec.ts`: login admin, abrir orden sin agentId → ve banner → asigna agente → banner desaparece → como ese agente luego ve la orden.

## Estimate
6-8 horas (1 dev), distribuidas:
- Mapping + helper + backfill order: ~1.5h
- Verify endpoint enrichment + auto-share: ~1h
- Endpoint nuevo `/api/agent/client-payments` + signed URL: ~1.5h
- UI agente (botón ver recibo): ~1h
- UI admin (banner asignar agente): ~1h
- Tests unit + E2E: ~2h
- Backfill prod + smoke con Noel: ~30min

## Riesgos
1. **Mapping agentName Odoo→agentId Firestore incompleto**: si `odooAgents.linkedUserId` no está poblado para todos los agentes con órdenes, el banner aparecerá en muchas órdenes. **Mitigación**: correr `scripts/backfill-link-odoo-agents-to-users.ts` antes del deploy o aceptar que admin asigne manualmente uno por uno.
2. **Signed URL v4 + Cloud Run service account**: ya validado en Story 10.1 (self-impersonation `roles/iam.serviceAccountTokenCreator`). No requiere setup adicional.
3. **Firestore rules**: si las rules actuales no permiten al agente leer `payments` o `contracts` con su `agentId` claim, hay 403 silencioso. **Mitigación**: validar rules en emulador antes del deploy y agregar smoke test.
4. **Auto-share dispara en pagos viejos**: el endpoint verify no se re-ejecuta para pagos ya verified; por eso existe `scripts/backfill-auto-share-verified-contracts.ts`. Validar idempotencia.
5. **Cierre Fase 0 a 3 días**: si Bug B (mapping team→user) requiere más tiempo que estimado, fallback aceptable: shippear AC2 + AC3 + AC4 + AC5 con `agentId` resuelto manual via banner (sin AC1 automático). Admin podría tener que asignar 5-10 órdenes piloto manualmente, lo cual es operable.

## Próximo paso
Pasar a `bmad-bmm-dev-story` en **chat limpio** con esta historia. Empezar por AC1+AC2+AC3 (backend) → AC4+AC5 (UI) → backfill → smoke con Noel.
