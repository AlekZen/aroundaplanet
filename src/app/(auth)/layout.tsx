import Image from 'next/image'
import { PageTransition } from '@/components/shared/PageTransition'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:min-h-11 focus:flex focus:items-center focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        Saltar al contenido principal
      </a>
      <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
        {/* Hero lateral — solo desktop */}
        <div className="hidden lg:block bg-primary relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur" />
          <div className="relative z-10 flex h-full flex-col items-center justify-center p-12 text-primary-foreground">
            <Image
              src="/images/logo-aroundaplanet.webp"
              alt="AroundaPlanet"
              width={80}
              height={80}
              className="h-20 w-20 mb-6"
            />
            <h1 className="font-heading text-3xl font-bold text-center">
              AroundaPlanet
            </h1>
            <p className="mt-3 text-primary-foreground/80 text-center max-w-xs">
              Vuelta al Mundo en 33.8 dias
            </p>
          </div>
        </div>

        {/* Lado del formulario */}
        <div className="flex items-center justify-center p-8">
          {/* Logo centrado en mobile */}
          <div className="w-full max-w-md">
            <div className="flex flex-col items-center mb-8 lg:hidden">
              <Image
                src="/images/logo-aroundaplanet.webp"
                alt="AroundaPlanet"
                width={56}
                height={56}
                className="h-14 w-14 mb-3"
              />
              <span className="font-heading text-xl font-semibold text-primary">
                AroundaPlanet
              </span>
            </div>
            <main
              id="main-content"
              className="bg-card rounded-lg shadow-lg p-8 max-w-md w-full"
            >
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
        </div>
      </div>
    </>
  )
}
