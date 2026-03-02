/** Shared order status color classes for consistent badge styling across views */
export const STATUS_COLORS: Record<string, string> = {
  Interesado: 'bg-blue-100 text-blue-800',
  Cotizado: 'bg-yellow-100 text-yellow-800',
  Confirmado: 'bg-green-100 text-green-800',
  'En Progreso': 'bg-amber-100 text-amber-800',
  Pagado: 'bg-emerald-100 text-emerald-800',
  Completado: 'bg-primary/10 text-primary',
  Cancelado: 'bg-red-100 text-red-800',
}
