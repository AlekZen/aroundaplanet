# Manual de administración — Pagos y sincronización con Odoo

Este manual está hecho para Paloma y el equipo administrativo. Explica cómo viaja un pago desde que el agente lo captura hasta que queda contabilizado en Odoo, qué pantalla usar en cada momento y qué hacer cuando algo se ve raro.

> Importante: en este manual le decimos **"el sistema interno"** a la plataforma de AroundaPlanet (lo que ves en el navegador) y **"Odoo contable"** o simplemente **Odoo** al sistema de contabilidad donde Paloma postea los pagos. Son dos sistemas distintos que se hablan entre sí automáticamente.

---

## 1. Cómo viaja un pago, de principio a fin

Un pago pasa por cuatro etapas. La mayoría avanza sola; solo dos requieren intervención humana (verificar y postear).

```
  AGENTE                ADMIN (TÚ)              SISTEMA              PALOMA EN ODOO
  ──────                ───────────              ────────              ──────────────

  1. Captura     →      2. Verifica       →     3. Empuja a    →     4. Postea
     pago en el            comprobante,            Odoo como             el pago
     portal y              monto, cliente          BORRADOR              (action_post)
     sube                  y aprueba o             automático
     comprobante           rechaza                 (sin tocar
                                                   contabilidad)
```

**Detalle por etapa:**

1. **Captura (agente).** El agente registra un pago de su cliente en el portal del agente y sube la foto del comprobante (transferencia, depósito, etc.). El sistema interno guarda el pago con estado `pendiente`. Aquí no hay nada que hagas tú todavía.

2. **Verificación (tú, en `/admin/verification`).** El pago aparece en la cola de **Verificación de pagos**. Tu trabajo es:
   - Abrir el detalle del pago y comparar lo que dice el comprobante contra lo que capturó el agente (monto, fecha, banco, referencia).
   - Si todo cuadra, aprobar. Si no cuadra, rechazar y el agente recibe notificación para corregir.
   - **Importante:** cuando apruebas, el sistema cambia el estado a `verificado` y automáticamente empuja el pago a Odoo (siguiente paso). Tú no haces nada manual para esto.

3. **Empuje automático a Odoo (sistema, sin intervención).** Apenas marcas `verificado`, el sistema interno crea el pago en Odoo contable como **borrador (draft)**. El pago queda visible en Odoo pero **NO afecta tu contabilidad todavía** (no está posteado). Esto se hace para que tú lo veas en Odoo, lo revises, y decidas cuándo postearlo formalmente.

4. **Posteo manual en Odoo (Paloma).** Paloma entra a Odoo contable, encuentra los pagos en estado `borrador`, hace su validación contable (¿cuadra con el estado de cuenta del banco?, ¿está bien la cuenta contable?, ¿el journal correcto?) y le da **Post** en Odoo. **Esto lo hace Paloma manualmente en Odoo, NO desde nuestro sistema interno.** La plataforma nunca postea automático.

> Regla de oro: **el sistema interno nunca postea, nunca borra ni cancela pagos en Odoo, y nunca modifica el estado contable**. Solo crea borradores y mantiene los datos sincronizados.

---

## 2. Cuándo usar cada pantalla

El menú lateral ahora está agrupado para que sea más fácil encontrar cada cosa.

### Operación diaria

#### `/admin/verification` — Verificación de pagos
Es tu pantalla del **día a día**. Aquí llegan todos los pagos que los agentes capturan y que esperan tu visto bueno. Si solo vas a entrar a una pantalla en el día, que sea esta. Apruebas o rechazas; el resto del flujo es automático a partir de aquí.

#### `/admin/leads` — Leads
Solicitudes de cotización y leads de la página pública. No tiene que ver con pagos.

#### `/admin/commissions` — Comisiones
Tablero de comisiones por agente. Para revisar cuánto se le va a pagar a cada agente.

### Sincronización con Odoo

#### `/admin/payments/sync-console` — Consola de Sync
Aquí ves la **salud del puente entre el sistema interno y Odoo**. La usas cuando algo se ve raro: pagos que llevan días sin reflejarse en Odoo, conflictos donde el sistema interno y Odoo dicen cosas distintas del mismo pago, o alertas operativas. Tiene tres pestañas:
- **Cola de push**: pagos verificados que están esperando empujarse a Odoo. Si uno lleva mucho tiempo en la cola, puedes pedir un reintento.
- **Conflictos**: cuando alguien editó el mismo pago en los dos sistemas al mismo tiempo y el sistema no sabe cuál versión es la buena. Tú decides cuál se queda.
- **Alertas**: avisos automáticos cuando algo no se está sincronizando bien.

#### `/admin/payments/reconciliation` — Reconciliación
Para vincular pagos antiguos (capturados antes de que existiera el sync automático, antes de mayo 2026) con sus pagos correspondientes en Odoo. Es trabajo de **una sola vez** sobre el histórico, no del día a día.

#### `/admin/odoo/duplicates` — Duplicados Odoo
Lista de pagos que aparecen **duplicados dentro de Odoo** (no entre sistemas, sino dos veces en Odoo). Para ir limpiando históricamente. También trabajo ocasional, no diario.

#### `/admin/odoo-sync` — Sync Odoo (¡ojo, esta NO es de pagos!)
Esta pantalla es del sincronizador de **viajes y usuarios** entre Odoo y el sistema interno (catálogo de productos, agentes, clientes). **No tiene nada que ver con pagos.** Si lo que buscas es ver cómo va el sync de un pago, es la **Consola de Sync** de arriba, no esta. Mantenemos las dos porque cubren cosas diferentes.

### Catálogo

#### `/admin/trips` y `/admin/documents`
Administración del catálogo de viajes y documentos. Sin relación con pagos.

---

## 3. Glosario

| Término | Qué significa |
|---|---|
| **Sistema interno** | La plataforma AroundaPlanet (lo que estás usando en el navegador). |
| **Odoo contable** | El sistema externo de contabilidad donde Paloma postea los pagos. |
| **Borrador (draft)** | Estado inicial del pago en Odoo. Es visible pero **no afecta contabilidad** hasta que se postea. |
| **Posteado** | Estado final del pago en Odoo después de que Paloma lo valida y le da Post. Ya afecta contabilidad. |
| **Cola de push** | Lista de pagos verificados que el sistema todavía no ha terminado de empujar a Odoo. Normalmente avanza en segundos; si algo tarda más de unos minutos, ahí lo ves. |
| **Sync demorado** | Un pago que lleva más tiempo del normal esperando empujarse a Odoo. Suele resolverse con un reintento. |
| **Conflicto LWW** | "LWW" viene de _Last Write Wins_ (gana el último que escribió). Pasa cuando alguien tocó el mismo pago en los dos sistemas casi al mismo tiempo y el sistema no puede decidir solo cuál versión vale. Tú decides cuál se queda. |
| **Reconciliación** | Vincular un pago del sistema interno con su equivalente en Odoo, sobre todo para pagos viejos que no nacieron sincronizados. |
| **Duplicado interno Odoo** | Un mismo pago que quedó registrado dos veces dentro de Odoo (no entre sistemas). Hay que marcar cuál es el "bueno". |
| **Pago descartado** | Un pago que decidiste **excluir del sync** (por ejemplo, capturas de prueba o duplicados ya conocidos). Sigue existiendo en el sistema interno pero ya no se intenta empujar a Odoo. |
| **Pago legacy** | Pago capturado antes de mayo de 2026, cuando no existía el sync automático. Hay que reconciliarlo manualmente desde la pantalla de **Reconciliación**. |
| **Verificación** | Acción de revisar el comprobante y aprobar (o rechazar) el pago capturado por el agente. |
| **Push** | El sistema interno **empuja** un pago hacia Odoo. |
| **Pull** | El sistema interno **trae** información desde Odoo (por ejemplo, cuando Paloma editó algo en Odoo y queremos reflejarlo aquí). |

---

## 4. Decisiones operativas comunes

### "Un pago lleva días apareciendo como _Sync demorado_, ¿qué hago?"
1. Ve a **Consola de Sync** → pestaña **Cola de push**.
2. Busca el pago por nombre de cliente o monto.
3. Revisa el motivo del retraso (suele aparecer un mensaje técnico).
4. Si no hay nada raro, dale **Reintentar push**. Normalmente se resuelve en segundos.
5. Si después de 2-3 reintentos sigue fallando, anótalo y avísale al equipo técnico.

### "Aparece un conflicto, ¿qué hago?"
1. Ve a **Consola de Sync** → pestaña **Conflictos**.
2. Abre el conflicto. Vas a ver dos columnas: lo que dice el sistema interno y lo que dice Odoo.
3. Compara campo por campo (monto, banco, referencia, fecha).
4. Decide cuál versión es la correcta y elige esa. La otra se descarta.
5. Si dudas, pregúntale a Paloma o al agente que capturó el pago original antes de elegir.

### "¿Cuándo descarto un pago del sync?"
Solo en dos casos:
- Es un **pago de prueba** (un agente capturó algo para probar y se le olvidó borrar).
- Es un **duplicado conocido** (el mismo pago ya está en Odoo con otro registro y verificado).

Nunca descartes un pago real porque "se ve raro". Si dudas, repórtalo.

### "¿Por qué hay pagos antiguos que aparecen sin sincronizar?"
Son **pagos legacy** (capturados antes de mayo 2026). Hay que vincularlos a mano desde la pantalla de **Reconciliación**. Esa pantalla te muestra sugerencias automáticas (cuando el sistema cree que encontró el pago equivalente en Odoo) y tú confirmas o rechazas.

### "Veo el chip _Sincronizando…_ en un pago que ya está verificado hace tiempo"
Es un caso conocido: el pago se aprobó pero todavía no quedó enlazado por su número de Odoo. Ve a la **Consola de Sync**, busca el pago en la **Cola de push** y dale **Reintentar**. Si no aparece en la cola, podría ser un pago legacy que necesita **Reconciliación** manual.

### "Paloma me dice que en Odoo aparece un pago en _borrador_ que ella no quiere postear todavía"
Perfecto, así debe ser. El sistema **siempre** lo deja en borrador. Paloma decide en Odoo cuándo postearlo. No hay que hacer nada del lado del sistema interno.

---

## 5. Lo que la consola NUNCA hace (restricciones firmes)

Para que te quedes tranquila, estas son cosas que el sistema **no puede hacer**, ni por error ni a propósito:

- ❌ **No postea pagos automáticamente en Odoo.** Siempre los deja en borrador. Posteo manual de Paloma es la única vía.
- ❌ **No borra ni cancela pagos en Odoo desde la interfaz.** Si un pago llegó a Odoo, ahí se queda hasta que alguien lo gestione manualmente en Odoo.
- ❌ **No modifica el estado contable** (el campo `state` de Odoo: `draft`, `posted`, `cancelled`). Solo lo lee.
- ❌ **No toca pagos que ya están posteados.** Una vez que Paloma postea un pago, el sistema interno lo respeta tal cual.
- ❌ **No descarta pagos sin confirmación.** Descartar siempre es una decisión manual desde la consola.

Esto significa que **nada de lo que hagas en la Consola de Sync puede romper la contabilidad** ni descuadrar a Paloma. Lo peor que puede pasar es que un pago se quede sin empujarse a Odoo, y eso se resuelve con un reintento o reportándolo al equipo técnico.

---

## 6. ¿A quién aviso si algo se ve mal?

- **Pago verificado que tarda más de 1 hora en aparecer en Odoo**: reintentar desde la Consola de Sync; si tras 3 reintentos sigue fallando, escalar al equipo técnico.
- **Conflicto que no sabes cómo resolver**: pregúntale al agente o a Paloma antes de elegir versión.
- **Pago en Odoo que no aparece en el sistema interno**: avisa al equipo técnico para que lo reconcilien manualmente.
- **Algo se ve raro y no encaja en ninguna pantalla**: documenta con captura de pantalla y compártelo en el canal del equipo.

---

_Última actualización: mayo 2026._
