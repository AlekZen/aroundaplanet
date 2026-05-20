import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { PaymentReceiptDocument, type PaymentReceiptSnapshot } from './PaymentReceiptDocument'

function buildSnapshot(overrides: Partial<PaymentReceiptSnapshot> = {}): PaymentReceiptSnapshot {
  return {
    receiptNumber: 'R-Uu4UppB4-V1',
    clientName: 'FELIPE RUBIO',
    clientPhone: '+52 1 33 1234 5678',
    tripName: 'VUELTA AL MUNDO 2026 (OCT-DIC)',
    paymentAmountFormatted: '$5,000.00 MXN',
    paymentAmountLetras: 'CINCO MIL PESOS 00/100 M.N.',
    paymentDateFormatted: '15 de mayo de 2026',
    verifiedAtFormatted: '16 de mayo de 2026',
    paymentMethodLabel: 'Transferencia',
    bankName: 'BBVA',
    bankReference: 'REF-12345',
    orderTotalFormatted: '$145,000.00 MXN',
    cobradoAcumuladoFormatted: '$25,000.00 MXN',
    saldoPendienteFormatted: '$120,000.00 MXN',
    generatedAtFormatted: '20 de mayo de 2026',
    ...overrides,
  }
}

describe('PaymentReceiptDocument (NS-02)', () => {
  it('produce un Buffer con magic bytes %PDF', async () => {
    const buf = await renderToBuffer(<PaymentReceiptDocument snapshot={buildSnapshot()} />)
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF')
    expect(buf.length).toBeGreaterThan(1000)
  }, 15000)

  it('tamaño bajo 100KB con logo optimizado', async () => {
    const buf = await renderToBuffer(<PaymentReceiptDocument snapshot={buildSnapshot()} />)
    expect(buf.length).toBeLessThan(100 * 1024)
  }, 15000)

  it('renderiza sin banco ni referencia bancaria', async () => {
    const buf = await renderToBuffer(
      <PaymentReceiptDocument snapshot={buildSnapshot({ bankName: null, bankReference: null })} />
    )
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF')
  }, 15000)

  it('latencia < 5000 ms (umbral generoso, NS-02)', async () => {
    const t0 = Date.now()
    await renderToBuffer(<PaymentReceiptDocument snapshot={buildSnapshot()} />)
    expect(Date.now() - t0).toBeLessThan(5000)
  }, 15000)
})
