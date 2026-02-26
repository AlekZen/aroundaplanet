import { describe, it, expect } from 'vitest'
import {
  userListQuerySchema,
  userStatusUpdateSchema,
  odooSyncResultSchema,
  USER_LIST_PAGE_SIZE,
} from './userManagementSchema'

describe('userListQuerySchema', () => {
  it('applies defaults when no params provided', () => {
    const result = userListQuerySchema.parse({})
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(USER_LIST_PAGE_SIZE)
    expect(result.search).toBeUndefined()
    expect(result.roleFilter).toBeUndefined()
    expect(result.statusFilter).toBeUndefined()
  })

  it('coerces string numbers to integers', () => {
    const result = userListQuerySchema.parse({ page: '3', pageSize: '50' })
    expect(result.page).toBe(3)
    expect(result.pageSize).toBe(50)
  })

  it('rejects page < 1', () => {
    expect(() => userListQuerySchema.parse({ page: 0 })).toThrow()
  })

  it('rejects pageSize > 100', () => {
    expect(() => userListQuerySchema.parse({ pageSize: 101 })).toThrow()
  })

  it('accepts valid roleFilter', () => {
    const result = userListQuerySchema.parse({ roleFilter: 'admin' })
    expect(result.roleFilter).toBe('admin')
  })

  it('rejects invalid roleFilter', () => {
    expect(() => userListQuerySchema.parse({ roleFilter: 'hacker' })).toThrow()
  })

  it('accepts statusFilter active/inactive', () => {
    expect(userListQuerySchema.parse({ statusFilter: 'active' }).statusFilter).toBe('active')
    expect(userListQuerySchema.parse({ statusFilter: 'inactive' }).statusFilter).toBe('inactive')
  })

  it('rejects invalid statusFilter', () => {
    expect(() => userListQuerySchema.parse({ statusFilter: 'banned' })).toThrow()
  })

  it('trims search whitespace', () => {
    const result = userListQuerySchema.parse({ search: '  test  ' })
    expect(result.search).toBe('test')
  })

  it('rejects search longer than 200 chars', () => {
    expect(() => userListQuerySchema.parse({ search: 'a'.repeat(201) })).toThrow()
  })

  it('accepts optional cursor', () => {
    const result = userListQuerySchema.parse({ cursor: 'abc123' })
    expect(result.cursor).toBe('abc123')
  })
})

describe('userStatusUpdateSchema', () => {
  it('accepts valid deactivation', () => {
    const result = userStatusUpdateSchema.parse({ isActive: false, reason: 'Left company' })
    expect(result.isActive).toBe(false)
    expect(result.reason).toBe('Left company')
  })

  it('accepts activation without reason', () => {
    const result = userStatusUpdateSchema.parse({ isActive: true })
    expect(result.isActive).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('rejects missing isActive', () => {
    expect(() => userStatusUpdateSchema.parse({})).toThrow()
  })

  it('rejects reason longer than 500 chars', () => {
    expect(() =>
      userStatusUpdateSchema.parse({ isActive: false, reason: 'x'.repeat(501) })
    ).toThrow()
  })

  it('trims reason whitespace', () => {
    const result = userStatusUpdateSchema.parse({ isActive: false, reason: '  test  ' })
    expect(result.reason).toBe('test')
  })
})

describe('odooSyncResultSchema', () => {
  it('accepts valid sync result', () => {
    const result = odooSyncResultSchema.parse({
      total: 10,
      created: 3,
      updated: 7,
      errors: 0,
      syncedAt: '2026-02-26T12:00:00Z',
      isStale: false,
    })
    expect(result.total).toBe(10)
    expect(result.created).toBe(3)
    expect(result.isStale).toBe(false)
  })

  it('rejects negative numbers', () => {
    expect(() =>
      odooSyncResultSchema.parse({
        total: -1, created: 0, updated: 0, errors: 0,
        syncedAt: '2026-02-26', isStale: false,
      })
    ).toThrow()
  })

  it('rejects missing fields', () => {
    expect(() => odooSyncResultSchema.parse({ total: 5 })).toThrow()
  })
})
