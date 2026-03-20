import { AdminDashboard } from './AdminDashboard'

export const metadata = {
  title: 'Panel Admin | AroundaPlanet',
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6 p-4">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Panel de Administracion
      </h1>
      <AdminDashboard />
    </div>
  )
}
