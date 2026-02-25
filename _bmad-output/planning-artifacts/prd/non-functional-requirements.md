# Non-Functional Requirements

## Performance

- NFR1: Paginas publicas (landing viajes) cargan con LCP <2.5s para cumplir Core Web Vitals y posicionar en Google (SSG/ISR)
- NFR2: Dashboard Director carga datos iniciales en <3s desde cualquier conexion (Madrid, 4G)
- NFR3: Flujo completo de reporte de pago (foto → IA → datos → confirma → enviado) se completa en <30s
- NFR4: Cola de verificacion admin carga en <2s para que Mariana procese pagos sin esperar
- NFR5: Navegacion entre secciones privadas (SPA) transiciona en <500ms sin recargas completas
- NFR6: Time to Interactive (TTI) <3.5s en primera carga sobre red 4G
- NFR7: El sistema soporta al menos 50 usuarios concurrentes sin degradacion perceptible de performance

## Security

- NFR8: Toda comunicacion entre cliente y servidor usa HTTPS/TLS 1.2+
- NFR9: Datos sensibles (comprobantes, datos fiscales, cuenta bancaria) se almacenan en Firebase con security rules que restringen acceso por uid y rol
- NFR10: Un agente no puede acceder a datos de clientes, pagos o comisiones de otro agente bajo ninguna circunstancia — validado tanto en frontend (UI) como backend (Firestore rules + server-side)
- NFR11: Sesiones de autenticacion expiran despues de 14 dias de inactividad. Revocacion inmediata disponible desde panel SuperAdmin
- NFR12: Fotos de comprobantes bancarios son accesibles unicamente por: el usuario que las subio, admin asignado a verificar, y SuperAdmin
- NFR13: Operaciones destructivas (borrar usuario, cambiar roles) requieren rol SuperAdmin y dejan audit trail en log
- NFR14: API Routes del proxy Odoo validan autenticacion y autorizacion en cada request — no hay endpoint publico que exponga datos de Odoo
- NFR15: Firebase Storage rules imponen estructura de carpetas por uid — un usuario no puede escribir ni leer fuera de su scope

## Scalability

- NFR16: Arquitectura soporta crecimiento de 120 usuarios a 500 sin cambios en infraestructura (Firebase auto-scale)
- NFR17: Queries de Firestore usan indices compuestos para mantener performance constante independientemente del volumen de datos
- NFR18: Landing pages estaticas (SSG) se sirven desde CDN sin carga en servidor de aplicacion
- NFR19: Cache de datos Odoo en Firestore evita que crecimiento de usuarios multiplique llamadas XML-RPC

## Integration

- NFR20: Capa proxy Odoo abstrae el protocolo XML-RPC — cambiar de Odoo a otro ERP solo requiere reemplazar el adaptador, no la logica de negocio
- NFR21: Si Odoo no responde en <5s, el sistema usa cache de Firestore y muestra indicador visual "datos de hace X horas"
- NFR22: Sincronizacion Odoo↔Firestore es eventual (no transaccional) — el sistema tolera inconsistencias temporales con mecanismo de reconciliacion
- NFR23: WhatsApp Odoo templates tienen fallback a push FCM + email si el canal falla
- NFR24: Firebase AI Logic para OCR tiene fallback a formulario manual — el flujo de pagos nunca se bloquea por falla de IA

## Reliability

- NFR25: El flujo de pagos (reportar → verificar → notificar) tiene disponibilidad >99.5% — es la operacion critica diaria
- NFR26: PWA funciona offline mostrando ultimo snapshot cacheado del dashboard y historial de pagos, con indicador "sin conexion"
- NFR27: Notificaciones push se despachan con retry automatico (hasta 3 intentos) si el primer envio falla
- NFR28: Errores de sincronizacion con Odoo se registran en log visible para SuperAdmin con opcion de retry manual
- NFR29: El sistema no tiene single point of failure fuera de Firebase — si un servicio individual de Firebase se degrada, los demas siguen operando

## Accessibility (Minimo Viable)

- NFR30: Contraste de texto cumple ratio minimo 4.5:1 para legibilidad en mobile bajo condiciones de luz solar (agentes en campo)
- NFR31: Elementos interactivos tienen area de toque minima de 44x44px para uso en dispositivos moviles
- NFR32: Formularios clave (reporte pago, verificacion) son navegables por teclado para admins en escritorio
