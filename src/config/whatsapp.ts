export const WHATSAPP_CONTACT_NUMBER = '523331741585'
export const WHATSAPP_COTIZACION_NUMBER = '5215517492766'

export function buildWhatsAppUrl(phone: string, text?: string): string {
  const base = `https://wa.me/${phone}`
  if (!text) return base
  return `${base}?text=${encodeURIComponent(text)}`
}
