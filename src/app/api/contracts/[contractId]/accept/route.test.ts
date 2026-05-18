import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockRequireAuth = vi.fn()
const mockUserGet = vi.fn()
const mockTxGet = vi.fn()
const mockTxUpdate = vi.fn()

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: (col: string) => {
      if (col === 'users') {
        return { doc: () => ({ get: mockUserGet }) }
      }
      if (col === 'contracts') {
        return { doc: (id: string) => ({ id, path: `contracts/${id}` }) }
      }
      throw new Error(`Unexpected collection ${col}`)
    },
    runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = { get: mockTxGet, update: mockTxUpdate }
      return cb(tx)
    },
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: (error: unknown) => {
    if (error && typeof error === 'object' && 'status' in error) {
      const e = error as { status: number; code: string; message: string }
      return NextResponse.json({ code: e.code, message: e.message }, { status: e.status })
    }
    return NextResponse.json({ code: 'ERROR', message: 'Unknown' }, { status: 500 })
  },
}))

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/contracts/c1/accept', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.5' },
  })
}

const ctx = { params: Promise.resolve({ contractId: 'c1' }) }

describe('POST /api/contracts/[contractId]/accept — L2 TOCTOU regression', () => {
  beforeEach(() => {
    vi.resetModules()
    mockRequireAuth.mockReset().mockResolvedValue({ uid: 'client-uid', roles: ['cliente'] })
    mockUserGet.mockReset().mockResolvedValue({
      exists: true,
      data: () => ({ displayName: 'Juan Cliente' }),
    })
    mockTxGet.mockReset()
    mockTxUpdate.mockReset()
  })

  it('happy path: aceptación válida llama tx.update con timestamp + uid + ip', async () => {
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({ clientUserId: 'client-uid', sharedWithClient: true, acceptedAt: null }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(), ctx)
    expect(res.status).toBe(200)
    expect(mockTxUpdate).toHaveBeenCalledTimes(1)
    const updateArgs = mockTxUpdate.mock.calls[0]![1] as Record<string, unknown>
    expect(updateArgs.acceptedAt).toBe('SERVER_TIMESTAMP')
    expect(updateArgs.acceptedByUid).toBe('client-uid')
    expect(updateArgs.acceptedByName).toBe('Juan Cliente')
    expect(updateArgs.acceptedIp).toBe('203.0.113.5')
  })

  it('TOCTOU race: si admin revoca sharedWithClient entre lecturas, NO escribe (403 NOT_SHARED)', async () => {
    // El doc fue marcado como NO compartido dentro de la transacción (admin lo revocó
    // post-render UI). El check dentro de runTransaction debe abortar antes de tx.update.
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({ clientUserId: 'client-uid', sharedWithClient: false, acceptedAt: null }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(), ctx)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('NOT_SHARED')
    expect(mockTxUpdate).not.toHaveBeenCalled()
  })

  it('idempotencia: contrato ya aceptado retorna 200 con acceptedAt existente sin re-update', async () => {
    const fakeTs = { toDate: () => new Date('2026-05-10T12:00:00Z') }
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({
        clientUserId: 'client-uid',
        sharedWithClient: true,
        acceptedAt: fakeTs,
        acceptedByUid: 'client-uid',
      }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(), ctx)
    expect(res.status).toBe(200)
    expect(mockTxUpdate).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.alreadyAccepted).toBe(true)
    expect(body.acceptedAt).toBe('2026-05-10T12:00:00.000Z')
    expect(body.acceptedByUid).toBe('client-uid')
  })

  it('auth missing: requireAuth lanza 401 antes de entrar a la transacción', async () => {
    const { AppError } = await import('@/lib/errors/AppError')
    mockRequireAuth.mockRejectedValue(new AppError('AUTH_REQUIRED', 'Sesion requerida', 401, false))
    const { POST } = await import('./route')
    const res = await POST(makeReq(), ctx)
    expect(res.status).toBe(401)
    expect(mockTxGet).not.toHaveBeenCalled()
    expect(mockTxUpdate).not.toHaveBeenCalled()
  })

  it('documento no existe: tx.get retorna exists:false → 404 sin update', async () => {
    mockTxGet.mockResolvedValue({ exists: false, data: () => undefined })
    const { POST } = await import('./route')
    const res = await POST(makeReq(), ctx)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe('CONTRACT_NOT_FOUND')
    expect(mockTxUpdate).not.toHaveBeenCalled()
  })

  it('ownership: clientUserId distinto al uid del caller → 403 FORBIDDEN sin update', async () => {
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({ clientUserId: 'OTHER-uid', sharedWithClient: true, acceptedAt: null }),
    })
    const { POST } = await import('./route')
    const res = await POST(makeReq(), ctx)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('FORBIDDEN')
    expect(mockTxUpdate).not.toHaveBeenCalled()
  })
})
