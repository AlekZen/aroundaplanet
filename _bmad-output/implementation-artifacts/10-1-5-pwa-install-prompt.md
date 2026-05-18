# Story 10.1.5 — PWA Install Prompt Cross-Platform

## Resumen

Cierra el entregable contractual "PWA instalable" de Cláusula 2 Sub-fase B. Story 1.1a sembró Serwist (Service Worker + manifest); esta story añade la UX que guía al usuario a instalar la app sin pasos manuales no obvios.

## Alcance

- Hook `usePwaInstall` con captura module-scope de `beforeinstallprompt`, detección plataforma (incluye iPadOS reportado como Mac), persistencia localStorage de dismiss.
- Toaster bottom-right responsive (Tailwind + shadcn).
- Modal de instrucciones visual para iOS Safari (4 pasos) y macOS Safari 17+ (3 pasos).
- Integración solo en layouts `(public)`, `(client)`, `(agent)`. Admin/Director/SuperAdmin NO ven el banner (escritorio, Paloma no debe ser distraída).

## Archivos creados

- `src/hooks/usePwaInstall.ts`
- `src/hooks/usePwaInstall.test.ts` (24 tests)
- `src/components/pwa/PwaInstallToaster.tsx`
- `src/components/pwa/PwaInstallToaster.test.tsx` (7 tests)
- `src/components/pwa/PwaInstallInstructions.tsx`
- `src/components/pwa/PwaInstallInstructions.test.tsx` (4 tests)

## Archivos modificados

- `src/app/(public)/layout.tsx`
- `src/app/(client)/layout.tsx`
- `src/app/(agent)/layout.tsx`

## Criterios de aceptación

- **AC1** Detección plataforma: chromium / ios-safari / macos-safari / firefox / unsupported con UA + maxTouchPoints. iPadOS detectado correctamente (Mac UA + touchPoints>1).
- **AC2** `beforeinstallprompt` capturado module-scope (no se pierde si dispara antes del mount). Botón "Instalar" llama `event.prompt()`.
- **AC3** Instrucciones manuales con pasos numerados visuales para iOS Safari y macOS Safari.
- **AC4** Persistencia dismiss en `localStorage` con ventanas 7d (1-2 dismiss) / 30d (3+ dismiss) / permanente (999).
- **AC5** Integrado en 3 layouts: public, client, agent. NO en admin/director/superadmin.
- **AC6** Tests unitarios: 35 nuevos (24 hook + 7 toaster + 4 instructions). Suite total 1836 (baseline 1801 + 35).
- **AC7** Browser smoke con Playwright MCP — completo desktop chromium. iOS Safari cubierto por tests unitarios (Playwright corre Chromium real, no puede emular UA pre-mount para el lazy init).

## Reglas show/hide

- `installed` (display-mode standalone | navigator.standalone | android-app referrer) → nunca mostrar.
- `dismissCount === 0` + 30s en la app → mostrar.
- `dismissCount 1-2` → ocultar 7 días desde `lastDismissedAt`.
- `dismissCount >= 3` → ocultar 30 días.
- `dismissCount === 999` (botón "No volver a mostrar") → ocultar permanente.
- `platform === 'firefox' | 'unsupported'` → nunca mostrar (no soporta install nativo ni Safari steps).

## Decisiones técnicas

- **Lazy init de useState** para `installed` y `platform` (evita cascading renders detectados por el lint rule `react-hooks/no-effect-set-state`).
- **Module-scope listener** para `beforeinstallprompt`: el evento puede dispararse antes del primer mount del hook; el patrón actual lo captura una sola vez y notifica vía pub/sub a cualquier hook montado después.
- **No PwaInstallProvider wrapper**: Toaster se monta directo en los 3 layouts (cliente components ya). Evita indirección.
- **pageViews descartado**: el brief sugería "30s o 5 page-views". Se quedó solo el delay 30s — menos código, mismo UX (en SPA con App Router las navegaciones intra-app no recargan el hook).
- **Chrome iOS / Edge iOS / Firefox iOS** marcados `unsupported`: no soportan `beforeinstallprompt` y los pasos de Safari no aplican.

## Edge cases conocidos

- **Brave private mode**: localStorage funciona pero puede borrarse al cerrar tab — el toaster reaparecerá. Comportamiento aceptable.
- **Samsung Internet**: detectado como chromium (string `SamsungBrowser`); soporta `beforeinstallprompt`. Validado por detección, no smoke real.
- **iOS PWA ya instalada**: `navigator.standalone === true`, isInstalled detectado, banner nunca aparece.
- **Reset post-install**: si el usuario desinstala manualmente, el flag `installed` queda `true` en localStorage. El próximo `beforeinstallprompt` (que dispararía Chromium al re-detectar elegibilidad) no llegará a mostrar el toaster sin limpiar el flag. **Pendiente F1**: detectar transición standalone→browser y resetear el flag.

## Smoke browser (ejecutado)

Build `pnpm build` exit 0 + `pnpm start` ready en 1.5s. Validado con Playwright MCP en Chrome desktop:

1. ✓ Navegación a `http://localhost:3000` → SSG público carga.
2. ✓ `localStorage` limpio + dispatch `beforeinstallprompt` simulado.
3. ✓ Tras delay 30s el toaster `[data-testid="pwa-install-toaster"]` aparece en el DOM.
4. ✓ Headline: `Instala AroundaPlanet como aplicación` + botón `Instalar` (correcto para chromium con `canPrompt=true`).
5. ✓ Click en X cierra el toaster y persiste `{installed:false, dismissedAt:<ISO>, dismissCount:1}` en localStorage.
6. ✓ Re-render confirma `stillVisible=false` (muted dentro de ventana 7 días).
7. Screenshot: `scripts/audit-output/10-1-5-pwa-install/desktop-chromium-toaster.png`.

**iOS Safari / macOS Safari no smokeados en browser real**: Playwright MCP corre Chromium; override de `navigator.userAgent` post-mount no afecta al hook por su lazy init. La validación queda cubierta por los 11 tests unitarios (toaster con `platform=ios-safari`/`macos-safari` + modal con 4/3 pasos). Validación real requiere dispositivo iPhone/Mac, recomendado en smoke prod post-deploy.

## Pendientes Fase 1 explícitos

- Reset flag `installed=true` al detectar desinstalación (transición standalone→browser).
- Telemetría: contar dismiss y outcome del prompt.
- A/B copy de headline (variantes).
- Push del banner a iOS por web push (cuando la PWA esté instalada).
