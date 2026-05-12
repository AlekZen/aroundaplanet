import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { ReconciliationView } from './ReconciliationView'

export const metadata = {
  title: 'Reconciliación de Pagos | AroundaPlanet',
}

export const dynamic = 'force-dynamic'

export default function ReconciliationPage() {
  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Reconciliación Firestore ↔ Odoo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enlaza retroactivamente pagos Firestore con account.payment de Odoo. Solo lectura en Odoo.
        </p>
      </div>
      <Suspense fallback={<ReconciliationSkeleton />}>
        <ReconciliationView />
      </Suspense>
    </div>
  )
}

function ReconciliationSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
