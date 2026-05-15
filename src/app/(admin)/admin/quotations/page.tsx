import { QuotationsPanel } from './QuotationsPanel'

export const metadata = {
  title: 'Cotizaciones | AroundaPlanet',
}

export default function AdminQuotationsPage() {
  return (
    <div className="space-y-6 p-4">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Cotizaciones</h1>
      <p className="text-sm text-muted-foreground">
        Leads capturados desde <code>/cotizar</code> y cotizaciones generadas desde admin. Genera el PDF
        formal cuando el cliente esté listo para recibir la propuesta.
      </p>
      <QuotationsPanel />
    </div>
  )
}
