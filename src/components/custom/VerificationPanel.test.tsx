import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { VerificationPanel } from './VerificationPanel'

afterEach(() => {
  cleanup()
})

const payment = {
  id: 'PAY-001',
  amount: 500000,
  agentName: 'Lupita',
  clientName: 'Carlos',
  date: '2026-02-25',
}

describe('VerificationPanel', () => {
  it('renders payment details', () => {
    render(<VerificationPanel payment={payment} />)
    expect(screen.getByText('Lupita', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Carlos', { exact: false })).toBeInTheDocument()
  })

  it('shows skeleton when no payment', () => {
    const { container } = render(<VerificationPanel />)
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it('has aria-label with payment id', () => {
    render(<VerificationPanel payment={payment} />)
    expect(screen.getByLabelText(/PAY-001/)).toBeInTheDocument()
  })

  it('payment amount is displayed formatted using formatCurrency', () => {
    render(<VerificationPanel payment={payment} />)
    // 500000 centavos = $5,000 MXN
    expect(screen.getByText(/5,000|5\.000/)).toBeInTheDocument()
  })

  it('keyboard hints text is present', () => {
    render(<VerificationPanel payment={payment} />)
    expect(screen.getByText(/Atajos/i)).toBeInTheDocument()
    expect(screen.getByText(/Verificar/i, { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText(/Rechazar/i, { selector: 'p' })).toBeInTheDocument()
  })

  it('Verificar button is visible in initial state', () => {
    render(<VerificationPanel payment={payment} />)
    expect(screen.getByRole('button', { name: /verificar/i })).toBeInTheDocument()
  })

  it('calls onVerify callback when Verificar button is clicked', () => {
    const handleVerify = vi.fn()
    render(<VerificationPanel payment={payment} onVerify={handleVerify} />)
    fireEvent.click(screen.getByRole('button', { name: /verificar/i }))
    expect(handleVerify).toHaveBeenCalledTimes(1)
  })

  it('clicking Rechazar shows textarea for rejection reason', () => {
    render(<VerificationPanel payment={payment} />)
    fireEvent.click(screen.getByRole('button', { name: /^rechazar$/i }))
    expect(screen.getByLabelText(/motivo de rechazo/i)).toBeInTheDocument()
  })

  it('Verificar button is hidden after clicking Rechazar (reject flow started)', () => {
    render(<VerificationPanel payment={payment} />)
    fireEvent.click(screen.getByRole('button', { name: /^rechazar$/i }))
    // En el estado isRejecting, el boton Verificar no se renderiza
    expect(screen.queryByRole('button', { name: /^verificar$/i })).not.toBeInTheDocument()
  })

  it('reject flow: entering reason and confirming calls onReject with the reason', () => {
    const handleReject = vi.fn()
    render(<VerificationPanel payment={payment} onReject={handleReject} />)
    // Paso 1: click en Rechazar para mostrar el textarea
    fireEvent.click(screen.getByRole('button', { name: /^rechazar$/i }))
    // Paso 2: escribir el motivo
    const textarea = screen.getByLabelText(/motivo de rechazo/i)
    fireEvent.change(textarea, { target: { value: 'Comprobante ilegible' } })
    // Paso 3: confirmar el rechazo
    fireEvent.click(screen.getByRole('button', { name: /confirmar rechazo/i }))
    expect(handleReject).toHaveBeenCalledTimes(1)
    expect(handleReject).toHaveBeenCalledWith('Comprobante ilegible')
  })

  it('reject flow: Cancelar button hides the textarea and restores Verificar button', () => {
    render(<VerificationPanel payment={payment} />)
    fireEvent.click(screen.getByRole('button', { name: /^rechazar$/i }))
    // Ahora debe estar en modo rechazo
    expect(screen.getByLabelText(/motivo de rechazo/i)).toBeInTheDocument()
    // Click en Cancelar
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    // Debe volver al estado inicial
    expect(screen.queryByLabelText(/motivo de rechazo/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /verificar/i })).toBeInTheDocument()
  })

  it('applies custom className to the card', () => {
    render(<VerificationPanel payment={payment} className="custom-panel" />)
    const card = screen.getByLabelText(/PAY-001/)
    expect(card).toHaveClass('custom-panel')
  })

  it('renders receipt image url when receipt is provided', () => {
    const receipt = { imageUrl: '/receipts/test-receipt.jpg' }
    render(<VerificationPanel payment={payment} receipt={receipt} />)
    expect(screen.getByText(/test-receipt\.jpg/)).toBeInTheDocument()
  })
})
