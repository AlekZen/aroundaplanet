import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { DocumentDetail } from './DocumentDetail'
import type { DocumentMirrorClient } from './types'
import { toast } from 'sonner'

afterEach(cleanup)

const doc: DocumentMirrorClient = {
  id: '42',
  odooDocumentId: 42,
  name: 'Comprobante Felipe.pdf',
  type: 'binary',
  mimetype: 'application/pdf',
  fileSize: 0,
  folderId: 100,
  folderName: 'ASIA MAYO 2026',
  attachmentId: 999,
  resModel: 'product.template',
  resId: 1748,
  resName: 'ASIA MAYO 2026',
  scope: 'payment',
  writeDate: null,
  effectiveScope: 'payment',
  relationStatus: 'linked',
}

describe('<DocumentDetail>', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    ;(toast.success as ReturnType<typeof vi.fn>).mockClear()
    ;(toast.error as ReturnType<typeof vi.fn>).mockClear()
  })

  it('mark-unrelated POSTea al endpoint con reason', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200 }),
    )
    render(<DocumentDetail document={doc} open onClose={() => {}} />)
    const reasonInput = screen.getByLabelText('Razón para marcar como no-relacionado')
    fireEvent.change(reasonInput, { target: { value: 'doc interno' } })
    fireEvent.click(screen.getByText('Marcar no-relacionado'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/odoo/documents/42/mark-unrelated')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ reason: 'doc interno' })
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it('save sin cambios muestra toast.error', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200 }),
    )
    render(<DocumentDetail document={doc} open onClose={() => {}} />)
    fireEvent.click(screen.getByText('Guardar override'))
    expect(toast.error).toHaveBeenCalledWith('Cambia al menos un campo antes de guardar')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('save con productId numérico llama PATCH', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200 }),
    )
    render(<DocumentDetail document={doc} open onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Producto Odoo (id)'), {
      target: { value: '1748' },
    })
    fireEvent.click(screen.getByText('Guardar override'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/odoo/documents/42')
    expect((init as RequestInit).method).toBe('PATCH')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ relatedProductId: 1748 })
  })
})
