# Smoke 7.1.1 — AppLogo en 6 layouts

Fecha: 2026-05-20
Build local: `pnpm build --webpack` ✅ · `pnpm start` http://localhost:3000

## Resultado

| # | Ruta | Layout | Asset HTTP | Logo visible | Captura |
|---|---|---|---|---|---|
| 01 | `/` | `(public)` Navbar | 200 (340 KB) + `/_next/image` 200 | ✅ verde + texto | `01-public-landing.png` |
| 02 | `/login` | `(auth)` (esperado) | n/a | ⚠️ redirige a `/superadmin/users` por sesión activa — AuthLayout cubierto por unit tests `AppLogo.test.tsx` + integración con `<Image>` lg/md ya verificada visualmente con el mismo asset en navbar | `02-auth-login.png` (muestra superadmin redirect) |
| 03 | `/agent/clients` | `(agent)` `RoleSidebar` desktop | n/a | ✅ logo verde en sidebar header | `03-agent-clients.png` |
| 04 | `/admin/verification` | `(admin)` `RoleSidebar` | n/a | ✅ logo verde en sidebar header | `04-admin-verification.png` |
| 05 | `/client/my-trips` | `(client)` header sticky | n/a | ✅ logo verde + texto | `05-client-my-trips.png` |
| 06 | `/superadmin/users` | `(superadmin)` `AdminShell`+`RoleSidebar` | n/a | ✅ logo verde en sidebar header | `06-superadmin-users.png` |
| 07 | `/director/dashboard` | `(director)` `RoleSidebar` desktop | n/a | ✅ logo verde en sidebar header | `07-director-dashboard.png` |

## Bug detectado y resuelto durante smoke

Primera iteración el PNG estaba en `public/aroundaplanet-logo.png` (raíz). El proxy de Next.js (`src/proxy.ts`) redirige rutas que no son `_next/static|_next/image|favicon.ico|manuals|icons|images|sw.js|manifest.webmanifest` a `/login` cuando no hay sesión.

Resultado: la imagen retornaba 307 → 400 desde `/_next/image` → placeholder roto en navbar pública.

**Fix**: mover el asset a `public/images/aroundaplanet-logo.png` (ya cubierto por el matcher). Path actualizado en `AppLogo.tsx` y en el documento objetivo (apartado 2.1).

## Validaciones

- `pnpm typecheck` ✅ 0 errores
- `pnpm lint` ✅ 0 errores (57 warnings pre-existentes)
- `pnpm vitest run src/components/shared/AppLogo.test.tsx` ✅ 5/5
- `pnpm vitest run` ✅ 1847 pass / 1 fail pre-existente `RoleSidebar.test.tsx` (stale tras Story 10.6, NO regresión de este batch — confirmado con `git stash`)
- `pnpm build --webpack` ✅ compila

## Pendiente F0 (otros criterios 7.1)

- 7.1.2: logo en PDF de contratos (`ContractDocument.tsx`) — Batch B
- 7.1.3: PWA icons + favicon + OpenGraph — Batch C
