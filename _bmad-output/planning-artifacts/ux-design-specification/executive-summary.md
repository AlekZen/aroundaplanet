# Executive Summary

## Project Vision

AroundaPlanet es una PWA (Next.js + Firebase) que reemplaza un grupo de WhatsApp de 42 personas con 4 portales inteligentes por rol, integrada bidireccionalmente con Odoo 18 Enterprise (12,214 ordenes reales, 3,854 contactos, 21 modulos). No es un SaaS generico — es una capa custom que potencia la infraestructura existente de Odoo con UX especializada por rol.

La plataforma resuelve tres dolores inmediatos: (1) eliminar la exposicion de datos sensibles en WhatsApp mediante portales con permisos granulares, (2) dar a cada agente freelance visibilidad real de su cartera, clientes y comisiones para construir confianza y retencion, y (3) darle al director visibilidad ejecutiva en tiempo real desde Madrid, donde se muda permanentemente el 3 de marzo de 2026.

**Principio rector UX**: La plataforma no vende funcionalidad — vende confianza (agentes), tranquilidad (director), productividad (admins) y emocion (clientes). Cada decision de diseno debe evaluarse contra estas emociones, no solo contra los requerimientos funcionales.

## Target Users

**Noel — Director / Fundador (Primario)**
- Dispositivo: Celular (mobile-first). Nivel tecnico: Bajo
- Pensador visual-first: rechaza tablas, aprueba rapido con demos. Menciona "grafica" 3 veces en conversaciones
- Dualidad emocional "Los Dos Noeles": Noel Racional (8pm, KPIs y metricas) vs Noel Vulnerable (11pm, busca senales de vida y tranquilidad)
- Trauma Wix: pago por pagina "personalizada" que era plantilla. Necesita VER para creer
- Anti-chatbot explicito. Piensa en estructura jerarquica ("puestos y produccion por puesto")
- Exito UX: Abre la app en Madrid a las 11pm. Ve que todo esta bien. Cierra el celular y duerme

**Lupita — Agente Freelance (~100 agentes, Primario)**
- Dispositivo: Celular exclusivamente. Nivel tecnico: Basico (WhatsApp)
- Miedo profundo: que la agencia le "robe" clientes. La desconfianza es mas profunda que el problema de privacidad
- Motivacion de adopcion: por primera vez VE su negocio — sus clientes, sus comisiones, su cartera. La confidencialidad es beneficio; la transparencia es killer feature
- Tambien es Cliente — puede comprar viajes para si misma (rol aditivo)
- Exito UX: Abre la app. Ve "12 clientes, $180K ventas del mes, comision $X". Reporta pago en 3 toques. Nadie mas ve sus datos

**Mariana — Administrativa (8 personas, Primario)**
- Dispositivo: Escritorio todo el dia. Nivel tecnico: Medio (usa Odoo para cotizaciones)
- Saturada con procesos manuales: 5-6 interacciones WhatsApp por cada pago. El equipo es capaz, la herramienta no
- Frustracion secreta: las cotizaciones PDF ("nos quita mucho tiempo")
- Va a ser medida (Noel quiere productividad por puesto). El sistema debe ayudarla a ser productiva, no vigilarla
- Exito UX: 7 pagos verificados en 8 minutos. Antes eran 45 minutos de WhatsApp

**Carmen — Cliente / Viajera (Secundario en MVP)**
- Dispositivo: Celular. Nivel tecnico: Variable — debe ser extremadamente simple
- No compro un servicio — compro un sueno. Cada pago es un paso mas cerca de la aventura de su vida
- Portal cliente no es lo que vende la plataforma a Noel, pero tiene mayor potencial para Fase 1 (UX emocional, gamificacion)
- Exito UX: Abre portal. Ve "$100K de $145K pagados — 69%". Descarga contrato. Ve itinerario. No pregunto a nadie

**Alek — SuperAdmin (Operativo)**
- Dispositivo: Desktop. Nivel tecnico: Alto
- Gestion de usuarios, roles aditivos, sync Odoo, configuracion de umbrales y horarios
- No necesita UX emocional — necesita eficiencia y control

## Key Design Challenges

1. **Complejidad de roles aditivos en una sola interfaz** — 5 roles donde un usuario puede tener multiples (Lupita = Agente + Cliente, Noel = Director + Cliente). El sidebar debe adaptarse dinamicamente mostrando todas las secciones del usuario sin confusion ni toggles. Este es el desafio de navegacion mas critico del proyecto.

2. **Mobile-first con experiencia desktop diferenciada** — Noel y 100 agentes usan celular (375px+). Mariana y admins usan escritorio con split-screen de verificacion. No es "responsive" generico — son dos experiencias UX distintas que comparten sistema de diseno.

3. **Adopcion sin friccion para usuarios resistentes** — Marco (agente resistente, 52 anos) nunca leera un manual. Onboarding de 2 minutos. Primer login muestra SUS clientes con datos REALES de Odoo. El sistema funciona sin el (admin como proxy), pero la ventaja visible genera presion social natural.

4. **Flujo de pago IA en maxima simplicidad** — Foto → IA extrae datos → confirma → enviado. <=3 toques, <30 segundos total. Todo el flujo critico del negocio depende de que esto sea mas rapido y privado que mandar foto a WhatsApp.

5. **Transicion publico → privado seamless** — Visitante llega desde Instagram a landing publica, crea cuenta con 1 click (Google), y aparece en dashboard privado sin ruptura de experiencia. Atribucion UTM/ref capturada transparentemente.

6. **Dashboard para dos estados emocionales** — El mismo dashboard debe servir al Noel Racional (KPIs, metricas, drill-down) y al Noel Vulnerable (senales de vida, actividad reciente, alertas por excepcion). Dos capas de informacion en un solo espacio.

## Design Opportunities

1. **Barra de progreso emocional** — Carmen ve su progreso de pago como un viaje visual con micro-celebraciones en hitos (25/50/75/100%). Convierte "pagar" en "avanzar hacia tu sueno". Gamificacion emocional que genera engagement y acelera pagos. Ningun competidor hace esto.

2. **Portal "Mi Negocio" tipo Shopify** — Lupita no usa un CRM — ve SU negocio. El framing visual cambia de "herramienta de la empresa" a "plataforma de mi emprendimiento". Links personalizados con atribucion, comisiones en tiempo real, catalogo de viajes. Modelo agente-emprendedor unico en el sector.

3. **Split-screen verificacion IA-asistida** — Mariana ve comprobante (izq) + datos IA prellenados resaltados para comparacion manual (der) + boton 1-clic verificar/rechazar. Reduce 45 min de WhatsApp a 5 min. La pantalla con mayor impacto operativo del proyecto.

4. **UGC como motor de conversion visual** — Fotos reales de viajeros en landing pages. Carmen marca sus fotos como publicas post-viaje. Generan trafico organico con atribucion UTM. Social proof visual que cuesta $0 producir y es mas persuasivo que fotos de stock.

5. **Notificaciones como experiencia emocional** — Deep links a seccion relevante. Push de hitos emocionales ("Tu pago fue verificado — llevas 83%"). Resumenes nocturnos para Noel. El NotificationService no es infraestructura — es un canal de experiencia de usuario.
