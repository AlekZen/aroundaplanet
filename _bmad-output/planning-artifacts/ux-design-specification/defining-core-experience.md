# Defining Core Experience

## Defining Experience

AroundaPlanet tiene DOS experiencias definitorias que operan en tandem:

**1. La experiencia de adopcion (primer contacto):**
> "Abri la app y ya estaban MIS datos reales — mis clientes, mis ventas, mis comisiones"

Este es el momento que convierte escepticos en usuarios. Sin esto, la experiencia core nunca tiene oportunidad de existir. Es lo que diferencia AroundaPlanet de "otra app que me obligaron a usar".

**2. La experiencia core (uso diario):**
> "Tome foto del comprobante y en 3 toques quedo reportado — sin mandar nada por WhatsApp"

Este es el ciclo que reemplaza el caos actual: 42 personas en un grupo de WhatsApp intercambiando fotos de comprobantes sin privacidad ni trazabilidad.

## User Mental Model

**Como resuelven el problema HOY:**

| Actor | Proceso actual (WhatsApp) | Pasos | Tiempo | Dolor principal |
|-------|--------------------------|-------|--------|----------------|
| Agente (Lupita) | Foto comprobante → envia a grupo WA → escribe "pago de Roberto $15K" → espera respuesta admin | 4-5 mensajes | 5-10 min + espera | Todos ven sus datos. No sabe si ya verificaron |
| Admin (Mariana) | Recibe foto en grupo → abre banco → busca movimiento → responde "confirmado" en WA → registra en Odoo | 5-6 interacciones | 6-8 min por pago | 45 min diarios en WA. Errores manuales |
| Director (Noel) | Llama a oficina → pregunta "como van los pagos?" → alguien busca en Odoo → le reportan | 1 llamada | 15-30 min + zona horaria | No puede dormir sin saber. Dependencia total del equipo |
| Cliente (Carmen) | Manda WhatsApp a su agente → "ya deposite" → adjunta foto → espera confirmacion | 3-4 mensajes | Variable | No sabe cuanto lleva pagado. No tiene historial |

**Modelo mental que TRAEN los usuarios:**
- **Lupita**: Piensa como WhatsApp — "adjuntar foto y enviar". Espera inmediatez similar
- **Mariana**: Piensa como Odoo — buscar, comparar, confirmar. Espera mas estructura que WA
- **Noel**: Piensa como app bancaria — "abro y veo el estado". Espera graficas visuales
- **Carmen**: Piensa como app de pagos (Mercado Pago) — "escaneo, pago, listo". Espera simplicidad total

**Puntos de confusion potencial:**
- Lupita con multiples roles (Agente + Cliente): "donde estoy? en mi portal de agente o de cliente?"
- Carmen primera vez: "como subo un pago? que es un comprobante?" (no todos saben)
- Marco resistente: "por que tengo que usar esto si WhatsApp funciona?" (objecion a resolver con valor visible, no con obligacion)

**Workarounds actuales que revelan necesidades:**
- Agentes guardan screenshots de confirmaciones de admin como "recibo" → necesitan historial con status
- Mariana tiene Excel paralelo a Odoo para tracking de pagos → necesita cola de verificacion
- Noel pide a alguien que le mande "resumen del dia" por WA → necesita push proactivo automatico

## Success Criteria

| Criterio | Metrica | Umbral exito |
|----------|---------|-------------|
| **Velocidad del reporte** | Tiempo foto → enviado | <30 segundos, <=3 toques |
| **Precision IA** | % de campos correctamente extraidos | >80% sin correccion manual |
| **Velocidad verificacion** | Tiempo por pago verificado (admin) | <90 segundos promedio |
| **Feedback inmediato** | Push de confirmacion al reporter | <5 minutos post-verificacion |
| **Visibilidad agente** | Primer login muestra datos reales | 100% — cero estados vacios |
| **Autonomia cliente** | Carmen consulta progreso sin llamar | 100% self-service (barra progreso + historial) |
| **Tranquilidad director** | Noel checa dashboard sin llamar a oficina | Dashboard comprensible en <10 segundos |

**Indicadores de "lo estamos haciendo bien":**
1. Lupita deja de mandar fotos por WhatsApp → las sube por la app
2. Mariana NO necesita abrir WhatsApp para verificar pagos
3. Noel NO llama a oficina para preguntar "como van los pagos"
4. Carmen NO necesita preguntar "cuanto me falta"
5. Marco empieza a usar la app porque ve que Lupita tiene ventaja

## Novel UX Patterns

**Patrones ESTABLECIDOS (adoptar sin cambios):**

| Patron | Referencia | Por que no innovar |
|--------|-----------|-------------------|
| Bottom navigation mobile | Universal (WA, Instagram, Banco) | Los usuarios ya lo entienden. Cero curva de aprendizaje |
| Pull-to-refresh | Universal | Gesto natural para actualizar datos |
| Cards para informacion | Fintech, e-commerce | Marco mental existente para "bloques de datos" |
| Push notifications con deep link | Todas las apps modernas | Expectativa estandar |
| Google 1-click sign up | Universal | Reducir friccion de registro al minimo |

**Patrones ADAPTADOS (familiar con twist AroundaPlanet):**

| Patron | Referencia original | Adaptacion |
|--------|---------------------|-----------|
| Barra progreso pagos | Nubank, apps bancarias | Progreso financiero + hitos emocionales del viaje. No solo "$100K de $145K" sino "69% — vas increible, el Taj Mahal te espera" |
| "Mi Tienda" | Shopify | "Mi Negocio" con framing emprendedor: MIS clientes, MIS comisiones, MI link de ventas |
| Tracking de pedido | Uber, Rappi | Stepper de pago: Reportado → En verificacion → Verificado/Rechazado con timestamps |
| Split-screen comparacion | Apps de productividad | Comprobante (izq) + datos IA resaltados (der) + acciones 1-clic |
| Resumen periodico | Spotify Wrapped | Push nocturno para Noel, semanal para agentes. Personalizado con datos reales |

**Patron NOVEL (unico de AroundaPlanet):**

| Patron | Que es | Riesgo | Mitigacion |
|--------|--------|--------|-----------|
| OCR comprobante con IA | Foto → datos extraidos automaticamente | IA falla con comprobantes variados | Fallback 100%: formulario manual siempre disponible. IA es atajo, no requisito |
| Sidebar roles aditivos | Un sidebar que muestra secciones de TODOS tus roles simultaneamente | Confusion visual si muchas secciones | Agrupacion clara: "Mi Portal" (cliente), "Mi Negocio" (agente), "Operaciones" (admin). Separadores visuales |
| Adopcion por envidia productiva | El no-usuario ve que el usuario tiene ventaja | No genera envidia suficiente | Admin como proxy elimina la necesidad forzada. La ventaja es genuina (ver comisiones), no artificial |

## Experience Mechanics

**Flujo: Reportar Pago (Agente/Cliente)**

```
INICIO
  |-- Agente ve FAB naranja "Reportar Pago" (siempre visible en portal)
  |-- Tap FAB → Camara se abre directamente (no selector de archivos)

INTERACCION
  |-- Toma foto del comprobante bancario
  |-- Firebase AI Logic (gemini-2.5-flash-lite) procesa imagen (<2 seg)
  |-- Pantalla muestra datos extraidos RESALTADOS:
  |     |-- Monto: $15,000 (Roboto Mono, verde si alta confianza, amarillo si baja)
  |     |-- Banco: BBVA
  |     |-- Referencia: 123456789
  |     +-- Fecha: 24/02/2026
  |-- Usuario puede EDITAR cualquier campo (tap → input editable)
  |-- Si agente: selecciona cliente del dropdown (prellenado con sus asignados)

FEEDBACK
  |-- Boton "Confirmar y Enviar" (accent naranja, prominente)
  |-- Tap → animacion de envio (check animado, no spinner generico)
  |-- Toast: "Pago reportado — en cola de verificacion"
  |-- Badge de notificaciones se actualiza

COMPLETADO
  |-- Regresa a vista anterior con pago nuevo visible en historial
  |-- Status: "Pendiente de verificacion" (badge amarillo)
  |-- Push a admin: "Nuevo pago de Roberto por $15K — verificar"

POST-VERIFICACION (asincrono)
  |-- Admin verifica → Push al reporter: "Tu pago de $15K fue verificado"
  |-- Deep link en push → historial con status actualizado (badge verde)
  |-- Barra de progreso de Carmen se actualiza automaticamente
  +-- Comision de Lupita se recalcula en tiempo real
```

**Flujo: Verificar Pago (Admin — Desktop)**

```
INICIO
  |-- Admin ve cola de verificacion en sidebar "Operaciones"
  |-- Cola ordenada por antiguedad (urgentes >48h con badge rojo)
  |-- Card preview: monto + reporter + cliente + tiempo en cola

INTERACCION
  |-- Clic en pago → Panel split-screen:
  |     |-- IZQUIERDA: Imagen comprobante (zoom, rotar)
  |     +-- DERECHA: Datos IA extraidos + datos de la orden Odoo
  |           |-- Monto reportado vs monto esperado (highlight si difieren)
  |           |-- Referencia bancaria (copiable para buscar en banca)
  |           +-- Alerta si referencia duplicada detectada

FEEDBACK
  |-- Boton "Verificar" (verde, prominente) o "Rechazar" (rojo, secundario)
  |-- Si rechaza: modal con motivo (dropdown predefinidos + texto libre)
  |-- Animacion de confirmacion → card desaparece de cola
  |-- Contador "Verificados hoy: 8" se incrementa (maestria)

COMPLETADO
  |-- Cola muestra siguiente pago automaticamente
  |-- NotificationService dispara: push a reporter, push a cliente,
  |   update Odoo (account.move), recalculo comision agente
  +-- Atajos teclado: [V] verificar, [R] rechazar, [→] siguiente
```

**Flujo: Dashboard Nocturno (Director — Mobile)**

```
INICIO
  |-- Push programado 10pm (hora Madrid): "Resumen del dia"
  |-- Tap push → deep link a dashboard
  |   (o: Noel abre app por iniciativa propia)

INTERACCION
  |-- Pantalla 1 (sin scroll): Semaforo de salud del negocio
  |     |-- Verde: "Todo en orden" (sin excepciones)
  |     |-- Amarillo: "2 pagos pendientes >48h" (atencion, no alarma)
  |     +-- Rojo: "Agente X inactivo 7 dias" (accion requerida)
  |-- KPI cards (swipe horizontal): ventas del mes, cobranza, ocupacion
  |-- Tap en KPI → drill-down (semana/mes/trimestre/YoY)

FEEDBACK
  |-- Datos con timestamp: "Actualizado hace 12 min"
  |-- Si offline: banner "Sin conexion — datos de hace 2h"
  |-- Metricas con tendencia visual (flecha + %)

COMPLETADO
  |-- Noel entiende estado del negocio en <10 segundos
  |-- Si todo verde: cierra app → tranquilidad → duerme
  |-- Si amarillo/rojo: tap en alerta → detalle → decide accion
  +-- No necesito llamar a la oficina
```
