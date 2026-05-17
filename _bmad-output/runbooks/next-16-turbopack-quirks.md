# Next.js 16 Turbopack — quirks operativas

> Sesión 44 (2026-05-16). Diagnóstico bug heredado bloqueando Story 4-3.

## Bug: `Jest worker encountered N child process exceptions` en `/api/agents/[agentId]/*` (dev)

### Síntoma

Cualquier request al subtree `/api/agents/[agentId]/{clients,metrics,orders,validate}` bajo `pnpm dev` (Turbopack) retorna HTTP 500 con:

```
Error: Jest worker encountered 2 child process exceptions, exceeding retry limit
  at ChildProcessWorker.initialize (next/dist/compiled/jest-worker/index.js:1:11580)
  at ChildProcessWorker._onExit (next/dist/compiled/jest-worker/index.js:1:12545)
  at ChildProcess._handle.onexit (node:internal/child_process:293:12)
```

El crash ocurre **antes de ejecutar el handler** (un request sin cookie de sesión también lo dispara — `requireAuth` ni se llega a invocar). Es decir, el worker child de Turbopack muere durante la fase de carga/transpilación del módulo, no en runtime.

### Alcance confirmado (sesión 44)

| Endpoint | Dev Turbopack | Prod webpack | Vitest aislado |
|---|---|---|---|
| `/api/agents/[agentId]/clients` | 500 (worker crash) | ✅ compila | ✅ pasa |
| `/api/agents/[agentId]/metrics` | 500 (worker crash) | ✅ compila | ✅ pasa |
| `/api/agents/[agentId]/orders` | 500 (worker crash) | ✅ compila | ✅ pasa |
| `/api/agents/[agentId]/validate` | 500 (worker crash) | ✅ compila | ✅ pasa |
| `/api/contracts/from-order/[orderId]/generate` | 401 (normal) | ✅ | ✅ |
| `/api/odoo/documents`, `/api/payments`, `/api/auth/claims` | 401 (normal) | ✅ | ✅ |

- **Prod NO afectada**: `pnpm build --webpack` compila las 4 rutas sin error (verificado sesión 44, build 43s).
- **Tests aislados pasan**: 13/13 vitest del subtree `src/app/api/agents/**` verdes.
- **No es CommissionList `variant`**: el TypeError reportado en MEMORY es consecuencia secundaria del 500 de `/metrics`, no causa.

### Hipótesis (sin root cause exacto)

- **H1 (confirmada parcialmente)**: bug del transpilador/worker de Turbopack 16.1.6 al cargar este subtree específico. Crashea en fase de import.
- **H2 descartada**: handler-level bug. Los tests Vitest pasan invocando `GET()` directamente; el worker muere sin entrar al handler.
- **H3 descartada**: índices Firestore faltantes. `firestore.indexes.json` incluye CG `commissions (agentId, status, createdAt)` requerido por `/metrics`. Además un `FAILED_PRECONDITION` no crashea un worker child — devuelve error normal vía `handleApiError`.
- **H4 no probada**: algún import en `clients/route.ts` (`@/lib/odoo/cache`, `@/lib/odoo/client`) trigger algo en el transpiler. Pero `orders` y `validate` también crashean y no comparten todos los imports, así que el denominador común probable es `@/lib/firebase/admin` + `requireAuth` + `handleApiError` — los mismos que usan endpoints sanos, contradicción.

### Workarounds disponibles

1. **Dev contra build prod** (probado, funciona): `pnpm build --webpack && pnpm start`. Slow turnaround pero sin worker crashes.
2. **Tests Vitest como dev loop**: para Story 4-3 y similares, iterar contra `pnpm test:watch` del handler con mocks. Browser smoke solo al final contra prod build.
3. **Diagnóstico futuro** (no aplicado): poner `experimental.workerThreads: false` en `next.config.ts` (temporal) para que el handler corra in-process y burbujee el stack real. Pendiente para sesión enfocada de root cause.

### Decisión sesión 44

- **No aplicar fix de código**: prod no afectada, código sano según Vitest. Aplicar workaround upstream-style (cambiar bundler de dev) sería degradar HMR. Esperar fix upstream de Next 16.
- **Story 4-3 desbloqueada con caveat**: usar `pnpm build && pnpm start` durante dev y/o trabajar el handler con TDD Vitest + smoke prod final.
- **Bug archivable**: si en una sesión futura se encuentra el commit exacto que lo introdujo (probable: Story 4-2 `e9c3b86`/`bb519ca`/`1818bfc`), aislar el import diff y abrir issue upstream Next.js.

### Validación reproducible (Windows 11)

```bash
# Dev Turbopack (crashea)
pnpm dev                # arranca :3000
curl -i http://localhost:3000/api/agents/test/clients   # HTTP 500 worker error

# Prod webpack (OK)
pnpm build --webpack    # ✅ Compiled successfully
pnpm start              # arranca :3000
curl -i http://localhost:3000/api/agents/test/clients   # HTTP 401 (esperado, requireAuth)

# Vitest aislado (OK)
pnpm test src/app/api/agents/ --run   # 13/13 passed
```
