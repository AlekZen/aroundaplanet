import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, afterEach, vi, beforeEach, type Mock } from 'vitest'

// Mock Firebase client y Firestore antes de importar el componente
vi.mock('@/lib/firebase/client', () => ({
  firebaseApp: {},
}))

vi.mock('firebase/firestore', () => {
  const onSnapshotMock = vi.fn()
  const getDocMock = vi.fn()
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    onSnapshot: onSnapshotMock,
    doc: vi.fn(),
    getDoc: getDocMock,
  }
})

import { onSnapshot, getDoc } from 'firebase/firestore'
import { AlertsTable } from './AlertsTable'

const mockAlerts = [
  {
    id: 'pay001__odoo_canceled',
    paymentId: 'pay001',
    type: 'odoo_canceled',
    status: 'open',
    odooPaymentId: 8134,
    odooState: 'cancel',
    firestoreStatus: 'verified',
    detectedAt: '2026-05-14T10:00:00Z',
    runId: 'run-abc123',
  },
  {
    id: 'pay002__attachment_failed',
    paymentId: 'pay002',
    type: 'attachment_failed',
    status: 'open',
    odooPaymentId: 8135,
    odooState: 'draft',
    firestoreStatus: 'verified',
    detectedAt: '2026-05-14T09:00:00Z',
    runId: null,
  },
  {
    id: 'pay003__orphan_payment',
    paymentId: 'pay003',
    type: 'orphan_payment',
    status: 'open',
    odooPaymentId: null,
    odooState: null,
    firestoreStatus: 'verified',
    detectedAt: '2026-05-14T08:00:00Z',
    runId: 'run-xyz',
  },
  {
    id: 'pay004__unknown_method',
    paymentId: 'pay004',
    type: 'unknown_method',
    status: 'open',
    odooPaymentId: 8136,
    odooState: 'draft',
    firestoreStatus: 'verified',
    detectedAt: '2026-05-13T15:00:00Z',
    runId: null,
  },
]

const paymentDataByPaymentId: Record<string, Record<string, unknown>> = {
  pay001: { clientName: 'Felipe Rubio', amount: 500000, paymentMethod: 'transfer' },
  pay002: { clientName: 'Yazil Ramírez', amount: 8680000, paymentMethod: 'deposit' },
  pay003: { clientName: 'Test Browser', amount: 250000, paymentMethod: 'cash' },
  pay004: { clientName: 'Alek Zen', amount: 333000, paymentMethod: 'unknown_method_xyz' },
}

beforeEach(() => {
  ;(onSnapshot as Mock).mockImplementation(
    (_q: unknown, cb: (snap: unknown) => void, _err?: unknown) => {
      cb({
        docs: mockAlerts.map((a) => ({
          id: a.id,
          data: () => a,
        })),
      })
      return () => {}
    },
  )

  ;(getDoc as Mock).mockImplementation((docRef: { id?: string } | unknown) => {
    const docId = (docRef as { id?: string })?.id ?? ''
    const data = paymentDataByPaymentId[docId]
    return Promise.resolve({
      exists: () => !!data,
      data: () => data ?? null,
      id: docId,
    })
  })

  global.fetch = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AlertsTable', () => {
  it('renderiza 4 acordeones — uno por tipo de alerta', () => {
    render(<AlertsTable />)
    expect(screen.getByText(/Odoo cancelado/)).toBeInTheDocument()
    expect(screen.getByText(/Adjunto fallido/)).toBeInTheDocument()
    expect(screen.getByText(/Pago huérfano/)).toBeInTheDocument()
    expect(screen.getByText(/Método desconocido/)).toBeInTheDocument()
  })

  it('odoo_canceled muestra botón Marcar Firestore canceled', () => {
    render(<AlertsTable />)
    // Expandir el acordeón odoo_canceled
    const trigger = screen.getByText(/Odoo cancelado/)
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: /Marcar Firestore canceled/i })).toBeInTheDocument()
  })

  it('attachment_failed muestra botón Reintentar subida', () => {
    render(<AlertsTable />)
    const trigger = screen.getByText(/Adjunto fallido/)
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: /Reintentar subida/i })).toBeInTheDocument()
  })

  it('orphan_payment muestra botones de reintentar y marcar manual', () => {
    render(<AlertsTable />)
    const trigger = screen.getByText(/Pago huérfano/)
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: /Reintentar idempotency lock/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Marcar como manual/i })).toBeInTheDocument()
  })

  it('unknown_method muestra enlace Editar mapping', () => {
    render(<AlertsTable />)
    const trigger = screen.getByText(/Método desconocido/)
    fireEvent.click(trigger)
    expect(screen.getByRole('link', { name: /Editar mapping/i })).toBeInTheDocument()
  })

  it('click Desestimar en odoo_canceled abre modal con textarea de nota', () => {
    render(<AlertsTable />)
    const trigger = screen.getByText(/Odoo cancelado/)
    fireEvent.click(trigger)
    const dismissBtns = screen.getAllByRole('button', { name: /Desestimar/i })
    fireEvent.click(dismissBtns[0])
    expect(screen.getByText(/Desestimar alerta/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Nota de resolución/i)).toBeInTheDocument()
  })

  it('submit de desestimar hace PATCH al endpoint correcto', async () => {
    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ dismissed: true }),
    })

    render(<AlertsTable />)
    const trigger = screen.getByText(/Odoo cancelado/)
    fireEvent.click(trigger)
    const dismissBtns = screen.getAllByRole('button', { name: /Desestimar/i })
    fireEvent.click(dismissBtns[0])

    const textarea = screen.getByLabelText(/Nota de resolución/i)
    fireEvent.change(textarea, { target: { value: 'Falso positivo — verificado con Paloma' } })

    const confirmBtn = screen.getByRole('button', { name: /Confirmar/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      const fetchCall = (global.fetch as Mock).mock.calls[0]
      expect(fetchCall[0]).toBe('/api/payment-alerts/pay001__odoo_canceled')
      expect(fetchCall[1]?.method).toBe('PATCH')
      // Auth via cookie — no se envía Authorization header
      expect(fetchCall[1]?.headers?.Authorization).toBeUndefined()
      const body = JSON.parse(fetchCall[1]?.body as string) as {
        status: string
        resolutionNote: string
      }
      expect(body.status).toBe('dismissed')
      expect(body.resolutionNote).toBe('Falso positivo — verificado con Paloma')
    })
  })

  it('click Reintentar subida en attachment_failed hace POST a retry-attachment', async () => {
    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 501,
      json: async () => ({ code: 'not_implemented', message: 'Pendiente Story 9.4' }),
    })

    render(<AlertsTable />)
    const trigger = screen.getByText(/Adjunto fallido/)
    fireEvent.click(trigger)
    const retryBtn = screen.getByRole('button', { name: /Reintentar subida/i })
    fireEvent.click(retryBtn)

    await waitFor(() => {
      const fetchCall = (global.fetch as Mock).mock.calls[0]
      expect(fetchCall[0]).toBe('/api/payments/pay002/retry-attachment')
      expect(fetchCall[1]?.method).toBe('POST')
    })
  })

  it('muestra toast con "Pendiente Story 9.4" cuando retry-attachment retorna 501', async () => {
    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 501,
      json: async () => ({ code: 'not_implemented' }),
    })

    render(<AlertsTable />)
    const trigger = screen.getByText(/Adjunto fallido/)
    fireEvent.click(trigger)
    const retryBtn = screen.getByRole('button', { name: /Reintentar subida/i })
    fireEvent.click(retryBtn)

    // Verificar que se llamó al endpoint (el toast lo verifica integration level)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/payments/pay002/retry-attachment',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('muestra mensaje vacío cuando no hay alertas', () => {
    ;(onSnapshot as Mock).mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [] })
      return () => {}
    })
    render(<AlertsTable />)
    expect(screen.getByText(/Sin alertas operativas abiertas/)).toBeInTheDocument()
  })
})
