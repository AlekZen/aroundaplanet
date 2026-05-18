/* eslint-disable no-console */
/**
 * Story 10.1.4 — Smoke local del nuevo template visual.
 * Renderiza ContractDocument con 3 fixtures (VAM, ASIA, COLOMBIA) para revisión visual.
 * Uso: pnpm tsx scripts/smoke-10-1-4-pdf-render.tsx
 */
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { writeFileSync, mkdirSync } from 'fs'
import { ContractDocument } from '../src/lib/pdf/templates/ContractDocument'
import { currencyToSpanish, formatMxnFromCents } from '../src/lib/pdf/currencyToSpanish'
import { PILOT_CONTRACT_TEMPLATES } from '../src/lib/pdf/contracts/seedTemplates'

const OUT_DIR = 'scripts/audit-output/10-1-4-visual'

type Fixture = {
  label: string
  templateIndex: number
  cliente: string
  acompanantes?: string
  periodoViaje: string
  temporada: string
  montoCents: number
  anticipoCents: number | null
  ciudadFirma: string
}

const FIXTURES: Fixture[] = [
  {
    label: 'VAM',
    templateIndex: 0,
    cliente: 'FELIPE DE JESUS RUBIO RUIZ',
    acompanantes: 'Y MA TERESA VIDAÑA SALAS',
    periodoViaje: 'DEL 31 DE OCTUBRE AL 07 DE DICIEMBRE 2026',
    temporada: 'OCTUBRE-DICIEMBRE 2026',
    montoCents: 14500000,
    anticipoCents: 2000000,
    ciudadFirma: 'Ocotlan, Jalisco',
  },
  {
    label: 'ASIA',
    templateIndex: 1,
    cliente: 'YAZIL RAMIREZ HERNANDEZ',
    periodoViaje: 'DEL 05 AL 22 DE MAYO 2026',
    temporada: 'MAYO 2026',
    montoCents: 8680000,
    anticipoCents: 1500000,
    ciudadFirma: 'Ocotlan, Jalisco',
  },
  {
    label: 'COLOMBIA',
    templateIndex: 2,
    cliente: 'LAURA ELENA MURILLO DE FLORES',
    periodoViaje: 'DEL 12 AL 22 DE MAYO 2026',
    temporada: 'MAYO 2026',
    montoCents: 4200000,
    anticipoCents: null,
    ciudadFirma: 'Ocotlan, Jalisco',
  },
]

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  for (const f of FIXTURES) {
    const tplBase = PILOT_CONTRACT_TEMPLATES[f.templateIndex]
    if (!tplBase) {
      console.warn(`No hay template piloto en index ${f.templateIndex}, uso index 0`)
    }
    const base = tplBase ?? PILOT_CONTRACT_TEMPLATES[0]!
    const template = { ...base, templateId: base.templateKey }

    const saldoCents = f.montoCents - (f.anticipoCents ?? 0)
    const element = React.createElement(ContractDocument, {
      template,
      snapshot: {
        nombreCliente: f.cliente,
        nombreAcompanantes: f.acompanantes ?? null,
        viajeDestino: template.destinoLabel,
        viajeTemporada: f.temporada,
        periodoViaje: f.periodoViaje,
        fechaSalida: null,
        fechaRegreso: null,
        montoTotalCents: f.montoCents,
        montoTotalFormatted: formatMxnFromCents(f.montoCents),
        montoTotalLetras: currencyToSpanish(f.montoCents),
        anticipoCents: f.anticipoCents,
        anticipoFormatted: f.anticipoCents ? formatMxnFromCents(f.anticipoCents) : null,
        anticipoLetras: f.anticipoCents ? currencyToSpanish(f.anticipoCents) : null,
        saldoCents,
        saldoFormatted: formatMxnFromCents(saldoCents),
        agenteId: 'a-paloma',
        agenteName: 'Paloma Aguilar',
        ciudadFirma: f.ciudadFirma,
      },
      contractId: `smoke-10-1-4-${f.label.toLowerCase()}`,
      generatedAtIso: new Date().toISOString(),
    })

    const t0 = Date.now()
    const buf = await renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0])
    const ms = Date.now() - t0
    if (!Buffer.isBuffer(buf) || buf.length < 1000) {
      throw new Error(`[${f.label}] Buffer invalido (${buf?.length ?? '?'} bytes)`)
    }
    const magic = buf.subarray(0, 4).toString('ascii')
    if (magic !== '%PDF') throw new Error(`[${f.label}] magic bytes "${magic}"`)
    const out = `${OUT_DIR}/contract-${f.label.toLowerCase()}.pdf`
    writeFileSync(out, buf)
    const kb = (buf.length / 1024).toFixed(1)
    console.log(`✓ [${f.label}] ${kb}KB en ${ms}ms → ${out}`)
  }

  console.log('\n✓ Smoke 10.1.4 OK — abre los PDFs para revisión visual')
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e)
  process.exit(1)
})
