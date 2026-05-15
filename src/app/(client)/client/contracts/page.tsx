import { MyContractsPanel } from '@/components/contracts/MyContractsPanel'

export const metadata = {
  title: 'Mis contratos | AroundaPlanet',
}

export default function ClientContractsPage() {
  return (
    <div className="space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Mis contratos</h1>
        <p className="text-sm text-muted-foreground">
          Contratos de viaje compartidos contigo por AroundaPlanet. Léelos antes de pagar el
          anticipo y acepta los términos para confirmar tu reservación.
        </p>
      </header>
      <MyContractsPanel viewerHint="client" />
    </div>
  )
}
