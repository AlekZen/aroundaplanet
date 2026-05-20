import React from 'react'
import { renderToFile } from '@react-pdf/renderer'
import { PaymentReceiptDocument, type PaymentReceiptSnapshot } from '../src/lib/pdf/templates/PaymentReceiptDocument'
import { currencyToSpanish, formatMxnFromCents } from '../src/lib/pdf/currencyToSpanish'

async function main() {
  const paymentCents = 500000
  const totalCents = 14500000
  const cobradoCents = 2500000
  const saldoCents = totalCents - cobradoCents
  const snapshot: PaymentReceiptSnapshot = {
    receiptNumber: 'R-Uu4UppB4-V1',
    clientName: 'FELIPE RUBIO',
    clientPhone: '+52 33 1234 5678',
    tripName: 'VUELTA AL MUNDO 2026 (OCT-DIC)',
    paymentAmountFormatted: formatMxnFromCents(paymentCents),
    paymentAmountLetras: currencyToSpanish(paymentCents),
    paymentDateFormatted: '15 de mayo de 2026',
    verifiedAtFormatted: '16 de mayo de 2026',
    paymentMethodLabel: 'Transferencia',
    bankName: 'BBVA',
    bankReference: 'REF-12345',
    orderTotalFormatted: formatMxnFromCents(totalCents),
    cobradoAcumuladoFormatted: formatMxnFromCents(cobradoCents),
    saldoPendienteFormatted: formatMxnFromCents(saldoCents),
    generatedAtFormatted: '20 de mayo de 2026',
  }

  await renderToFile(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(PaymentReceiptDocument, { snapshot }) as any,
    '_bmad-output/implementation-artifacts/smoke-cierre-fase-0/ns-02-receipt-pdf/01-receipt-pdf-render.pdf'
  )
  console.log('receipt ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
