import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'

vi.mock('@/lib/firebase/client', () => ({ firebaseApp: {} }))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db, name: string) => ({ __collection: name })),
  query: vi.fn((c) => c),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { onSnapshot } from 'firebase/firestore'
import { DocumentsPanel } from './DocumentsPanel'

afterEach(cleanup)

beforeEach(() => {
  ;(onSnapshot as unknown as Mock).mockReset()
})

describe('<DocumentsPanel> orchestrator', () => {
  it('muestra skeleton mientras carga (no spinner)', () => {
    ;(onSnapshot as unknown as Mock).mockImplementation(() => () => {})
    const { container } = render(<DocumentsPanel />)
    // Skeleton component renderiza con animate-pulse
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renderiza tabs y métricas después de recibir snapshots vacíos', async () => {
    ;(onSnapshot as unknown as Mock).mockImplementation(
      (_q: unknown, cb: (snap: unknown) => void) => {
        cb({ docs: [] })
        return () => {}
      },
    )
    render(<DocumentsPanel />)
    await waitFor(() => {
      // Hay 2 ocurrencias de "Relacionados" (métrica + tab) cuando carga.
      expect(screen.getAllByText('Relacionados').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Sin relacionar').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Carpetas').length).toBeGreaterThan(0)
    })
  })

  it('renderiza documento desde snapshot con effectiveScope = adminOverride.scope', async () => {
    ;(onSnapshot as unknown as Mock).mockImplementation(
      (q: { __collection?: string }, cb: (snap: unknown) => void) => {
        const collectionName = q?.__collection
        if (collectionName === 'odooDocuments') {
          cb({
            docs: [
              {
                id: '42',
                data: () => ({
                  odooDocumentId: 42,
                  name: 'Comprobante.pdf',
                  type: 'binary',
                  mimetype: 'application/pdf',
                  fileSize: 1024,
                  folderId: 1,
                  folderName: 'ASIA MAYO',
                  resModel: 'product.template',
                  resId: 1748,
                  scope: 'payment',
                  writeDate: '2026-05-16 10:00:00',
                  adminOverride: { scope: 'contract' },
                }),
              },
            ],
          })
        } else {
          cb({ docs: [] })
        }
        return () => {}
      },
    )
    render(<DocumentsPanel />)
    await waitFor(() => expect(screen.getByText('Comprobante.pdf')).toBeInTheDocument())
    // Override visible
    expect(screen.getByText('Override admin')).toBeInTheDocument()
    expect(screen.getByText('Contrato')).toBeInTheDocument()
  })
})
