import { UnassignedLeadsPanel } from '@/app/(admin)/admin/leads/UnassignedLeadsPanel'

export const metadata = {
  title: 'Leads Sin Asignar | AroundaPlanet',
}

export default function SuperAdminLeadsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Leads Sin Asignar
      </h1>
      <UnassignedLeadsPanel />
    </div>
  )
}
