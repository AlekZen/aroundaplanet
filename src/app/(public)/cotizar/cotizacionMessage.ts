import type { CotizacionFormData } from '@/schemas/cotizacionSchema'

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

export function buildCotizacionMessage(data: CotizacionFormData): string {
  const menores = Number(data.menores)

  const lines: string[] = [
    '✈️ *Solicitud de Cotización — AroundaPlanet*',
    '',
    `👤 *Asesor:* ${data.nombreAgente}`,
    `👥 *Cliente:* ${data.nombreCliente}`,
    '',
    `🌎 *Tipo de viaje:* ${data.tipoViaje}`,
    `📍 *Destino:* ${data.destino}`,
    `📅 *Salida:* ${formatDate(data.fechaSalida)}`,
    `📅 *Regreso:* ${formatDate(data.fechaRegreso)}`,
    '',
    `🧑‍🤝‍🧑 *Adultos:* ${data.adultos}`,
  ]

  if (menores > 0) {
    lines.push(`👶 *Menores:* ${menores} (edades: ${data.edadesMenores})`)
  }

  lines.push(`🏨 *Habitaciones:* ${data.habitaciones}`)
  lines.push('')
  lines.push(`💰 *Presupuesto:* ${data.presupuesto} MXN`)

  if (data.notas && data.notas.trim() !== '') {
    lines.push('')
    lines.push(`📝 *Notas:* ${data.notas.trim()}`)
  }

  return lines.join('\n')
}
