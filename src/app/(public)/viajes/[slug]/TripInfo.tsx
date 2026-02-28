import { Badge } from '@/components/ui/badge'
import type { PublicTrip } from '@/types/trip'

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facil',
  moderate: 'Moderado',
  challenging: 'Desafiante',
}

interface TripInfoProps {
  trip: PublicTrip
}

export function TripInfo({ trip }: TripInfoProps) {
  const hasHighlights = trip.highlights.length > 0
  const hasTags = trip.tags.length > 0
  const hasDifficulty = trip.difficulty !== null

  if (!hasHighlights && !hasTags && !hasDifficulty) return null

  return (
    <section className="space-y-6" aria-label="Informacion del viaje">
      {hasDifficulty && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Dificultad:</span>
          <Badge variant="secondary">
            {DIFFICULTY_LABELS[trip.difficulty!] ?? trip.difficulty}
          </Badge>
        </div>
      )}

      {hasTags && (
        <div className="flex flex-wrap gap-2" aria-label="Categorias del viaje">
          {trip.tags.map((tag) => (
            <Badge key={tag} className="bg-accent/10 text-accent-foreground">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {hasHighlights && (
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
            Lo que incluye
          </h2>
          <ul className="mt-4 space-y-2" role="list">
            {trip.highlights.map((highlight) => (
              <li
                key={highlight}
                className="flex items-start gap-3 text-base text-muted-foreground"
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
