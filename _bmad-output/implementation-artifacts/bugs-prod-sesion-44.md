# Bugs Prod descubiertos Sesión 44 (post-deploy build-2026-05-18-001)

**Fecha**: 2026-05-18
**Contexto**: Alek (admin + agente dual) reportó issues operativos mientras testing post-deploy de los 23 commits.

## RE-CLASIFICACIÓN (post-diagnóstico agente paralelo)

El agente paralelo confirmó: "tu cuenta ES agente con datos". Esto invalida mi hipótesis original "agente sin agentId vacío". El root cause real es **B3 (`STATUS_CONFIG[c.status]` undefined)**, NO B1 (metrics 500 que asumí).

| Bug | Antes | Ahora |
|---|---|---|
| B1 metrics 500 | 🔴 Bloqueante F0 | 🟡 A confirmar — puede ser síntoma de B3 o bug independiente; el agente paralelo no validó si /api/agents/[agentId]/metrics responde 200 con cuenta real con datos |
| B3 CommissionList `variant` | 🔴 Alta | 🔴 **Bloqueante F0 — root cause real**. Diagnóstico confirmado: `STATUS_CONFIG[c.status]` undefined cuando el handler retorna un status nuevo que el componente no mapea |
| B4 screenshots contaminados | 🔴 Alta | 🔴 Alta — bloqueado por B3 |
| B5 (nuevo) | — | 🔴 **Bloqueante prod — `outputFileTracingIncludes` faltante** para que `/agent/manual` no crashee en prod sin acceso a `_bmad-output/manuals/manual-agente.md` |



---

## Bug B1 — `/api/agents/[agentId]/metrics` retorna 500 CON sesión real

### Síntoma

- URL afectada: `GET /api/agents/{agentId}/metrics` en localhost:3001 dev (próximamente prod si no se valida con login real)
- agentId observado: `gif7XVStiEfOJFrBMCeEC...` (Alek Zen como agente)
- Status code: 500 Internal Server Error
- UI: dashboard agente `/agent/dashboard` muestra "No se pudieron cargar las métricas" con `<CommissionList>` error boundary
- Console: múltiples 500 sucesivos por reintentos del componente cliente

### Distinción crítica vs bug Turbopack workers

Este NO es el mismo bug que cerramos en commit a6ad2b9 (Story 4-3 desbloqueada con workaround):

| Característica | Bug Turbopack (cerrado) | Bug B1 nuevo (abierto) |
|---|---|---|
| Sesión | Sin sesión / 401 esperado | CON sesión válida |
| Stack | `ChildProcessWorker.initialize` (fase import) | Handler entra, falla internamente |
| Comportamiento | Worker crash antes de auth | Auth pasa, query/lógica falla |
| Status | 500 worker crash | 500 application error |
| Reproducción | `pnpm dev` sin login | `pnpm dev` + login real |

El agente paralelo confirmó hace minutos que el endpoint responde 401 LIMPIO sin sesión (sesión 44 misma) — el bug Turbopack está resuelto. Lo que NO se probó: comportamiento CON sesión válida.

### Hipótesis ranked

**H1 (más probable)** — Firestore CG index `commissions(agentId, status, createdAt)` faltante o construyéndose en prod
- Origen: Story 4-2 (commits e9c3b86, bb519ca) introdujo query con compound index
- Síntoma típico: `FAILED_PRECONDITION: index is currently building` o similar
- Validación: `gcloud firestore indexes composite list --project=arounda-planet --format=json | grep commissions`

**H2** — Handler asume datos seedeados que no existen en cuenta Alek
- El handler hace algún cálculo (división, agregación) que explota cuando `commissions[agentId]` está vacío
- Síntoma típico: `TypeError: cannot read property '...' of undefined` o `RangeError: division by zero`

**H3** — Conflicto con sync Odoo en curso
- Race entre lectura de commissions y push/pull bidireccional
- Síntoma típico: `aborted` o `deadline-exceeded`

**H4** — Bug post-commit batch #11 (b4fb2bd Story 8-1b fixes) que tocó relacionados sync
- Improbable porque b4fb2bd solo tocó documents-pull, no commissions
- Pero vale verificar diff de los commits desplegados

### Diagnóstico requerido (orden)

1. Capturar stack trace REAL del 500 — runtime logs del server dev o prod
2. Leer handler `src/app/api/agents/[agentId]/metrics/route.ts` completo
3. Validar indexes Firestore prod con `firestore_list_indexes` MCP
4. Reproducir con cuenta agente real + sin commissions vs con commissions

### Urgencia

🔴 **BLOQUEANTE** para experiencia agente en prod. Si Alek (admin + agente con setup completo) ve 500, los 100 agentes reales probablemente también. La consola sync de Paloma probablemente funciona porque es admin, no agente; pero todos los agentes ven dashboard roto.

### Owner asignado

Pendiente — agente paralelo cuando termine manual agente + sidebar.

---

## Bug B3 — `<CommissionList>` TypeError 'variant' (consecuencia de B1, pero también código frágil)

### Síntoma

Error boundary muestra literalmente:
```
Algo salió mal
Ocurrió un error inesperado. Por favor intenta de nuevo.
Cannot read properties of undefined (reading 'variant')
```

Visible en `/agent/dashboard` cuando el endpoint `/api/agents/[agentId]/metrics` retorna 500 (Bug B1).

### Cadena causal

1. `/agent/dashboard` monta `<CommissionList>` que depende de datos de `/api/agents/[agentId]/metrics`
2. Endpoint retorna 500 → datos quedan `undefined`
3. `<CommissionList>` o un sub-componente intenta leer `.variant` de un objeto undefined
4. Throw → ErrorBoundary captura

### Por qué es bug propio (no solo consecuencia de B1)

Aunque fixear B1 elimina el síntoma visible, el componente sigue siendo frágil:
- No tiene defensive defaults para datos faltantes
- No tiene loading state explícito separado del error state
- Si en F1 hay un endpoint lento o intermitente, este mismo error vuelve

### Fix

1. **Quick**: agregar defensive defaults en el lugar exacto donde se lee `.variant` (probable componente `<Badge variant={...}>` con prop undefined)
2. **Mejor**: usar Zod safeParse en la respuesta del fetch + fallback a `<EmptyState>` o `<Skeleton>` controlado

### Urgencia

🔴 **Alta** — si B1 toma tiempo de fixear, este componente debe al menos NO romper toda la página. Es defensa en profundidad.

### Owner

Mismo que B1 — son issues hermanos. Fix B1 + B3 en mismo commit.

---

## Bug B4 — Screenshots del manual de agente capturados durante error state

### Síntoma

El manual de agente en `/agent/manual` (página recién creada por agente paralelo) muestra screenshots de la app **rota**:
- `02-dashboard.png`: muestra "Algo salió mal — Cannot read properties of undefined (reading 'variant')" del bug B3
- Probable otros screenshots con states defectuosos

### Por qué pasó

El agente paralelo capturó screenshots en `localhost:3001` durante login real cuando B1 y B3 estaban activos. Los componentes mostraron error boundaries en lugar de UI normal. Como el agente no podía distinguir "captura mostrando estado deseado" de "captura mostrando bug actual", commiteó las imágenes como están.

### Consecuencia

Si Alek envía el manual a Noel o a agentes reales:
- Muestra que la app NO funciona bien (error visible)
- Daña la confianza
- Confunde al lector (qué pasa cuando vea ese error? está documentado el fallback? NO)

**Inaceptable para entrega F0**.

### Fix requerido

1. **Bloqueante**: fixear B1 + B3 PRIMERO (los componentes deben renderizar normal)
2. Re-capturar las screenshots afectadas con dev local funcionando correcto:
   - Mínimo: `02-dashboard.png` (Mi Negocio)
   - Verificar: `04-mis-clientes.png`, `09-mis-contratos.png`, `10-perfil.png` por si tienen estados defectuosos también
3. Verificar que los datos seedeados de la cuenta de captura tengan al menos 1-2 clientes, comisiones, contratos para que las pantallas se vean "vivas" no vacías. Si no hay datos, mostrar empty states bonitos (no errors).

### Urgencia

🔴 **Alta** — bloqueante para entregar manual F0.

### Owner

Agente paralelo, post fix B1+B3.

---

## Bug B5 — `outputFileTracingIncludes` faltante en `next.config.ts`

### Síntoma esperado

`/agent/manual/page.tsx` hace `fs.readFileSync('_bmad-output/manuals/manual-agente.md')` en server component. En `pnpm dev` funciona porque el filesystem completo está disponible. En **build prod** (`pnpm build --webpack`), Next.js solo incluye archivos dentro de `src/`, `public/`, y los que estén en `outputFileTracingIncludes`. Como `_bmad-output/` está fuera de esos defaults, **el MD no se incluye en la imagen Docker** que App Hosting deploya. Resultado en runtime prod: `ENOENT: no such file or directory, open '_bmad-output/manuals/manual-agente.md'`.

### Hallazgo

Detectado proactivamente por el agente paralelo durante la implementación de `/agent/manual`. Anotado como TODO en su commit WIP.

### Fix

En `next.config.ts`, agregar:
```ts
experimental: {
  outputFileTracingIncludes: {
    '/agent/manual': ['./_bmad-output/manuals/**/*.md'],
    // Cuando agreguemos /client/manual y /admin/manual:
    // '/client/manual': ['./_bmad-output/manuals/**/*.md'],
    // '/admin/manual': ['./_bmad-output/manuals/**/*.md'],
  },
},
```

**Alternativa más simple** (recomendada): mover los manuales de `_bmad-output/manuals/` a `src/content/manuals/`. Next.js incluye automáticamente. Sin config extra, sin riesgo de olvidar la directiva para futuras rutas de manual.

### Decisión orquestador

Después de discutir, vamos por la **alternativa**: mover a `src/content/manuals/manual-agente.md` + ajustar import en page.tsx. Simpler, más robusto, escala a los 3 manuales (agente/cliente/admin) sin pensar.

### Urgencia

🔴 **Bloqueante para deploy con manual**. Sin esto, `/agent/manual` da 500 en prod inmediato post-deploy.

### Owner

Sub-tarea separada después de fix B3. Se hace junto con re-captura de screenshots (Sub-tarea 3 del agente paralelo).

---

## Bug B2 — Manual no aparece en sidebar agente

### Síntoma

Sidebar agente visible para Alek logueado:
- Mi Negocio
- Mis Clientes
- Contratos
- Mis Viajes
- Mi Perfil

**Falta**: entrada "Manual" o "Ayuda" para acceder al manual de agente.

### Causa

El agente paralelo en sesión 44 generó manual MD en `_bmad-output/manuals/manual-agente.md` (commit 0f8b624) PERO pausó antes de aplicar:
- Sub-tarea 2B: crear página `src/app/(agent)/manual/page.tsx`
- Sub-tarea 2C: agregar entrada en sidebar/BottomNav agente

El manual existe en disco pero NO es accesible desde la app web. Cumple parcialmente Cláusula 2 Sub-fase C "Documentación completa: manuales de uso" — la documentación existe pero no es discoverable por el usuario final.

### Urgencia

🟡 No bloqueante pero entregable F0 incompleto. El user (Alek) explícitamente pidió "que sean accesibles desde el sidebar".

### Owner

Agente paralelo, continuación del flujo que pausó en preview de screenshots.

---

## Issue Op-1 — Asignar contrato a cuenta agente Alek para test end-to-end

### Pedido

Alek pidió que se le asigne un contrato a su cuenta agente (mismo uid pero rol agente) para validar el flujo end-to-end de share desde admin → vista agente → descarga PDF.

### Datos

- email: ocompudoc@gmail.com
- agentId observado en URL: `gif7XVStiEfOJFrBMCeEC...`
- Rol: admin + superadmin + director + agente (dual+)

### Acción operativa

1. Verificar que Alek tiene `agentId` válido y rol `agente` en custom claims
2. Localizar contrato existente en Firestore `contracts` collection (puede ser uno generado en sesión 43 para YAZIL o FELIPE)
3. PATCH `sharedWithAgent: true` + `agentId: gif7XVStiEfOJFrBMCeEC` (uid completo) en el contrato
4. Verificar que aparece en `/agent/contracts` para Alek
5. Validar descarga PDF como agente

NOTA: F1 explícito que el sharing automático (agentName Odoo → agentId Firestore) requiere desarrollo separado. Por ahora todo es manual desde admin.

### Limitación de scope

Esta es operación de PRUEBA, no story. Se documenta para trazabilidad pero NO requiere commit ni feature nueva.

### Owner

Operativo — agente paralelo puede ejecutar via Firebase Admin SDK script ad-hoc post manual fix.
