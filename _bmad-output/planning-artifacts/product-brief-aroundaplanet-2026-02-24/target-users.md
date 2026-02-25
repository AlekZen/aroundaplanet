# Target Users

## Primary Users

### Persona 1: Noel — Director / Fundador

| Campo | Detalle |
|-------|---------|
| Nombre real | Noel Sahagun |
| Edad | 37 anos |
| Ubicacion | Ocotlan, Jalisco -> Madrid (permanente desde 3 marzo 2026) |
| Nivel tecnico | Bajo — nunca se empapo de Odoo |
| Dispositivo principal | Celular (mobile-first) |
| Frecuencia de uso | Diaria, principalmente nocturna |

**Contexto**: Fundador con 8 anos de operacion, emprende desde joven. Su producto Vuelta al Mundo es su orgullo y diferenciador. Se muda a Madrid para abrir mercado europeo pero deja su operacion en Mexico sin herramientas de control remoto.

**Procesamiento cognitivo**: Pensador visual-first. Rechaza tablas y texto largo. Cuando ve algo visual que funciona, aprueba casi inmediato. Piensa en estructura jerarquica ("puestos y produccion por puesto"), no personas planas.

**Los Dos Noeles**:
- *Noel Racional (20:00-22:00)*: Quiere KPIs, metricas, dashboards. "Dame numeros, quiero productividad clara."
- *Noel Vulnerable (22:00+)*: Preocupaciones profundas — fuga de agentes, quejas de clientes, calidad inconsistente. La plataforma debe darle **control emocional**: "puedo dormir tranquilo en Madrid."

**Dolor actual**: Cero visibilidad ejecutiva. Toma decisiones con lo que le reportan por WhatsApp. No usa Odoo (nunca fue capacitado). A partir de marzo esta a 7 horas de diferencia sin ojos ni oidos sobre su negocio.

**Exito**: Abre la app desde Madrid a las 11 PM. Ve que todo esta en orden. Cierra el celular y duerme.

**Trauma relevante**: Pago por "pagina personalizada" en Wix que resulto plantilla generica. Proveedor desaparecio. Anti-chatbot explicito. Necesita VER para creer — demos > documentos.

---

### Persona 2: Lupita — Agente Freelance

| Campo | Detalle |
|-------|---------|
| Nombre | Lupita (arquetipo, representa ~100 agentes) |
| Perfil | Vendedora independiente por comision |
| Nivel tecnico | Basico — acostumbrada a WhatsApp |
| Dispositivo | Celular exclusivamente |
| Frecuencia de uso | Varias veces por semana |

**Contexto**: No es empleada de AroundaPlanet — es freelance. Vende viajes de varias agencias, pero AroundaPlanet es su principal fuente de ingreso. Su cartera de 12 clientes es su negocio personal. No tiene contrato, no tiene prestaciones, no tiene seguridad.

**Miedo profundo**: Que la agencia le "robe" a sus clientes. Cuando un cliente llama directo a la oficina, Lupita sospecha que le quitaran la comision. Esto no es paranoia — es un patron real en la industria de agencias de viajes. La **desconfianza es mas profunda que el problema de privacidad**.

**Dolor actual**: Reporta pagos de sus clientes en un grupo de WhatsApp de 42 personas. Todos ven cuanto cobro, a quien, por que viaje. No tiene visibilidad de sus comisiones acumuladas. No sabe exactamente cuantos clientes tiene ni el estado de cada uno.

**Motivacion de adopcion**: Lupita adopta la plataforma NO porque la obligan — la adopta porque por primera vez VE su negocio: sus clientes, sus comisiones, su cartera. La confidencialidad es un beneficio, pero la **transparencia es el killer feature**.

**Exito**: Abre la app, ve "12 clientes, $180K ventas del mes, comision acumulada $X". Reporta un pago en 3 toques. Recibe confirmacion cuando admin verifica. Nadie mas ve sus datos.

---

### Persona 3: Mariana — Administrativa

| Campo | Detalle |
|-------|---------|
| Nombre | Mariana (arquetipo, representa 8 admins) |
| Ubicacion | Oficina en Ocotlan, Jalisco |
| Nivel tecnico | Medio — usa Odoo para cotizaciones |
| Dispositivo | Escritorio (uso todo el dia) |
| Frecuencia de uso | Todo el dia, continuamente |

**Contexto**: Trabaja en oficina procesando pagos, generando cupones, armando contratos PDF, atendiendo clientes. Es competente y dedicada, pero sus herramientas la limitan. Pasa horas en tareas que un sistema resolveria en segundos.

**Dolor actual**: Cada pago que llega por WhatsApp requiere: (1) leer el mensaje, (2) identificar al cliente, (3) buscar en Odoo, (4) verificar contra banco, (5) responder al agente, (6) notificar al cliente. Son 5-6 interacciones manuales por cada pago. Con decenas de pagos diarios, esta saturada.

**Frustracion secreta**: Las cotizaciones PDF. "Nos toma mucho la cotizacion, porque tenemos que armar el PDF. Es muy detallado, nos quita mucho tiempo" (cita real de reunion con Noel).

**Exito**: Llega al trabajo. Abre la cola de verificacion. 5 pagos pendientes ordenados por antiguedad. Abre uno: comprobante a la izquierda, movimiento bancario a la derecha. Un clic: verificado. El sistema notifica automaticamente a todos. Pasa al siguiente. Lo que antes tomaba 45 minutos de WhatsApp toma 5 minutos.

---

## Secondary Users

### Persona 4: Carmen — Cliente / Viajera

| Campo | Detalle |
|-------|---------|
| Nombre | Carmen (arquetipo del viajero) |
| Contexto | Compro Vuelta al Mundo por $145K MXN, pagando en abonos |
| Nivel tecnico | Variable — debe ser extremadamente simple |
| Dispositivo | Celular |
| Frecuencia de uso | Semanal/quincenal durante periodo de pago |

**Contexto**: Carmen no compro un servicio — compro un sueno. Cada pago que hace es un paso mas cerca de la aventura de su vida. Hoy, para saber cuanto lleva pagado tiene que mandar WhatsApp y esperar. No tiene documentos accesibles. No sabe si su ultimo pago ya fue verificado.

**Por que es secundaria en MVP**: El portal cliente no es lo que vende la plataforma a Noel. Los dolores de Carmen se resuelven indirectamente cuando el flujo de pagos funciona. Sin embargo, el portal cliente es el feature que mas potencial tiene para Fase 1 (UX emocional, gamificacion, experiencia del viaje).

**Exito**: Abre el portal. Ve "$100,000 de $145,000 pagados — 69%". Descarga su contrato. Ve el itinerario. Sonrie. No pregunto a nadie.

---

## User Journey

### Flujo de Adopcion por Rol

**Director (Noel)**:
- **Descubrimiento**: Alek le muestra la plataforma el 2 de marzo en demo presencial
- **Onboarding**: Login con su email, perfil de super admin preconfigurado
- **Primer valor**: Ve dashboard con datos REALES de Odoo (ventas, viajes, empleados — todo jalado de su sistema). No son datos mock — es su negocio
- **Momento aha**: "Esto es lo que puedo ensenar en Madrid" (la plataforma en su celular, instalada como PWA)
- **Largo plazo**: Revision nocturna diaria desde Madrid. Alertas por excepcion cuando algo va mal

**Agente (Lupita)**:
- **Descubrimiento**: Admin le envia link de acceso + instrucciones. Onboarding en 2 minutos
- **Onboarding**: Login con email, ve inmediatamente SUS clientes (seeded desde Odoo)
- **Primer valor**: "Estos son MIS 12 clientes. Nadie mas los ve." La confianza se construye desde el primer login
- **Momento aha**: Reporta su primer pago — 3 toques, foto, listo. Recibe notificacion cuando admin verifica. Compara con el proceso anterior de WhatsApp
- **Largo plazo**: La plataforma es su herramienta de trabajo diaria. Ve comisiones, cartera, historial. Efecto red: agentes que adoptan tienen ventaja visible, generando envidia natural en los resistentes

**Administrativo (Mariana)**:
- **Descubrimiento**: Alek capacita al equipo presencialmente en Ocotlan
- **Onboarding**: Login con email, perfil admin preconfigurado con permisos
- **Primer valor**: Cola de verificacion con pagos ya en fila. No tiene que buscar en WhatsApp
- **Momento aha**: Verifica 5 pagos en 5 minutos. Lo que antes le tomaba 45 minutos. El sistema notifico a todos automaticamente
- **Largo plazo**: Flujo ordenado de trabajo. Bandeja de atencion compartida con el equipo. Metricas de productividad sin registro manual

**Cliente (Carmen)**:
- **Descubrimiento**: Recibe invitacion del admin o del agente para crear su cuenta
- **Onboarding**: Registro por email, perfil cliente automatico
- **Primer valor**: Ve cuanto lleva pagado SIN preguntar a nadie
- **Momento aha**: Descarga su contrato en PDF. Ve el itinerario. Todo accesible 24/7
- **Largo plazo**: Recibe notificaciones de hitos (pago verificado, viaje proximo). La plataforma se convierte en su ventana al viaje

### Adopcion Gradual

El sistema esta disenado para funcionar con **adopcion parcial**. No necesita que los 100 agentes adopten el dia 1:
- Admin absorbe trabajo del agente resistente (puede capturar pagos en nombre del agente)
- Adoptantes tempranos tienen ventaja visible (ven sus comisiones, los resistentes no)
- Efecto red natural: conforme mas agentes adoptan, WhatsApp pierde masa critica
- Meta: cerrar el grupo de WhatsApp cuando la mayoria migre (no forzar)

---
