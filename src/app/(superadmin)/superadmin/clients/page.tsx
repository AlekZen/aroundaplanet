import { SuperAdminClientsPanel } from './SuperAdminClientsPanel'

export default function SuperAdminClientsPage() {
  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Clientes por Agente
        </h1>
        <p className="text-muted-foreground">
          Vista de todos los clientes agrupados por agente. Selecciona un agente para ver su cartera.
        </p>
      </div>
      <SuperAdminClientsPanel />
    </div>
  )
}
