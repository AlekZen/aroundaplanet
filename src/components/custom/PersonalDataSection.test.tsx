import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// Mock useAutoSave so no real fetch calls occur in tests
vi.mock('@/hooks/useAutoSave', () => ({
  useAutoSave: () => ({ save: vi.fn() }),
}))

// Mock sonner (imported transitively via useAutoSave)
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

let PersonalDataSection: typeof import('./PersonalDataSection').PersonalDataSection

beforeEach(async () => {
  const mod = await import('./PersonalDataSection')
  PersonalDataSection = mod.PersonalDataSection
})

afterEach(() => {
  cleanup()
  vi.resetModules()
})

const DEFAULT_PROPS = {
  uid: 'user-abc123',
  defaultValues: {
    firstName: 'Maria',
    lastName: 'Lopez',
    phone: '+52 333 123 4567',
  },
  email: 'maria@example.com',
}

describe('PersonalDataSection', () => {
  it('renders firstName input with default value', () => {
    render(<PersonalDataSection {...DEFAULT_PROPS} />)

    const input = screen.getByDisplayValue('Maria') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('renders lastName input with default value', () => {
    render(<PersonalDataSection {...DEFAULT_PROPS} />)

    const input = screen.getByDisplayValue('Lopez') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('renders email field as disabled', () => {
    render(<PersonalDataSection {...DEFAULT_PROPS} />)

    const emailInput = screen.getByDisplayValue('maria@example.com') as HTMLInputElement
    expect(emailInput).toBeInTheDocument()
    expect(emailInput).toBeDisabled()
  })

  it('renders phone field', () => {
    render(<PersonalDataSection {...DEFAULT_PROPS} />)

    const phoneInput = screen.getByDisplayValue('+52 333 123 4567') as HTMLInputElement
    expect(phoneInput).toBeInTheDocument()
    expect(phoneInput).toHaveAttribute('type', 'tel')
  })

  it('has "Datos Personales" as section title', () => {
    render(<PersonalDataSection {...DEFAULT_PROPS} />)

    expect(screen.getByText('Datos Personales')).toBeInTheDocument()
  })
})
