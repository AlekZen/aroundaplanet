'use client'

import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Props = {
  userRole?: 'admin' | 'cliente' | 'agente'
  title?: string
  description?: string
}

const SUPPORT_EMAIL = 'soporte@aroundaplanet.com'

export function NoAgentIdEmptyState({ userRole = 'agente', title, description }: Props) {
  const isAdmin = userRole === 'admin'

  const defaultTitle = isAdmin
    ? 'Tu cuenta no tiene perfil de agente'
    : 'Aún no tienes perfil de agente'

  const defaultDescription = isAdmin
    ? 'Tu rol es admin, no agente. Si necesitas operar como agente, vincula un agentId desde el panel de SuperAdmin.'
    : 'Tu cuenta todavía no está vinculada a un agente en Odoo. Pídele a Paloma o al equipo de soporte que te vincule para empezar a operar.'

  return (
    <div className="flex items-center justify-center py-12 px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
          <div className="rounded-full bg-muted p-4">
            <UserPlus className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            {title ?? defaultTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {description ?? defaultDescription}
          </p>
          {isAdmin ? (
            <Button asChild variant="default" size="sm">
              <Link href="/superadmin/users">Ir a SuperAdmin · Usuarios</Link>
            </Button>
          ) : (
            <Button asChild variant="default" size="sm">
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Solicitud%20acceso%20agente`}>
                Solicitar acceso de agente
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
