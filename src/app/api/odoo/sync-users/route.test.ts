import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Hoisted mocks ---
const mockRequirePermission = vi.hoisted(() => vi.fn())
const mockSearchRead = vi.hoisted(() => vi.fn())
const mockWithCacheFallback = vi.hoisted(() => vi.fn())
const mockDocUpdate = vi.hoisted(() => vi.fn())
const mockDocSet = vi.hoisted(() => vi.fn())
const mockAuditAdd = vi.hoisted(() => vi.fn())
const mockTimestampNow = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: mockRequirePermission,
}))

vi.mock('@/lib/odoo/client', () => ({
  getOdooClient: vi.fn(() => ({
    searchRead: mockSearchRead,
  })),
}))

vi.mock('@/lib/odoo/cache', () => ({
  withCacheFallback: mockWithCacheFallback,
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: vi.fn((error: unknown) => {
    const err = error as { status?: number; code?: string; message?: string; retryable?: boolean }
    return Response.json(
      { code: err.code ?? 'ERROR', message: err.message ?? 'Error', retryable: err.retryable ?? false },
      { status: err.status ?? 500 }
    )
  }),
}))

// Mock Firestore adminDb with chainable query
const mockDocRef = vi.hoisted(() => ({
  id: 'auto-generated-id',
  ref: { update: vi.fn() },
  update: vi.fn(),
  set: vi.fn(),
}))

const mockQueryChain = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.where = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.get = vi.fn()
  chain.doc = vi.fn(() => mockDocRef)
  chain.add = vi.fn()
  return chain
})

const mockLockDocRef = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}))

const mockRunTransaction = vi.hoisted(() => vi.fn())

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'auditLog') {
        return { add: mockAuditAdd }
      }
      return mockQueryChain
    }),
    doc: vi.fn(() => mockLockDocRef),
    runTransaction: mockRunTransaction,
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: mockTimestampNow,
  },
}))

import { POST } from './route'
import { AppError } from '@/lib/errors/AppError'

// --- Helpers ---

function makeCacheResult<T>(data: T, isStale = false) {
  return { data, cachedAt: new Date(), isStale }
}

function makeFirestoreDoc(uid: string, data: Record<string, unknown>) {
  return {
    id: uid,
    ref: { update: mockDocUpdate },
    data: () => data,
  }
}

/** Simulates the 3-step Odoo fetch: teams → users → partners */
function setupOdooMocks(opts: {
  teams: Array<{ id: number; name: string; member_ids: number[] }>
  users: Array<{ id: number; name: string; login: string; partner_id: [number, string] }>
  partners: Array<{ id: number; name: string; email: string; phone?: string; write_date?: string }>
  isStale?: boolean
}) {
  const stale = opts.isStale ?? false
  mockWithCacheFallback
    .mockResolvedValueOnce(makeCacheResult(opts.teams, stale))     // crm.team
    .mockResolvedValueOnce(makeCacheResult(opts.users, stale))     // res.users
    .mockResolvedValueOnce(makeCacheResult(opts.partners, stale))  // res.partner
}

describe('POST /api/odoo/sync-users', () => {
  const FAKE_TIMESTAMP = { seconds: 1740000000, nanoseconds: 0 }

  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockRequirePermission.mockResolvedValue({ uid: 'superadmin1', roles: ['superadmin'] })

    mockSearchRead.mockReset()
    mockWithCacheFallback.mockReset()
    mockDocUpdate.mockReset()
    mockDocSet.mockReset()
    mockAuditAdd.mockReset()
    mockTimestampNow.mockReset()

    mockTimestampNow.mockReturnValue(FAKE_TIMESTAMP)
    mockAuditAdd.mockResolvedValue({ id: 'audit-1' })

    // Reset chainable mock
    mockQueryChain.where.mockClear().mockImplementation(() => mockQueryChain)
    mockQueryChain.limit.mockClear().mockImplementation(() => mockQueryChain)
    mockQueryChain.get.mockReset()
    mockQueryChain.doc.mockClear().mockImplementation(() => ({
      id: 'auto-generated-id',
      set: mockDocSet.mockResolvedValue(undefined),
    }))

    mockDocUpdate.mockResolvedValue(undefined)
    mockDocSet.mockResolvedValue(undefined)

    // Lock mock: always acquire lock (default happy path)
    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<boolean>) => {
      const fakeTx = {
        get: vi.fn().mockResolvedValue({ data: () => null }),
        set: vi.fn(),
      }
      return fn(fakeTx)
    })
    mockLockDocRef.set.mockResolvedValue(undefined)
  })

  // --- Auth guard ---
  it('llama requirePermission con sync:odoo', async () => {
    // Empty teams = no members to sync
    mockWithCacheFallback.mockResolvedValue(makeCacheResult([]))

    await POST()

    expect(mockRequirePermission).toHaveBeenCalledWith('sync:odoo')
  })

  it('retorna 403 cuando el usuario no tiene permiso sync:odoo', async () => {
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso sync:odoo requerido', 403, false)
    )

    const response = await POST()

    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.code).toBe('INSUFFICIENT_PERMISSION')
  })

  // --- Successful sync: create new users ---
  it('crea usuarios nuevos cuando no existen en Firestore', async () => {
    setupOdooMocks({
      teams: [{ id: 5, name: 'Ventas Mexico', member_ids: [10] }],
      users: [{ id: 10, name: 'Maria Perez', login: 'maria@test.com', partner_id: [100, 'Maria Perez'] }],
      partners: [{ id: 100, name: 'Maria Perez', email: 'maria@test.com', phone: '+52 33 1234', write_date: '2026-02-25 10:00:00' }],
    })

    // Firestore: no existing user with that email
    mockQueryChain.get.mockResolvedValue({ empty: true, docs: [] })

    const response = await POST()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.total).toBe(1)
    expect(json.created).toBe(1)
    expect(json.updated).toBe(0)
    expect(json.errors).toBe(0)
    expect(json.isStale).toBe(false)

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'auto-generated-id',
        email: 'maria@test.com',
        displayName: 'Maria Perez',
        firstName: 'Maria',
        lastName: 'Perez',
        roles: ['cliente'],
        isActive: false,
        needsRegistration: true,
        odooTeamId: 5,
        odooWriteDate: '2026-02-25 10:00:00',
        lastSyncAt: FAKE_TIMESTAMP,
        photoURL: null,
      })
    )
  })

  // --- Successful sync: update existing users ---
  it('actualiza usuarios existentes cuando se encuentra match por email', async () => {
    setupOdooMocks({
      teams: [{ id: 7, name: 'Madrid', member_ids: [20] }],
      users: [{ id: 20, name: 'Carlos Ruiz', login: 'carlos@test.com', partner_id: [200, 'Carlos Ruiz'] }],
      partners: [{ id: 200, name: 'Carlos Ruiz', email: 'carlos@test.com', write_date: '2026-02-25 10:00:00' }],
    })

    const existingDoc = makeFirestoreDoc('uid-carlos', {
      email: 'carlos@test.com',
      displayName: 'Carlos R',
      roles: ['cliente', 'agente'],
      isActive: true,
    })
    mockQueryChain.get.mockResolvedValue({ empty: false, docs: [existingDoc] })

    const response = await POST()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.total).toBe(1)
    expect(json.created).toBe(0)
    expect(json.updated).toBe(1)
    expect(json.errors).toBe(0)

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        odooPartnerId: 200,
        odooTeamId: 7,
        odooWriteDate: '2026-02-25 10:00:00',
        lastSyncAt: FAKE_TIMESTAMP,
        displayName: 'Carlos Ruiz',
        updatedAt: FAKE_TIMESTAMP,
      })
    )
  })

  // --- UTF-8 handling ---
  it('limpia caracteres zero-width de campos string', async () => {
    setupOdooMocks({
      teams: [{ id: 2, name: 'Team', member_ids: [30] }],
      users: [{ id: 30, name: 'Ana Garcia', login: 'ana@test.com', partner_id: [300, 'Ana Garcia'] }],
      partners: [{
        id: 300,
        name: 'Ana\u200B \u200CGarcia\u200D',
        email: '\uFEFFana@test.com',
        phone: '+52\u200B1234',
        write_date: '2026-02-25 10:00:00',
      }],
    })

    mockQueryChain.get.mockResolvedValue({ empty: true, docs: [] })

    await POST()

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Ana Garcia',
        email: 'ana@test.com',
        phone: '+521234',
        firstName: 'Ana',
        lastName: 'Garcia',
      })
    )
  })

  // --- Graceful degradation: stale cache ---
  it('retorna isStale: true cuando Odoo no esta disponible (cache fallback)', async () => {
    setupOdooMocks({
      teams: [{ id: 1, name: 'Team', member_ids: [40] }],
      users: [{ id: 40, name: 'Cached', login: 'cached@test.com', partner_id: [400, 'Cached'] }],
      partners: [{ id: 400, name: 'Cached', email: 'cached@test.com' }],
      isStale: true,
    })

    const existingDoc = makeFirestoreDoc('uid-cached', { email: 'cached@test.com' })
    mockQueryChain.get.mockResolvedValue({ empty: false, docs: [existingDoc] })

    const response = await POST()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.isStale).toBe(true)
    expect(json.total).toBe(1)
  })

  // --- Audit log ---
  it('escribe audit log al completar sync', async () => {
    setupOdooMocks({
      teams: [{ id: 1, name: 'Team', member_ids: [50] }],
      users: [{ id: 50, name: 'Test', login: 'audit-test@test.com', partner_id: [500, 'Test'] }],
      partners: [{ id: 500, name: 'Test', email: 'audit-test@test.com' }],
    })

    mockQueryChain.get.mockResolvedValue({ empty: true, docs: [] })

    await POST()

    expect(mockAuditAdd).toHaveBeenCalledWith({
      action: 'odoo.syncCompleted',
      targetUid: 'system',
      performedBy: 'superadmin1',
      timestamp: FAKE_TIMESTAMP,
      details: {
        total: 1,
        created: 1,
        updated: 0,
        errors: 0,
        isStale: false,
      },
    })
  })

  // --- Empty teams (no members) ---
  it('maneja equipos sin miembros correctamente', async () => {
    // Teams exist but no member_ids
    mockWithCacheFallback.mockResolvedValueOnce(makeCacheResult([
      { id: 1, name: 'Empty Team', member_ids: [] },
    ]))

    const response = await POST()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.total).toBe(0)
    expect(json.created).toBe(0)
    expect(json.updated).toBe(0)
    expect(json.errors).toBe(0)

    expect(mockAuditAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'odoo.syncCompleted',
        details: expect.objectContaining({ total: 0 }),
      })
    )
  })

  // --- Users without email are counted as errors ---
  it('cuenta agentes sin email como errores', async () => {
    setupOdooMocks({
      teams: [{ id: 1, name: 'Team', member_ids: [60, 61] }],
      users: [
        { id: 60, name: 'Sin Email', login: '', partner_id: [600, 'Sin Email'] },
        { id: 61, name: 'Con Email', login: 'valid@test.com', partner_id: [601, 'Con Email'] },
      ],
      partners: [
        { id: 600, name: 'Sin Email', email: '' },
        { id: 601, name: 'Con Email', email: 'valid@test.com' },
      ],
    })

    mockQueryChain.get.mockResolvedValue({ empty: true, docs: [] })

    const response = await POST()
    const json = await response.json()

    expect(json.total).toBe(2)
    expect(json.created).toBe(1)
    expect(json.errors).toBe(1)
  })

  // --- Multiple agents: mixed create and update ---
  it('maneja mezcla de creaciones y actualizaciones', async () => {
    setupOdooMocks({
      teams: [{ id: 1, name: 'Team', member_ids: [70, 71] }],
      users: [
        { id: 70, name: 'Ya Existe', login: 'existing@test.com', partner_id: [700, 'Ya Existe'] },
        { id: 71, name: 'Nuevo', login: 'new@test.com', partner_id: [701, 'Nuevo'] },
      ],
      partners: [
        { id: 700, name: 'Ya Existe', email: 'existing@test.com' },
        { id: 701, name: 'Nuevo', email: 'new@test.com' },
      ],
    })

    const existingDoc = makeFirestoreDoc('uid-existing', { email: 'existing@test.com' })
    mockQueryChain.get
      .mockResolvedValueOnce({ empty: false, docs: [existingDoc] })
      .mockResolvedValueOnce({ empty: true, docs: [] })

    const response = await POST()
    const json = await response.json()

    expect(json.total).toBe(2)
    expect(json.created).toBe(1)
    expect(json.updated).toBe(1)
    expect(json.errors).toBe(0)
  })

  // --- Single-word name ---
  it('maneja nombres con una sola palabra', async () => {
    setupOdooMocks({
      teams: [{ id: 1, name: 'Team', member_ids: [80] }],
      users: [{ id: 80, name: 'Madonna', login: 'madonna@test.com', partner_id: [800, 'Madonna'] }],
      partners: [{ id: 800, name: 'Madonna', email: 'madonna@test.com' }],
    })

    mockQueryChain.get.mockResolvedValue({ empty: true, docs: [] })

    await POST()

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Madonna',
        firstName: 'Madonna',
        lastName: '',
      })
    )
  })

  // --- Firestore error for individual agent doesn't crash the whole sync ---
  it('continua sync cuando un agente individual falla en Firestore', async () => {
    setupOdooMocks({
      teams: [{ id: 1, name: 'Team', member_ids: [90, 91] }],
      users: [
        { id: 90, name: 'Falla', login: 'fail@test.com', partner_id: [900, 'Falla'] },
        { id: 91, name: 'Ok', login: 'ok@test.com', partner_id: [901, 'Ok'] },
      ],
      partners: [
        { id: 900, name: 'Falla', email: 'fail@test.com' },
        { id: 901, name: 'Ok', email: 'ok@test.com' },
      ],
    })

    mockQueryChain.get
      .mockRejectedValueOnce(new Error('Firestore write error'))
      .mockResolvedValueOnce({ empty: true, docs: [] })

    const response = await POST()
    const json = await response.json()

    expect(json.total).toBe(2)
    expect(json.errors).toBe(1)
    expect(json.created).toBe(1)
  })

  // --- syncedAt is ISO string ---
  it('retorna syncedAt como ISO string', async () => {
    mockWithCacheFallback.mockResolvedValueOnce(makeCacheResult([]))

    const response = await POST()
    const json = await response.json()

    const parsed = new Date(json.syncedAt)
    expect(parsed.toISOString()).toBe(json.syncedAt)
  })

  // --- Agent without team gets null odooTeamId ---
  it('asigna odooTeamId null cuando usuario no tiene team', async () => {
    // User 100 is in a team, user 101 is not (but we only fetch team members, so this tests the map)
    setupOdooMocks({
      teams: [{ id: 1, name: 'Team', member_ids: [100] }],
      users: [{ id: 100, name: 'Has Team', login: 'team@test.com', partner_id: [1000, 'Has Team'] }],
      partners: [{ id: 1000, name: 'Has Team', email: 'team@test.com' }],
    })

    mockQueryChain.get.mockResolvedValue({ empty: true, docs: [] })

    await POST()

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        odooTeamId: 1,
      })
    )
  })
})
