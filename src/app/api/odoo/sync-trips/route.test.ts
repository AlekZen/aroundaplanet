import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// === Hoisted mocks ===

const mockRequirePermission = vi.hoisted(() => vi.fn())
const mockSyncTrips = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/requirePermission', () => ({
  requirePermission: mockRequirePermission,
}))

vi.mock('@/lib/odoo/sync/trip-sync', () => ({
  syncTrips: mockSyncTrips,
}))

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: vi.fn(() => ({ _seconds: 1000, _nanoseconds: 0, toMillis: () => 1000000 })),
    fromDate: vi.fn((d: Date) => ({ _seconds: Math.floor(d.getTime() / 1000), _nanoseconds: 0 })),
  },
  FieldValue: { serverTimestamp: vi.fn(() => ({})) },
  getFirestore: vi.fn(),
}))

const mockLockDocRef = vi.hoisted(() => ({
  set: vi.fn().mockResolvedValue(undefined),
}))

const mockRunTransaction = vi.hoisted(() => vi.fn())

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    doc: vi.fn(() => mockLockDocRef),
    runTransaction: mockRunTransaction,
  },
}))

import { POST } from './route'
import { AppError } from '@/lib/errors/AppError'

// === Helpers ===

function makeRequest(body: unknown = {}) {
  return new NextRequest('http://localhost:3000/api/odoo/sync-trips', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const MOCK_CLAIMS = { uid: 'user-123', roles: ['superadmin'] }

const MOCK_SYNC_RESULT = {
  total: 18,
  created: 15,
  updated: 3,
  skipped: 0,
  errors: 0,
  syncedAt: '2026-02-27T12:00:00.000Z',
  syncSource: 'manual',
}

// === Tests ===

describe('POST /api/odoo/sync-trips', () => {
  beforeEach(() => {
    mockRequirePermission.mockReset()
    mockSyncTrips.mockReset()

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

  it('syncs trips successfully with default options', async () => {
    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
    mockSyncTrips.mockResolvedValue(MOCK_SYNC_RESULT)

    const response = await POST(makeRequest({}))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.total).toBe(18)
    expect(data.created).toBe(15)
    expect(data.updated).toBe(3)
    expect(data.syncedAt).toBeDefined()
    expect(mockSyncTrips).toHaveBeenCalledWith(
      { mode: 'incremental' }, // default mode
      'user-123',
    )
  })

  it('accepts full sync with filters', async () => {
    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
    mockSyncTrips.mockResolvedValue(MOCK_SYNC_RESULT)

    const response = await POST(makeRequest({
      mode: 'full',
      nameFilter: '2026',
      minPrice: 5000,
    }))

    expect(response.status).toBe(200)
    expect(mockSyncTrips).toHaveBeenCalledWith(
      { mode: 'full', nameFilter: '2026', minPrice: 5000 },
      'user-123',
    )
  })

  it('returns 403 when user lacks sync:odoo permission', async () => {
    mockRequirePermission.mockRejectedValue(
      new AppError('INSUFFICIENT_PERMISSION', 'Permiso sync:odoo requerido', 403, false)
    )

    const response = await POST(makeRequest({}))
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('INSUFFICIENT_PERMISSION')
    expect(data.retryable).toBe(false)
    expect(mockSyncTrips).not.toHaveBeenCalled()
  })

  it('returns 401 when user is not authenticated', async () => {
    mockRequirePermission.mockRejectedValue(
      new AppError('AUTH_REQUIRED', 'Autenticacion requerida', 401, false)
    )

    const response = await POST(makeRequest({}))
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.code).toBe('AUTH_REQUIRED')
  })

  it('returns 400 for invalid sync options', async () => {
    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)

    const response = await POST(makeRequest({ mode: 'invalid-mode' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
    expect(data.retryable).toBe(false)
    expect(mockSyncTrips).not.toHaveBeenCalled()
  })

  it('returns 400 for negative minPrice', async () => {
    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)

    const response = await POST(makeRequest({ mode: 'full', minPrice: -100 }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('handles Odoo errors with retryable response', async () => {
    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
    mockSyncTrips.mockRejectedValue(
      new AppError('ODOO_UNAVAILABLE', 'Odoo no disponible', 503, true)
    )

    const response = await POST(makeRequest({}))
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.code).toBe('ODOO_UNAVAILABLE')
    expect(data.retryable).toBe(true)
  })

  it('handles unexpected errors with 500', async () => {
    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
    mockSyncTrips.mockRejectedValue(new Error('Unexpected'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await POST(makeRequest({}))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.code).toBe('INTERNAL_ERROR')
    expect(data.retryable).toBe(true)
    consoleSpy.mockRestore()
  })

  it('handles empty/malformed JSON body gracefully', async () => {
    mockRequirePermission.mockResolvedValue(MOCK_CLAIMS)
    mockSyncTrips.mockResolvedValue(MOCK_SYNC_RESULT)

    // Request with no body — json() will throw, caught as {}
    const req = new NextRequest('http://localhost:3000/api/odoo/sync-trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })

    const response = await POST(req)
    // Defaults to { mode: 'incremental' } when body parse fails
    expect(response.status).toBe(200)
  })
})
