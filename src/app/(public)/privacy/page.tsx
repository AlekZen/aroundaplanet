import { createMetadata } from '@/lib/metadata'
import { PrivacyContent } from '@/components/shared/PrivacyContent'

export const metadata = createMetadata({
  title: 'Aviso de Privacidad — AroundaPlanet',
  description: 'Aviso de privacidad de AroundaPlanet. Conoce como recopilamos, usamos y protegemos tus datos personales.',
})

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl py-12">
      <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
        Aviso de Privacidad
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Ultima actualizacion: 28 de febrero de 2026</p>

      <div className="mt-8">
        <PrivacyContent />
      </div>
    </article>
  )
}
