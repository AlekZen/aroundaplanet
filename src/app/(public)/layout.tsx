import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { PageTransition } from '@/components/shared/PageTransition'
import { AnalyticsProvider } from '@/components/shared/AnalyticsProvider'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <AnalyticsProvider />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:min-h-11 focus:flex focus:items-center focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        Saltar al contenido principal
      </a>
      <Navbar />
      <main id="main-content" className="pt-16">
        <div className="max-w-7xl mx-auto px-4">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
      <Footer />
    </>
  )
}
