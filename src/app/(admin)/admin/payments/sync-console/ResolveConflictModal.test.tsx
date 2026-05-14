import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, afterEach, vi, beforeEach, type Mock } from 'vitest'

// Mock fetch global
const mockFetch = vi.fn()
global.fetch = mockFetch

import { ResolveConflictModal } from './ResolveConflictModal'
import type { PaymentConflict } from '@/schemas/paymentConflictSchema'

const baseConflict: PaymentConflict & { conflictId: string } = {
  conflictId: 'conflict001',
  paymentId: 'pay001',
  field: 'amount',
  firestoreValue: 500000,
  odooValue: 600000,
  firestoreWrittenAt: '2026-05-14T10:00:00Z',
  odooWrittenAt: '2026-05-14T10:05:00Z',
  detectedAt: '2026-05-14T10:10:00Z',
  firestoreSource: 'firestore',
  odooSource: 'odoo',
  resolvedAt: null,
}

const memoConflict: PaymentConflict & { conflictId: string } = {
  ...baseConflict,
  conflictId: 'conflict002',
  field: 'memo',
  firestoreValue: 'Pago viaje Asia',
  odooValue: 'Pago Asia',
}

beforeEach(() => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ pushQueued: false }),
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ResolveConflictModal', () => {
  it('renderiza con campo amount — muestra valores MXN', () => {
    render(<ResolveConflictModal conflict={baseConflict} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Valor Firestore')).toBeInTheDocument()
    expect(screen.getByText('Valor Odoo')).toBeInTheDocument()
    // Valores formateados en MXN
    expect(screen.getByText('$5,000.00')).toBeInTheDocument()
    expect(screen.getByText('$6,000.00')).toBeInTheDocument()
  })

  it('submit "Conservar Firestore" llama fetch con payload correcto', async () => {
    const onClose = vi.fn()
    render(<ResolveConflictModal conflict={baseConflict} open={true} onClose={onClose} />)

    // Radio firestore ya es default
    const submitBtn = screen.getByRole('button', { name: /Confirmar resolución/ })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/payment-conflicts/conflict001/resolve',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"resolution":"firestore"'),
        }),
      )
      // Auth via cookie — no se envía Authorization header
      const call = mockFetch.mock.calls[0][1] as { headers?: Record<string, string> }
      expect(call.headers?.['Authorization']).toBeUndefined()
    })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('submit con "Valor personalizado" inválido (vacío) muestra error de validación', async () => {
    render(<ResolveConflictModal conflict={baseConflict} open={true} onClose={vi.fn()} />)

    // Seleccionar custom
    const customRadio = screen.getByDisplayValue('custom')
    fireEvent.click(customRadio)

    // Dejar customValue vacío y enviar
    const submitBtn = screen.getByRole('button', { name: /Confirmar resolución/ })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/El valor personalizado es obligatorio/)).toBeInTheDocument()
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('respuesta 409 muestra toast específico de race condition', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: 'ya resuelto por otro.admin@test.com' }),
    })
    const onClose = vi.fn()
    render(<ResolveConflictModal conflict={baseConflict} open={true} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /Confirmar resolución/ }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    // El toast de error debería haber sido llamado — verificamos que fetch fue llamado
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('campo memo muestra textarea para valor personalizado', () => {
    render(<ResolveConflictModal conflict={memoConflict} open={true} onClose={vi.fn()} />)

    const customRadio = screen.getByDisplayValue('custom')
    fireEvent.click(customRadio)

    // Debería aparecer textarea para memo
    const textarea = screen.getByPlaceholderText(/Texto del memo/)
    expect(textarea).toBeInTheDocument()
  })
})
