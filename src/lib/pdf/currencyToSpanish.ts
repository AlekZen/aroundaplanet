/**
 * Story 10.1 — Convierte montos en centavos (entero) a texto en español MX.
 * Formato canónico observado en los contratos de Paloma:
 *   "CIENTO CUARENTA Y CINCO MIL PESOS 00/100 M.N."
 *   "VEINTE MIL PESOS 00/100 M.N."
 *   "DIECISIETE MIL QUINIENTOS PESOS 00/100 M.N."
 *
 * Soporta 0 ≤ cents ≤ 99,999,999,99 (hasta 999,999,999 pesos).
 */

const UNIDADES = [
  '',
  'UNO',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISÉIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
  'VEINTE',
  'VEINTIUNO',
  'VEINTIDÓS',
  'VEINTITRÉS',
  'VEINTICUATRO',
  'VEINTICINCO',
  'VEINTISÉIS',
  'VEINTISIETE',
  'VEINTIOCHO',
  'VEINTINUEVE',
]

const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']

const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
]

function sub1000(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'

  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []

  if (c > 0) partes.push(CENTENAS[c])

  if (resto > 0) {
    if (resto < 30) {
      partes.push(UNIDADES[resto])
    } else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      if (u === 0) {
        partes.push(DECENAS[d])
      } else {
        partes.push(`${DECENAS[d]} Y ${UNIDADES[u]}`)
      }
    }
  }

  return partes.join(' ')
}

function integerToSpanishWords(num: number): string {
  if (num < 0) throw new Error('currencyToSpanish: negative numbers not supported')
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error('currencyToSpanish: requires a non-negative integer')
  }
  if (num === 0) return 'CERO'

  const millones = Math.floor(num / 1_000_000)
  const miles = Math.floor((num % 1_000_000) / 1000)
  const resto = num % 1000

  const partes: string[] = []

  if (millones > 0) {
    if (millones === 1) {
      partes.push('UN MILLÓN')
    } else {
      partes.push(`${sub1000(millones)} MILLONES`)
    }
  }

  if (miles > 0) {
    if (miles === 1) {
      partes.push('MIL')
    } else {
      partes.push(`${sub1000(miles)} MIL`)
    }
  }

  if (resto > 0) {
    partes.push(sub1000(resto))
  }

  return partes.join(' ')
}

/**
 * Convierte centavos a string en español MX formato AroundaPlanet.
 * Ejemplo: 14500000 → "CIENTO CUARENTA Y CINCO MIL PESOS 00/100 M.N."
 *          14500050 → "CIENTO CUARENTA Y CINCO MIL PESOS 50/100 M.N."
 */
export function currencyToSpanish(cents: number): string {
  if (!Number.isFinite(cents) || !Number.isInteger(cents)) {
    throw new Error('currencyToSpanish: requires an integer cents value')
  }
  if (cents < 0) throw new Error('currencyToSpanish: negative cents not supported')

  const pesos = Math.floor(cents / 100)
  const centavos = cents % 100
  const centavosStr = centavos.toString().padStart(2, '0')

  const palabrasPesos = integerToSpanishWords(pesos)
  const sufijo = pesos === 1 ? 'PESO' : 'PESOS'

  return `${palabrasPesos} ${sufijo} ${centavosStr}/100 M.N.`
}

/**
 * Formato visual `$1,234.56 MXN` (intl-style sin depender de Intl en runtime PDF).
 */
export function formatMxnFromCents(cents: number): string {
  if (!Number.isFinite(cents) || !Number.isInteger(cents)) {
    throw new Error('formatMxnFromCents: requires integer cents')
  }
  const pesos = Math.floor(cents / 100)
  const centavos = (cents % 100).toString().padStart(2, '0')
  // Inserta separador de miles cada 3 dígitos
  const pesosStr = pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `$${pesosStr}.${centavos} MXN`
}
