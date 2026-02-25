# Core User Experience

## Defining Experience

La plataforma AroundaPlanet tiene un ciclo core por rol, pero una unica accion que sostiene todo el negocio: el **ciclo de pago** (agente/cliente sube comprobante → IA extrae datos → confirma → admin verifica → todos notificados). Este ciclo es el pulso operativo. Si no es mas rapido y privado que WhatsApp, la plataforma fracasa.

Sin embargo, el **momento que desbloquea la adopcion** es diferente: el primer login de Lupita donde ve SUS 12 clientes con datos reales de Odoo. Si ese momento no genera el "wow" de confianza, los 100 agentes no adoptan y el ciclo de pago no tiene usuarios.

**Acciones core por rol:**

| Rol | Accion mas frecuente | Accion mas critica |
|-----|---------------------|-------------------|
| Agente (Lupita) | Ver estado de sus clientes | Reportar pago en 3 toques |
| Admin (Mariana) | Verificar pagos en cola | Verificar con 1 clic (split-screen IA) |
| Director (Noel) | Revisar dashboard nocturno | Interpretar estado del negocio en <10 seg |
| Cliente (Carmen) | Consultar progreso de pagos | Subir comprobante sin ayuda |
| SuperAdmin (Alek) | Gestionar usuarios/roles | Sync Odoo + asignar roles |

## Platform Strategy

| Aspecto | Decision | Justificacion |
|---------|----------|---------------|
| Tipo | PWA (Next.js App Router) | Instalable sin App Store, mobile-first, offline, auto-deploy Firebase App Hosting |
| Paginas publicas | SSG con ISR (revalidar cada hora) | SEO, Core Web Vitals LCP <2.5s, landing viajes indexables |
| Paginas privadas | CSR/SPA | Transiciones <500ms sin recarga, Firestore listeners real-time |
| Input primario touch | Agentes (100) + Director + Clientes | Mobile 375px+, areas de toque 44x44px minimo |
| Input primario mouse/teclado | Admins (8) + SuperAdmin | Desktop 1024px+, split-screen verificacion, atajos teclado |
| Offline | Cache-first para assets, network-first para API | Dashboard ultimo snapshot + historial pagos. Banner "sin conexion — datos de hace Xh" |
| Capacidades nativas | Camara (comprobantes), FCM push, Add to Home Screen | Fundamentales para flujo pagos y engagement |
| Responsive | 375px (mobile) → 768px (tablet) → 1024px+ (desktop) | Mobile-first para 110+ usuarios moviles, desktop optimizado para 8 admins |

**Navegacion dual:**
- **Publica**: Home → Catalogo viajes → Landing por viaje → Registro/Login. SSG, SEO, sin auth requerido
- **Privada**: Dashboard dinamico por roles → Secciones por rol en sidebar unificado. CSR, auth requerido, `noindex`
- **Transicion**: Registro desde landing publica → redirect a dashboard privado sin ruptura. El usuario no "cambia de app"

## Effortless Interactions

1. **Reportar pago (agente/cliente)** — Abrir camara → foto comprobante → IA extrae monto/banco/referencia/fecha en <2 seg → 1 tap confirma → enviado. <=3 toques, <30 seg total. Debe ser mas rapido que "abrir WhatsApp, adjuntar foto, escribir datos, enviar"

2. **Primer login** — Email o Google → ve SUS datos reales de Odoo inmediatamente. Cero tutoriales, cero estados vacios, cero "configura tu perfil primero". Los clientes de Lupita ya estan ahi. Los KPIs de Noel ya tienen numeros. El seed de Odoo alimenta todo desde el primer segundo

3. **Verificar pago (admin)** — Cola priorizada (urgentes arriba) → clic en pago → split-screen: comprobante izquierda + datos IA resaltados derecha → 1 clic "Verificar" o "Rechazar" con motivo → NotificationService dispara 4+ notificaciones automaticamente. 7 pagos en 8 minutos

4. **Crear cuenta desde landing** — Google 1 click → automaticamente rol Cliente → ref de agente capturado de URL → orden en estado "Interesado" creada → deep link a viaje de interes. Sin formularios largos, sin verificacion de email

5. **Push → seccion relevante** — Cada notificacion incluye deep link: "Tu pago fue verificado" → `/mis-viajes/vuelta-al-mundo`. "Nuevo pago de Roberto" → `/admin/verificacion/[id]`. Cero navegacion manual despues del tap

6. **Copiar link atribucion (agente)** — En catalogo de viajes, 1 tap genera link personalizado `?ref=lupita` → copiado al portapapeles → listo para pegar en WhatsApp/Instagram Story

## Critical Success Moments

**Momentos make-or-break (si fallan, pierdes al usuario):**

| Momento | Exito | Fracaso |
|---------|-------|---------|
| **Primer login de Lupita** | "Estos son MIS 12 clientes. Nadie mas los ve" → confianza → adopcion | Estado vacio o datos incorrectos → "esto no sirve" → nunca regresa |
| **Demo a Noel (2 marzo)** | Ve datos REALES ($27M ventas, ranking agentes, ocupacion) → "esto es lo que llevo a Madrid" | Datos mock o dashboard vacio → trauma Wix se activa → pierde fe |
| **Primer pago con IA** | Foto → datos correctos en 2 seg → "es mas rapido que WhatsApp" | IA no lee comprobante → campos vacios → "mejor mando foto por WA" |
| **Noel 11pm Madrid** | Push resumen: "Todo en orden" → cierra celular → duerme | Sin push, abre app, no entiende metricas → ansiedad → llama a oficina |
| **Carmen ve progreso** | "Llevo 69%! Falta poco para mi Vuelta al Mundo" → sube siguiente pago motivada | Solo numeros frios → "cuanto me falta?" → llama a admin |
| **Marco el resistente** | Sistema funciona sin el (admin proxy). Lupita presume comisiones → Marco cede por presion social | Plataforma rota sin adopcion completa → fuerzan migracion → rebelion |

**Momento "aha" por rol:**
- **Noel**: Ve su negocio real en su celular por primera vez (no datos mock — 12,214 ordenes reales)
- **Lupita**: Reporta pago en 3 toques. Recibe push cuando admin verifica. Compara con WhatsApp y no hay vuelta atras
- **Mariana**: 7 pagos en 8 minutos. Lo que antes tomaba 45 min. Sin un solo mensaje de WhatsApp
- **Carmen**: Ve barra de progreso moverse despues de su pago. Siente que esta construyendo su sueno

## Experience Principles

1. **Confianza primero, funcion despues** — Cada pantalla responde "tus datos estan seguros y solo TU los ves" antes de mostrar funcionalidad. La privacidad no es un icono decorativo — es el statement visual mas importante de la plataforma. Agente X nunca ve datos de Agente Y, en ningun endpoint, bajo ninguna circunstancia.

2. **3 toques o menos** — Cualquier accion critica (reportar pago, verificar pago, ver dashboard, copiar link agente) se completa en maximo 3 interacciones. Si un flujo necesita mas pasos, el diseno tiene un problema que resolver.

3. **Datos reales desde el primer segundo** — Cero estados vacios, cero datos mock, cero "aun no hay informacion". El seed de Odoo alimenta la plataforma con 8 anos de historia (3,854 contactos, 12,214 ordenes). El primer login SIEMPRE muestra algo real y valioso para ese usuario.

4. **Emocion sobre informacion** — Carmen no necesita "$100,000 de $145,000" — necesita una barra que avanza y le dice "69% — vas increible". Noel no necesita 15 KPIs — necesita un semaforo verde que dice "todo bien, puedes dormir". Lupita no necesita un CRM — necesita ver "MI negocio". Framing emocional en cada dato.

5. **Funciona sin ti** — El sistema opera con adopcion parcial. Admin como proxy del agente resistente. Notificaciones automaticas sin abrir la app. Cache offline muestra ultimo snapshot. Si un actor falta, los demas siguen operando sin degradacion.
