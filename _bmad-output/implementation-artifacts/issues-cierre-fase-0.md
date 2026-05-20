# Issues reportados durante cierre Fase 0

Registro de issues recibidos del equipo durante el periodo de smoke. Cada issue se clasifica al momento como **F0-blocker** (entra al objetivo), **F0-smoke-finding** (pieza ya implementada que necesita validar/aclarar), **F1-backlog** (va a propuesta Fase 1) o **Operativo** (manual/comunicación, no requiere código).

---

## NS-01 — Smoke: Noel registra pago de prueba como Ruth

- **Reportado por:** Noel via WhatsApp (~14:37)
- **Rol:** Cliente (probando como Ruth Cerda)
- **Pantalla:** Modal "Pago registrado" tras submit
- **Contexto:** Noel registró un pago para Ruth para probar el flujo de admin rechazo (puso un pago "falso de otro cliente" para no aceptarlo).
- **Observación:** Modal "Pago registrado" se ve correcto, copy "3 a 4 días hábiles" presente — coincide con fix BUG-H de sesión 45.
- **Clasificación:** 🟡 **F0-smoke-finding (positivo)** — confirma que el modal de pago registrado funciona bien tras el batch sesión 45.
- **Acción:** ninguna. Documentar como evidencia de smoke OK del flujo de registro de pago cliente.

---

## NS-02 — PDF formal de recibo de pago con membrete, monto y saldo actualizado

- **Reportado por:** Noel via WhatsApp (~14:38)
- **Rol:** Agente
- **Pantalla:** `/agent/clients` panel "Recibos verificados"
- **Frase exacta:** *"Lo que veo que en el botón ver recibo solo aparece una imagen de la captura del banco. No como tal el PDF con pago actualizado"*
- **Análisis:**
  - El "Ver recibo" actual abre el `receiptUrl` del pago = la imagen/PDF que el cliente o agente subió al registrar el pago (captura del banco).
  - Lo que se requiere = PDF generado por la plataforma con membrete AroundaPlanet (logo + datos de la agencia), datos del cliente y del viaje, monto del abono validado, fecha de verificación, **saldo acumulado actualizado** y referencia interna del recibo.
- **Clasificación:** 🔴 **F0-blocker (incluido en el cierre)**.
- **Alcance de la implementación:**
  1. Template `src/lib/pdf/templates/PaymentReceiptDocument.tsx` con `@react-pdf/renderer`. Logo en header (mismo asset `public/images/aroundaplanet-logo.png`), datos de la agencia, datos del cliente (nombre, teléfono, viaje), bloque "Abono recibido" (monto del pago + fecha + método + referencia bancaria), bloque "Resumen del expediente" (total contratado, cobrado acumulado incluyendo este pago, saldo pendiente), pie con número de recibo (`R-{paymentId-corto}-{version}`) y firma de la administración.
  2. Endpoint `GET /api/payments/[paymentId]/receipt-pdf` (server, runtime nodejs):
     - Auth requerida.
     - Permisos: cliente dueño (`payment.clientId === uid` o `payment.registeredBy === uid`), agente asignado (`payment.agentId === claims.agentId`), admin/superadmin.
     - Solo genera si `payment.status === 'verified'`. Si no, retorna 409 `RECEIPT_NOT_AVAILABLE`.
     - Generación on-demand: render PDF + buffer → response `application/pdf` con `Content-Disposition: inline; filename="recibo-{ref}.pdf"`. No persistir en Storage por ahora (regeneración es rápida y evita stale data del saldo). Re-evaluar si genera carga.
  3. UI:
     - `/agent/clients` `AgentVerifiedPaymentsPanel`: botón **"Descargar recibo PDF"** junto al actual "Ver comprobante" (renombrado para distinguir). El comprobante bancario sigue accesible.
     - `/client/my-trips` o `/client/contracts`: mismo botón en cada pago verified del cliente.
     - `/admin/orders/[orderId]` card Pagos: link "Recibo PDF" por cada pago verified.
- **Pruebas obligatorias:**
  - Vitest del template (renderiza sin errores, saldo se calcula correcto sumando todos los pagos verified <= fecha del recibo).
  - Vitest del endpoint (auth, permisos, estado verified).
  - Browser smoke: descargar PDF como agente, como cliente, como admin y validar visualmente que el logo, datos, monto y saldo son correctos. Capturar como evidencia en `smoke-cierre-fase-0/ns-02-receipt-pdf/`.
- **Acción inmediata:** comunicar a Noel que el PDF se incluye en este cierre, esperar a que la otra ventana termine Batch A para empujarlo como siguiente batch.

---

## NS-03 — Link "Ver contrato" inline en `/agent/clients` y "Recibo PDF" en cada pago

- **Reportado por:** Noel via WhatsApp (~14:39)
- **Rol:** Agente
- **Pantalla:** `/agent/clients` (vista summary + tabla órdenes del cliente)
- **Frase exacta:** *"En esta pantalla no veo donde descargar contrato o fichas de pago pdf"*
- **Análisis:** la funcionalidad de contratos existe en `/agent/contracts` pero no es descubrible desde donde el agente la busca. La ficha PDF se cubre con NS-02.
- **Clasificación:** 🔴 **F0-blocker (incluido en el cierre)** — gap UX que se cierra ahora.
- **Alcance de la implementación:**
  1. En `GroupedByClientView.tsx` (tabla desktop + cards mobile) agregar una columna/área extra por fila de orden con dos acciones cuando aplique:
     - **"Ver contrato"** visible si `order.contractId != null`. Abre el PDF del contrato directamente vía `GET /api/contracts/{contractId}/url` (endpoint existente) en nueva pestaña.
     - **"Recibo PDF"** visible si esa orden tiene al menos un pago verified del agente. Abre el listado de recibos PDF de esa orden o el más reciente directamente.
  2. La data de `contractId` debe venir en el response del endpoint que alimenta `/agent/clients` para no hacer fetch extra. Si no viene, enriquecer en el endpoint correspondiente.
  3. Tooltip o estado disabled visible cuando la orden no tiene contrato ("Contrato pendiente") para que el agente sepa que falta paso de admin.
- **Pruebas obligatorias:**
  - Vitest del endpoint (incluye `contractId` por orden cuando existe).
  - Browser smoke: como agente, navegar a `/agent/clients`, expandir un cliente con contrato + pago verified, confirmar que ambos links abren PDFs correctos. Captura en `smoke-cierre-fase-0/ns-03-inline-links/`.
- **Acción inmediata:** comunicar a Noel que el link directo se agrega en esta misma sesión de cierre. Implementar después de Batch A logo (la otra ventana puede tomarlo como Batch A-extra o como batch independiente).

---

## Resumen de clasificación

| Issue | Clasificación | Bloquea cierre | Acción |
|---|---|---|---|
| NS-01 | 🟡 Smoke positivo | No | Documentar como evidencia |
| NS-02 | ✅ Cerrado | — | Template + endpoint + UI desplegados (commit pendiente de push). Smoke en `smoke-cierre-fase-0/ns-02-receipt-pdf/`. |
| NS-03 | 🔴 F0-blocker | Sí | Implementar links inline contrato + recibo en `/agent/clients` |

**Estado:** NS-02 y NS-03 se incorporan al cierre como batches subsecuentes. NS-01 queda como evidencia de smoke OK. La ejecución se hace después de cerrar Batch A (logo en layouts) para mantener el orden de dependencias (logo es prerrequisito visual del PDF).
