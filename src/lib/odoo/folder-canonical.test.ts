import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDocGet = vi.fn()
const mockSearchRead = vi.fn()
const mockCreate = vi.fn()

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ get: mockDocGet }) }),
  },
}))

vi.mock('@/lib/odoo/client', () => ({
  getOdooClient: () => ({
    searchRead: mockSearchRead,
    create: mockCreate,
  }),
}))

import {
  buildNormalizedKey,
  normalizeFolderName,
  resetFolderCanonicalCache,
  resolveCanonicalFolderId,
} from './folder-canonical'

beforeEach(() => {
  vi.clearAllMocks()
  resetFolderCanonicalCache()
})

describe('normalizeFolderName', () => {
  it('lowercase + strip espacios extra', () => {
    expect(normalizeFolderName('ASIA   MAYO  2026')).toBe('asia mayo 2026')
  })

  it('strip acentos', () => {
    expect(normalizeFolderName('AMÉRICA LATINA')).toBe('america latina')
  })

  it('strip sufijos numéricos pegados a palabra', () => {
    expect(normalizeFolderName('ASIA MAYO1')).toBe('asia mayo')
    expect(normalizeFolderName('COLOMBIA ENERO2')).toBe('colombia enero')
  })

  it('preserva años (espacio antes del número)', () => {
    expect(normalizeFolderName('ASIA MAYO 2026')).toBe('asia mayo 2026')
  })
})

describe('buildNormalizedKey', () => {
  it('combina destino + mes en español + año UTC', () => {
    const key = buildNormalizedKey('ASIA', new Date('2026-05-15T12:00:00Z'))
    expect(key).toBe('asia mayo 2026')
  })

  it('mes enero', () => {
    const key = buildNormalizedKey('COLOMBIA', new Date('2026-01-15T12:00:00Z'))
    expect(key).toBe('colombia enero 2026')
  })
})

describe('resolveCanonicalFolderId', () => {
  const baseInput = {
    tripDestino: 'ASIA',
    paymentDate: new Date('2026-05-15T12:00:00Z'),
  }

  it('flag off → source=disabled', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ folderAutoAssign: false }),
    })

    const r = await resolveCanonicalFolderId(baseInput)

    expect(r).toEqual({
      folderId: null,
      source: 'disabled',
      normalizedKey: 'asia mayo 2026',
    })
    expect(mockSearchRead).not.toHaveBeenCalled()
  })

  it('flag on + tagId match → source=canonical-tag', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        folderAutoAssign: true,
        folderCanonicoTagId: 49,
      }),
    })
    mockSearchRead.mockResolvedValueOnce([
      { id: 1942, name: 'ASIA MAYO 2026' },
      { id: 1943, name: 'COLOMBIA MAYO 2026' },
    ])

    const r = await resolveCanonicalFolderId(baseInput)

    expect(r.folderId).toBe(1942)
    expect(r.source).toBe('canonical-tag')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('flag on sin match + folderAutoCreate=false → source=no-match', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        folderAutoAssign: true,
        folderAutoCreate: false,
        folderCanonicoTagId: 49,
      }),
    })
    mockSearchRead.mockResolvedValueOnce([
      { id: 1943, name: 'COLOMBIA ENERO 2026' },
    ])

    const r = await resolveCanonicalFolderId(baseInput)

    expect(r.folderId).toBeNull()
    expect(r.source).toBe('no-match')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('flag on sin match + folderAutoCreate=true → crea + source=fallback-create', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        folderAutoAssign: true,
        folderAutoCreate: true,
        folderCanonicoTagId: 49,
      }),
    })
    mockSearchRead.mockResolvedValueOnce([])
    mockCreate.mockResolvedValueOnce(2025)

    const r = await resolveCanonicalFolderId(baseInput)

    expect(r.folderId).toBe(2025)
    expect(r.source).toBe('fallback-create')
    expect(mockCreate).toHaveBeenCalledWith(
      'documents.document',
      expect.objectContaining({
        type: 'folder',
        tag_ids: [[6, 0, [49]]],
      }),
    )
    const args = mockCreate.mock.calls[0][1]
    expect(args.name).toBe('ASIA MAYO 2026')
  })

  it('tripDestino vacío → no-match sin tocar Odoo', async () => {
    const r = await resolveCanonicalFolderId({
      tripDestino: '   ',
      paymentDate: new Date('2026-05-15T12:00:00Z'),
    })
    expect(r.source).toBe('no-match')
    expect(mockDocGet).not.toHaveBeenCalled()
  })

  it('paymentDate inválido → no-match sin tocar Odoo', async () => {
    const r = await resolveCanonicalFolderId({
      tripDestino: 'ASIA',
      paymentDate: new Date('invalid'),
    })
    expect(r.source).toBe('no-match')
    expect(mockDocGet).not.toHaveBeenCalled()
  })

  it('flag on + searchRead falla → source=error', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        folderAutoAssign: true,
        folderCanonicoTagId: 49,
      }),
    })
    mockSearchRead.mockRejectedValueOnce(new Error('XML-RPC fault'))

    const r = await resolveCanonicalFolderId(baseInput)

    expect(r.folderId).toBeNull()
    expect(r.source).toBe('error')
    expect(r.error).toContain('XML-RPC')
  })

  it('readConfig falla → degraded a disabled', async () => {
    mockDocGet.mockRejectedValueOnce(new Error('Firestore down'))

    const r = await resolveCanonicalFolderId(baseInput)

    expect(r.source).toBe('disabled')
  })

  it('cluster con duplicados tageados (anomalía) → gana id más bajo', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        folderAutoAssign: true,
        folderCanonicoTagId: 49,
      }),
    })
    mockSearchRead.mockResolvedValueOnce([
      { id: 1942, name: 'ASIA MAYO 2026' },
      { id: 1950, name: 'ASIA MAYO 2026' },
    ])

    const r = await resolveCanonicalFolderId(baseInput)

    expect(r.folderId).toBe(1942)
  })
})
