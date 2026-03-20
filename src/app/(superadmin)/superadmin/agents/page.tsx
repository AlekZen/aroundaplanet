import { AgentsPanel } from './AgentsPanel'

export const metadata = {
  title: 'Agentes Odoo | AroundaPlanet',
}

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Agentes Odoo
      </h1>
      <AgentsPanel />
    </div>
  )
}
