export function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export const PAYMENT_STATE_LABELS: Record<string, string> = {
  paid: 'Pagado',
  partial: 'Parcial',
  not_paid: 'Sin pagar',
  in_payment: 'En proceso',
}

export const PAYMENT_STATE_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  not_paid: 'bg-red-100 text-red-800',
  in_payment: 'bg-blue-100 text-blue-800',
}
