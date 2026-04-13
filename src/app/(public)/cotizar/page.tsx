import type { Metadata } from 'next'
import { CotizacionForm } from './CotizacionForm'

export const metadata: Metadata = {
  title: 'Cotiza tu viaje gratis | AroundaPlanet',
  description:
    'Solicita una cotización personalizada para tu próximo viaje: nacional, internacional, cruceros, vuelo + hotel y más. Respuesta directa por WhatsApp con AroundaPlanet.',
  keywords: [
    'cotización de viajes',
    'cotizar viaje México',
    'agencia de viajes',
    'cotizar crucero',
    'cotizar paquete todo incluido',
    'vuelo y hotel',
    'AroundaPlanet',
    'Vuelta al Mundo',
  ],
  alternates: {
    canonical: '/cotizar',
  },
  openGraph: {
    title: 'Cotiza tu viaje gratis | AroundaPlanet',
    description:
      'Solicita una cotización personalizada para tu próximo viaje y recibe respuesta directa por WhatsApp.',
    url: '/cotizar',
    siteName: 'AroundaPlanet',
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cotiza tu viaje gratis | AroundaPlanet',
    description:
      'Solicita una cotización personalizada y recibe respuesta directa por WhatsApp.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
}

export default function CotizarPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold text-primary mb-2">Solicitar Cotización</h1>
      <p className="text-muted-foreground mb-6">
        Completa los datos del viaje y envía la solicitud directamente por WhatsApp.
      </p>
      <CotizacionForm />
    </div>
  )
}
