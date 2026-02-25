# UX Consistency Patterns

## Button Hierarchy

| Nivel | Estilo | Uso | Ejemplo |
|-------|--------|-----|---------|
| **Primary** | Fondo `accent`, texto `primary`, bold | UNA accion principal por pantalla | "Confirmar y Enviar", "Verificar", "Cotizar" |
| **Secondary** | Fondo `card`, borde `border`, texto `primary` | Acciones complementarias | "Rechazar", "Cancelar", "Ver Detalle" |
| **Ghost** | Sin fondo, texto `primary`, hover fondo `muted` | Acciones terciarias | "Saltar", "Ver mas", "Editar" |
| **Destructive** | Fondo `destructive`, texto blanco | Acciones irreversibles (confirmar previamente) | "Rechazar Pago", "Desactivar Usuario" |
| **Icon-only** | Circulo ghost con icono, tooltip hover | Acciones compactas en tablas/cards | Zoom, rotar, copiar |

**Reglas:** Max 1 Primary por pantalla visible. Destructive SIEMPRE requiere Dialog. Touch target min 48px mobile, 36px desktop. FAB = Primary elevado, solo para "Reportar Pago".

## Feedback Patterns

**Success**: Toast verde (`primary-muted`), check icon, 4s auto-dismiss. Ej: "Pago reportado"
**Error**: Toast coral (`destructive-muted`), X icon, persiste hasta dismiss manual. Ej: "Error al subir"
**Warning**: Banner inline amarillo (`warning-bg`), persiste hasta resolver. Ej: "2 pagos >48h"
**Info**: Banner inline azul (`info-bg`), junto al dato. Ej: "Datos de Odoo de hace 2h"
**Offline**: Banner sticky top `warning-bg`, icono wifi-off. Persiste hasta reconexion
**Confirmacion destructiva**: Dialog centrado + overlay. "Cancelar" (secondary) + "Confirmar" (destructive)

## Toast Patterns

**Anatomia**: Top-right desktop, top-center mobile. Max 360px desktop, 100%-32px mobile. Border-radius 12px, shadow-lg.
**Animacion**: Slide-down + fade-in 200ms entrada. Fade-out + slide-up 150ms salida. Barra countdown sutil para auto-dismiss.

| Variante | Fondo | Duracion | Dismiss |
|----------|-------|----------|---------|
| Success | `#D8F3DC` | 4s auto | Click X o swipe |
| Error | `#FADBD8` | Persiste | Solo click X |
| Warning | `#FFF3CD` | 6s auto | Click X o swipe |
| Info | `#D6EAF8` | 4s auto | Click X o swipe |
| Loading | `#FFFFFF` borde | Hasta completar | No dismissable |

**Toasts por accion critica:**

| Accion | Variante | Texto | CTA en toast |
|--------|----------|-------|-------------|
| Pago reportado | Success | "Pago reportado — en cola de verificacion" | No |
| Pago verificado (admin) | Success | "Pago verificado — notificaciones enviadas" | "Siguiente" |
| Pago rechazado (admin) | Warning | "Pago rechazado — [nombre] sera notificado" | No |
| Error upload | Error | "No pudimos subir la imagen — intenta de nuevo" | "Reintentar" |
| Link copiado | Success | "Link copiado al portapapeles" | No |
| Perfil guardado | Success | "Datos guardados" | No |
| Odoo limitado | Warning | "Conexion limitada — datos recientes" | No |
| Sesion expirada | Error | "Tu sesion expiro" | "Login" |

**Reglas**: Max 3 visibles simultaneos (stack, mas nuevo arriba). Error NUNCA auto-dismiss. Loading bloquea duplicados. No cubrir FAB ni bottom nav en mobile.

## Push Notification Patterns

**REGLA CRITICA: Deep link funcional es requisito no-negociable de todo push. Push sin deep link = push roto = NO se envia.**

**Anatomia de push:**

| Elemento | Especificacion |
|----------|---------------|
| **Icon** | Logo AroundaPlanet (`logo-aroundaplanet.webp`, 72px) |
| **Titulo** | <50 chars, accion + dato clave |
| **Body** | Contexto: quien + que |
| **Deep link** | URL interna a pantalla EXACTA con datos PRE-CARGADOS |
| **Imagen** | Opcional — foto viaje para pushes emocionales |

**Deep link como accion, no como informacion:**
- "Pago verificado" → abre historial con ESE pago highlighted, no lista generica
- "Nuevo lead" → abre perfil de ESE cliente, no lista de clientes
- "Resumen del dia" → abre dashboard con datos del dia
- "2 pagos pendientes >48h" → abre cola filtrada con esos pagos especificos
- Si no logueado: login → redirect automatico al deep link (no se pierde)
- Si no tiene permiso: redirect a su dashboard + toast info
- Deep links usan IDs reales de Firestore, no parametros genericos
- **QA**: tap push → pantalla correcta → datos correctos = criterio de aceptacion

**Templates de push por tipo:**

| Tipo | Titulo | Body | Deep link | Agrupacion |
|------|--------|------|-----------|-----------|
| Pago reportado | "Nuevo pago — $15K" | "Lupita → Roberto Garcia" | `/admin/verificacion/[id]` | Si (5+ en 1h) |
| Pago verificado | "Pago verificado — $15K" | "Roberto — VaM" | `/agente/pagos/[id]` | No |
| Pago rechazado | "Pago rechazado" | "[Motivo] — toca para ver" | `/agente/pagos/[id]` | No (urgente) |
| Nuevo lead | "Nuevo cliente desde tu link" | "[Nombre] — [viaje]" | `/agente/clientes/[id]` | No |
| Lead sin asignar | "Lead sin agente" | "[Nombre] — asignar" | `/admin/leads` | Si |
| Resumen diario | "Resumen del dia" | "Todo en orden" o "N alertas" | `/dashboard` | N/A (programado) |
| Resumen semanal | "Tu semana" | "3 pagos, $45K, $5.4K comision" | `/agente/mi-negocio` | N/A (programado) |
| Hito progreso | "Llevas 75%!" | "Casi llegas — el mundo te espera" | `/mis-viajes/[slug]` | No |
| Alerta excepcion | "Atencion requerida" | "Agente [nombre] inactivo 7d" | `/dashboard/agentes/[id]` | Si |

**Reglas de dispatch:**
- Horario silencioso: respeta config usuario (default 11pm-7am local)
- Director resumen: 10pm hora Madrid (configurable)
- Agente resumen: lunes 9am hora local
- Retry: hasta 3 intentos si FCM falla, fallback a email
- Agrupacion: 5+ eventos mismo tipo en <1h = 1 push resumen. NUNCA agrupar rechazos ni alertas
- Canales configurables desde perfil por categoria

## Form Patterns

**Inputs**: 48px height mobile, 40px desktop. Label arriba (Inter Medium 14px). Borde primary on focus, destructive on error. Error debajo del campo (12px). Nunca borrar input del usuario al mostrar error.

**Reporte pago (formulario IA)**: Campos prellenados con indicador confianza (verde/amarillo). Editar con 1 tap inline. Submit deshabilitado hasta requeridos completos. Selector cliente prellenado con SUS asignados.

**Perfil/fiscales**: Secciones colapsables (Personales, Fiscales, Bancarios). Guardado automatico por seccion. Icono candado en datos sensibles + "Solo tu ves estos datos".

## Navigation Patterns

**Mobile (Bottom Nav)**: 4-5 tabs max. Tab activo en `accent`. Badge numerico en Alertas. Ocultar on scroll-down, mostrar on scroll-up. Fade 200ms entre tabs.

**Desktop (Sidebar)**: 280px fijo, siempre visible. Secciones colapsables por rol. Item activo `rgba(accent, 0.15)`. Logo top, perfil/logout bottom.

**Deep links (push)**: Cada push → pantalla exacta. Si no logueado → login → redirect. Si no permiso → dashboard default + toast.

**Transiciones**: Tabs fade 200ms. Push content slide-left 250ms. Modales fade-in 200ms. Sheets slide-up 300ms spring.

**Sin breadcrumbs** (navegacion flat). Excepcion: drill-down director usa back-arrow en header.

## Empty States & Loading

**Loading**: NUNCA pantalla blanca. Skeleton que replica forma del contenido. Pulse 0.5→1.0 opacity, 1.5s cycle.

**Empty states**: Prioridad que NO pase (seed Odoo). Si agente nuevo sin clientes: ilustracion linea + "Tu primer cliente te espera" + CTA "Comparte tu link". NUNCA "No hay datos".

**Error de carga**: "No pudimos cargar esta informacion" + causa breve + "Reintentar" button. Odoo offline: cache + banner info.

## Modal & Overlay Patterns

**Dialog**: Overlay rgba(0,0,0,0.5), click-outside dismiss. 440px max. Focus trap + Escape dismiss. Botones: Secondary izq + Primary/Destructive der.

**Sheet (mobile)**: Slide-up, 85vh max. Handle bar top. Swipe-down dismiss. Para: detalle pago, filtros, selector.

**Fullscreen (mobile)**: Flujos multi-paso (camara pago). Header back-arrow + titulo + accion.

## Search & Filtering

**Catalogo viajes**: Filtros inline tipo chips arriba del grid. Real-time, no boton "Aplicar". Tags con X para deseleccionar.

**Selector cliente (agente)**: Combobox con busqueda. Solo SUS asignados. Ultimo seleccionado como sugerencia.

**Cola verificacion**: Sin busqueda — cola priorizada por antiguedad. Filtro rapido: Todos / Urgentes / Hoy.

## Assets Existentes

**Ubicacion**: `AlekContenido:execution/web-audit/assets/`

| Categoria | Cant. | Formato | Uso |
|-----------|-------|---------|-----|
| Logo | 1 | WebP | Sidebar, navbar, push icon 72px, favicon, PWA manifest, OG images |
| Fotos productos | 26 | WebP | TripCard hero, landing pages SSG, carousels, push images |
| Fotos agentes | 15 | WebP | Avatar cards, directorio publico, perfil |
| Carousel homepage | 10 | WebP | Scroll Morph Hero, galeria homepage |
| Hero/grupo | 2 | WebP | Hero sections publicas, about us |
| Backgrounds | 2 | WebP | Parallax, fondos secciones |
| Promocionales | 7 | WebP | Marketing, redes sociales |
| CEO (Noel) | 1 | WebP | About us, credibilidad |
| SVG decorativos | 2 | SVG | Iconos about us |

**Estrategia de assets**: Logo multi-tamano (16/72/192/512px). Productos alimentan TripCard via Odoo. Agentes con fallback iniciales sobre `primary-muted`. Assets en Firebase Storage con CDN. UGC futuro en `/ugc/[userId]/[tripId]/`.
