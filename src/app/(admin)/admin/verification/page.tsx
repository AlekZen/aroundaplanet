import { VerificationPanel } from './VerificationPanel'

export const metadata = {
  title: 'Verificacion de Pagos | AroundaPlanet',
}

export default function VerificationPage() {
  return (
    <div className="space-y-6 p-4">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Cola de Verificacion
      </h1>
      <VerificationPanel />
    </div>
  )
}
