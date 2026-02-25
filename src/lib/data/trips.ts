export interface StaticTrip {
  title: string
  slug: string
  imageUrl: string
  price: number // centavos
  dates: string
  destination: string
  description: string
}

export interface ItineraryDay {
  day: number
  location: string
  description: string
}

export const STATIC_TRIPS: readonly StaticTrip[] = [
  {
    title: 'Vuelta al Mundo 33.8 dias',
    slug: 'vuelta-al-mundo',
    imageUrl: '/images/trips/vuelta-al-mundo-2025.webp',
    price: 14500000,
    dates: 'Todo el anio',
    destination: 'Internacional',
    description:
      'La aventura definitiva: 33.8 dias recorriendo los destinos mas impresionantes del planeta. De America a Asia, de Europa a Oceania.',
  },
  {
    title: 'Europa Inolvidable',
    slug: 'europa-inolvidable',
    imageUrl: '/images/trips/europa-inolvidable.webp',
    price: 8000000,
    dates: 'Septiembre 2025',
    destination: 'Europa',
    description:
      'Recorre las capitales mas iconicas de Europa: Paris, Roma, Barcelona, Amsterdam y mas en un viaje grupal inolvidable.',
  },
  {
    title: 'Argentina y Brasil',
    slug: 'argentina-brasil',
    imageUrl: '/images/trips/argentina-brasil-agosto-2025.webp',
    price: 5500000,
    dates: 'Agosto 2025',
    destination: 'Sudamerica',
    description:
      'Buenos Aires, Iguazu, Rio de Janeiro — la combinacion perfecta de cultura, naturaleza y fiesta.',
  },
  {
    title: 'Chiapas Magico',
    slug: 'chiapas',
    imageUrl: '/images/trips/chiapas-octubre-2025.webp',
    price: 1500000,
    dates: 'Octubre 2025',
    destination: 'Mexico',
    description:
      'Cascadas, ruinas mayas, selva y pueblos magicos. Chiapas es Mexico en su estado mas puro.',
  },
  {
    title: 'Turquia y Dubai',
    slug: 'turquia-dubai',
    imageUrl: '/images/trips/turquia-dubai-2025.webp',
    price: 6000000,
    dates: 'Noviembre 2025',
    destination: 'Medio Oriente',
    description:
      'Estambul, Capadocia, Dubai — donde Oriente y Occidente se encuentran en una experiencia unica.',
  },
  {
    title: 'Colombia Aventura',
    slug: 'colombia',
    imageUrl: '/images/trips/colombia-octubre-2025.webp',
    price: 4000000,
    dates: 'Octubre 2025',
    destination: 'Sudamerica',
    description:
      'Cartagena, Medellin, el Eje Cafetero — descubre la calidez y biodiversidad de Colombia.',
  },
  {
    title: 'Peru Ancestral',
    slug: 'peru',
    imageUrl: '/images/trips/peru-diciembre-2025.webp',
    price: 4500000,
    dates: 'Diciembre 2025',
    destination: 'Sudamerica',
    description:
      'Machu Picchu, Cusco, Lima gastronomica — un viaje al corazon de la civilizacion inca.',
  },
  {
    title: 'Japon, China y Corea',
    slug: 'japon-china-corea',
    imageUrl: '/images/trips/japon-china-corea-2026.webp',
    price: 9500000,
    dates: 'Marzo 2026',
    destination: 'Asia',
    description:
      'Tokio, Beijing, Seoul — tecnologia, tradicion y gastronomia en el corazon de Asia.',
  },
]

export const VUELTA_AL_MUNDO_ITINERARY: readonly ItineraryDay[] = [
  { day: 1, location: 'Ciudad de Mexico', description: 'Punto de reunion y vuelo de salida' },
  { day: 3, location: 'Madrid, Espana', description: 'Cultura, tapas y vida nocturna madrilena' },
  { day: 6, location: 'Roma, Italia', description: 'Coliseo, Vaticano y la dolce vita' },
  { day: 9, location: 'Estambul, Turquia', description: 'Donde Europa se encuentra con Asia' },
  { day: 12, location: 'Dubai, EAU', description: 'Rascacielos, desierto y lujo' },
  { day: 15, location: 'Mumbai, India', description: 'Colores, sabores y espiritualidad' },
  { day: 18, location: 'Bangkok, Tailandia', description: 'Templos, mercados y street food' },
  { day: 22, location: 'Tokio, Japon', description: 'Tradicion y tecnologia en armonia' },
  { day: 26, location: 'Sydney, Australia', description: 'Opera House, playas y naturaleza' },
  { day: 30, location: 'Nueva York, EUA', description: 'La ciudad que nunca duerme' },
  { day: 33, location: 'Ciudad de Mexico', description: 'Regreso a casa con recuerdos eternos' },
]
