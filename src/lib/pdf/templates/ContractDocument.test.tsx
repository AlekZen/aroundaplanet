/**
 * Story 10.1.4 — Smoke unit del rediseño visual.
 * Verifica que el módulo carga el logo como Buffer no vacío y que el componente
 * renderiza un PDF válido (%PDF magic bytes) con latencia razonable.
 */
import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { ContractDocument } from './ContractDocument'
import { PILOT_CONTRACT_TEMPLATES } from '../contracts/seedTemplates'
import { currencyToSpanish, formatMxnFromCents } from '../currencyToSpanish'
import type { ContractTemplate } from '@/schemas/contractTemplateSchema'

function buildSnapshot(overrides: Partial<Record<string, unknown>> = {}) {
  const montoCents = 14500000
  const anticipoCents = 2000000
  return {
    nombreCliente: 'FELIPE DE JESUS RUBIO RUIZ',
    nombreAcompanantes: 'Y MA TERESA VIDAÑA SALAS',
    viajeDestino: 'VUELTA AL MUNDO',
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
    saldoCents: montoCents - anticipoCents,
    saldoFormatted: formatMxnFromCents(montoCents - anticipoCents),
    agenteId: 'a-paloma',
    agenteName: 'Paloma Aguilar',
    ciudadFirma: 'Ocotlan, Jalisco',
    ...overrides,
  } as unknown as Parameters<typeof ContractDocument>[0]['snapshot']
}

function pickTemplate(index = 0): ContractTemplate {
  const base = PILOT_CONTRACT_TEMPLATES[index] ?? PILOT_CONTRACT_TEMPLATES[0]!
  return { ...base, templateId: base.templateKey } as ContractTemplate
}

async function renderContract(snapshotOverrides: Partial<Record<string, unknown>> = {}) {
  const element = React.createElement(ContractDocument, {
    template: pickTemplate(0),
    snapshot: buildSnapshot(snapshotOverrides),
    contractId: 'unit-test-001',
    generatedAtIso: '2026-05-18T12:00:00.000Z',
  })
  return renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0])
}

describe('ContractDocument (Story 10.1.4 visual redesign)', () => {
  it('produce un Buffer con magic bytes %PDF', async () => {
    const buf = await renderContract()
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF')
    expect(buf.length).toBeGreaterThan(1000)
  }, 15000)

  it('tamaño bajo el budget de 100KB con logo optimizado', async () => {
    const buf = await renderContract()
    expect(buf.length).toBeLessThan(100 * 1024)
  }, 15000)

  it('renderiza sin acompañantes ni anticipo (camino "pago inmediato")', async () => {
    const buf = await renderContract({
      nombreAcompanantes: null,
      anticipoCents: null,
      anticipoFormatted: null,
      anticipoLetras: null,
    })
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF')
  }, 15000)

  it('latencia render < 1500ms en cold path', async () => {
    const t0 = Date.now()
    await renderContract()
    const ms = Date.now() - t0
    expect(ms).toBeLessThan(1500)
  }, 15000)
})
