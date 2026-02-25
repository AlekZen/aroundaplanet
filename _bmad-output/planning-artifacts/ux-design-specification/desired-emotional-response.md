# Desired Emotional Response

## Primary Emotional Goals

| Rol | Emocion primaria | Frase que lo resume | Emocion a EVITAR |
|-----|-----------------|--------------------|-----------------|
| **Noel (Director)** | Paz mental / control | "Puedo dormir tranquilo en Madrid" | Ansiedad, desconexion, sentirse fuera |
| **Lupita (Agente)** | Confianza / propiedad | "Este es MI negocio, nadie me lo quita" | Desconfianza, vulnerabilidad, exposicion |
| **Mariana (Admin)** | Empoderamiento / flujo | "Soy productiva, no vigilada" | Saturacion, micromanagement, caos |
| **Carmen (Cliente)** | Emocion / anticipacion | "Cada pago me acerca a mi sueno" | Frialdad transaccional, incertidumbre |
| **Marco (Resistente)** | Envidia → curiosidad → "esto si sirve" | "Lupita ve todo y yo no... bueno, dejame probar" | Obligacion, presion autoritaria |

**Meta emocional general de la plataforma:** AroundaPlanet no vende funcionalidad — vende confianza (agentes), tranquilidad (director), productividad (admins) y emocion (clientes). Tecnicamente es un sistema de gestion de agencias de viaje. Emocionalmente es "duerme tranquilo aunque tu negocio este en otro continente".

## Emotional Journey Mapping

**Descubrimiento (landing publica):**
- Visitante ve reel en Instagram → curiosidad → llega a landing → inspiracion (fotos reales UGC, no stock) → urgencia sutil ("quedan 7 lugares" — dato real de Odoo Events) → deseo → "Cotizar / Apartar" → transicion fluida a registro
- Target emocional: "Esto es real, esta gente viajo de verdad, yo quiero eso"

**Primer login (momento critico):**
- Lupita: Login → ve 12 clientes CON DATOS → alivio + poder ("por fin puedo ver lo mio")
- Noel: Login → ve $27M en ventas reales → validacion ("esto si funciona, no es template Wix")
- Mariana: Login → ve cola de pagos organizada → esperanza ("ya no voy a buscar en WhatsApp")
- Target emocional: "Esto YA tiene mis datos. Es mio desde el primer segundo"

**Uso diario (core loop):**
- Lupita reporta pago: rapidez → satisfaccion → push de verificacion → seguridad ("ya quedo, me confirmaron")
- Mariana verifica: cola ordenada → flujo → maestria → metricas automaticas → orgullo ("verifique 23 pagos hoy")
- Noel revisa dashboard: semaforo verde → tranquilidad → drill-down si quiere → control → cierra app → libertad
- Carmen consulta: barra progreso → emocion → hito alcanzado → celebracion → push emocional → conexion
- Target emocional: "Esto fluye. Hago mi trabajo y el sistema hace el resto"

**Cuando algo sale mal:**
- IA no lee comprobante → campos vacios para llenado manual → calma ("no se trabo, puedo escribirlo yo")
- Pago rechazado → push con motivo claro + deep link → claridad ("se que paso y que hacer")
- Odoo no responde → datos cacheados con indicador → confianza ("muestra lo ultimo que sabia, no se rompe")
- Target emocional: "Algo fallo pero no me dejo tirado. Se que hacer ahora"

**Regreso (usuario recurrente):**
- Lupita: Abre app → ve resumen semanal → progreso ("$5,400 de comision esta semana")
- Noel: Push lunes 9am Madrid → resumen semanal → informado sin esfuerzo ("no tuve que abrir nada")
- Carmen: Push "Tu pago fue verificado — llevas 83%" → momentum → abre app → barra avanzo → dopamina
- Target emocional: "Cosas pasaron mientras no estaba y todo sigue bien"

## Micro-Emotions

| Micro-emocion | Donde aplica | Patron UX |
|--------------|-------------|-----------|
| **Confianza > Confusion** | Sidebar con roles multiples | Secciones claramente etiquetadas: "Mi Portal" vs "Mi Negocio". Sin toggle, sin ambiguedad |
| **Propiedad > Exposicion** | Portal agente | Lenguaje posesivo deliberado: "MIS clientes", "MI cartera", "MIS comisiones" |
| **Logro > Frustracion** | Barra progreso Carmen | Micro-celebraciones en 25/50/75/100%. Confetti sutil, mensaje emocional, no solo numeros |
| **Calma > Ansiedad** | Dashboard Noel 11pm | Semaforo de salud del negocio (verde/amarillo/rojo). Un solo indicador que responde la pregunta de fondo |
| **Maestria > Incompetencia** | Cola verificacion admin | Metricas automaticas ("23 pagos hoy, promedio 1.2 min"). Mariana se siente competente, no vigilada |
| **Pertenencia > Aislamiento** | UGC post-viaje | "Los viajeros de VaM 2025" — fotos reales, comunidad. Pertenecer a algo mas grande que una transaccion |
| **Urgencia > Presion** | Landing publica | "Quedan 7 lugares" (dato real de Odoo Events). Urgencia honesta basada en datos, no manipulacion |

## Design Implications

| Emocion objetivo | Que implica para UX |
|---------|-------------------|
| **Paz mental (Noel)** | Push proactivos nocturnos. Indicador "todo bien" visible sin interaccion. Alertas SOLO por excepcion. Resumenes que RESPONDEN ("todo en orden"), no que solo INFORMAN (lista de numeros) |
| **Propiedad (Lupita)** | Seccion "Mi Negocio", no "Panel Agente". Comisiones como primer dato visible. Link atribucion como "mi herramienta de venta". Framing de emprendedor, no de empleado |
| **Flujo (Mariana)** | Cola priorizada (urgentes primero). 1-clic verificar. Cero campos innecesarios. Atajos teclado en desktop. Metricas como consecuencia del trabajo, no como tarea extra |
| **Sueno (Carmen)** | Barra progreso como viaje visual, no termometro financiero. Fotos del destino que cambian. "Faltan 47 dias" con imagen espectacular. Cada pago = level up emocional |
| **Envidia productiva (Marco)** | La ventaja de adoptar es VISIBLE (Lupita ve comisiones, Marco no). No forzar adopcion — hacer que la no-adopcion sea la opcion claramente inferior |

## Emotional Design Principles

1. **Responder la pregunta emocional, no solo la funcional** — Noel no pregunta "cuantos pagos hubo hoy", pregunta "esta todo bien?". Carmen no pregunta "cuanto debo?", pregunta "que tan cerca estoy de mi viaje?". Cada pantalla debe responder la pregunta emocional de fondo.

2. **Celebrar progreso, no solo informar estado** — Un pago verificado no es un cambio de status en una tabla — es un paso mas hacia el viaje de Carmen, una comision mas para Lupita, una operacion menos para Mariana. El sistema celebra cada avance con feedback visual y emocional proporcional.

3. **Silencio = todo bien** — El sistema de notificaciones se rige por excepcion, no por volumen. Si Noel no recibe alertas, todo esta bien. Si Lupita no recibe pushes de rechazo, sus pagos estan verificados. El silencio del sistema es un diseno intencional que comunica normalidad.

4. **El error no rompe la experiencia** — Cada fallback esta disenado para mantener la emocion positiva: IA no lee → "puedes escribirlo tu" (calma). Odoo caido → datos cacheados (confianza). Pago rechazado → motivo + accion clara (resolucion). Ningun error deja al usuario sin saber que hacer.

5. **La privacidad es una emocion, no un feature** — Cuando Lupita abre su portal y ve SOLO sus clientes, no piensa "los permisos funcionan" — siente "mi negocio esta protegido". El diseno visual de la privacidad (indicadores de "solo tu ves esto", scope claro por seccion) refuerza la emocion de seguridad, no solo la funcionalidad tecnica.
