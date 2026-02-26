import { UsersPanel } from './UsersPanel'

export const metadata = {
  title: 'Gestion de Usuarios | AroundaPlanet',
}

export default function UsersManagementPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Gestion de Usuarios
      </h1>
      <UsersPanel />
    </div>
  )
}
