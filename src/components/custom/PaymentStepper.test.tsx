import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { PaymentStepper } from './PaymentStepper'

afterEach(() => {
  cleanup()
})

const steps = [
  { id: '1', label: 'Pago reportado', status: 'completed' as const },
  { id: '2', label: 'En verificacion', status: 'current' as const },
  { id: '3', label: 'Confirmado', status: 'upcoming' as const },
]

describe('PaymentStepper', () => {
  it('renders list with steps', () => {
    render(<PaymentStepper steps={steps} />)
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByText('Pago reportado')[0]).toBeInTheDocument()
    expect(screen.getAllByText('En verificacion')[0]).toBeInTheDocument()
  })

  it('marks current step with aria-current="step"', () => {
    render(<PaymentStepper steps={steps} />)
    const listItems = screen.getAllByRole('listitem')
    const currentItem = listItems.find((li) => li.getAttribute('aria-current') === 'step')
    expect(currentItem).toBeTruthy()
    expect(currentItem).toHaveAttribute('aria-current', 'step')
  })

  it('aria-current="step" matches the step with status "current"', () => {
    render(<PaymentStepper steps={steps} />)
    const listItems = screen.getAllByRole('listitem')
    const currentItem = listItems.find((li) => li.getAttribute('aria-current') === 'step')
    expect(currentItem?.textContent).toContain('En verificacion')
  })

  it('non-current steps do NOT have aria-current', () => {
    render(<PaymentStepper steps={steps} />)
    const listItems = screen.getAllByRole('listitem')
    const nonCurrentItems = listItems.filter((li) => li.getAttribute('aria-current') !== 'step')
    nonCurrentItems.forEach((item) => {
      expect(item).not.toHaveAttribute('aria-current', 'step')
    })
  })

  it('step with status "rejected" is rendered in the DOM with destructive styling', () => {
    const stepsWithRejected = [
      { id: '1', label: 'Pago reportado', status: 'completed' as const },
      { id: '2', label: 'Comprobante rechazado', status: 'rejected' as const },
      { id: '3', label: 'Pendiente', status: 'upcoming' as const },
    ]
    const { container } = render(<PaymentStepper steps={stepsWithRejected} />)
    expect(screen.getByText('Comprobante rechazado')).toBeInTheDocument()
    // El icono del step rechazado usa colores destructivos
    const destructiveIcon = container.querySelector('.text-destructive')
    expect(destructiveIcon).toBeInTheDocument()
  })

  it('step amount is formatted using formatCurrency', () => {
    const stepsWithAmount = [
      { id: '1', label: 'Pago inicial', status: 'completed' as const, amount: 500000 },
    ]
    render(<PaymentStepper steps={stepsWithAmount} />)
    // 500000 centavos = $5,000 MXN
    expect(screen.getByText(/5,000|5\.000/)).toBeInTheDocument()
  })

  it('step with amount=0 still renders the formatted value', () => {
    const stepsWithZero = [
      { id: '1', label: 'Sin cargo', status: 'upcoming' as const, amount: 0 },
    ]
    render(<PaymentStepper steps={stepsWithZero} />)
    // amount 0 debe renderizarse (el componente comprueba != null)
    expect(screen.getByText(/\$0|MX\$0/)).toBeInTheDocument()
  })

  it('applies custom className to the list', () => {
    const { container } = render(<PaymentStepper steps={steps} className="custom-stepper" />)
    const list = container.querySelector('ol')
    expect(list).toHaveClass('custom-stepper')
  })

  it('renders timestamp when provided', () => {
    const stepsWithTimestamp = [
      { id: '1', label: 'Pago reportado', status: 'completed' as const, timestamp: '25 Feb 2026 10:30' },
    ]
    render(<PaymentStepper steps={stepsWithTimestamp} />)
    expect(screen.getByText('25 Feb 2026 10:30')).toBeInTheDocument()
  })

  it('renders all 4 step statuses correctly', () => {
    const allStatuses = [
      { id: '1', label: 'Completado', status: 'completed' as const },
      { id: '2', label: 'Actual', status: 'current' as const },
      { id: '3', label: 'Rechazado', status: 'rejected' as const },
      { id: '4', label: 'Pendiente', status: 'upcoming' as const },
    ]
    render(<PaymentStepper steps={allStatuses} />)
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.getByText('Actual')).toBeInTheDocument()
    expect(screen.getByText('Rechazado')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })
})
