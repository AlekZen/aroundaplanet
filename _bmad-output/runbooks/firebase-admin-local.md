# Firebase Admin SDK — inicialización local vs Cloud Run

> Sesión 45 (2026-05-18). Diagnóstico bug "no puedo iniciar sesión en dev".

## Regla firme

`src/lib/firebase/admin.ts` decide entre credenciales locales (JSON SA en `.keys/`) y ADC. **La condición correcta es `process.env.K_SERVICE`, NO `NODE_ENV`.**

```ts
// CORRECTO
if (process.env.K_SERVICE) {
  return initializeApp(); // ADC (Cloud Run / App Hosting)
}
// fallback: leer .keys/arounda-planet-firebase-adminsdk-fbsvc-*.json
```

```ts
// MAL (versión anterior, rompió sesión 45)
if (process.env.NODE_ENV === "production") {
  return initializeApp();
}
```

## Por qué `NODE_ENV` no sirve

`pnpm start` invoca `next start` que setea `NODE_ENV=production` localmente. Esto es práctica común porque el bug de Next 16 Turbopack workers (ver `next-16-turbopack-quirks.md`) hace que algunos endpoints crashen en `pnpm dev`, así que se corre prod build local como workaround.

Con la condición vieja `NODE_ENV === "production"`, ese workaround activaba ADC en una máquina donde `gcloud auth application-default login` puede apuntar a CUALQUIER proyecto del usuario (en sesión 45 era `elevatek-bi-ai`, no `arounda-planet`).

## Síntoma observable

- POST a `/api/auth/session` → 401 (`Unauthorized`)
- Server log: `Firebase ID token has incorrect "aud" (audience) claim. Expected "<otro-proyecto>" but got "arounda-planet".`
- Popup Google abre, pero la cookie `__session` nunca se crea → el usuario "no puede iniciar sesión"
- En sesión 45 el `catch {}` del endpoint tragaba el error sin log → diagnóstico lento. **Fix aplicado**: ahora `catch (err)` con `console.error` y `debug: err.message` en respuesta 401.

## Cómo diagnosticar rápido

1. Mira el server log al intentar login. Si ves "incorrect aud claim", el ADC local apunta a otro proyecto.
2. Verifica con `gcloud config get-value project` y `gcloud auth application-default print-access-token`.
3. Opciones:
   - **Recomendado**: confirmar que `src/lib/firebase/admin.ts` usa `K_SERVICE` (este runbook).
   - Alternativa: re-ejecutar `gcloud auth application-default login` apuntando al proyecto `arounda-planet`.
   - Workaround temporal: `pnpm dev` en lugar de `pnpm start` (NODE_ENV=development → siempre lee el JSON).

## Variables que SÍ inyecta Cloud Run / App Hosting

- `K_SERVICE` — nombre del servicio (existe siempre que corres en Cloud Run)
- `K_REVISION` — revisión actual
- `K_CONFIGURATION` — config Cloud Run
- `PORT` — también la setea Cloud Run pero también `next start` local, no sirve para discriminar

`K_SERVICE` es el discriminador canónico documentado por Google.

## Comprobación post-fix

```bash
pnpm build && pnpm start
# Esperado: log NO debe contener "incorrect aud claim"
# Esperado: POST /api/auth/session → 204 al login exitoso
```
