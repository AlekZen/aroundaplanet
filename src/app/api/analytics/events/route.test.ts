import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAdd = vi.fn().mockResolvedValue({ id: 'evt-123' })
const mockCountGet = vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) })

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          add: mockAdd,
        }),
      }),
      add: mockAdd,
      where: () => ({
        where: () => ({
          count: () => ({
            get: mockCountGet,
          }),
        }),
      }),
    }),
  },
}))

vi.mock('@/lib/auth/tryAuth', () => ({
  tryAuth: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/analytics-server', () => ({
  writeAnalyticsEvent: vi.fn().mockResolvedValue('evt-123'),
}))

import { POST } from './route'
import { tryAuth } from '@/lib/auth/tryAuth'
import { writeAnalyticsEvent } from '@/lib/analytics-server'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/analytics/events', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
  })
}

describe('POST /api/analytics/events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCountGet.mockResolvedValue({ data: () => ({ count: 0 }) })
  })

  it('creates analytics event for valid request', async () => {
    const res = await POST(makeRequest({ type: 'page_view', metadata: { page_path: '/viajes' } }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.eventId).toBe('evt-123')
    expect(vi.mocked(writeAnalyticsEvent)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'page_view', userId: undefined })
    )
  })

  it('returns 400 for invalid event type', async () => {
    const res = await POST(makeRequest({ type: 'hacked_event' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns 429 when rate limited', async () => {
    mockCountGet.mockResolvedValue({ data: () => ({ count: 35 }) })

    const res = await POST(makeRequest({ type: 'page_view' }))
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.code).toBe('RATE_LIMITED')
  })

  it('enriches event with userId when authenticated', async () => {
    vi.mocked(tryAuth).mockResolvedValue({ uid: 'user-123', roles: ['cliente'] } as ReturnType<typeof tryAuth> extends Promise<infer T> ? T : never)

    const res = await POST(makeRequest({ type: 'sign_up' }))
    expect(res.status).toBe(201)
    expect(vi.mocked(writeAnalyticsEvent)).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123' })
    )
  })
})
