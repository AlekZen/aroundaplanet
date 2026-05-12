import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { DuplicatesView } from './DuplicatesView'

export const metadata = {
  title: 'Duplicados Odoo | AroundaPlanet',
}

export const dynamic = 'force-dynamic'

export default function DuplicatesPage() {
  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Duplicados Internos Odoo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Marca canónico de cada cluster. Solo escribe en Odoo a 2 campos: <code>x_dup_status</code> y <code>x_canonical_payment_id</code>.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <DuplicatesView />
      </Suspense>
    </div>
  )
}
