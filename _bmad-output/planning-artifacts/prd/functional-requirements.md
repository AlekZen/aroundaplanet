# Functional Requirements

## 1. Identity & Access Management

- FR1: Visitante anonimo puede crear cuenta con email o Google desde cualquier pagina publica
- FR2: Usuario autenticado tiene rol Cliente como base — siempre presente independientemente de roles adicionales
- FR3: SuperAdmin puede asignar roles adicionales (Agente, Admin, Director, SuperAdmin) a cualquier usuario
- FR4: SuperAdmin puede desactivar un usuario sin borrar sus datos ni historial
- FR5: SuperAdmin puede sincronizar usuarios desde Odoo (res.users + hr.employee) y asignarles roles
- FR6: SuperAdmin puede configurar permisos read-only para roles especificos (ej: Director sin edicion)
- FR7: Sistema impide que un usuario vea datos de otro usuario que no le correspondan segun su rol y asignaciones
- FR8: Usuario autenticado puede editar su perfil: foto, datos personales, datos fiscales (RFC, razon social, regimen, domicilio, uso CFDI), cuenta bancaria (agentes)
- FR9: Usuario autenticado puede configurar sus preferencias de notificacion segun las categorias disponibles para su rol

## 2. Public Content & Conversion

- FR10: Visitante puede navegar paginas publicas: home, catalogo de viajes, landing individual por viaje, pagina Vuelta al Mundo
- FR11: Landing de viaje muestra galeria de fotos (profesionales + UGC), itinerario, precio, fechas de salida disponibles, ocupacion/disponibilidad, testimonios de viajeros
- FR12: Visitante puede solicitar cotizacion / apartar lugar en un viaje seleccionando fecha de salida, creando una orden en estado "Interesado"
- FR13: Sistema captura atribucion de origen (UTMs, ref de agente) al momento de la primera visita y la asocia al usuario cuando crea cuenta
- FR14: Si visitante llega con parametro ref de agente, se autoasigna a ese agente al crear cuenta (primer toque gana)
- FR15: Si visitante llega sin ref, admin recibe notificacion de nuevo lead para asignacion manual o round-robin

## 3. Trip Management & Catalog

- FR16: SuperAdmin/Admin puede crear, editar, publicar y despublicar viajes con datos sincronizados desde Odoo (product.template)
- FR17: Viaje puede tener multiples fechas de salida con capacidad individual por fecha (via Odoo Events)
- FR18: Viaje tiene contenido rico en Firestore (fotos hero, copy marketing, SEO meta, slug URL) independiente de datos operativos de Odoo
- FR19: Cliente puede ver catalogo completo de viajes disponibles con filtros
- FR20: Agente puede ver catalogo de viajes con material de venta y copiar su link personalizado por viaje

## 4. Payment Flow

- FR21: Agente o Cliente puede reportar un pago subiendo foto de comprobante bancario
- FR22: Sistema analiza foto del comprobante con IA y extrae automaticamente monto, fecha, referencia y banco
- FR23: Usuario que reporta pago puede confirmar o corregir los datos extraidos por IA antes de enviar
- FR24: Agente puede reportar pago en nombre de un cliente asignado
- FR25: Admin puede reportar pago en nombre de cualquier agente o cliente (proxy)
- FR26: Admin ve cola de verificacion de pagos priorizada por antiguedad con indicador de urgencia para pagos >48h
- FR27: Admin puede verificar un pago confirmando que coincide con movimiento bancario
- FR28: Admin puede rechazar un pago especificando motivo
- FR29: Sistema detecta comprobantes duplicados por referencia bancaria y alerta al admin
- FR30: Viaje activo de cliente muestra plan de pagos con monto total, pagado, pendiente, y sugerencia de proximo pago
- FR31: Cliente puede ver historial completo de pagos de todos sus viajes con status de cada uno

## 5. Agent Business Portal

- FR32: Agente puede ver lista de SUS clientes asignados con status de cada uno
- FR33: Agente puede ver detalle de cada cliente: perfil, viaje activo, historial de pagos
- FR34: Agente puede ver sus comisiones acumuladas con detalle por cliente y viaje
- FR35: Agente puede ver resumen de su cartera: total ventas, cantidad clientes, comision del periodo
- FR36: Agente puede generar y copiar su link personalizado por viaje con parametro de atribucion
- FR37: Agente recibe notificacion cuando un lead se autoasigna desde su link

## 6. Director Dashboard & BI

- FR38: Director puede ver dashboard ejecutivo con KPIs de ventas brutas, cobranza, ocupacion por viaje, ranking agentes
- FR39: Director puede cambiar dimension temporal de cualquier metrica: semana, mes, trimestre, ano, comparativas YoY, tendencias
- FR40: Director puede hacer drill-down desde KPI agregado hasta detalle de orden individual
- FR41: Director puede ver widget de fuentes de trafico: desglose por canal (Instagram, Google, agentes, etc.) con embudo de conversion
- FR42: Director puede ver widget de performance de agentes: leads generados, pagos procesados, ranking
- FR43: Director puede ver cobranza pendiente con filtros por antiguedad y monto
- FR44: Director puede ver metricas de adopcion por agente (pagos via plataforma vs proxy admin)

## 7. Notification System

- FR45: Sistema despacha notificaciones via multiples canales: push (FCM), WhatsApp (Odoo templates), email
- FR46: Cada notificacion incluye deep link que lleva al usuario a la seccion relevante de la informacion
- FR47: Sistema envia resumenes programados: diario nocturno para Director, diario matutino para Admin, semanal para Agente
- FR48: Sistema envia alertas por excepcion al Director: agente inactivo, pago atrasado, meta no alcanzada, hito de negocio
- FR49: Sistema agrupa notificaciones cuando multiples eventos ocurren en ventana corta (ej: 5 pagos en 1 hora = 1 push agrupado)
- FR50: Usuario puede activar/desactivar categorias de notificacion y configurar horarios desde su perfil

## 8. Client Experience & UGC

- FR51: Cliente puede ver todos sus viajes (pasados, activo, futuro) con detalle de cada uno
- FR52: Cliente puede ver progreso visual de pagos de su viaje activo
- FR53: Cliente puede descargar documentos asociados a sus viajes (contratos, itinerarios) 24/7
- FR54: Cliente puede subir fotos de viajes completados a su galeria personal
- FR55: Cliente puede escribir resena y calificar viajes completados
- FR56: Cliente puede marcar fotos individuales como publicas (toggle) para que aparezcan en la landing del viaje
- FR57: Admin puede moderar fotos y resenas antes de publicarlas en landing pages
- FR58: Cliente puede generar card para compartir su experiencia en redes sociales con link de atribucion a la landing del viaje

## 9. Analytics & Attribution

- FR59: Sistema registra eventos de conversion en Firebase Analytics: view_trip, sign_up, begin_checkout, purchase
- FR60: Sistema captura y almacena parametros UTM y ref de agente en la sesion del visitante y los asocia a su cuenta
- FR61: Sistema dispara eventos equivalentes en Meta Pixel y Google Tag para cada evento de conversion
- FR62: Sistema mide push click-through rate por tipo de notificacion
- FR63: Director puede ver dashboard de atribucion: fuentes de trafico, conversion por canal, performance de links de agente

## 10. Odoo Integration

- FR64: Sistema lee datos de Odoo via XML-RPC: contactos, ordenes de venta, pagos, productos, CRM, empleados, eventos
- FR65: Sistema escribe datos de vuelta a Odoo cuando corresponde: registro de pagos en account.move, actualizacion de ordenes
- FR66: Sistema sincroniza catalogo de viajes entre Odoo product.template y Firestore
- FR67: Sistema opera con capa de abstraccion que desacopla la logica de negocio de la API especifica de Odoo
- FR68: Sistema opera en modo degradado si Odoo no esta disponible, mostrando datos cacheados con indicador de estado
