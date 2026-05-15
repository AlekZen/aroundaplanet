import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ContractDocument } from '../templates/ContractDocument'
import { uploadPdfBuffer } from '../storage'
import type { ContractSnapshot } from '@/schemas/contractSchema'
import type { ContractTemplate } from '@/schemas/contractTemplateSchema'

/**
 * Story 10.1 — Renderiza el contrato y lo sube a Firebase Storage.
 * Devuelve URL pública + storage path para persistir en `contracts/{id}`.
 */
export async function renderAndUploadContract(input: {
  contractId: string
  orderId: string
  template: ContractTemplate
  snapshot: ContractSnapshot
  generatedAtIso: string
}): Promise<{ pdfUrl: string; pdfStoragePath: string }> {
  const { contractId, orderId, template, snapshot, generatedAtIso } = input

  const element = React.createElement(ContractDocument, {
    template,
    snapshot,
    contractId,
    generatedAtIso,
  })
  // `renderToBuffer` espera ReactElement<DocumentProps>; nuestro wrapper devuelve un Document
  // pero los tipos no infieren la equivalencia. Cast intencional.
  const buffer = await renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0])

  const storagePath = `contracts/${orderId}/${contractId}.pdf`
  const { url, path } = await uploadPdfBuffer(storagePath, buffer)
  return { pdfUrl: url, pdfStoragePath: path }
}
