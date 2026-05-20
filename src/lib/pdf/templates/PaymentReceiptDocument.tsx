/* eslint-disable react/no-unescaped-entities */
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, Svg, Polygon } from '@react-pdf/renderer'
import { loadLogoWhiteBuffer } from '@/lib/pdf/assets'

/**
 * NS-02 — Recibo de pago formal generado por la plataforma AroundaPlanet.
 *
 * Consistente con ContractDocument/QuotationDocument: paralelogramos navy/teal en
 * header + logo blanco a la izquierda + dirección a la derecha. Body con bloques
 * destacados (cliente, abono, expediente) y pie con número de recibo + nota legal.
 */

const COLOR_NAVY = '#1C2D52'
const COLOR_TEAL = '#3FB8AF'
const COLOR_ACCENT = '#F4A261'
const COLOR_MUTED = '#525252'
const COLOR_BORDER = '#9CA3AF'

const LOGO_BUFFER: Buffer = loadLogoWhiteBuffer()

const PAGE_W = 612
const HEADER_H = 80
const FOOTER_H = 50

const styles = StyleSheet.create({
  page: {
    paddingTop: HEADER_H + 24,
    paddingBottom: FOOTER_H + 16,
    paddingHorizontal: 48,
    fontSize: 10,
    lineHeight: 1.5,
    fontFamily: 'Helvetica',
    color: '#111111',
  },
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_H },
  headerLogo: { position: 'absolute', top: 18, left: 32, width: 140, height: 45, objectFit: 'contain' },
  headerAddress: {
    position: 'absolute',
    top: 22,
    right: 40,
    width: 260,
    color: '#FFFFFF',
    fontSize: 9,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },
  footerWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, height: FOOTER_H },
  footerInline: {
    position: 'absolute',
    bottom: 14,
    left: 60,
    right: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: { color: '#FFFFFF', fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  titleBanner: {
    backgroundColor: COLOR_TEAL,
    borderWidth: 2,
    borderColor: COLOR_ACCENT,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 14,
  },
  titleBannerText: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 16, textAlign: 'center' },
  receiptNumber: {
    textAlign: 'center',
    color: COLOR_NAVY,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginBottom: 16,
  },
  sectionHeader: {
    backgroundColor: COLOR_TEAL,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  sectionHeaderText: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  row: { flexDirection: 'row', marginBottom: 3 },
  rowLabel: { width: 150, fontFamily: 'Helvetica-Bold', color: COLOR_MUTED, fontSize: 9.5 },
  rowValue: { flex: 1, fontSize: 10 },
  highlightBox: {
    backgroundColor: '#F8FAFC',
    borderLeft: `3pt solid ${COLOR_ACCENT}`,
    padding: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  amountLine: { fontFamily: 'Helvetica-Bold', fontSize: 16, color: COLOR_NAVY },
  amountInWords: { fontSize: 10, color: COLOR_MUTED, fontStyle: 'italic', marginTop: 2 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: `0.5pt solid ${COLOR_BORDER}`,
  },
  summaryRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    borderLeft: `3pt solid ${COLOR_NAVY}`,
  },
  summaryLabel: { fontSize: 10, color: COLOR_MUTED },
  summaryValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111111' },
  summaryFinalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLOR_NAVY },
  legalNote: {
    marginTop: 24,
    fontSize: 8.5,
    color: COLOR_MUTED,
    fontStyle: 'italic',
    textAlign: 'center',
  },
})

const BRAND = {
  direccionLinea1: 'Montecito 38, piso 22, oficina 10. WTC',
  direccionLinea2: 'Napoles, Benito Juarez, CDMX.',
  contactoWeb: 'aroundaplanet.odoo.com',
  contactoTel: '3929 2264 79',
  contactoEmail: 'aroundaplanet123@gmail.com',
} as const

function ReceiptHeader() {
  return (
    <View style={styles.headerWrap} fixed>
      <Svg viewBox={`0 0 ${PAGE_W} ${HEADER_H}`} style={{ width: PAGE_W, height: HEADER_H }}>
        <Polygon points={`0,0 340,0 300,${HEADER_H} 0,${HEADER_H}`} fill={COLOR_NAVY} />
        <Polygon points={`360,0 ${PAGE_W},0 ${PAGE_W},${HEADER_H} 320,${HEADER_H}`} fill={COLOR_TEAL} />
      </Svg>
      {LOGO_BUFFER.length > 0 ? (
        <Image style={styles.headerLogo} src={{ data: LOGO_BUFFER, format: 'png' }} />
      ) : null}
      <View style={styles.headerAddress}>
        <Text>{BRAND.direccionLinea1}</Text>
        <Text>{BRAND.direccionLinea2}</Text>
      </View>
    </View>
  )
}

function ReceiptFooter() {
  return (
    <View style={styles.footerWrap} fixed>
      <Svg viewBox={`0 0 ${PAGE_W} ${FOOTER_H}`} style={{ width: PAGE_W, height: FOOTER_H }}>
        <Polygon points={`0,0 300,0 340,${FOOTER_H} 0,${FOOTER_H}`} fill={COLOR_NAVY} />
        <Polygon points={`320,0 ${PAGE_W},0 ${PAGE_W},${FOOTER_H} 360,${FOOTER_H}`} fill={COLOR_TEAL} />
      </Svg>
      <View style={styles.footerInline}>
        <Text style={styles.footerItem}>{BRAND.contactoWeb}</Text>
        <Text style={styles.footerItem}>{BRAND.contactoTel}</Text>
        <Text style={styles.footerItem}>{BRAND.contactoEmail}</Text>
      </View>
    </View>
  )
}

function SectionHeader({ children }: { children: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{children}</Text>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || !value.trim()) return null
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

export type PaymentReceiptSnapshot = {
  receiptNumber: string
  clientName: string | null
  clientPhone: string | null
  tripName: string | null
  paymentAmountFormatted: string
  paymentAmountLetras: string
  paymentDateFormatted: string
  verifiedAtFormatted: string
  paymentMethodLabel: string
  bankName: string | null
  bankReference: string | null
  orderTotalFormatted: string
  cobradoAcumuladoFormatted: string
  saldoPendienteFormatted: string
  generatedAtFormatted: string
}

export type PaymentReceiptDocumentProps = {
  snapshot: PaymentReceiptSnapshot
}

export function PaymentReceiptDocument({ snapshot }: PaymentReceiptDocumentProps) {
  return (
    <Document title={`Recibo ${snapshot.receiptNumber}`} author="AroundaPlanet">
      <Page size="LETTER" style={styles.page}>
        <ReceiptHeader />
        <ReceiptFooter />

        <View style={styles.titleBanner}>
          <Text style={styles.titleBannerText}>RECIBO DE PAGO</Text>
        </View>
        <Text style={styles.receiptNumber}>No. {snapshot.receiptNumber}</Text>

        <SectionHeader>DATOS DEL CLIENTE</SectionHeader>
        <Row label="Nombre" value={snapshot.clientName} />
        <Row label="Teléfono" value={snapshot.clientPhone} />
        <Row label="Viaje contratado" value={snapshot.tripName} />

        <SectionHeader>ABONO RECIBIDO</SectionHeader>
        <View style={styles.highlightBox}>
          <Text style={styles.amountLine}>{snapshot.paymentAmountFormatted}</Text>
          <Text style={styles.amountInWords}>{snapshot.paymentAmountLetras}</Text>
        </View>
        <Row label="Fecha del pago" value={snapshot.paymentDateFormatted} />
        <Row label="Verificado" value={snapshot.verifiedAtFormatted} />
        <Row label="Método de pago" value={snapshot.paymentMethodLabel} />
        <Row label="Banco / origen" value={snapshot.bankName} />
        <Row label="Referencia bancaria" value={snapshot.bankReference} />

        <SectionHeader>RESUMEN DEL EXPEDIENTE</SectionHeader>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total contratado del viaje</Text>
          <Text style={styles.summaryValue}>{snapshot.orderTotalFormatted}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Cobrado acumulado (incluye este pago)</Text>
          <Text style={styles.summaryValue}>{snapshot.cobradoAcumuladoFormatted}</Text>
        </View>
        <View style={styles.summaryRowFinal}>
          <Text style={styles.summaryLabel}>Saldo pendiente</Text>
          <Text style={styles.summaryFinalValue}>{snapshot.saldoPendienteFormatted}</Text>
        </View>

        <Text style={styles.legalNote}>
          Recibo generado automáticamente por la plataforma AroundaPlanet — vigente al{' '}
          {snapshot.generatedAtFormatted}. Este documento sirve como comprobante interno del abono
          registrado contra el viaje contratado; no sustituye el CFDI fiscal cuando aplique.
        </Text>
      </Page>
    </Document>
  )
}
