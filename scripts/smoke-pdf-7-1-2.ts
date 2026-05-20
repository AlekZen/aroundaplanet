import React from 'react'
import { renderToFile } from '@react-pdf/renderer'
import { ContractDocument } from '../src/lib/pdf/templates/ContractDocument'
import { QuotationDocument } from '../src/lib/pdf/templates/QuotationDocument'
import { PILOT_CONTRACT_TEMPLATES } from '../src/lib/pdf/contracts/seedTemplates'
import { currencyToSpanish, formatMxnFromCents } from '../src/lib/pdf/currencyToSpanish'

async function main() {
  const tpl = PILOT_CONTRACT_TEMPLATES[0]!
  const monto = 14500000
  const anticipo = 2000000
  const snapshot = {
    nombreCliente: 'FELIPE DE JESUS RUBIO RUIZ',
    nombreAcompanantes: 'Y MA TERESA VIDAÑA SALAS',
    viajeDestino: tpl.destinoLabel,
    viajeTemporada: 'OCTUBRE-DICIEMBRE 2026',
    periodoViaje: 'DEL 31 DE OCTUBRE AL 07 DE DICIEMBRE 2026',
    montoTotalCents: monto,
    montoTotalFormatted: formatMxnFromCents(monto),
    montoTotalLetras: currencyToSpanish(monto),
    anticipoCents: anticipo,
    anticipoFormatted: formatMxnFromCents(anticipo),
    anticipoLetras: currencyToSpanish(anticipo),
    saldoCents: monto - anticipo,
    saldoFormatted: formatMxnFromCents(monto - anticipo),
    ciudadFirma: 'Ocotlan, Jalisco',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any

  await renderToFile(
    React.createElement(ContractDocument, {
      template: { ...tpl, templateId: tpl.templateKey },
      snapshot,
      contractId: 'smoke-001',
      generatedAtIso: '2026-05-20T20:50:00Z',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    '_bmad-output/implementation-artifacts/smoke-cierre-fase-0/7-1-2-contract-pdf/01-contract-with-logo.pdf'
  )
  console.log('contract ok')

  const quotLead = {
    nombreCliente: 'Felipe Rubio',
    contactPhone: '+52 1 33 1234 5678',
    contactEmail: 'felipe@test.com',
    nombreAgente: 'Paloma Aguilar',
    tipoViaje: 'Grupal',
    destino: 'Vuelta al Mundo',
    fechaSalida: '31 oct 2026',
    fechaRegreso: '7 dic 2026',
    adultos: '2',
    menores: '0',
    edadesMenores: '',
    habitaciones: '1',
    presupuesto: '120,000-150,000',
    notas: 'Smoke 7.1.2 hotfix',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any

  await renderToFile(
    React.createElement(QuotationDocument, {
      quotationId: 'Q-SMOKE-001',
      lead: quotLead,
      generatedAtIso: '2026-05-20T20:50:00Z',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    '_bmad-output/implementation-artifacts/smoke-cierre-fase-0/7-1-2-contract-pdf/02-quotation-with-logo.pdf'
  )
  console.log('quotation ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
