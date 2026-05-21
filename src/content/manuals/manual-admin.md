# Manual del Admin — AroundaPlanet

> Guía operativa para el equipo administrativo de AroundaPlanet (Paloma y back office). Pensada para abrirse desde la laptop. Organizada por flujo de trabajo, no por menú.

---

## Bienvenida

Esta plataforma sustituye los WhatsApps, los correos sueltos y las hojas de cálculo cruzadas entre el equipo de Ocotlán y los agentes freelance. Todo lo que aquí queda registrado se refleja en Odoo (cuando corresponde) y todo lo que pasa en Odoo se refleja aquí (cuando hay enlace). Tu rol es el más sensible del sistema: tú verificas que cada pago, cada contrato y cada documento esté en orden antes de que se "vaya" al ERP.

> **Antes de cualquier cosa, lee la sección [Restricciones firmes](#restricciones-firmes-leer-antes-de-cualquier-cambio)**. Hay cosas que el sistema no hace de forma automática a propósito, y otras que **nunca** debes hacer aunque la pantalla te lo permita técnicamente.

---

## Tu mañana típica

Una rutina sana de 15–30 minutos al inicio del día:

1. **Abre la cola de verificación** (`Verificación` en el sidebar). Cualquier pago marcado en amarillo lleva esperando atención. Estos son los más críticos: cliente subió comprobante y espera confirmación.
2. **Revisa la consola de sync**. Si hay conflictos LWW o alertas rojas, atiéndelas antes de que se acumulen. Un conflicto sin resolver bloquea el badge "Synced Odoo".
3. **Mira el panel de órdenes**. Filtra por las recién creadas para asegurar que el agente asignado, el viaje y los datos del contrato cuadran.
4. **Pasa por leads y cotizaciones**. Cualquier lead recién entrado por `/cotizar` o por landing debe llegar al agente correspondiente o a Noel para reparto.
5. **Cierra con un vistazo al backoffice de Documents** si Odoo viene cargado (suele pasar tras fin de mes), por si hay carpetas duplicadas o expedientes huérfanos.

---

## Verificación de pagos — el flujo más crítico

`Verificación` en el sidebar → `/admin/verification`

![Cola de verificación](/manuals/admin/01-verification-queue.png)

Cada tarjeta representa un comprobante que el cliente o el agente subió. Verás:

- **Cliente y agente**: ambos denormalizados; teléfono con click-to-copy.
- **Monto y método**: tal como lo capturó quien registró el pago.
- **OCR (Gemini)**: confianza estimada que la cifra leída del comprobante corresponde al monto declarado.
- **Estado de sync**: badge `Sincronizando…` mientras el push a Odoo está en curso, badge `Synced Odoo #N · Bank` cuando ya cerró el ciclo.

### Cómo aprobar un pago

1. Da clic en la tarjeta. Se abre el detalle con el PDF/imagen del comprobante.
2. Verifica que **monto, fecha, cliente, agente y método** coinciden con el comprobante.
3. Si el viaje aplica, abre el link "Abrir detalle de orden →" para confirmar que el pago corresponde a la orden esperada.
4. Toca **Aprobar**. Aparece un modal de confirmación; léelo antes de aceptar.
5. El sistema:
   - Marca el pago como `verified` en Firestore.
   - Empuja a Odoo `account.payment` con estado `draft` (NUNCA `posted` automático).
   - Sube el comprobante a `ir.attachment` con tag `aroundaplanet_comprobante` y lo enlaza al payment.
   - Si todo cierra, aparece el badge `Synced Odoo #N`.

> **El badge "Sincronizando…" debería desaparecer en menos de 30 segundos**. Si lleva más de 5 minutos, abre la consola de sync para ver qué pasa antes de aprobar más pagos.

### Cómo rechazar un pago

1. Abre la tarjeta y toca **Rechazar**.
2. Escribe el motivo (queda guardado y se nota al agente/cliente vía WhatsApp/email).
3. Confirma. El pago queda `rejected`, no se sincroniza con Odoo, y desaparece de la cola.

---

## Órdenes y cotizaciones

### Cotizaciones — `/admin/quotations`

![Cotizaciones](/manuals/admin/04-quotations.png)

Aquí caen los leads de `/cotizar` (formulario público) y los leads internos que un agente o tú capturen. Filtra por estado, viaje o agente. Cada cotización puede generar un PDF de cotización vía el botón **Generar PDF**, y promoverse a orden cuando el cliente acepta.

### Órdenes — `/admin/orders`

![Lista de órdenes](/manuals/admin/02-orders-list.png)

Cada fila es una orden (mirror de `sale.order` de Odoo o nativa de la plataforma). En el detalle verás:

![Detalle de orden](/manuals/admin/03-order-detail.png)

- **Card Pagos**: los pagos vinculados a esta orden, su estado y badge de sync.
- **Card Contrato**: el contrato asignado (si lo hay) con botones para asignar, generar PDF, compartir con cliente/agente, y regenerar.
- **Toggle visibilidad**: controla si el cliente y/o el agente pueden ver el contrato en su portal.
- **Columna "Recibo PDF"** en la tabla de pagos: solo aparece el link cuando el pago está `verified`. Al tocarlo se abre el [recibo formal de pago](#recibo-pdf-formal-de-pago) generado por la plataforma.

> **Si una orden viene de Odoo y no muestra el agente correcto**, casi siempre es porque el `team_id` (columna *Agente* en Odoo) está vacío o apunta a "REDES". Edítalo en Odoo y vuelve a sincronizar la orden — la plataforma no inventa agentes.

### Órdenes sin agente asignado — `/admin/orders/sin-agente`

![Vista batch de órdenes sin agente](/manuals/admin/12-orders-sin-agente.png)

Sidebar **Operación diaria → Sin agente** (ícono triángulo amarillo). Vista batch para resolver el caso recurrente: una orden viene de Odoo con `team_id` vacío o no mapeado y los pagos verificados quedan sin denormalizar el `agentId`. Resultado visible para el equipo: el agente no ve sus recibos en `/agent/clients`.

Lo que muestra:

- Tabla con todas las órdenes que tienen `agentId === null`.
- **Ordenadas por prioridad**: primero las que ya tienen contrato firmado o pagos verificados (más urgentes), luego el resto.
- Cada fila tiene un **dropdown** con la lista de agentes activos para asignar inline.

Lo que hace el sistema al asignar agente desde el dropdown:

1. Escribe `agentId` en la orden.
2. Si la orden tiene `contractId`, actualiza `contracts/{contractId}.agentId` y activa `sharedWithAgent`.
3. **Backfill on-demand**: re-procesa todos los pagos `verified` de esa orden y denormaliza `agentId` en cada uno (para que aparezcan en `/agent/clients` panel "Recibos verificados").
4. Escribe un audit log con `action: 'order.assignAgent'` + `paymentsBackfilled: N`.

Aparece un toast `Asignado a {agente} · N pagos actualizados`. La fila desaparece de la tabla.

> **No edites `agentId` directamente desde la consola Firestore** ni desde Odoo. Esta vista hace además el auto-share del contrato y el backfill de pagos. Saltarse este endpoint deja datos inconsistentes.

> **El mapping `team_id` Odoo → `agentId` Firebase es manual en Fase 0**. La automatización (linkedUserId en odooAgents) queda diferida a Fase 1.

---

## Viajes y datos del contrato

`Viajes` en el sidebar → `/admin/trips`

![Lista de viajes](/manuals/admin/05-trips-list.png)

Cada viaje viene de Odoo (`product.template`). En la lista verás cuántas ventas tiene asociadas, su precio base y si ya tiene los datos del contrato configurados.

### Configurar datos contractuales

Abre cualquier viaje → desplázate a la sección **Datos del contrato**:

![Datos del contrato](/manuals/admin/06-trip-contract-fields.png)

Aquí defines, por viaje, los campos que el PDF del contrato necesita:

- **Nombre del destino en el contrato** (encabezado del PDF).
- **Ítems incluidos** (vuelos, hospedaje, traslados, etc.). Mínimo 1 para poder generar.
- **Cláusulas opcionales específicas del viaje**.
- **Política de cancelación**, **anticipo mínimo**, **fechas**, etc.

Los cambios se **autoguardan**. No hay botón "Guardar".

> **5 viajes piloto ya tienen estos datos configurados** (VUELTA AL MUNDO 2026, ASIA MAYO 2026, COLOMBIA MAYO 2026 ORIGINAL, EUROPA SEP 2026, CHEPE ENERO 2026). Para el resto, al intentar generar un contrato aparecerá un banner rojo. Configúralos aquí antes de generar.

---

## Documents — backoffice de archivos Odoo

`Documentos` en el sidebar → `/admin/documents`

![Documents backoffice](/manuals/admin/07-documents-backoffice.png)

Es una vista de los `documents.document` de Odoo. Sirve para auditar qué expedientes hay, cuáles tienen el tag `aroundaplanet_comprobante` y cuáles están en carpetas duplicadas.

### Dedup de carpetas — `/admin/odoo-folders/dedup`

![Folder dedup](/manuals/admin/08-folder-dedup.png)

Cuando alguien crea una carpeta nueva con un nombre casi igual a una existente (`ASIA MAYO` vs `ASIA MAYO1`, `COLOMBIA ORIGINAL` vs `VUELO DESDE GDL`), la plataforma las detecta y agrupa por cluster. Aquí marcas:

- **Canónica**: la carpeta "buena" (tag `folder-canonico`).
- **Duplicada**: la que se debería evitar (tag `folder-duplicado`).

> **NUNCA muevas documentos entre carpetas ni hagas `unlink` desde aquí**. El sistema sólo aplica tags planos sobre las carpetas. Los archivos individuales no se tocan.

---

## Sync con Odoo

### Consola de sync — `/admin/payments/sync-console`

![Consola de sync](/manuals/admin/09-sync-console.png)

Aquí vives los detalles del sync bidireccional de pagos:

- **Cursores de pull**: cuándo fue la última corrida (cada 15 min vía Cloud Scheduler).
- **Alertas** (`paymentAlerts/`): pagos que el pull detectó modificados en Odoo y necesitan tu mirada.
- **Conflictos LWW** (`paymentConflicts/`): el mismo pago se editó en ambos lados — el último timestamp gana, pero queda el registro para auditoría.
- **Retries**: pagos cuyo push a Odoo falló y la plataforma reintenta.

### Reconciliación — `/admin/payments/reconciliation`

![Reconciliación](/manuals/admin/10-reconciliation.png)

Vista de pagos *huérfanos*: existen en Firestore pero no en Odoo, o viceversa. Permite enlazarlos manualmente (acción "Marcar como canónico" o "Descartar como falso match").

---

## Recibo PDF formal de pago

A partir de mayo 2026 cada pago `verified` tiene **dos** documentos distinguibles:

- **Comprobante bancario** (`receiptUrl`): la imagen o PDF que el cliente o agente subió al banco — la captura del depósito/transferencia que se usó para verificar.
- **Recibo PDF formal**: documento generado por la plataforma con membrete AroundaPlanet (logo + datos fiscales de la agencia), monto del abono en cifras + letras, fecha de verificación, método/banco/referencia, y resumen del expediente (total contratado + cobrado acumulado a la fecha del pago + saldo pendiente).

![Recibo PDF formal con membrete y saldo acumulado](/manuals/admin/13-recibo-pdf.png)

### Cómo descargar el recibo

Desde `/admin/orders/[orderId]`, card de Pagos, columna **Recibo PDF**:

- Si el pago está `verified` → link "Recibo PDF" visible. Toca para abrir en pestaña nueva.
- Si el pago está `pending_verification` / `rejected` / `info_requested` → guion (`—`). El recibo solo se genera tras aprobar.

El endpoint es `GET /api/payments/[paymentId]/receipt-pdf`. Genera el PDF on-demand (sin Storage, ~500 ms cold path). Cache cliente 5 min — si modificas un pago, el recibo refleja los datos nuevos en la siguiente descarga.

### Quién puede descargarlo

- **Admin / superadmin**: siempre.
- **Agente**: solo si `payment.agentId === claims.agentId` (su propio pago).
- **Cliente**: solo si `payment.clientId === uid` o `payment.registeredBy === uid` (su propio pago).
- Si no cumple ninguno → HTTP 403.

> **Antes de marcar un pago como verified**, confirma con calma todos los datos. El recibo formal **es lo que el cliente y el agente van a usar como comprobante oficial** — un error después de aprobar implica generar V2 manualmente (no automatizado en Fase 0).

> **El recibo formal NO sustituye el CFDI fiscal**. Es el comprobante interno del abono contra el viaje. La factura SAT, cuando aplique, sigue saliendo desde Odoo.

---

## Gestión de usuarios — Superadmin

`Usuarios` en el sidebar → `/superadmin/users` (sólo visible con rol superadmin)

![Gestión de usuarios](/manuals/admin/11-superadmin-users.png)

Asigna roles (cliente, agente, admin, director, superadmin). Un mismo usuario puede tener varios — Alek por ejemplo es admin + superadmin + agente. Cuando asignas el rol "agente", el sistema bootstrappea automáticamente el doc `agents/{agentId}` para que las Firestore Security Rules dejen escribir.

> **Cuidado con `revokeRefreshTokens` en el detalle de usuario**: si lo aplicas sobre tu propia cuenta, te tira la sesión. El sistema te avisa, pero confirma siempre con un segundo par de ojos.

---

## Restricciones firmes (LEER ANTES DE CUALQUIER CAMBIO)

> Estas reglas no son sugerencias. Romperlas tiene consecuencias reales sobre datos de producción y/o sobre Odoo.

1. **NUNCA `unlink` (borrar) en Odoo**, ni manual ni desde la plataforma. Cancelar (`state='cancel'`) o renombrar (`_CLEANED_`) sí; borrar **no**.
2. **NUNCA `action_post` automático** sobre un `account.payment`. La plataforma lo deja en `draft`. Posteo manual lo hace Paloma desde Odoo después de verificar contablemente.
3. **NO toques los 200 pagos legacy** anteriores a Epic 9. Sólo se enlazan vía `odooPaymentId`. No los modifiques, no los re-sincronices, no los actives.
4. **NO muevas documentos entre carpetas** ni renombres carpetas Odoo. El dedup usa **tags planos** (`folder-canonico` / `folder-duplicado`), nunca `shortcut_document_id` ni `parent_folder_id`.
5. **NO crees comprobantes PDF maestro**. Cada pago recibe su propio `ir.attachment` individual con tag `aroundaplanet_comprobante`. Nada de expedientes concentradores.
6. **NO retries manuales sin `force=true`** sobre attachments legacy enlazados (`legacy_linked`). El endpoint los bloquea para evitar duplicar el PDF maestro de Paloma.
7. **Cuando dudes, pregúntale a Alek antes de ejecutar**. Especialmente si vas a tocar `appConfig/`, custom fields de Odoo (`x_firebase_*`, `x_canonical_payment_id`), o cualquier endpoint `/api/odoo/*`.

---

## FAQ operativa

### ¿Qué hago si Odoo está caído?
La plataforma sigue funcionando: clientes registran pagos, agentes capturan leads. El push a Odoo se reintenta automáticamente con backoff exponencial. Cuando Odoo vuelve, los pagos pendientes aparecen como `Sincronizando…` y el ciclo cierra solo. **No fuerces nada manualmente.**

### ¿Cómo cancelo un pago ya verificado?
No hay botón "deshacer verificación". Si fue error:
1. Anótalo en el campo de notas del pago.
2. Avísale a Paloma para que cancele el `account.payment` en Odoo (`state='cancel'`).
3. Si necesitas registrar el reembolso, crea un pago nuevo con monto negativo y nota explícita.

### ¿Cómo reasigno un cliente entre agentes?
Edita la orden (`/admin/orders/[orderId]`) y cambia `agentId`. Esto actualiza el mirror en Firestore. **Pero**: si la orden viene de Odoo, también hay que actualizar `team_id` en `sale.order` en Odoo, o el próximo pull lo revertirá. Coordínalo con Paloma.

### ¿Cómo regenero un contrato si el PDF salió mal?
En el detalle de la orden, Card Contrato → botón **Regenerar PDF**. Esto genera una nueva versión usando los datos actuales del viaje (incluyendo lo que hayas editado en `Datos del contrato`). La firma SAT no aplica en Fase 0 — el "aceptado" del cliente es evidencia, no firma fiscal.

### ¿Qué hago si un pago queda en conflicto LWW?
Abre `/admin/payments/sync-console`, busca el conflicto. Verás los dos snapshots (Firestore y Odoo) lado a lado con timestamps. La plataforma ya aplicó el más reciente. Si la decisión automática es incorrecta, edita manualmente el campo en el lado correcto y confirma.

### ¿Qué hago si veo el badge "Sincronizando…" más de 5 minutos?
1. Mira la consola de sync por errores recientes.
2. Confirma que el Cloud Scheduler `odoo-payments-pull` está enabled en GCP us-east4.
3. Si está enabled y siguen colgados, avisa a Alek con el `firestoreId` del pago.

### ¿Qué hago si un lead nuevo de `/cotizar` no llegó a ningún agente?
La asignación auto está en backlog (Fase 1). Por ahora todos los leads sin agente caen en `/admin/leads`. Reasígnalos manualmente desde ahí.

### ¿Cómo agrego un viaje nuevo al catálogo?
Se crea primero en Odoo como `product.template` con el tipo correcto. El sync por polling lo levanta en menos de 15 minutos. Luego entras a `/admin/trips/[tripId]`, lo marcas como **publicado** y configuras los **datos del contrato**.

---

## Atajos útiles

- **Cambiar de rol**: si tienes varios roles (admin + agente, por ejemplo), usa el `RoleSwitcher` al pie del sidebar.
- **Tu perfil**: `/admin/profile`. Edita nombre, foto, datos de contacto.
- **Volver al manual**: siempre accesible desde el sidebar → `Ayuda y manual`.

---

> **Última actualización**: 2026-05-20. Si encuentras un flujo desactualizado, avísale a Alek por WhatsApp. Este manual se actualiza por cada cambio relevante en la plataforma.
>
> **Cambios recientes** (Story 10.6 + NS-02/NS-03 + identidad visual):
> - Vista batch `/admin/orders/sin-agente` con dropdown inline + backfill automático de pagos verified.
> - Recibo PDF formal de pago (endpoint `GET /api/payments/[id]/receipt-pdf`) distinto del comprobante bancario que sube el cliente.
> - Logo oficial AroundaPlanet integrado en headers, PDFs y PWA.
