# User Journey Flows

*6 journeys criticos disenados con flujos detallados, basados en los 7 user journeys del PRD.*

## Journey 1: Visitante → Cliente (Conversion Publica)

**Contexto**: Visitante llega desde Instagram/Google a landing publica. Conversion con minima friccion.
**Direccion visual**: Aventura Inmersiva (PublicLayout)

```mermaid
flowchart TD
    A[Visitante llega desde Instagram/Google] --> B{Tiene parametro ?ref=agente?}
    B -->|Si| C[Guardar ref en sessionStorage]
    B -->|No| D[Sin atribucion agente]
    C --> E[Landing de Viaje SSG]
    D --> E
    E --> F[Ve: galeria UGC + itinerario + precio + ocupacion real + testimonios]
    F --> G{Accion del visitante}
    G -->|Cotizar / Apartar| H[Modal: Google 1-click o Email]
    G -->|Seguir navegando| I[Catalogo de viajes]
    G -->|Salir| J[Retargeting Meta Pixel / Google Tag]
    H --> K{Tiene cuenta?}
    K -->|No| L[Crear cuenta Firebase Auth]
    K -->|Si| M[Login]
    L --> N[Asignar rol Cliente base]
    N --> O{Tenia ref de agente?}
    O -->|Si| P[Autoasignar a ese agente - primer toque gana]
    O -->|No| Q[Notificar admin: nuevo lead sin agente]
    P --> R[Crear orden estado Interesado en Odoo]
    Q --> R
    M --> R
    R --> S[Redirect a dashboard privado - Mis Viajes]
    S --> T[Ve: viaje de interes + plan de pagos sugerido]
    T --> U[Capturar evento: sign_up + begin_checkout en Analytics]
```

**Optimizaciones:**
- Google 1-click como camino feliz — zero formularios largos
- UTMs + ref se capturan ANTES del registro, se asocian DESPUES
- Redirect post-registro lleva al viaje que el usuario veia, no a dashboard generico
- Ocupacion real ("Quedan 7 lugares") desde Odoo Events genera urgencia honesta

## Journey 2: Lupita Reporta Pago (Core Loop)

**Contexto**: Agente reporta pago de un cliente. 3 toques, <30 seg. Mas rapido que WhatsApp.
**Direccion visual**: Emprendedor Mobile (AgentMobileLayout)

```mermaid
flowchart TD
    A[Lupita en portal Mi Negocio] --> B[Tap FAB naranja - Reportar Pago]
    B --> C[Camara se abre directamente]
    C --> D[Toma foto comprobante bancario]
    D --> E[Firebase AI Logic procesa imagen]
    E --> F{IA extrae datos OK?}
    F -->|Si - alta confianza| G[Muestra datos resaltados en VERDE]
    F -->|Parcial - baja confianza| H[Muestra datos en AMARILLO + campos editables]
    F -->|Falla| I[Formulario manual vacio - campos editables]
    G --> J[Pantalla confirmacion: Monto + Banco + Ref + Fecha]
    H --> J
    I --> J
    J --> K[Seleccionar cliente del dropdown - prellenado con sus asignados]
    K --> L{Datos correctos?}
    L -->|Si| M[Tap - Confirmar y Enviar]
    L -->|Editar| N[Tap campo - editar inline - volver a confirmar]
    N --> L
    M --> O[Animacion check verde + Toast: Pago reportado]
    O --> P[Regresa a vista anterior]
    P --> Q[Pago aparece en historial con badge AMARILLO - Pendiente]
    Q --> R[Push a admin: Nuevo pago de Roberto por 15K]
    R --> S{Admin verifica}
    S -->|Verificado| T[Push a Lupita: Tu pago de 15K fue verificado]
    S -->|Rechazado| U[Push a Lupita: Pago rechazado - motivo + deep link]
    T --> V[Badge cambia a VERDE en historial]
    V --> W[Comision de Lupita se recalcula]
    U --> X[Lupita tap push - ve motivo - puede reenviar]
```

**Optimizaciones:**
- Camara se abre directo (no file picker) — competir con WhatsApp en velocidad
- IA con niveles de confianza: verde (auto-llena), amarillo (sugiere), vacio (fallback manual)
- Dropdown de clientes prellenado con SUS asignados, no 3,854 contactos
- Post-envio regresa a vista anterior, no a pantalla de exito extra

## Journey 3: Mariana Verifica Pagos (Admin Desktop)

**Contexto**: Admin verifica cola de pagos. Split-screen IA-asistida. 7 pagos en 8 minutos.
**Direccion visual**: Dashboard Ejecutivo (AdminDesktopLayout)

```mermaid
flowchart TD
    A[Mariana abre portal - sidebar Operaciones] --> B[Ve cola de verificacion]
    B --> C[Cola ordenada por antiguedad - urgentes mayor48h arriba con badge ROJO]
    C --> D[Card preview: monto + reporter + cliente + tiempo en cola]
    D --> E[Clic en pago - Split-screen se abre]
    E --> F[IZQUIERDA: Imagen comprobante - zoom + rotar]
    E --> G[DERECHA: Datos IA extraidos + datos Odoo]
    G --> H{Monto reportado = monto esperado?}
    H -->|Si| I[Highlight VERDE - coincide]
    H -->|Difiere| J[Highlight AMARILLO - diferencia visible]
    G --> K{Referencia duplicada?}
    K -->|Si| L[Alerta ROJA: Posible duplicado - ver original]
    K -->|No| M[Sin alerta]
    I --> N{Decision de Mariana}
    J --> N
    L --> N
    M --> N
    N -->|Verificar| O[Clic boton verde VERIFICAR o atajo V]
    N -->|Rechazar| P[Clic boton rojo RECHAZAR o atajo R]
    O --> Q[Card desaparece de cola con animacion]
    Q --> R[Contador: Verificados hoy +1]
    R --> S[NotificationService dispara automaticamente]
    R --> T[Cola muestra siguiente pago - atajo flecha derecha]
    P --> U[Modal: Seleccionar motivo - dropdown + texto libre]
    U --> V[Confirmar rechazo]
    V --> W[Push a reporter con motivo + deep link]
    W --> T
```

**Optimizaciones:**
- Atajos teclado: [V] verificar, [R] rechazar, [→] siguiente — flujo sin mouse
- Split-screen: comprobante siempre visible mientras compara datos
- Urgencia >48h como badge rojo, no color de fila completa
- Contador "Verificados hoy: N" como feedback de maestria

## Journey 4: Noel Dashboard Nocturno (Director Mobile)

**Contexto**: Noel en Madrid a las 11pm. Quiere saber si todo esta bien para dormir tranquilo.
**Direccion visual**: Ejecutivo + Emocional (DirectorLayout)

```mermaid
flowchart TD
    A{Como entra Noel?}
    A -->|Push 10pm Madrid| B[Push: Resumen del dia - tap para ver]
    A -->|Abre app| C[Dashboard carga directo]
    B --> D[Deep link a dashboard]
    C --> D
    D --> E[HERO: Semaforo de salud del negocio]
    E --> F{Estado del semaforo}
    F -->|VERDE| G[Todo en orden - sin excepciones]
    G --> H[Noel ve semaforo verde - tranquilidad]
    H --> I{Quiere mas detalle?}
    I -->|No| J[Cierra app - duerme tranquilo]
    I -->|Si| K[Scroll - KPI cards]
    F -->|AMARILLO| L[Atencion: N pagos pendientes mayor48h]
    L --> M[Noel tap en alerta - detalle]
    M --> N[Ve lista de pagos pendientes con responsable]
    N --> O{Accion?}
    O -->|Solo monitorear| J
    O -->|Actuar| P[Deep link a pago o notificar admin]
    F -->|ROJO| Q[Accion requerida: agente inactivo N dias]
    Q --> R[Noel tap - detalle del problema]
    R --> S[Opciones: contactar agente / escalar / marcar como visto]
    K --> T[KPI cards swipe horizontal]
    T --> U{Tap en KPI}
    U --> V[Drill-down: semana/mes/trimestre/YoY]
```

**Optimizaciones:**
- Semaforo como HERO — responde "esta todo bien?" sin leer nada
- Push proactivo nocturno — Noel no tiene que recordar abrir la app
- Si todo verde, interaccion completa <10 segundos
- Drill-down OPCIONAL — solo para Noel Racional, no para Noel Vulnerable

## Journey 5: Carmen Progreso de Viaje (Cliente Mobile)

**Contexto**: Carmen consulta progreso de pagos de su Vuelta al Mundo. Quiere sentir que avanza.
**Direccion visual**: Journey Emocional (ClientLayout)

```mermaid
flowchart TD
    A[Carmen abre app - Mis Viajes] --> B[Ve card principal: Vuelta al Mundo 33 Dias]
    B --> C[HERO: EmotionalProgress bar al 69%]
    C --> D[Mensaje emocional: Vas increible Carmen. El Taj Mahal te espera]
    D --> E[Scroll - Timeline de pagos]
    E --> F[Pagos verificados: dots VERDES con check + monto + fecha]
    E --> G[Proximo pago sugerido: dot NARANJA + monto + fecha sugerida]
    E --> H[Pagos futuros: dots GRISES]
    D --> I{Carmen quiere actuar?}
    I -->|Reportar pago| J[Tap Reportar Pago - flujo foto camara]
    I -->|Ver documentos| K[Tap Documentos - lista descargable: contrato itinerario]
    I -->|Ver detalle viaje| L[Tap Itinerario - timeline dia-por-dia con fotos]
    I -->|Solo consultar| M[Scroll - ve historial completo - cierra satisfecha]
    J --> N[Pago reportado - badge amarillo en timeline]
    N --> O{Admin verifica}
    O -->|Verificado| P[Push: Tu pago fue verificado - llevas 83%!]
    P --> Q[Carmen abre push - barra avanzo - micro-celebracion]
    Q --> R{Hito alcanzado?}
    R -->|25%| S[Tu aventura comienza a tomar forma]
    R -->|50%| T[Mitad del camino - increible!]
    R -->|75%| U[Casi llegas - el mundo te espera]
    R -->|100%| V[Celebracion especial: confetti + Viaje pagado completo!]
    R -->|No| W[Barra avanza suavemente + nuevo porcentaje]
```

**Optimizaciones:**
- Barra de progreso como HERO — responde "que tan cerca estoy?"
- Mensajes emocionales personalizados con nombre + destino
- Micro-celebraciones en hitos 25/50/75/100%
- Self-service: Carmen reporta pago sin llamar a su agente

## Journey 6: Primer Login Agente (Momento Critico de Adopcion)

**Contexto**: Lupita abre la app por primera vez. Si no ve SUS datos reales, no regresa.
**Direccion visual**: Emprendedor Mobile (AgentMobileLayout)

```mermaid
flowchart TD
    A[Lupita recibe link de invitacion por WhatsApp] --> B[Abre link - AuthLayout]
    B --> C[Google 1-click o email + password]
    C --> D[Firebase Auth crea cuenta]
    D --> E{SuperAdmin ya asigno rol Agente + seed Odoo?}
    E -->|Si - camino feliz| F[Redirect a Mi Negocio]
    E -->|No - edge case| G[Redirect a Mi Portal cliente - notificar admin]
    F --> H[PRIMER IMPACTO: Ve SUS datos reales de Odoo]
    H --> I[Greeting: Hola Lupita - Tu negocio]
    I --> J[Metricas REALES: 12 clientes + 180K ventas + 5400 comision]
    J --> K[Lista de SUS clientes con nombre + viaje + porcentaje pagado]
    K --> L{Reaccion emocional}
    L -->|Wow mis datos| M[Confianza establecida - Lupita explora]
    L -->|Que mas hay| N[Scroll natural - descubre mas secciones]
    M --> O[Explora: clientes detalle comisiones link atribucion]
    N --> O
    O --> P[Ve FAB naranja - Reportar Pago]
    P --> Q{Tiene pago que reportar?}
    Q -->|Si| R[Primer reporte de pago]
    Q -->|No| S[Copia link personalizado ref=lupita - comparte en WA]
    R --> T[Exito: Pago reportado en 3 toques]
    T --> U[Push cuando admin verifica - Lupita confirma que funciona]
    U --> V[ADOPCION COMPLETA: Lupita ya no usa WA para pagos]
    S --> W[Agente comparte link - lead se autoasigna]
    W --> X[Push: Nuevo lead desde tu link - motivacion]
```

**Optimizaciones:**
- Seed de Odoo ANTES del primer login — cero estados vacios
- Greeting personalizado: "Hola Lupita" no "Bienvenido usuario"
- Metricas como primer impacto — el "onboarding" ES ver tus datos reales
- No hay wizard de 5 pasos ni tutorial

## Journey Patterns

**Patrones de navegacion:**

| Patron | Donde aplica | Implementacion |
|--------|-------------|---------------|
| Entry via deep link | Todos los journeys post-notificacion | Push → deep link a seccion exacta. Cero navegacion manual |
| FAB como accion primaria | Agente + Cliente mobile | Boton flotante naranja siempre visible. 1 tap = inicia accion core |
| Bottom nav contextual | Todos los roles mobile | 4 tabs: Inicio, Viajes/Negocio, Alertas, Perfil. Tabs cambian por rol |
| Sidebar por secciones | Admin + SuperAdmin desktop | Secciones agrupadas: Director, Operaciones, Mi Portal. Separadores visuales |

**Patrones de decision:**

| Patron | Donde aplica | Implementacion |
|--------|-------------|---------------|
| Confirmar antes de enviar | Reporte pago, verificacion, rechazo | Pantalla intermedia con datos resaltados + boton confirmar |
| Motivo obligatorio en rechazo | Admin rechaza pago | Modal con dropdown predefinidos + texto libre |
| Drill-down progresivo | Dashboard director, detalle agente | KPI agregado → tap → detalle por periodo → tap → ordenes |

**Patrones de feedback:**

| Patron | Donde aplica | Implementacion |
|--------|-------------|---------------|
| Animacion de exito | Post-reporte pago, post-verificacion | Check animado verde + toast. No spinner generico |
| Badge de estado | Historial pagos, cola verificacion | Verde=verificado, Amarillo=pendiente, Rojo=rechazado. Color+icono+texto |
| Push cadena completa | Todo el ciclo de pago | Reportado→admin. Verificado→reporter+cliente. Rechazado→reporter+motivo |
| Datos con timestamp | Dashboard, cola, historial | "Actualizado hace 12 min". Offline: "Sin conexion — datos de hace 2h" |

## Flow Optimization Principles

1. **Competir con WhatsApp en velocidad** — Reportar pago <30s (WA: 2-3 min), verificar <90s (WA: 6-8 min), consultar estado <10s (WA: llamar a oficina)
2. **Zero estados vacios** — Seed de Odoo garantiza datos reales desde primer login. Empty states solo en agentes nuevos con CTA: "Comparte tu link para obtener tu primer cliente"
3. **Recuperacion sin drama** — IA falla → formulario manual. Odoo caido → cache. Pago rechazado → motivo + accion. Offline → ultimo snapshot + banner
4. **Notificaciones como cierre de loop** — Cada accion dispara notificacion al siguiente actor. El ciclo no tiene huecos
5. **Progresion emocional** — Cada paso tiene feedback proporcional: micro-feedback (toast), progreso (barra), celebracion (hitos), tranquilidad (semaforo verde)
