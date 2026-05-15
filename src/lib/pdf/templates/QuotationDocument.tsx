import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { QuotationLeadSnapshot } from '@/schemas/quotationSchema'

const COLOR_PRIMARY = '#1B4332'
const COLOR_ACCENT = '#F4A261'
const COLOR_MUTED = '#6B7280'
const COLOR_BORDER = '#D1D5DB'
const COLOR_BG_SOFT = '#FAFAF8'

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    lineHeight: 1.5,
    fontFamily: 'Helvetica',
    color: '#111111',
    backgroundColor: COLOR_BG_SOFT,
  },
  hero: {
    backgroundColor: COLOR_PRIMARY,
    color: 'white',
    padding: 16,
    marginBottom: 16,
    borderRadius: 6,
  },
  heroBrand: { fontSize: 9, color: COLOR_ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 1.2 },
  heroTitle: { fontSize: 18, color: 'white', fontFamily: 'Helvetica-Bold', marginTop: 4 },
  heroMeta: { fontSize: 9, color: '#E5E7EB', marginTop: 6 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COLOR_PRIMARY,
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: `1pt solid ${COLOR_BORDER}`,
  },
  row: { flexDirection: 'row', marginBottom: 3 },
  rowLabel: {
    width: 110,
    fontFamily: 'Helvetica-Bold',
    color: COLOR_MUTED,
    fontSize: 9,
  },
  rowValue: { flex: 1, fontSize: 10 },
  notesBox: {
    backgroundColor: 'white',
    padding: 10,
    borderLeft: `3pt solid ${COLOR_ACCENT}`,
    marginTop: 6,
    fontSize: 9.5,
  },
  nextStepsBox: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 4,
    marginTop: 8,
    borderTop: `2pt solid ${COLOR_PRIMARY}`,
  },
  stepLine: { marginBottom: 4, fontSize: 9.5 },
  vigencia: {
    marginTop: 16,
    fontSize: 9,
    color: COLOR_MUTED,
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 7.5,
    color: COLOR_MUTED,
    textAlign: 'center',
    borderTop: `0.5pt solid ${COLOR_BORDER}`,
    paddingTop: 4,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 24,
    right: 48,
    fontSize: 7.5,
    color: COLOR_MUTED,
  },
})

type QuotationDocumentProps = {
  quotationId: string
  lead: QuotationLeadSnapshot
  generatedAtIso: string
}

function row(label: string, value: string | null | undefined): React.ReactElement | null {
  if (!value || !value.trim()) return null
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

export function QuotationDocument({ quotationId, lead, generatedAtIso }: QuotationDocumentProps) {
  const fechaGen = new Date(generatedAtIso)
  const fechaStr = fechaGen.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const vigenciaHasta = new Date(fechaGen.getTime() + 7 * 24 * 60 * 60 * 1000)
  const vigenciaStr = vigenciaHasta.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Document title={`Cotización ${quotationId} — ${lead.destino}`} author="AroundaPlanet">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.heroBrand}>AROUNDAPLANET — AGENCIA DE VIAJES</Text>
          <Text style={styles.heroTitle}>Cotización personalizada</Text>
          <Text style={styles.heroMeta}>
            Folio {quotationId} · Emitida el {fechaStr}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>DATOS DEL CLIENTE</Text>
        {row('Nombre', lead.nombreCliente)}
        {row('Teléfono', lead.contactPhone)}
        {row('Email', lead.contactEmail)}
        {row('Asesor', lead.nombreAgente)}

        <Text style={styles.sectionTitle}>VIAJE SOLICITADO</Text>
        {row('Tipo', lead.tipoViaje)}
        {row('Destino', lead.destino)}
        {row('Fecha salida', lead.fechaSalida)}
        {row('Fecha regreso', lead.fechaRegreso)}

        <Text style={styles.sectionTitle}>PASAJEROS Y HOSPEDAJE</Text>
        {row('Adultos', lead.adultos)}
        {row('Menores', lead.menores)}
        {row('Edades menores', lead.edadesMenores)}
        {row('Habitaciones', lead.habitaciones)}

        <Text style={styles.sectionTitle}>PRESUPUESTO</Text>
        {row('Rango', `${lead.presupuesto} MXN`)}

        {lead.notas && lead.notas.trim() ? (
          <>
            <Text style={styles.sectionTitle}>NOTAS DEL CLIENTE</Text>
            <View style={styles.notesBox}>
              <Text>{lead.notas}</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>PRÓXIMOS PASOS</Text>
        <View style={styles.nextStepsBox}>
          <Text style={styles.stepLine}>
            1. Tu asesor AroundaPlanet revisa la solicitud y arma una propuesta a tu medida.
          </Text>
          <Text style={styles.stepLine}>
            2. Recibirás opciones con vuelos, hospedaje y experiencias dentro de las próximas 48 horas hábiles.
          </Text>
          <Text style={styles.stepLine}>
            3. Al confirmar, se emite el contrato de prestación de servicios turísticos y se gestiona el
            anticipo correspondiente.
          </Text>
        </View>

        <Text style={styles.vigencia}>
          Vigencia de esta cotización: hasta el {vigenciaStr} (7 días desde su emisión). Precios y
          disponibilidad sujetos a cambio sin previo aviso.
        </Text>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
        <Text style={styles.footer} fixed>
          AroundaPlanet · Ocotlán, Jalisco · aroundaplanet123@gmail.com · WhatsApp +52 1 55 1749 2766
        </Text>
      </Page>
    </Document>
  )
}
