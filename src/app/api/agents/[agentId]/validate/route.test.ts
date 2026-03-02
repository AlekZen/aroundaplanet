import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGet = vi.fn()

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({
        get: mockGet,
      }),
    }),
  },
}))

vi.mock('@/lib/errors/handleApiError', () => ({
  handleApiError: (error: Error) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ code: 'INTERNAL', message: error.message }, { status: 500 })
  },
}))

import { GET } from './route'

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/agents/lupita/validate')
}

function makeParams(agentId: string) {
  return { params: Promise.resolve({ agentId }) }
}

describe('GET /api/agents/[agentId]/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns valid: true for active agent', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ isActive: true, roles: ['agente'] }),
    })

    const res = await GET(makeRequest(), makeParams('lupita'))
    const json = await res.json()

    expect(json.valid).toBe(true)
  })

  it('returns valid: false when user does not exist', async () => {
    mockGet.mockResolvedValue({ exists: false })

    const res = await GET(makeRequest(), makeParams('nonexistent'))
    const json = await res.json()

    expect(json.valid).toBe(false)
  })

  it('returns valid: false when user is not an agent', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ isActive: true, roles: ['cliente'] }),
    })

    const res = await GET(makeRequest(), makeParams('client-user'))
    const json = await res.json()

    expect(json.valid).toBe(false)
  })

  it('returns valid: false when agent is inactive', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ isActive: false, roles: ['agente'] }),
    })

    const res = await GET(makeRequest(), makeParams('inactive-agent'))
    const json = await res.json()

    expect(json.valid).toBe(false)
  })

  it('returns valid: false for empty agentId', async () => {
    const res = await GET(makeRequest(), makeParams(''))
    const json = await res.json()

    expect(json.valid).toBe(false)
  })
})
