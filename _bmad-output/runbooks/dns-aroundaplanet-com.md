# Runbook — DNS aroundaplanet.com

**Estado**: pendiente operativo (Alek + administrador del dominio).
**Bloquea cierre código Fase 0**: no. La plataforma sigue operativa en la URL canónica de App Hosting.
**Última actualización**: 2026-05-20.

---

## 1. Contexto

El convenio v4.0 no especifica un dominio canónico obligatorio. La URL productiva actual es:

```
https://aroundaplanet--arounda-planet.us-east4.hosted.app
```

El cliente ya posee el dominio `aroundaplanet.com` (verificar con Noel quién es el registrador: GoDaddy / Namecheap / Google Domains / otro). La configuración DNS es un paso post-entrega que se ejecuta cooperativamente entre el prestador (Alek) y el cliente.

---

## 2. Pasos para apuntar `aroundaplanet.com` a Firebase App Hosting

### 2.1. Conectar el dominio custom desde Firebase Console

1. Abrir Firebase Console → proyecto `arounda-planet` → App Hosting → backend `aroundaplanet` (región `us-east4`).
2. Sección **Custom Domains** → **Add domain**.
3. Ingresar `aroundaplanet.com` (apex) y `www.aroundaplanet.com` (subdominio).
4. Firebase mostrará los registros DNS que se deben crear en el registrador del dominio. Generalmente:
   - Apex (`aroundaplanet.com`): **A** records (4 direcciones IPv4 de Google) o **ALIAS/ANAME** si el registrador lo soporta.
   - `www.aroundaplanet.com`: **CNAME** apuntando al hostname `aroundaplanet--arounda-planet.us-east4.hosted.app`.
5. Copiar exactamente los valores que la consola muestra (los valores pueden cambiar entre proyectos).

### 2.2. Crear los registros en el registrador

1. Entrar al panel del registrador con la cuenta de Noel/AroundaPlanet.
2. Eliminar o desactivar cualquier A/CNAME previo para `@` y `www` que apunte a un host viejo.
3. Crear los registros con los valores que mostró Firebase Console.
4. TTL recomendado: 300–3600 segundos para propagación rápida.

### 2.3. Verificar el dominio en Firebase

1. Volver a Firebase Console → Custom Domains.
2. Click **Verify**. La verificación puede tardar entre minutos y hasta 24 horas dependiendo de propagación DNS.
3. Una vez verificado, Firebase provisiona automáticamente certificado SSL (Let's Encrypt o equivalente Google-managed). Provisioning puede tardar otras 1–4 horas.

### 2.4. (Opcional) Redirect 301 desde la URL canónica de App Hosting

Si se desea que la URL `aroundaplanet--arounda-planet.us-east4.hosted.app` redirija al dominio custom, configurar reglas en `apphosting.yaml` o middleware:

```typescript
// src/proxy.ts (ejemplo)
const url = request.nextUrl;
if (url.hostname === 'aroundaplanet--arounda-planet.us-east4.hosted.app') {
  url.hostname = 'aroundaplanet.com';
  return NextResponse.redirect(url, 301);
}
```

**Recomendación**: NO hacer el redirect hasta que el dominio custom esté verde y SSL provisionado, para no romper accesos en tránsito durante la propagación.

---

## 3. Validación post-DNS

Una vez verificado el dominio en Firebase y SSL provisionado, validar:

```powershell
# Apex responde 200 (HTML) con SSL válido
curl.exe -I https://aroundaplanet.com

# www responde 200 (HTML) con SSL válido
curl.exe -I https://www.aroundaplanet.com

# Login funciona en el dominio custom
# (abrir en browser: https://aroundaplanet.com/login)
```

Criterios de éxito:
- Status 200 (o 308 → 200 si Firebase fuerza HTTPS).
- Header `strict-transport-security` presente.
- Certificate validity en navegador (no warning de "Not secure").
- `/login`, `/api/auth/session`, `/admin/manual` responden correctamente.

---

## 4. Actualizar referencias internas tras DNS verde

Después de verificar el dominio:

1. `_bmad-output/entrega-formal/fase-0-entregables.md` apartado 3.1: actualizar URL canónica.
2. `apphosting.yaml` (si aplica): agregar `aroundaplanet.com` como custom hostname.
3. `src/lib/firebase/config.ts` `authDomain`: dejar el de Firebase (`arounda-planet.firebaseapp.com`) para que Firebase Auth siga funcionando — NO cambiar a `aroundaplanet.com`.
4. OpenGraph URLs en `src/app/layout.tsx` (si están hardcodeadas): actualizar a `https://aroundaplanet.com/...`.
5. Avisar a Noel y al grupo de champions del cambio de URL.

---

## 5. Contactos y recursos

- **Documentación Firebase**: https://firebase.google.com/docs/hosting/custom-domain (aplica al producto App Hosting con ajustes menores).
- **Proyecto Firebase**: `arounda-planet`.
- **Backend**: `aroundaplanet` región `us-east4`.
- **Registrador del dominio**: pendiente confirmar con Noel.
- **Responsable de la configuración**: Alek (técnica) + Noel (acceso al registrador).

---

## 6. Rollback

Si tras la configuración hay problemas (SSL no provisiona en 24h, propagación rota, etc.):

1. En el registrador, revertir los registros DNS al estado anterior (si los había) o eliminarlos.
2. En Firebase Console, eliminar el custom domain del backend.
3. Los usuarios siguen accediendo por `aroundaplanet--arounda-planet.us-east4.hosted.app` sin interrupción.

---

*Runbook DNS v1.0 — 2026-05-20. Cualquier ajuste posterior se documenta como `dns-aroundaplanet-com-v1.1.md` (NO sobreescribir).*
