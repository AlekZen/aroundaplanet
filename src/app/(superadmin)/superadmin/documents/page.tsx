import { DocumentsPanel } from '@/components/custom/DocumentsPanel'

export const metadata = {
  title: 'Documentos | AroundaPlanet',
}

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Metadata segura de Odoo Documents y documentos publicos ligados a productos.
        </p>
      </div>
      <DocumentsPanel />
    </div>
  )
}
