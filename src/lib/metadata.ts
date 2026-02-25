import type { Metadata } from 'next'

const DEFAULT_OG_IMAGE = '/images/hero/hero-group-photo-01.webp'

export function createMetadata(overrides: Partial<Metadata> = {}): Metadata {
  const title = overrides.title ?? 'AroundaPlanet — Viaja el Mundo'
  const description =
    (overrides.description as string) ??
    'Vuelta al Mundo en 33.8 días. La agencia de viajes grupales más aventurera de México. Más de 8 años de experiencia.'

  // Destructure openGraph and twitter to merge them deeply,
  // then spread remaining overrides WITHOUT re-overwriting them.
  const { openGraph: ogOverrides, twitter: twOverrides, ...restOverrides } = overrides

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      siteName: 'AroundaPlanet',
      locale: 'es_MX',
      title: typeof title === 'string' ? title : undefined,
      description,
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
      ...(typeof ogOverrides === 'object' ? ogOverrides : {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...(typeof twOverrides === 'object' ? twOverrides : {}),
    },
    ...restOverrides,
  }
}
