import { TripListPanel } from './TripListPanel'

export const metadata = {
  title: 'Viajes | AroundaPlanet',
}

export default function TripsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Viajes
      </h1>
      <TripListPanel />
    </div>
  )
}
