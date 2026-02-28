import Link from 'next/link'
import { cn } from '@/lib/utils'

interface FooterProps {
  className?: string
}

export function Footer({ className }: FooterProps) {
  return (
    <footer
      className={cn('bg-primary text-primary-foreground', className)}
    >
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Contacto */}
          <div>
            <h3 className="font-heading text-lg font-semibold mb-4">Contacto</h3>
            <address className="not-italic text-sm text-primary-foreground/80 space-y-2">
              <p>Ocotlan, Jalisco, Mexico</p>
              <p>
                <a
                  href="mailto:info@aroundaplanet.com"
                  className="hover:text-primary-foreground transition-colors"
                >
                  info@aroundaplanet.com
                </a>
              </p>
            </address>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-heading text-lg font-semibold mb-4">Explora</h3>
            <nav aria-label="Links del footer" className="flex flex-col gap-2">
              {[
                { href: '/viajes', label: 'Viajes' },
                { href: '/viajes/vuelta-al-mundo-2025', label: 'Vuelta al Mundo' },
                { href: '/sobre-nosotros', label: 'Nosotros' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors min-h-11 flex items-center focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-heading text-lg font-semibold mb-4">Legal</h3>
            <nav aria-label="Links legales" className="flex flex-col gap-2">
              {[
                { href: '/privacy', label: 'Aviso de Privacidad' },
                { href: '/terms', label: 'Terminos y Condiciones' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors min-h-11 flex items-center focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-8 border-t border-primary-foreground/20 pt-8 text-center text-sm text-primary-foreground/60">
          <p suppressHydrationWarning>&copy; {new Date().getFullYear()} AroundaPlanet. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
