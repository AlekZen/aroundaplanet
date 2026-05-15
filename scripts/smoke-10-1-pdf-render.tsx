/* eslint-disable no-console */
/**
 * Smoke local del render de PDF — Story 10.1.
 * Renderiza ContractDocument + QuotationDocument con fixtures sintéticas
 * y escribe los Buffers a disco. NO toca Firestore ni Storage.
 *
 * Uso:
 *   pnpm tsx scripts/smoke-10-1-pdf-render.tsx
 *
 * Output:
 *   scripts/audit-output/10-1-smoke/contract-vam.pdf
 *   scripts/audit-output/10-1-smoke/quotation-sample.pdf
 */
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { writeFileSync, mkdirSync } from 'fs'
import { ContractDocument } from '../src/lib/pdf/templates/ContractDocument'
import { QuotationDocument } from '../src/lib/pdf/templates/QuotationDocument'
import { currencyToSpanish, formatMxnFromCents } from '../src/lib/pdf/currencyToSpanish'
import { PILOT_CONTRACT_TEMPLATES } from '../src/lib/pdf/contracts/seedTemplates'

const OUT_DIR = 'scripts/audit-output/10-1-smoke'

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  // === Fixture contrato VUELTA AL MUNDO ===
  const tplBase = PILOT_CONTRACT_TEMPLATES[0]
  if (!tplBase) throw new Error('No pilot template')
  const template = { ...tplBase, templateId: tplBase.templateKey }
  const montoCents = 11500000
  const anticipoCents = 2000000
  const saldoCents = montoCents - anticipoCents

  const contractEl = React.createElement(ContractDocument, {
    template,
    snapshot: {
      nombreCliente: 'FELIPE DE JESUS RUBIO RUIZ',
      nombreAcompanantes: 'Y MA TERESA VIDAÑA SALAS',
      viajeDestino: template.destinoLabel,
      viajeTemporada: 'OCTUBRE-DICIEMBRE 2026',
      periodoViaje: 'DEL 31 DE OCTUBRE AL 07 DE DICIEMBRE 2026',
      fechaSalida: null,
      fechaRegreso: null,
      montoTotalCents: montoCents,
      montoTotalFormatted: formatMxnFromCents(montoCents),
      montoTotalLetras: currencyToSpanish(montoCents),
      anticipoCents,
      anticipoFormatted: formatMxnFromCents(anticipoCents),
      anticipoLetras: currencyToSpanish(anticipoCents),
      saldoCents,
      saldoFormatted: formatMxnFromCents(saldoCents),
      agenteId: 'a-paloma',
      agenteName: 'Paloma Aguilar',
      ciudadFirma: 'Ocotlán, Jalisco',
    },
    contractId: 'smoke-contract-001',
    generatedAtIso: new Date().toISOString(),
  })

  const t0 = Date.now()
  const contractBuf = await renderToBuffer(
    contractEl as unknown as Parameters<typeof renderToBuffer>[0]
  )
  const contractMs = Date.now() - t0
  if (!Buffer.isBuffer(contractBuf) || contractBuf.length < 1000) {
    throw new Error(`Contract render produjo Buffer inválido (${contractBuf?.length ?? '?'} bytes)`)
  }
  const contractPath = `${OUT_DIR}/contract-vam.pdf`
  writeFileSync(contractPath, contractBuf)
  console.log(`✓ Contrato VAM: ${contractBuf.length} bytes en ${contractMs}ms → ${contractPath}`)

  // === Fixture cotización ===
  const quotationEl = React.createElement(QuotationDocument, {
    quotationId: 'smoke-quotation-001',
    lead: {
      nombreAgente: 'Paloma Aguilar',
      nombreCliente: 'Mariana Gómez',
      contactPhone: '+52 392 123 4567',
      contactEmail: 'mariana@example.com',
      tipoViaje: 'Internacional',
      destino: 'Madrid, España',
      fechaSalida: '2026-09-01',
      fechaRegreso: '2026-09-15',
      adultos: '2',
      menores: '1',
      edadesMenores: '8',
      habitaciones: '1',
      presupuesto: '$50K-$100K',
      notas: 'Aniversario de bodas. Preferencia por hoteles boutique en el centro.',
    },
    generatedAtIso: new Date().toISOString(),
  })

  const t1 = Date.now()
  const quotationBuf = await renderToBuffer(
    quotationEl as unknown as Parameters<typeof renderToBuffer>[0]
  )
  const quotationMs = Date.now() - t1
  if (!Buffer.isBuffer(quotationBuf) || quotationBuf.length < 1000) {
    throw new Error(`Quotation render produjo Buffer inválido (${quotationBuf?.length ?? '?'} bytes)`)
  }
  const quotationPath = `${OUT_DIR}/quotation-sample.pdf`
  writeFileSync(quotationPath, quotationBuf)
  console.log(`✓ Cotización: ${quotationBuf.length} bytes en ${quotationMs}ms → ${quotationPath}`)

  // Sanity: el primer byte de un PDF v1.x debe ser '%PDF'
  const magic = contractBuf.subarray(0, 4).toString('ascii')
  if (magic !== '%PDF') throw new Error(`Magic bytes inválidos: "${magic}"`)
  console.log('✓ Magic bytes %PDF OK en ambos archivos')

  console.log('\n✓ Smoke render OK — abre los PDFs en Adobe/Chrome para revisión visual')
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e)
  process.exit(1)
})
