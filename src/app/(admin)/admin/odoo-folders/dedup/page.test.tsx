import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGet = vi.fn()
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({ get: mockGet }),
  },
}))

import FolderDedupPage from './page'

beforeEach(() => {
  vi.clearAllMocks()
})

function makeDoc(data: Record<string, unknown>) {
  return { data: () => data }
}

describe('FolderDedupPage', () => {
  it('renderiza empty state si no hay logs', async () => {
    mockGet.mockResolvedValueOnce({ docs: [] })

    const ui = await FolderDedupPage()
    render(ui)

    expect(
      screen.getByText(/No hay logs de dedup todavía/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/audit-9-5-folder-clusters/i)).toBeInTheDocument()
  })

  it('renderiza tabla con clusters válidos y skip los inválidos', async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        makeDoc({
          normalizedKey: 'asia mayo 2026',
          canonicalId: 1942,
          canonicalName: 'ASIA MAYO 2026',
          canonicalChildrenCount: 12,
          duplicateIds: [1943, 1944],
          duplicateNames: ['ASIA MAYO1', 'ASIA MAYO 2'],
          duplicatesChildrenCount: 2,
          totalChildrenInDuplicates: 4,
          executedAt: '2026-05-14T18:00:00Z',
          executedBy: 'script-9-5-execute',
          snapshotFile: 'snap.json',
        }),
        makeDoc({
          normalizedKey: 'colombia enero 2026',
          canonicalId: 2000,
          canonicalName: 'COLOMBIA ENERO 2026',
          canonicalChildrenCount: 5,
          duplicateIds: [2001],
          duplicateNames: ['COLOMBIA ENERO 2026 ORIGINAL'],
          duplicatesChildrenCount: 1,
          totalChildrenInDuplicates: 1,
          executedAt: '2026-05-14T18:00:00Z',
          executedBy: 'script-9-5-execute',
          snapshotFile: 'snap.json',
        }),
        makeDoc({ invalid: true }),
      ],
    })

    const ui = await FolderDedupPage()
    render(ui)

    expect(screen.getByText('asia mayo 2026')).toBeInTheDocument()
    expect(screen.getByText('colombia enero 2026')).toBeInTheDocument()
    expect(screen.getByText('ASIA MAYO 2026')).toBeInTheDocument()
    expect(screen.getByText('ASIA MAYO1')).toBeInTheDocument()
  })

  it('link a Odoo apunta a /odoo/documents/{id}', async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        makeDoc({
          normalizedKey: 'asia mayo 2026',
          canonicalId: 1942,
          canonicalName: 'ASIA MAYO 2026',
          canonicalChildrenCount: 12,
          duplicateIds: [1943],
          duplicateNames: ['ASIA MAYO1'],
          duplicatesChildrenCount: 1,
          totalChildrenInDuplicates: 0,
          executedAt: '2026-05-14T18:00:00Z',
          executedBy: 'script-9-5-execute',
          snapshotFile: 'snap.json',
        }),
      ],
    })

    const ui = await FolderDedupPage()
    render(ui)

    const canonLink = screen.getByText('ASIA MAYO 2026').closest('a')
    expect(canonLink).toHaveAttribute('href', 'https://aroundaplanet.odoo.com/odoo/documents/1942')
    const dupLink = screen.getByText('ASIA MAYO1').closest('a')
    expect(dupLink).toHaveAttribute('href', 'https://aroundaplanet.odoo.com/odoo/documents/1943')
  })

  it('maneja error de Firestore como empty state', async () => {
    mockGet.mockRejectedValueOnce(new Error('Firestore down'))

    const ui = await FolderDedupPage()
    render(ui)

    expect(screen.getByText(/No hay logs de dedup todavía/i)).toBeInTheDocument()
  })
})
