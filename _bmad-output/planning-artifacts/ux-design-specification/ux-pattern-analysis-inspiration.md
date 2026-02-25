# UX Pattern Analysis & Inspiration

## Inspiring Products Analysis

**WhatsApp (referencia negativa → positiva):**
Es lo que todos los usuarios YA usan. Si la plataforma no es tan rapida como abrir WhatsApp y mandar foto, pierde. Lo que hace bien: inmediatez, notificaciones, sentido de grupo. Lo que hace MAL para AroundaPlanet: cero privacidad, cero estructura, cero trazabilidad. Leccion: igualar la velocidad en flujos criticos (3 toques = competir con "adjuntar foto + enviar").

**Nubank / Apps fintech mexicanas (BBVA, Banorte):**
El marco mental de los usuarios para "ver dinero y progreso de pagos". Lo que hacen bien: barra de progreso visual, confirmaciones con animacion sutil, notificaciones push de movimientos, UX mobile limpia. Patron transferible: plan de pagos tipo fintech para Carmen con barra visual, monto restante, sugerencia de proximo pago, confirmacion con dopamina visual.

**Shopify (modelo "Mi Negocio"):**
Insight del brainstorming: el agente como emprendedor, no como empleado de un CRM. Lo que hace bien: dashboard "Mi Tienda" donde el vendedor se siente dueno, metricas de SU negocio. Patron transferible: portal "Mi Negocio" de Lupita con framing de emprendimiento — "Mis clientes", "Mis ventas", "Mi comision", link personalizado como "mi herramienta de venta".

**Airbnb (experiencia emocional + social proof):**
Lo que hace bien: fotos reales de usuarios, reviews por componente, anticipacion del viaje, "Hosted by [nombre]". Patron transferible: UGC en landing pages (fotos de viajeros reales), credito al agente ("Asesorado por Lupita"), timeline interactivo del viaje, contenido que vende sin sentirse como venta.

**Uber/Rappi (onboarding frictionless + tracking en tiempo real):**
Lo que hacen bien: registrarse en 1 minuto, ver estado en tiempo real, notificaciones de cada paso. Patron transferible: onboarding agente en 2 minutos, cadena de notificacion completa por pago como tracking de pedido (reportado → en verificacion → verificado).

**Spotify Wrapped / Netflix (engagement recurrente):**
Lo que hacen bien: contenido personalizado, resumenes que generan compartir, engagement pasivo. Patron transferible: resumen semanal/mensual para Noel como "wrapped" de su negocio. Resumen para agentes ("Esta semana: 3 pagos, $45K, comision +$5,400"). Vision futura: "Tu Ano Viajero" wrapped para clientes.

## Transferable UX Patterns

**Patrones de navegacion:**

| Patron | Fuente | Aplicacion en AroundaPlanet |
|--------|--------|---------------------------|
| Bottom navigation mobile | Apps moviles exitosas universalmente | Navegacion principal mobile para agentes/director/clientes. Tabs: Inicio, Mis Viajes o Mi Negocio, Notificaciones, Perfil |
| Sidebar fijo desktop | Apps de productividad (Linear, Notion) | Admin y SuperAdmin en 1024px+. Sidebar siempre visible con secciones por rol |
| Deep links desde push | Todas las apps modernas | Cada notificacion lleva a la pantalla exacta. Cero navegacion manual post-tap |

**Patrones de interaccion:**

| Patron | Fuente | Aplicacion en AroundaPlanet |
|--------|--------|---------------------------|
| Floating Action Button | Material Design, WhatsApp | "Reportar Pago" como FAB en portal agente. Accion principal siempre accesible |
| Split-screen | Apps productividad (Notion, Linear) | Verificacion admin: comprobante izquierda + datos IA derecha. Solo desktop 1024px+ |
| Pull-to-refresh | Instagram, apps bancarias | Dashboard director, cola pagos admin. Gesto natural para actualizar |
| Stepper de progreso | Uber tracking pedido | Ciclo de pago: Reportado → En verificacion → Verificado/Rechazado. Visual tipo timeline |

**Patrones visuales:**

| Patron | Fuente | Aplicacion en AroundaPlanet |
|--------|--------|---------------------------|
| Card-based dashboard | Fintech + Shopify | KPIs de Noel como cards con numero grande + tendencia. Cards de viajes con barra ocupacion |
| Skeleton loading | Facebook, LinkedIn | Paneles cargan con esqueleto antes de datos. Nunca pantalla blanca |
| Offline indicator | Google Maps, Spotify | Banner sutil "Sin conexion — datos de hace 2h" en vez de error bloqueante |
| Empty state con CTA | Mailchimp, Notion | Agente nuevo sin clientes: "Comparte tu link para obtener tu primer cliente" (no "No hay datos") |

## Anti-Patterns to Avoid

| Anti-patron | Por que evitarlo | Alternativa |
|------------|-----------------|-------------|
| Tutorial de 5+ pantallas en primer login | Lupita y Marco no lo van a leer. Noel tampoco | Datos reales desde el primer segundo. El tutorial ES ver tus datos |
| Dashboard vacio "Empieza agregando..." | Mata la emocion del primer contacto. Activa trauma Wix de Noel | Seed de Odoo. Siempre hay datos reales |
| Toggle para cambiar de rol | Lupita es agente Y cliente. Toggle es confuso y duplica mental load | Sidebar unificado con todas las secciones visibles simultaneamente |
| Notificaciones masivas sin prioridad | Noel recibe 50 pushes → desactiva todo → pierde las criticas | Agrupacion inteligente + alertas por excepcion + resumen diario |
| Formularios largos antes de valor | Registro que pide RFC, fiscales, banco antes de mostrar algo | 1-click Google → ve datos → completa perfil cuando quiera |
| Chatbot o asistente IA conversacional | Noel lo rechaza explicitamente: "Yo voy en contra de eso" | IA practica (OCR comprobantes) que asiste sin conversar |
| Tablas como interfaz principal | Noel es visual-first, menciona "grafica" 3 veces | Cards, barras, semaforos, graficas. Tablas solo en drill-down |
| Hamburger menu en mobile | Features escondidas = features que nadie descubre | Bottom tabs en mobile, sidebar fijo en desktop |

## Design Inspiration Strategy

**Adoptar directamente (patrones universales probados):**
- Bottom navigation mobile (5 tabs maximo)
- Card-based KPIs (visual-first para Noel)
- Deep links en notificaciones push
- Skeleton loading (nunca pantalla blanca)
- Pull-to-refresh en dashboards y listas

**Adaptar al contexto de AroundaPlanet:**
- Shopify "Mi Tienda" → "Mi Negocio" con framing agente-emprendedor
- Nubank plan de pagos → Barra progreso emocional con hitos de viaje
- Uber tracking → Stepper de estado de pago (reportado → verificando → verificado)
- Airbnb social proof → UGC de viajeros reales con toggle publico/privado y moderacion
- Spotify Wrapped → Resumenes semanales/mensuales automaticos para director y agentes

**Evitar aunque sean populares:**
- Onboarding wizard extenso (datos reales > tutorial)
- Chatbot/asistente conversacional (anti-patron explicito de Noel)
- Tablas como vista principal (visual-first obligatorio)
- Hamburger menu en mobile (bottom tabs probadamente mejor)
- Dashboards genericos tipo BI (disenar para emociones, no solo para datos)
