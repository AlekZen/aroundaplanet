import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { PaymentRegistrationForm } from './PaymentRegistrationForm'

// Mock sonner toast (used internally by the form)
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const baseOrders = [
  {
    id: 'order-1',
    tripName: 'VUELTA AL MUNDO',
    amountTotalCents: 14500000,
    contactName: 'Cliente Demo',
  },
]

describe('PaymentRegistrationForm — receipt file input', () => {
  beforeEach(() => {
    // Force mobile (Sheet) path so input renders unconditionally
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
  })

  it('does NOT set the capture attribute (allows gallery + files on mobile)', () => {
    const { container } = render(
      <PaymentRegistrationForm
        isOpen
        onClose={() => {}}
        orders={baseOrders}
      />
    )
    const input = container.querySelector('#receipt-upload') as HTMLInputElement | null
    // Sheet renders into a portal but container should still resolve via document
    const fileInput = input ?? (document.querySelector('#receipt-upload') as HTMLInputElement | null)
    expect(fileInput).not.toBeNull()
    expect(fileInput!.hasAttribute('capture')).toBe(false)
  })

  it('accepts the supported image MIME types matching the upload endpoint', () => {
    render(
      <PaymentRegistrationForm
        isOpen
        onClose={() => {}}
        orders={baseOrders}
      />
    )
    const fileInput = document.querySelector('#receipt-upload') as HTMLInputElement | null
    expect(fileInput).not.toBeNull()
    const accept = fileInput!.getAttribute('accept') ?? ''
    expect(accept).toContain('image/jpeg')
    expect(accept).toContain('image/png')
    expect(accept).toContain('image/webp')
    expect(accept).toContain('image/heic')
  })
})
