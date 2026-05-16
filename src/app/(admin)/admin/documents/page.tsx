import { DocumentsPanel } from '@/components/custom/DocumentsPanel'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Documentos | AroundaPlanet',
  description: 'Backoffice de Odoo Documents — mirror Firestore en tiempo real.',
}

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Metadata segura de Odoo Documents y documentos públicos ligados a productos.
        </p>
      </div>
      <DocumentsPanel />
    </div>
  )
}
