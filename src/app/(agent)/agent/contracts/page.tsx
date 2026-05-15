import { MyContractsPanel } from '@/components/contracts/MyContractsPanel'

export const metadata = {
  title: 'Contratos de mis clientes | AroundaPlanet',
}

export default function AgentContractsPage() {
  return (
    <div className="space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Contratos de mis clientes
        </h1>
        <p className="text-sm text-muted-foreground">
          Contratos asignados a ti como agente, una vez que el admin autorice tu visibilidad.
        </p>
      </header>
      <MyContractsPanel viewerHint="agent" />
    </div>
  )
}
