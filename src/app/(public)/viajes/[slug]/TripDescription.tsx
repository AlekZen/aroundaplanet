interface TripDescriptionProps {
  description: string
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

/** Strip HTML tags and decode entities from Odoo rich text (description_sale is HTML in Odoo 18). */
function stripHtmlTags(html: string): string {
  const stripped = html.replace(/<[^>]*>/g, '')
  const decoded = stripped.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => HTML_ENTITIES[match] ?? match)
  return decoded.trim()
}

export function TripDescription({ description }: TripDescriptionProps) {
  const cleanText = stripHtmlTags(description)

  if (!cleanText) return null

  return (
    <section className="space-y-4">
      <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
        Sobre este viaje
      </h2>
      <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
        {cleanText}
      </p>
    </section>
  )
}
