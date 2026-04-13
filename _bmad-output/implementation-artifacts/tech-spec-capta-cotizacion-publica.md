---
title: 'CAPTA Cotización Pública'
slug: 'capta-cotizacion-publica'
created: '2026-04-13'
status: 'Implementation Complete'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
tech_stack: ['Next.js 16 App Router', 'React Hook Form 7.71', '@hookform/resolvers 5.2', 'Zod', 'Tailwind CSS v4', 'shadcn/ui']
files_to_modify: ['src/config/whatsapp.ts', 'src/schemas/cotizacionSchema.ts', 'src/app/(public)/cotizar/page.tsx', 'src/app/(public)/cotizar/CotizacionForm.tsx', 'src/app/(public)/cotizar/cotizacionMessage.ts', 'src/app/(public)/cotizar/CotizacionForm.test.tsx', 'src/schemas/cotizacionSchema.test.ts', 'src/app/(public)/cotizar/cotizacionMessage.test.ts']
code_patterns: ['camelCase Zod schemas with Schema suffix', 'co-located tests (Component.test.tsx)', 'Server Components by default, use client pushed low', 'PublicLayout provides navbar+footer+AnalyticsProvider+PageTransition with max-w-7xl mx-auto px-4', 'buildWhatsAppUrl() in src/config/whatsapp.ts', 'shadcn/ui Form wrapper with FormField+FormItem+FormLabel+FormControl+FormMessage']
test_patterns: ['Vitest + @testing-library/react', 'co-located *.test.tsx next to component', '10 existing test files in (public)/ routes']
adversarial_fixes: ['F1-url-length', 'F2-anchor-fallback', 'F3-coerce-number', 'F4-date-validation', 'F5-no-double-padding', 'F6-file-naming', 'F7-no-whatsapp-fallback', 'F10-edades-format', 'F11-robots-noindex', 'F13-inline-message-example', 'F14-disable-on-submit']
---

# Tech-Spec: CAPTA Cotización Pública

**Created:** 2026-04-13

## Overview

### Problem Statement

El formulario HTML de cotización (`capta-cotizacion-demo.html`) se comparte por WhatsApp como archivo `.html`. En iPhone Safari/WebView, JavaScript puede estar bloqueado en archivos locales (`file://`), rompiendo los botones de "Copiar texto" y generación de mensaje. El flujo queda inservible en iOS. Además: sin trazabilidad, cada actualización requiere re-enviar el archivo, y el flujo es de 2 pasos (copiar texto → pegar en WhatsApp).

### Solution

Página pública `/cotizar` dentro del proyecto Next.js existente. Formulario React con el design system del repo (verde `#1B4332` + naranja `#F4A261` + shadcn/ui), botón WhatsApp directo con `wa.me/?text=` que elimina el paso de copiar/pegar. Hosting en Firebase App Hosting ya configurado — cero infraestructura adicional. Compatible con Safari iOS al ser una página web normal (no archivo local).

### Scope

**In Scope:**
- Página pública en `src/app/(public)/cotizar/page.tsx`
- Formulario React + Tailwind + shadcn/ui (conversión del HTML existente)
- Validación con Zod + React Hook Form
- Botón WhatsApp directo (`wa.me/5219981523109?text=` con mensaje pre-armado URL-encoded)
- Campo "Agente" como texto libre
- Responsive mobile-first
- Compatibilidad Safari iOS

**Out of Scope:**
- Persistencia en Firestore (v2)
- Notificaciones al admin (v2)
- Panel admin de cotizaciones (v2)
- QR code, localStorage draft, PWA (v2)
- Versión dentro del dashboard del agente (futuro)
- Select de agentes poblado desde Firestore (futuro dashboard)

## Context for Development

### Codebase Patterns

- **Zod schemas:** `camelCase` + sufijo `Schema`, tipos derivados con `z.infer<typeof>`. Constantes como arrays readonly exportados. Ubicación: `src/schemas/`
- **Componentes:** `PascalCase` archivos, un componente por archivo. `'use client'` solo donde se necesite interactividad
- **PublicLayout** (`src/app/(public)/layout.tsx`): provee `AnalyticsProvider`, navbar fija, footer, `PageTransition`, wrapper `max-w-7xl mx-auto px-4`, main con `pt-16`. **IMPORTANTE:** el layout ya aplica `px-4` — las páginas hijas NO deben agregar padding horizontal propio para evitar doble padding en mobile
- **shadcn/ui Form:** El proyecto tiene `src/components/ui/form.tsx` — wrapper de RHF que exporta `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`. Usar este patrón.
- **WhatsApp:** `buildWhatsAppUrl(phone, text)` en `src/config/whatsapp.ts`. Dos números: `WHATSAPP_CONTACT_NUMBER` (`523331741585`, usado por ConversionForm para reservaciones) y `WHATSAPP_COTIZACION_NUMBER` (`5219981523109`, para cotizaciones). El formulario de cotización usa `WHATSAPP_COTIZACION_NUMBER`
- **shadcn/ui disponibles:** `Select`, `Input`, `Button`, `Textarea`, `Label`, `Form` (RHF wrapper)
- **Tests:** co-localizados. Vitest + @testing-library/react. Para shadcn/ui `Select` (Radix): usar `getByRole('combobox')` + `userEvent.click()` + `getByRole('option')` para interactuar en tests. NO usar `fireEvent.change` (no funciona con Radix Select en JSDOM)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/config/whatsapp.ts` | `buildWhatsAppUrl()` y `WHATSAPP_CONTACT_NUMBER` — reutilizar |
| `src/schemas/orderSchema.ts` | Patrón de referencia para Zod schemas (naming, exports, constantes) |
| `src/components/ui/form.tsx` | Wrapper shadcn/ui para RHF (`Form`, `FormField`, `FormItem`, etc.) |
| `src/components/ui/select.tsx` | `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` |
| `src/components/ui/textarea.tsx` | Componente `Textarea` |
| `src/app/(public)/layout.tsx` | PublicLayout — hereda navbar + footer + `px-4` automáticamente |

### Technical Decisions

- **Design system del repo**, no la paleta cyan del HTML original
- **React Hook Form + Zod + shadcn/ui Form wrapper** para validación client-side
- **WhatsApp vía `<a href>` tag**, NO `window.open` — Safari iOS bloquea `window.open` si el call stack pasa por código async (RHF `handleSubmit` es internamente async). Un `<a href={waUrl} target="_blank">` dentro de un click handler de usuario NUNCA es bloqueado por Safari. El flujo: al submit válido, construir URL y setearla en un estado, luego renderizar el `<a>` como botón de confirmación que el usuario clickea para abrir WhatsApp
- **Sin Firestore** — MVP es formulario → WhatsApp
- **Campo agente como texto libre** en versión pública
- **Server Component** para `page.tsx` (metadata SEO), **Client Component** para `CotizacionForm.tsx`
- **Sin server action** — todo client-side
- **`robots: 'noindex, nofollow'`** — esta es una herramienta interna para agentes, NO debe ser indexable por buscadores
- **Campos numéricos en selects:** shadcn/ui Select retorna `string`. Usar `z.coerce.number()` en el schema Zod para `adultos`, `menores`, `habitaciones`. Esto convierte `"2"` → `2` automáticamente
- **Fechas pasadas permitidas** — un agente puede registrar una cotización retroactiva. Solo se valida que `fechaRegreso >= fechaSalida` y que ambas sean fechas válidas
- **Límite de URL WhatsApp:** Safari iOS tiene ~2,083 caracteres de límite en URLs. El campo `notas` tiene `maxLength: 300` en el schema para prevenir exceder el límite después de `encodeURIComponent`
- **Se asume que el usuario tiene WhatsApp** — esta es una herramienta para agentes freelance que usan WhatsApp como canal principal. No se implementa fallback para "sin WhatsApp"

### Inventario de Campos

| Campo | Tipo Zod | Opciones | Requerido | Notas |
| ----- | -------- | -------- | --------- | ----- |
| nombreAgente | `z.string().min(2)` | — | Sí | |
| nombreCliente | `z.string().min(2)` | — | Sí | |
| tipoViaje | `z.enum([...])` | Nacional, Internacional, Crucero, Paquete todo incluido, Vuelo+Hotel, Solo vuelo, Solo hotel | Sí | |
| destino | `z.string().min(2)` | — | Sí | |
| fechaSalida | `z.string().refine(isValidDate)` | — | Sí | Input `type="date"` retorna `YYYY-MM-DD` |
| fechaRegreso | `z.string().refine(isValidDate)` | — | Sí | Refinamiento cruzado: `>= fechaSalida` |
| adultos | `z.coerce.number().int().min(1)` | 1-12, 15, 20, 25, 30 | Sí | Select retorna string, coerce convierte |
| menores | `z.coerce.number().int().min(0)` | 0-10 | No | Default 0 |
| edadesMenores | `z.string().regex(/^\d+(\s*,\s*\d+)*$/)` | — | Condicional | Solo si menores > 0. Formato: "5, 8, 12" |
| habitaciones | `z.coerce.number().int().min(1)` | 1-10 | Sí | Default 1 |
| presupuesto | `z.enum([...])` | <$10K, $10K-$25K, $25K-$50K, $50K-$100K, >$100K, Sin límite | Sí | |
| notas | `z.string().max(300).optional()` | — | No | maxLength 300 por límite URL WA |

### Ejemplo de Mensaje WhatsApp (referencia para implementación)

El mensaje que `cotizacionMessage.ts` debe generar sigue este formato:

```
✈️ *Solicitud de Cotización — AroundaPlanet*

👤 *Asesor:* María López
👥 *Cliente:* Juan Pérez García

🌎 *Tipo de viaje:* Internacional
📍 *Destino:* Cancún, México
📅 *Salida:* 15/05/2026
📅 *Regreso:* 22/05/2026

🧑‍🤝‍🧑 *Adultos:* 2
👶 *Menores:* 1 (edades: 5)
🏨 *Habitaciones:* 1

💰 *Presupuesto:* $25K - $50K MXN

📝 *Notas:* Preferencia por hotel all-inclusive frente al mar.
```

Notas sobre el formato:
- Usar `*texto*` para negritas de WhatsApp (NO markdown `**`)
- Emojis como separadores visuales de sección
- Fechas formateadas como `DD/MM/YYYY` (formato mexicano, no ISO)
- Si `menores` es 0, omitir la línea de menores y edades
- Si `notas` está vacío, omitir la línea de notas
- El mensaje NO debe incluir HTML ni markdown — solo texto plano con formato WhatsApp

## Implementation Plan

### Tasks

- [x] **Task 0: Agregar constante de WhatsApp para cotizaciones**
  - File: `src/config/whatsapp.ts`
  - Action: Agregar `export const WHATSAPP_COTIZACION_NUMBER = '5219981523109'` junto a la constante existente `WHATSAPP_CONTACT_NUMBER` (que se queda intacta — la usa el ConversionForm para reservaciones). NO modificar ni renombrar `WHATSAPP_CONTACT_NUMBER`.
  - Notes: Son dos números distintos para dos flujos distintos: reservaciones (`523331741585`) y cotizaciones (`5219981523109`)

- [x] **Task 1: Crear esquema Zod de cotización**
  - File: `src/schemas/cotizacionSchema.ts`
  - Action: Crear schema con los 12 campos según la tabla "Inventario de Campos" (ver tipos Zod exactos ahí). Exportar constantes readonly para opciones de selects: `TIPOS_VIAJE`, `RANGOS_PRESUPUESTO`, `OPCIONES_ADULTOS` (array de números: `[1,2,3,...12,15,20,25,30]`), `OPCIONES_MENORES` (`[0,1,...10]`), `OPCIONES_HABITACIONES` (`[1,2,...10]`). Exportar tipo `CotizacionFormData = z.infer<typeof cotizacionSchema>`. Helper `isValidDate(val: string): boolean` que valide que el string sea una fecha real (no `"2026-02-30"`). Refinamiento `.superRefine`: si `menores > 0`, `edadesMenores` es requerido y debe pasar regex; `fechaRegreso >= fechaSalida` comparando strings ISO directamente (funciona porque `YYYY-MM-DD` es lexicográficamente ordenable).
  - Notes: Seguir patrón de `orderSchema.ts`. `notas` tiene `max(300)` para prevenir URLs de WhatsApp demasiado largas.

- [x] **Task 2: Crear función de construcción de mensaje WhatsApp**
  - File: `src/app/(public)/cotizar/cotizacionMessage.ts`
  - Action: Función pura `buildCotizacionMessage(data: CotizacionFormData): string`. Seguir el formato exacto de la sección "Ejemplo de Mensaje WhatsApp". Convertir fechas de `YYYY-MM-DD` a `DD/MM/YYYY`. Omitir línea de menores/edades si `menores === 0`. Omitir línea de notas si vacío. Usar `*texto*` para negritas WA, emojis como separadores.
  - Notes: Archivo nombrado por dominio (`cotizacionMessage.ts`), no por función. Función pura sin dependencias externas — fácil de testear.

- [x] **Task 3: Crear página Server Component con metadata SEO**
  - File: `src/app/(public)/cotizar/page.tsx`
  - Action: Server Component que exporta `metadata` con: `title: "Solicitar Cotización — AroundaPlanet"`, `description` descriptiva, `robots: 'noindex, nofollow'` (herramienta interna, no indexable). Renderiza contenedor con `max-w-2xl mx-auto py-8` (**sin `px-4`** — PublicLayout ya lo provee), heading "Solicitar Cotización", subtítulo breve, y `<CotizacionForm />` como client component hijo.
  - Notes: NO `'use client'`. El `py-8` da espacio vertical. NO agregar padding horizontal.

- [x] **Task 4: Crear componente CotizacionForm**
  - File: `src/app/(public)/cotizar/CotizacionForm.tsx`
  - Action: Client Component (`'use client'`). Dos estados: **formulario** y **confirmación**.
    - **Estado formulario:** React Hook Form + `zodResolver(cotizacionSchema)` + shadcn/ui `Form` wrapper. Campos organizados en 4 secciones con headings: **Datos del asesor y cliente** (nombreAgente, nombreCliente), **Detalles del viaje** (tipoViaje, destino, fechaSalida, fechaRegreso), **Pasajeros y hospedaje** (adultos, menores, edadesMenores condicional, habitaciones), **Presupuesto y observaciones** (presupuesto, notas con contador de caracteres `/300`). Inputs `type="date"` nativos para fechas (máxima compatibilidad Safari iOS — NO date pickers JS). `edadesMenores` se muestra/oculta con `watch('menores')` — cuando aparece, el campo muestra placeholder "Ej: 5, 8, 12". `defaultValues`: menores=0, adultos=2, habitaciones=1. Botón submit: texto "Enviar por WhatsApp", `disabled` cuando `formState.isSubmitting` para evitar doble-tap. Al submit válido: construir mensaje con `buildCotizacionMessage()`, construir URL con `buildWhatsAppUrl(WHATSAPP_COTIZACION_NUMBER, mensaje)`, guardar URL en estado y cambiar a estado **confirmación**.
    - **Estado confirmación:** Vista previa del mensaje generado (en un `<pre>` o card con fondo gris), y un botón `<a href={waUrl} target="_blank" rel="noopener noreferrer">` estilizado como botón primario con texto "Abrir WhatsApp". Esto garantiza que Safari iOS NUNCA bloquee la apertura porque es un click directo del usuario en un `<a>` tag. Botón secundario "Editar cotización" que regresa al estado formulario conservando los datos.
  - Notes: Mobile-first. El patrón de dos estados (form → confirm → WA) es más robusto que `window.open` directo y además permite al usuario verificar el mensaje antes de enviarlo.

- [x] **Task 5: Tests del esquema y mensaje**
  - File: `src/schemas/cotizacionSchema.test.ts`
  - Action: Tests unitarios del schema Zod:
    - Campos requeridos fallan sin valor
    - `z.coerce.number()` convierte strings a números correctamente (`"2"` → `2`)
    - Refinamiento: `menores > 0` sin `edadesMenores` → error
    - Refinamiento: `menores > 0` con `edadesMenores: "5, 8"` → válido
    - Refinamiento: `edadesMenores` con formato inválido (`"cinco, ocho"`) → error
    - Validación: `fechaRegreso < fechaSalida` → error
    - Validación: fecha inválida (`"2026-02-30"`) → error
    - Validación: `notas` con más de 300 caracteres → error
    - Happy path con datos completos → válido
  - File: `src/app/(public)/cotizar/cotizacionMessage.test.ts`
  - Action: Tests del mensaje generado:
    - Contiene todos los campos del formulario
    - Fechas formateadas como `DD/MM/YYYY`
    - Omite línea de menores cuando `menores === 0`
    - Omite línea de notas cuando `notas` es vacío/undefined
    - Usa `*negritas*` de WhatsApp (no markdown `**`)
    - Funciona con caracteres especiales: `"Señor García"`, `"Cancún"`, `"Zürich"` — sin errores ni caracteres rotos
    - Longitud del mensaje no excede 1,500 caracteres con datos máximos razonables

- [x] **Task 6: Test del componente CotizacionForm**
  - File: `src/app/(public)/cotizar/CotizacionForm.test.tsx`
  - Action: Tests del componente:
    - Renderizado: formulario muestra todos los campos visibles y botón "Enviar por WhatsApp"
    - Validación: submit sin llenar campos muestra mensajes de error de RHF
    - Condicional: seleccionar menores > 0 muestra campo edadesMenores
    - Condicional: menores = 0 (default) no muestra campo edadesMenores
    - Submit válido: llenar formulario y submit cambia a vista de confirmación con preview del mensaje
    - Confirmación: vista muestra botón `<a>` con `href` conteniendo `wa.me/5219981523109?text=`
    - Editar: botón "Editar cotización" regresa al formulario con datos preservados
    - Disable: botón submit está disabled durante `isSubmitting`
  - Notes: Para shadcn/ui Select, usar `getByRole('combobox')` + `userEvent.click()` + `getByRole('option', { name: 'opción' })`. Mock de `window.open` NO necesario — el patrón usa `<a href>` no `window.open`

### Acceptance Criteria

- [ ] **AC 1:** Given un usuario en cualquier dispositivo, when navega a `/cotizar`, then ve un formulario de cotización con los 12 campos organizados en 4 secciones, con el design system del proyecto (verde `#1B4332` + naranja `#F4A261`)
- [ ] **AC 2:** Given un usuario con iPhone Safari, when abre `/cotizar`, then el formulario funciona completamente (inputs nativos de fecha, selects funcionales, botón de submit funcional, apertura de WhatsApp NO bloqueada)
- [ ] **AC 3:** Given un formulario con campos requeridos vacíos, when el usuario presiona "Enviar por WhatsApp", then se muestran mensajes de error en los campos faltantes y NO se avanza a la vista de confirmación
- [ ] **AC 4:** Given menores = 0, when el usuario ve el formulario, then el campo "Edades de menores" NO es visible. Given menores > 0, when el usuario selecciona la cantidad, then el campo "Edades de menores" aparece y es requerido con formato "números separados por comas"
- [ ] **AC 5:** Given fechaRegreso < fechaSalida, when el usuario intenta enviar, then se muestra error de validación indicando que la fecha de regreso debe ser igual o posterior a la de salida
- [ ] **AC 6:** Given un formulario completamente lleno y válido, when el usuario presiona "Enviar por WhatsApp", then ve una vista de confirmación con la preview del mensaje y un botón para abrir WhatsApp
- [ ] **AC 7:** Given la vista de confirmación, when el usuario presiona "Abrir WhatsApp", then se abre `wa.me/5219981523109?text=` en una nueva pestaña/app con el mensaje estructurado legible como texto plano (negritas WA, emojis, fechas DD/MM/YYYY)
- [ ] **AC 8:** Given la vista de confirmación, when el usuario presiona "Editar cotización", then regresa al formulario con todos los datos preservados
- [ ] **AC 9:** Given la página `/cotizar`, when se ve en mobile (< 640px), then el formulario ocupa el ancho completo con padding lateral del layout. When se ve en desktop (> 640px), then el formulario está centrado con ancho máximo ~672px (max-w-2xl)
- [ ] **AC 10:** Given el campo notas con más de 300 caracteres, when el usuario intenta enviar, then se muestra error de validación
- [ ] **AC 11:** Given una fecha inválida (ej: 30 de febrero), when el usuario intenta enviar, then se muestra error de validación
- [ ] **AC 12:** Given `pnpm typecheck`, when se ejecuta, then pasa sin errores de tipo
- [ ] **AC 13:** Given `pnpm test`, when se ejecuta, then todos los tests del schema, mensaje, y componente pasan

## Additional Context

### Dependencies

- `react-hook-form@^7.71.2` — ya instalado
- `@hookform/resolvers@^5.2.2` — ya instalado
- `zod` — ya instalado
- shadcn/ui components (`Form`, `Select`, `Input`, `Textarea`, `Button`, `Label`) — ya instalados
- `src/config/whatsapp.ts` — reutilizar `buildWhatsAppUrl` y `WHATSAPP_CONTACT_NUMBER`
- **Sin dependencias nuevas requeridas**

### Testing Strategy

- **Unit tests (Vitest):**
  - `cotizacionSchema.test.ts` — validación del schema Zod (9 test cases: requeridos, coerción, refinamientos, fechas, notas, happy path)
  - `cotizacionMessage.test.ts` — formato del mensaje (7 test cases: campos, fechas, condicionales, caracteres especiales, longitud)
- **Component tests (Vitest + @testing-library/react):**
  - `CotizacionForm.test.tsx` — 8 test cases: renderizado, validación, condicional, submit, confirmación, editar, disable
- **Manual testing:**
  - Abrir `/cotizar` en iPhone Safari (real o simulador) y completar flujo completo: llenar → submit → confirmar → abrir WhatsApp
  - Verificar que el mensaje se ve bien en la app de WhatsApp (negritas, emojis, formato)
  - Verificar responsive en mobile y desktop
  - Verificar que el botón "Abrir WhatsApp" NO es bloqueado por Safari

### Notes

- **Patrón form → confirm → WA (fix F2):** En lugar de `window.open` directo (que Safari iOS puede bloquear si el call stack es async), el formulario usa dos estados: el usuario llena el form, ve una preview del mensaje, y clickea un `<a href>` directo para abrir WhatsApp. Esto es 100% compatible con Safari iOS y además mejora la UX al permitir verificar el mensaje antes de enviar.
- **Límite URL WhatsApp (fix F1):** `notas` tiene `maxLength: 300`. Con los demás campos en valores normales, el mensaje completo queda bajo ~600 chars antes de encoding (~1,200 después), bien dentro del límite de ~2,083 de Safari iOS.
- **Futuro v2:** Agregar Firestore persistence es straightforward — crear server action que guarde antes del redirect a WhatsApp. El schema Zod se reutiliza tal cual.
- **Futuro dashboard:** El componente `CotizacionForm` se puede reutilizar en el dashboard del agente removiendo el campo `nombreAgente` (se toma del auth context).
