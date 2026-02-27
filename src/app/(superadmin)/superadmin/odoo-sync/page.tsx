import { OdooSyncDashboard } from './OdooSyncDashboard'

export const metadata = {
  title: 'Sincronizacion Odoo | AroundaPlanet',
}

export default function OdooSyncPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Sincronizacion Odoo
      </h1>
      <p className="text-sm text-muted-foreground">
        Sincroniza datos desde Odoo hacia la plataforma. Usuarios y viajes se actualizan de forma independiente.
      </p>
      <OdooSyncDashboard />
    </div>
  )
}
