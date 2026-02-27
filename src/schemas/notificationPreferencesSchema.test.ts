import { describe, it, expect } from 'vitest'
import {
  categoriesSchema,
  quietHoursSchema,
  channelsSchema,
  notificationPreferencesSchema,
} from './notificationPreferencesSchema'

describe('categoriesSchema', () => {
  it('accepts valid categories', () => {
    const result = categoriesSchema.safeParse({ payments: true, alerts: false })
    expect(result.success).toBe(true)
  })

  it('accepts all categories', () => {
    const result = categoriesSchema.safeParse({
      payments: true,
      sales: true,
      reports: false,
      trips: true,
      alerts: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object', () => {
    const result = categoriesSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects non-boolean values', () => {
    const result = categoriesSchema.safeParse({ payments: 'yes' })
    expect(result.success).toBe(false)
  })
})

describe('quietHoursSchema', () => {
  it('accepts valid quiet hours', () => {
    const result = quietHoursSchema.safeParse({
      enabled: true,
      startTime: '23:00',
      endTime: '07:00',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid time format', () => {
    const result = quietHoursSchema.safeParse({
      enabled: true,
      startTime: '11pm',
      endTime: '07:00',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing enabled', () => {
    const result = quietHoursSchema.safeParse({
      startTime: '23:00',
      endTime: '07:00',
    })
    expect(result.success).toBe(false)
  })
})

describe('channelsSchema', () => {
  it('accepts valid channels', () => {
    const result = channelsSchema.safeParse({
      push: true,
      whatsapp: true,
      email: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing channel', () => {
    const result = channelsSchema.safeParse({
      push: true,
      whatsapp: true,
    })
    expect(result.success).toBe(false)
  })
})

describe('notificationPreferencesSchema', () => {
  it('accepts full preferences', () => {
    const result = notificationPreferencesSchema.safeParse({
      categories: { payments: true, alerts: false },
      quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' },
      channels: { push: true, whatsapp: false, email: true },
      timezone: 'America/Mexico_City',
    })
    expect(result.success).toBe(true)
  })

  it('accepts partial preferences (all optional)', () => {
    const result = notificationPreferencesSchema.safeParse({
      categories: { payments: false },
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object', () => {
    const result = notificationPreferencesSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects invalid timezone (empty string)', () => {
    const result = notificationPreferencesSchema.safeParse({
      timezone: '',
    })
    expect(result.success).toBe(false)
  })
})
