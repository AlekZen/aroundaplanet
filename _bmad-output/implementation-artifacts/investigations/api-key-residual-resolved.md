# Investigación: "API key residual" en bundle de producción — RESUELTO (no era bug)

**Fecha:** 2026-05-16
**Estado:** Cerrado — falsa alarma
**Caso:** 1 (no bug)

## Hipótesis original

Se reportó en MEMORY del proyecto que el bundle de producción contenía una API key
`AIzaSyC_JR5E4...` que "daba 400 en algunos refresh", con origen aparentemente
desconocido: "no está en .env.local, no está en repo".

## Hallazgo

La key reportada **es** `NEXT_PUBLIC_FIREBASE_API_KEY`, la API key pública del
Firebase Web SDK rotada el 2026-05-12 (documentada en MEMORY como
`AIzaSyC_JR...8jU`). Su presencia en el bundle es **comportamiento esperado por
diseño**, no un residuo ni un leak.

### Cadena de evidencia

1. **`apphosting.yaml` líneas 10-12:** declara la variable como build-time + runtime,
   poblada desde el secret `prod-firebase-api-key`.

   ```yaml
   - variable: NEXT_PUBLIC_FIREBASE_API_KEY
     secret: prod-firebase-api-key
     availability: [BUILD, RUNTIME]
   ```

2. **`src/lib/firebase/client.ts` línea 4:** el client SDK consume
   `process.env.NEXT_PUBLIC_FIREBASE_API_KEY` directamente en `firebaseConfig`.

3. **Convención Next.js:** cualquier `process.env.NEXT_PUBLIC_*` referenciada en
   código que termina en el client se inlinea al bundle estáticamente en build time.

4. **Documentación oficial de Firebase:** la `apiKey` del Web SDK es pública por
   diseño. La seguridad se enforce con Firebase Security Rules + API Key
   restrictions en Google Cloud Console, no ocultando la key.

5. **MEMORY confirma la rotación 2026-05-12:** vieja `AIzaSyBIX...EeYc` → nueva
   `AIzaSyC_JR...8jU`. El primer fragmento coincide exactamente con la key reportada
   como "residual".

No se requirió forensics de bundle ni `git log -S` porque la cadena env-var →
client init → bundle inlining es suficiente para cerrar el caso.

## Acción tomada

- Cerrado el TODO de MEMORY "investigar API key residual" como falsa alarma.
- No se modifica código.
- No se push ni se rota ninguna key.

## TODOs explícitos para Alek

1. **Validar API Key restrictions en Google Cloud Console** (pendiente, requiere
   acceso humano):
   - Ir a https://console.cloud.google.com/apis/credentials → proyecto `arounda-planet`.
   - Para la key `AIzaSyC_JR...8jU` confirmar que tiene:
     - **HTTP referrer restrictions** activas (whitelist: dominios de prod + dev local).
     - **API restrictions** (limitada a Identity Toolkit API, Firebase Installations,
       Firestore, Storage — no "Don't restrict key").
   - Si NO tiene restrictions, configurarlas. Sin restrictions, aunque la key sea
     pública por diseño, queda vulnerable a abuso de cuota desde dominios arbitrarios.

2. **El "400 en algunos refresh"** es un síntoma separado, no relacionado con la key
   residual. Causas probables (todas requieren validación con Firebase Console logs):
   - Token expirado sin refresh automático (SDK race).
   - Throttling por restrictions mal configuradas (paradójicamente la fix del TODO #1
     puede causarlo si las referrer rules están demasiado estrictas).
   - Rate-limit en Identity Toolkit por refresh storms.

   **Recomendación:** investigación separada cuando vuelva a reproducirse, con
   captura del response body del 400 (`error.code` de Firebase Auth) y referer del
   request. Sin esos datos no se puede diagnosticar.

## Recomendación

Cerrar este ítem. Abrir un ticket nuevo para el 400 si se reproduce con datos
concretos (response body + headers + reproducible steps).
