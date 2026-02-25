# Implementation Patterns & Consistency Rules

## Pattern Categories Defined

**28 areas de conflicto potencial identificadas** donde agentes IA podrian tomar decisiones diferentes sin guia explicita.

## Naming Patterns

**Firestore Document Naming:**

| Elemento | Convencion | Ejemplo | Anti-patron |
|----------|-----------|---------|-------------|
| Collections | `camelCase` plural | `trips`, `users`, `notifications` | `Trips`, `trip`, `TRIPS` |
| Subcollections | `camelCase` plural | `agents/{id}/clients`, `agents/{id}/payments` | `Clients`, `client_list` |
| Document fields | `camelCase` | `firstName`, `createdAt`, `agentId` | `first_name`, `FirstName` |
| Document IDs | Firebase auto-ID o `kebab-case` significativo | auto: `Kj8mN2...`, manual: `vuelta-al-mundo-338` | `VUELTA_AL_MUNDO`, `trip 1` |
| Timestamps | Firestore `Timestamp` type | `Timestamp.now()` | ISO string, Unix epoch |
| Booleans | `is/has/can` prefix | `isVerified`, `hasPayments`, `canEdit` | `verified`, `payments_exist` |

**API Naming:**

| Elemento | Convencion | Ejemplo | Anti-patron |
|----------|-----------|---------|-------------|
| Route Handlers | `kebab-case` folders | `/api/odoo/search-read` | `/api/odoo/searchRead`, `/api/odoo/search_read` |
| Query params | `camelCase` | `?agentId=123&tripSlug=vuelta` | `?agent_id=123`, `?AgentId=123` |
| Path params | `camelCase` en brackets | `/api/payments/[paymentId]` | `/api/payments/[payment_id]` |
| HTTP methods | Semanticos | GET read, POST create, PATCH update, DELETE remove | POST para todo |

**Code Naming:**

| Elemento | Convencion | Ejemplo | Anti-patron |
|----------|-----------|---------|-------------|
| Componentes | `PascalCase` | `PaymentStepper.tsx`, `KPICard.tsx` | `payment-stepper.tsx`, `kpiCard.tsx` |
| Archivos componente | `PascalCase.tsx` | `EmotionalProgress.tsx` | `emotional-progress.tsx`, `emotionalProgress.tsx` |
| Hooks | `camelCase` con `use` prefix | `useAuth.ts`, `useOffline.ts` | `UseAuth.ts`, `auth-hook.ts` |
| Stores (Zustand) | `camelCase` con `use` + `Store` suffix | `useAuthStore.ts`, `useNotificationStore.ts` | `auth-store.ts`, `AuthStore.ts` |
| Schemas (Zod) | `camelCase` con `Schema` suffix | `paymentSchema.ts`, `userSchema.ts` | `Payment.schema.ts`, `payment-schema.ts` |
| Types/Interfaces | `PascalCase`, NO prefix `I` | `type Payment`, `interface User` | `IPayment`, `PaymentType`, `TPayment` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_UPLOAD_SIZE`, `ODOO_CACHE_TTL` | `maxUploadSize`, `MaxUploadSize` |
| Funciones util | `camelCase` verbo+sustantivo | `formatCurrency()`, `parseOdooDate()` | `currency_format()`, `CurrencyFormat()` |
| Event handlers | `handle` + evento | `handleSubmit`, `handlePaymentVerify` | `onSubmit` (reservado para props), `submit` |
| Props de callback | `on` + evento | `onPaymentVerify`, `onClose` | `handleVerify` (eso es interno), `verifyCallback` |

## Structure Patterns

**Project Organization: Feature-Adjacent, Not Feature-Grouped**

```
# CORRECTO: Componentes y hooks globales por tipo, pages por route group
src/
├── app/(agent)/dashboard/page.tsx      # Page
├── components/custom/KPICard.tsx        # Componente custom reutilizable
├── hooks/useAuth.ts                     # Hook global
├── lib/firebase/auth.ts                 # Service
├── schemas/payment.ts                   # Schema Zod
├── stores/useAuthStore.ts               # Store Zustand
├── types/payment.ts                     # Types

# INCORRECTO: Feature folders que duplican estructura
src/features/payments/components/...
src/features/payments/hooks/...
src/features/payments/types/...
```

Rationale: El App Router ya organiza por feature via route groups. No duplicar con feature folders en `src/`.

**Test Organization: Co-Located**

```
# CORRECTO: Tests junto al archivo que testean
src/
├── components/custom/KPICard.tsx
├── components/custom/KPICard.test.tsx     # Unit test co-located
├── lib/odoo/client.ts
├── lib/odoo/client.test.ts               # Unit test co-located
├── e2e/                                   # E2E tests en carpeta raiz
│   ├── payment-flow.spec.ts
│   └── auth-flow.spec.ts

# INCORRECTO: Carpeta __tests__ separada
__tests__/components/KPICard.test.tsx
tests/unit/odoo-client.test.ts
```

**Component File Pattern: Single Export**

```typescript
// CORRECTO: Un componente principal por archivo
// components/custom/KPICard.tsx
export function KPICard({ title, value, trend }: KPICardProps) { ... }

// INCORRECTO: Multiples componentes exportados
// components/custom/Cards.tsx
export function KPICard() { ... }
export function TripCard() { ... }
export function PaymentCard() { ... }
```

Excepcion: Componentes compuestos (ej: `Table` + `TableHead` + `TableRow`) pueden vivir en un archivo si son inseparables.

**Import Pattern: NO Barrel Exports**

```typescript
// CORRECTO: Import directo
import { KPICard } from '@/components/custom/KPICard'
import { useAuth } from '@/hooks/useAuth'

// INCORRECTO: Barrel exports (causan bundle bloat)
import { KPICard, TripCard, PaymentCard } from '@/components/custom'
import { useAuth, useRole } from '@/hooks'
```

## Format Patterns

**API Response Format:**

```typescript
// EXITO — retorna data directamente
return NextResponse.json({ trips: [...] }, { status: 200 })

// ERROR — usa AppError pattern
return NextResponse.json({
  code: 'PAYMENT_NOT_FOUND',
  message: 'No encontramos ese pago',
  retryable: false,
}, { status: 404 })

// LISTA con metadata
return NextResponse.json({
  data: [...],
  pagination: { page: 1, pageSize: 20, total: 150 },
}, { status: 200 })
```

**NO wrapper generico** tipo `{ success: true, data: ... }`. El status HTTP ya indica exito/error.

**Date/Time Handling:**

| Contexto | Formato | Ejemplo |
|----------|---------|---------|
| Firestore | `Timestamp` nativo | `Timestamp.now()` |
| API responses (JSON) | ISO 8601 string | `"2026-02-24T22:00:00.000Z"` |
| UI display | Formateado con `Intl.DateTimeFormat` | `"24 feb 2026"` |
| Odoo XML-RPC | String `"YYYY-MM-DD HH:mm:ss"` | `"2026-02-24 22:00:00"` |

**Regla:** Firestore Timestamps son la fuente de verdad. Se convierten a ISO string al salir de Route Handlers. Se formatean con `Intl` al mostrarse. Zona horaria: `America/Mexico_City` default, `Europe/Madrid` para oficina Madrid.

**Currency Handling:**

```typescript
// SIEMPRE almacenar en centavos (integer) para evitar floating point
// Firestore: amountCents: 14500000 (= $145,000.00 MXN)
// Display: formatCurrency(14500000) → "$145,000.00 MXN"

function formatCurrency(cents: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}
```

**JSON Field Convention:**

| Fuente | Campo original | Campo en Firestore/API |
|--------|---------------|----------------------|
| Odoo `res.partner` | `write_date` | `odooWriteDate` (prefijo `odoo` para campos sincronizados) |
| Odoo `sale.order` | `amount_total` | `odooAmountTotal` |
| App nativo | N/A | `createdAt`, `updatedAt` |
| Metadata sync | N/A | `lastSyncAt`, `syncSource` |

## Communication Patterns

**Domain Events (NotificationService triggers):**

```typescript
// Naming: dominio.accion en pasado
type DomainEvent =
  | { type: 'payment.reported'; paymentId: string; agentId: string; amountCents: number }
  | { type: 'payment.verified'; paymentId: string; adminId: string }
  | { type: 'payment.rejected'; paymentId: string; adminId: string; reason: string }
  | { type: 'client.created'; clientId: string; agentId: string }
  | { type: 'agent.inactive'; agentId: string; daysSinceLastAction: number }
  | { type: 'kpi.exception'; metric: string; threshold: number; actual: number }
```

**Zustand Store Pattern:**

```typescript
// SIEMPRE este formato para stores
interface AuthState {
  user: User | null
  roles: Role[]
  isLoading: boolean
  // Actions agrupadas al final
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  roles: [],
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  logout: async () => { /* ... */ set({ user: null, roles: [] }) },
}))
```

**Regla:** State es inmutable (Zustand lo maneja). NO usar `immer` middleware. Stores pequenos y enfocados, no un mega-store.

## Process Patterns

**Loading States:**

```typescript
// CORRECTO: Skeleton que replica forma del contenido (UX spec)
<Skeleton className="h-[200px] w-full rounded-xl" />

// INCORRECTO: Spinner generico
<Spinner /> // NO
<p>Cargando...</p> // NUNCA
```

Regla del UX spec: **NUNCA pantalla blanca**. Skeleton con pulse animation (0.5→1.0 opacity, 1.5s cycle). Cada componente tiene su propio skeleton que replica su forma.

**Error Boundaries:**

```typescript
// Error boundary por route group, NO global unico
// app/(agent)/error.tsx — errores del portal agente
// app/(admin)/error.tsx — errores del portal admin
// app/(public)/error.tsx — errores de paginas publicas

// Cada error.tsx muestra UI contextual al rol
export default function AgentError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <p>No pudimos cargar esta informacion</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  )
}
```

**Retry Pattern (Odoo):**

```typescript
// Exponential backoff: 1s → 2s → 4s, max 3 intentos
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn() }
    catch (e) {
      if (i === maxRetries - 1) throw e
      await sleep(Math.pow(2, i) * 1000)
    }
  }
  throw new Error('unreachable')
}
```

**Form Submission Pattern:**

```typescript
// SIEMPRE este flujo para forms con server action o API call
// 1. Validar con Zod (react-hook-form ya lo hace)
// 2. Set loading state
// 3. Try API call
// 4. Success → toast + redirect/update
// 5. Error → toast error + mantener form data (NUNCA borrar input del usuario)
```

**Authentication Check Pattern:**

```typescript
// En Client Components
const { user, isLoading } = useAuthStore()
if (isLoading) return <Skeleton />
if (!user) redirect('/login')

// En Server Components / Route Handlers
const session = await getServerSession()
if (!session) return NextResponse.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
```

## Enforcement Guidelines

**All AI Agents MUST:**

1. Run `npx tsc --noEmit` before considering a task complete (zero type errors)
2. Follow naming conventions EXACTLY — no "creative" alternatives
3. Use existing patterns in the codebase as reference before creating new ones
4. Never create barrel exports (`index.ts` that re-exports)
5. Co-locate tests with their source files
6. Use Zod schemas from `src/schemas/` — never inline validation
7. Use `AppError` pattern for all error responses — never raw strings
8. Use Firestore `Timestamp` for dates — never `new Date()` in Firestore writes
9. Store currency in centavos (integer) — never floating point
10. Use `'use client'` only where needed — push it down the tree

**Pattern Enforcement:**
- ESLint rules enforce naming conventions (eslint-plugin-naming-convention)
- TypeScript strict mode catches type mismatches
- PR review checklist includes pattern compliance check
- Vitest tests validate API response formats

**Pattern Updates:**
- Patterns se actualizan en este documento architecture.md
- Cambios a patrones requieren razon documentada
- Nuevos patrones se agregan cuando se descubre un conflict point no previsto

## Pattern Examples

**Good Examples:**

```typescript
// Firestore write correcto
await setDoc(doc(db, 'agents', agentId, 'payments', paymentId), {
  amountCents: 1450000,
  status: 'pending',
  agentId,
  clientId,
  createdAt: Timestamp.now(),
  isVerified: false,
  odooOrderId: 12345,
})

// Route Handler correcto
export async function GET(req: NextRequest, { params }: { params: { paymentId: string } }) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ code: 'AUTH_REQUIRED', message: 'Sesion requerida', retryable: false }, { status: 401 })
  // ...
  return NextResponse.json({ payment }, { status: 200 })
}

// Component correcto
export function PaymentCard({ payment, onVerify }: PaymentCardProps) {
  const handleVerify = async () => { /* ... */ }
  return <Card>...</Card>
}
```

**Anti-Patterns:**

```typescript
// MAL: snake_case en Firestore
await setDoc(ref, { amount_cents: 1450000, created_at: new Date() })

// MAL: Wrapper generico en API
return NextResponse.json({ success: true, data: { payment } })

// MAL: Barrel export
// components/custom/index.ts
export * from './KPICard'
export * from './TripCard'

// MAL: Tipo con prefijo I
interface IPayment { ... }

// MAL: Handler nombrado como prop
function onSubmit() { ... } // Usar handleSubmit para handlers internos

// MAL: Spinner generico
return <div className="flex justify-center"><Spinner /></div>

// MAL: Floating point currency
{ amount: 145000.00 } // Usar amountCents: 14500000
```
