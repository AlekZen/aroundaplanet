import { createMetadata } from '@/lib/metadata'
import { TermsContent } from '@/components/shared/TermsContent'

export const metadata = createMetadata({
  title: 'Terminos y Condiciones — AroundaPlanet',
  description: 'Terminos y condiciones de uso del servicio de AroundaPlanet, agencia de viajes grupales.',
})

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl py-12">
      <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
        Terminos y Condiciones
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Ultima actualizacion: 28 de febrero de 2026</p>

      <div className="mt-8">
        <TermsContent />
      </div>
    </article>
  )
}
