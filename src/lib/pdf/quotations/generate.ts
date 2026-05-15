import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { QuotationDocument } from '../templates/QuotationDocument'
import { uploadPdfBuffer } from '../storage'
import type { QuotationLeadSnapshot } from '@/schemas/quotationSchema'

/**
 * Story 10.1 — Renderiza la cotización y la sube a Firebase Storage.
 */
export async function renderAndUploadQuotation(input: {
  quotationId: string
  lead: QuotationLeadSnapshot
  generatedAtIso: string
}): Promise<{ pdfUrl: string; pdfStoragePath: string }> {
  const { quotationId, lead, generatedAtIso } = input

  const element = React.createElement(QuotationDocument, {
    quotationId,
    lead,
    generatedAtIso,
  })
  const buffer = await renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0])

  const storagePath = `quotations/${quotationId}/${quotationId}.pdf`
  const { url, path } = await uploadPdfBuffer(storagePath, buffer)
  return { pdfUrl: url, pdfStoragePath: path }
}
