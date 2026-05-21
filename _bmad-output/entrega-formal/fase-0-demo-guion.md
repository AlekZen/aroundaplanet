![AroundaPlanet](/images/aroundaplanet-logo.png)

# Guión de Demo Fase 0 — AroundaPlanet

**Documento:** entrega-formal/fase-0-demo-guion
**Versión:** 1.0
**Fecha:** 2026-05-20
**Audiencia:** Noel + Paloma + champions
**Duración objetivo:** 10 minutos
**Formato:** screencast Loom (o equivalente) con voz en off

> Este documento es el **guion para grabar la demo**, no el video. La grabación es operativa Alek (o quien grabe). Sigue el orden literal de pantallas y los bullet points por sección. No es transcripción palabra por palabra — son los puntos a cubrir con voz natural.

---

## Antes de grabar — checklist técnico

- [ ] Browser limpio (Chrome incógnito recomendado): historia limpia, sin tabs extras.
- [ ] Resolución 1440×900 (estándar para que Loom no aplique downscale).
- [ ] Cuenta de **superadmin Alek** logueada en una pestaña.
- [ ] Cuenta de **agente piloto** (Felipe Rubio o Paloma como agente) en otra pestaña.
- [ ] Cuenta de **cliente piloto** (Felipe Rubio cliente o cuenta test) en otra pestaña.
- [ ] Loom configurado: cámara mini esquina inferior derecha, audio claro.
- [ ] **5 viajes piloto disponibles**: VUELTA AL MUNDO 2026, ASIA MAYO 2026, COLOMBIA MAYO 2026 ORIGINAL, EUROPA SEPTIEMBRE 2026, CHEPE ENERO 2026.

---

## Orden literal de pantallas (10 secciones, ~1 min cada una)

### Sección 1 — Apertura (1 min)

**Pantalla:** `/` landing pública

**Decir:**
- "Hola Noel, esta es la entrega formal de Fase 0 de AroundaPlanet."
- "Lo que vas a ver es lo que pasó de WhatsApp + hojas sueltas a una plataforma operativa con sync bidireccional con Odoo."
- "10 minutos. Cubre los 6 roles (cliente, agente, admin, director, superadmin, público) y los 3 entregables documentales: contrato, cotización y recibo."

**Acción:** mostrar landing, hacer hover en el navbar para que se vea el logo nuevo.

---

### Sección 2 — Identidad visual cerrada (45 s)

**Pantallas:**
- `/` (logo navbar)
- `/login` (logo hero)
- Compartir URL en WhatsApp para ver OG preview.

**Decir:**
- "El logo oficial está integrado en los 6 layouts."
- "También en favicon, PWA icons, y la imagen OpenGraph que aparece cuando alguien comparte el link en WhatsApp."

**Acción:** abrir WhatsApp web en otra pestaña, pegar URL prod, mostrar preview con logo verde sobre fondo marca.

---

### Sección 3 — Flujo cliente: registrar abono (1.5 min)

**Pantalla:** `/client/my-trips` (logueado como cliente piloto)

**Decir:**
- "El cliente entra a Mis Viajes, ve su barra de progreso de pago."
- "Para registrar un abono nuevo: toca el botón en la tarjeta del viaje, sube el comprobante del banco."
- "El sistema lee el monto automáticamente con IA (Gemini OCR) y rellena el formulario."
- "El cliente confirma y queda **En revisión**."

**Acción:**
1. Click **Registrar Otro Pago** en VUELTA AL MUNDO.
2. Subir un PNG/PDF de comprobante (preparar uno demo antes de grabar).
3. Mostrar el OCR rellenando el monto.
4. Click **Registrar Pago**.
5. Confirmar que aparece "En revisión" en la tarjeta.

---

### Sección 4 — Flujo admin: verificación (1.5 min)

**Pantalla:** `/admin/verification` (cambiar a pestaña con superadmin Alek)

**Decir:**
- "Paloma ve la cola de verificación. Cada tarjeta tiene cliente, agente, monto, OCR y comprobante."
- "Confirma contra el banco, toca Aprobar."
- "El sistema hace 3 cosas atómicas:"
  - "Marca el pago como verified en Firestore."
  - "Empuja a Odoo como account.payment en draft (nunca posted automático)."
  - "Si la orden tiene contrato y agente, activa la visibilidad del agente y el cliente automáticamente."

**Acción:**
1. Localizar el pago recién creado en la sección anterior.
2. Hacer click en la tarjeta para ver detalle.
3. Mostrar el comprobante OCR.
4. Click **Aprobar**.
5. Esperar ~10s y mostrar el badge `Synced Odoo #N · Bank` apareciendo.

---

### Sección 5 — Recibo PDF formal (1 min)

**Pantalla:** `/admin/orders/[orderId]` del pago recién verificado

**Decir:**
- "Una vez verificado, se genera el recibo PDF formal de AroundaPlanet."
- "Esto es nuevo: antes el botón 'Ver recibo' solo abría la captura del banco. Ahora hay dos cosas distinguibles."
- "El **Recibo PDF** tiene el membrete oficial, monto en cifras y letras, saldo acumulado del cliente. Es lo que se le manda oficialmente."
- "El **comprobante bancario** sigue accesible — es la captura que subió el cliente."

**Acción:**
1. Bajar al card de Pagos.
2. Click en **Recibo PDF** del pago recién verificado.
3. Mostrar el PDF: logo blanco, "RECIBO DE PAGO", monto en letras, saldo pendiente.

---

### Sección 6 — Visibilidad agente (1.5 min)

**Pantalla:** `/agent/clients` (cambiar a pestaña agente piloto)

**Decir:**
- "El agente entra a Mis Clientes y ve un panel arriba — 'Recibos verificados' — con todos sus pagos aprobados."
- "Por cada uno, dos botones: el Recibo PDF formal (verde) y el comprobante bancario (outline)."
- "Si el agente filtra a 'Por Cliente' y expande un cliente, también puede ver el contrato del viaje desde ahí mismo."

**Acción:**
1. Mostrar el panel "Recibos verificados" arriba.
2. Cambiar tab a "Por Cliente".
3. Expandir un cliente con orden + contrato + pagos.
4. Mostrar la columna "Acciones" con `Ver contrato` + `Recibo PDF`.
5. Si hay múltiples pagos, mostrar el Popover `Recibos PDF (N)` con lista.

---

### Sección 7 — "Sin agente" vista batch (1 min)

**Pantalla:** `/admin/orders/sin-agente` (volver a superadmin Alek)

**Decir:**
- "Caso operativo recurrente: una orden viene de Odoo con team_id vacío o un agente que no está mapeado en Firebase. El pago verificado queda invisible para ese agente."
- "Vista nueva para resolverlo: Sin agente en el sidebar."
- "Tabla ordenada por prioridad — primero las que ya tienen contrato o pagos verificados. Paloma asigna agente desde el dropdown inline."
- "El sistema hace backfill automático: actualiza la orden, denormaliza agentId en todos los pagos verified de esa orden, comparte el contrato con ese agente, y registra audit log."

**Acción:**
1. Click "Sin agente" en sidebar.
2. Mostrar tabla con prioridades visuales.
3. Asignar un agente a una orden desde el dropdown.
4. Confirmar toast "Asignado a {agente} · N pagos actualizados".

---

### Sección 8 — Sync bidireccional Odoo (1 min)

**Pantalla:** `/admin/payments/sync-console`

**Decir:**
- "Vista del sync bidireccional. El pago verificado en la sección anterior ya está en Odoo como account.payment draft."
- "El polling cada 15 min trae de regreso ediciones que hagan en Odoo (memo, monto, fecha)."
- "Si alguien edita el mismo pago en ambos lados al mismo tiempo, el sistema detecta el conflicto LWW y lo registra para revisión."
- "Webhook fast-path Odoo está live — con la Automation Rule activada en Studio (paso operativo Paloma), las ediciones se reflejan en menos de 30s."

**Acción:**
1. Mostrar cursores de pull (última corrida).
2. Mostrar Cola Push + Conflictos + Alertas.
3. Mencionar custom fields Odoo (x_firebase_payment_id) sin abrir Odoo.

---

### Sección 9 — Documentación accesible (45 s)

**Pantalla:** `/admin/manual`

**Decir:**
- "Cada rol tiene su manual accesible dentro de la app — siempre actualizado, incluye screenshots reales."
- "Admin, agente, cliente. Versiones 1.1 con todas las secciones nuevas (Sin agente, Recibos PDF, plazo 3-4 días hábiles)."

**Acción:**
1. Mostrar `/admin/manual` con scroll rápido.
2. Cambiar a `/agent/manual` (cuenta agente).
3. Mencionar `/client/manual`.

---

### Sección 10 — Cierre + siguiente paso (45 s)

**Pantalla:** `_bmad-output/entrega-formal/fase-0-entregables.md` (abrir en editor o vista web)

**Decir:**
- "Lo que viste cubre el alcance literal del convenio v4.0 firmado el 24 de febrero, más el over-delivery de Epic 9 y Story 10.6."
- "Acompaño esta demo con el documento de entrega formal y la propuesta de Fase 1 con 14 iniciativas identificadas durante el smoke."
- "Te mando todo por WhatsApp / email para revisión. Cuando me confirmes el acuse, agendamos la conversación de Fase 1."
- "Gracias por la confianza Noel. Quedo atento."

**Acción:** mostrar el `fase-0-entregables.md` apartado 6 checklist con los criterios ya cerrados marcados ☑.

---

## Tips de grabación

- **Habla pausado**. Los videos rápidos cansan; 10 min con voz tranquila se digieren mejor.
- **Pausa de 1s** entre secciones para edición posterior si hace falta.
- **No reportes bugs ni "esto está en progreso"**. Si algo no se ve, pausa, fuerza el dato, y graba esa sección de nuevo.
- **Mostrar el cursor lento**. No hagas zoom out / in rápido — desorienta.
- **Cierra con WhatsApp listo**. Después de grabar, envía el link de Loom + los 3 documentos del paquete:
  1. `_bmad-output/entrega-formal/fase-0-entregables.md`
  2. `_bmad-output/entrega-formal/propuesta-fase-1.md`
  3. Este guion como contexto interno (NO se envía a Noel).

---

## Checklist post-grabación

- [ ] Video subido a Loom (workspace TransformIA).
- [ ] Privacidad: link compartible solo con quienes tengan el URL.
- [ ] Título: "AroundaPlanet — Entrega Fase 0 (10 min)".
- [ ] Descripción: incluir links a los 2 documentos formales.
- [ ] Mensaje WhatsApp a Noel con link + descripción de 1 párrafo.
- [ ] Mensaje a Paloma con el mismo link + cc a Champions Group.

---

*Guion v1.0 — 2026-05-20 · AroundaPlanet · TransformIA.*
