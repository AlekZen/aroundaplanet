import { OrphanOrdersPanel } from './OrphanOrdersPanel'

export const metadata = {
  title: 'Órdenes sin agente | AroundaPlanet',
}

export default function OrphanOrdersPage() {
  return (
    <div className="space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Órdenes sin agente asignado
        </h1>
        <p className="text-sm text-muted-foreground">
          Asigna el agente correspondiente para que el vendedor pueda ver el contrato y los recibos de pago de su cliente.
          Prioriza primero las órdenes con contrato o pagos verificados.
        </p>
      </header>
      <OrphanOrdersPanel />
    </div>
  )
}
