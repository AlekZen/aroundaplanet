import { describe, it, expect } from 'vitest'
import { registerSchema } from './registerSchema'

describe('registerSchema', () => {
  const validData = {
    displayName: 'Juan Perez',
    email: 'juan@example.com',
    password: 'password1',
    confirmPassword: 'password1',
  }

  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('rejects displayName shorter than 2 chars', () => {
    const result = registerSchema.safeParse({ ...validData, displayName: 'J' })
    expect(result.success).toBe(false)
  })

  it('rejects displayName longer than 100 chars', () => {
    const result = registerSchema.safeParse({
      ...validData,
      displayName: 'A'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({ ...validData, email: 'bad' })
    expect(result.success).toBe(false)
  })

  it('rejects password without letters', () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: '12345678',
      confirmPassword: '12345678',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password without numbers', () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: 'abcdefgh',
      confirmPassword: 'abcdefgh',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password shorter than 8 chars', () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: 'abc1',
      confirmPassword: 'abc1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      ...validData,
      confirmPassword: 'different1',
    })
    expect(result.success).toBe(false)
  })
})
