# Core Architectural Decisions

## Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Firestore document structure (hibrido: flat + subcollections per-agent)
2. Custom claims structure (roles en claims, permisos en Firestore)
3. Firestore Security Rules architecture (agent isolation pattern)
4. Odoo sync strategy (event-driven writes + polling)
5. API route protection (proxy + per-route validation)
6. Server/Client component split strategy

**Important Decisions (Shape Architecture):**
7. Cache TTL por modelo Odoo
8. Error handling standards (AppError pattern)
9. NotificationService declarative rules
10. SSG/ISR vs CSR rendering split
11. CI/CD pipeline (Firebase App Hosting + GitHub Actions)
12. Environment management (dev/staging/prod)

**Deferred Decisions (Post-MVP):**
- Multi-tenant data isolation (single-tenant MVP, architecture ready)
- GraphQL layer over Odoo (if REST-like queries prove insufficient)
- CDN custom domain (using Firebase default initially)
- Advanced monitoring (Sentry, DataDog — Firebase native sufficient for MVP)

## Data Architecture

**Firestore Document Structure: Hibrido**

Colecciones raiz para entidades compartidas, subcollections para datos per-agent:

```
/trips/{tripId}                    # Compartido — catalogo publico
/users/{uid}                       # Perfil usuario (todos los roles)
/agents/{agentId}/clients/{clientId}   # Aislado por agente
/agents/{agentId}/payments/{paymentId} # Aislado por agente
/notifications/{notificationId}    # Per-user con campo recipientId
/config/permissions/{role}         # Permisos granulares por rol
/config/notification-rules         # Reglas de NotificationService
/kpis/{period}                     # Materialized views para director dashboard
```

Rationale: Agent data isolation es natural con subcollections (Security Rules triviales). Trips son publicos. KPIs son materialized views pre-calculadas para evitar collection group queries costosas en dashboard director.

**Odoo↔Firestore Sync: Event-Driven Writes + Polling**

| Direccion | Trigger | Mecanismo |
|-----------|---------|-----------|
| App → Odoo | Pago reportado, cliente creado, status change | Write-through en Route Handler: escribe Firestore + Odoo en misma transaccion |
| Odoo → Firestore | Precio actualizado, itinerario cambiado, factura emitida | Polling via Cloud Scheduler cada 15-30 min. Compara timestamps, actualiza solo cambios |
| Bidireccional | Contactos (res.partner) | Write-through desde app + polling desde Odoo. Conflict resolution: last-write-wins con timestamp |

**Cache TTL por Modelo Odoo:**

| Modelo Odoo | TTL Firestore | Justificacion |
|-------------|--------------|---------------|
| `product.product` (viajes) | 24h | Precios/itinerarios rara vez cambian |
| `res.partner` (contactos) | 1h | Actualizaciones frecuentes de leads |
| `sale.order` (pedidos) | 15min | Status de pagos cambia constantemente |
| `account.move` (facturas) | 1h | Facturacion posterior al pago |
| KPI aggregations | 5min | Dashboard director necesita frescura |

**Data Validation: Zod Everywhere + Firestore Rules Safety Net**

Un schema Zod por entidad en `src/schemas/`. Usado por:
1. React Hook Form (client validation + UX)
2. Route Handler (server validation + business rules)
3. Firestore Security Rules (estructura basica como ultima barrera)

## Authentication & Security

**Custom Claims: Roles en JWT, Permisos en Firestore**

```typescript
// Firebase Auth Custom Claims (en JWT token)
interface UserClaims {
  roles: ('cliente' | 'agente' | 'admin' | 'director' | 'superadmin')[];
  agentId?: string;    // Solo si tiene rol agente
  adminLevel?: number; // Nivel de acceso admin (futuro)
}
```

Permisos granulares en Firestore `/config/permissions/{role}` — actualizables sin tocar Auth tokens. Proxy de Next.js lee claims + expande permisos desde Firestore con cache en memoria (TTL 5min).

**Firestore Security Rules: Agent Isolation Pattern**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Trips: publico lectura, admin/superadmin escritura
    match /trips/{tripId} {
      allow read: if true;
      allow write: if 'admin' in request.auth.token.roles
                   || 'superadmin' in request.auth.token.roles;
    }
    // Agent data: aislado por agentId
    match /agents/{agentId}/{document=**} {
      allow read: if request.auth.token.agentId == agentId
                  || 'admin' in request.auth.token.roles
                  || 'director' in request.auth.token.roles;
      allow write: if request.auth.token.agentId == agentId;
    }
    // User profiles: solo el propio usuario
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
      allow read: if 'admin' in request.auth.token.roles;
    }
  }
}
```

**API Route Protection: Proxy + Per-Route**

- `proxy.ts`: Verifica Firebase ID token en CADA request a rutas protegidas. Decodifica claims. Redirige a login si no autenticado.
- Route Handlers: Verifican permisos especificos (`requireRole('admin')`, `requirePermission('payments:verify')`).
- Rutas publicas (`/(public)/*`): Sin proxy auth.

**Firebase App Check:** Habilitado para proteger Route Handlers de requests fuera de la app. Attestation provider: reCAPTCHA Enterprise.

## API & Communication Patterns

**Odoo Proxy: Route Handlers (MVP), Migratable a Cloud Functions**

Proxy Odoo implementado como Route Handlers en `/api/odoo/*`. La capa de abstraccion vive en `lib/odoo/` con interfaz clara — si necesita escalar independiente, se mueve a Cloud Functions sin reescribir logica.

```typescript
// lib/odoo/client.ts — Interfaz de abstraccion
interface OdooClient {
  search(model: string, domain: any[], fields: string[]): Promise<any[]>;
  read(model: string, ids: number[], fields: string[]): Promise<any[]>;
  create(model: string, values: Record<string, any>): Promise<number>;
  write(model: string, ids: number[], values: Record<string, any>): Promise<boolean>;
  searchRead(model: string, domain: any[], fields: string[], options?: SearchOptions): Promise<any[]>;
}
```

**Error Handling: AppError Pattern**

```typescript
interface AppError {
  code: string;          // "PAYMENT_NOT_FOUND", "ODOO_TIMEOUT"
  message: string;       // Mensaje usuario-friendly en espanol
  status: number;        // HTTP status (400, 401, 403, 404, 500, 503)
  details?: unknown;     // Debug info (solo en development)
  retryable: boolean;    // Frontend puede mostrar boton "Reintentar"
}
```

Codigos de error estandarizados por dominio: `AUTH_*`, `PAYMENT_*`, `ODOO_*`, `NOTIFICATION_*`, `UPLOAD_*`.

**NotificationService: Declarativo, Stateless**

Reglas de notificacion en `lib/notifications/rules.ts`. El servicio recibe un evento de dominio, busca la regla correspondiente, y despacha a canales en orden de fallback (FCM → WhatsApp → email). Respeta horarios silenciosos, agrupa eventos, genera deep links.

## Frontend Architecture

**Server vs Client Components: Push 'use client' Down**

| Tipo | Rendering | Ejemplos |
|------|-----------|----------|
| Layouts | Server Component | RootLayout, PublicLayout, AdminDesktopLayout |
| Pages (data fetch) | Server Component | TripCatalogPage, AboutPage |
| Pages (real-time) | Client Component | DashboardPage, PaymentQueuePage |
| Interactive widgets | Client Component | PaymentForm, KPICard, EmotionalProgress |
| Static UI | Server Component | Footer, Navbar (sin state) |

Regla: Si no necesita `useState`, `useEffect`, event handlers, o browser APIs → Server Component.

**Rendering Strategy: SSG/ISR + CSR Split**

| Pagina | Rendering | Revalidation |
|--------|-----------|-------------|
| Landing, catalogo, about | SSG + ISR | revalidate: 3600 (1h) |
| Auth (login/registro) | SSG | Estatico |
| Dashboard director | CSR | Firestore real-time |
| Cola admin | CSR | Firestore onSnapshot |
| Portal agente | CSR + initial fetch | Firestore offline |
| Portal cliente | CSR + initial fetch | Firestore offline |

## Infrastructure & Deployment

**CI/CD: Firebase App Hosting + GitHub Actions**

- **Firebase App Hosting**: Auto-deploy desde `master`. Preview URLs por PR.
- **GitHub Actions**: CI pipeline en cada PR — ESLint + Vitest + Playwright. Block merge si falla.
- **Flow**: PR → GitHub Actions CI → Merge to `master` → Firebase auto-deploy

**Environment Management:**

| Environment | Branch | Infra | Odoo |
|-------------|--------|-------|------|
| Development | local | Firebase Emulator Suite | Mock/Sandbox |
| Staging | PR branches | Firebase preview URLs | Odoo prod (read-only) |
| Production | `master` | arounda-planet (us-east4) | aroundaplanet.odoo.com |

**Monitoring:**
- Firebase Performance Monitoring (Web Vitals: LCP, FID, CLS)
- Firebase Crashlytics (errores client-side)
- Cloud Logging (Route Handler logs automaticos en Cloud Run)
- Firebase Alerts (errores criticos, Odoo timeouts)

## Decision Impact Analysis

**Implementation Sequence:**
1. Firebase Auth + custom claims + proxy (todo depende de auth)
2. Firestore structure + Security Rules (data model es foundation)
3. Odoo abstraction layer + sync engine (datos reales)
4. Route groups + layouts (estructura de la app)
5. NotificationService + FCM setup (push depende de auth + data)
6. Offline queue + Background Sync (depende de Firestore structure)
7. CI/CD pipeline (soporta todo lo anterior)

**Cross-Component Dependencies:**
- Auth claims → Firestore Rules → Agent isolation → API protection (cadena critica)
- Odoo sync → Firestore cache → SSG/ISR revalidation (cadena de datos)
- Serwist SW → FCM → Deep links → NotificationService (cadena de notificaciones)
- Zod schemas → RHF forms → Route Handlers → Firestore writes (cadena de validacion)
