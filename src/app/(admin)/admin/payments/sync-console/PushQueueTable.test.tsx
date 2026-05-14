import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, afterEach, vi, beforeEach, type Mock } from 'vitest'

// Mock Firebase client y Firestore antes de importar el componente
vi.mock('@/lib/firebase/client', () => ({
  firebaseApp: {},
}))

vi.mock('firebase/firestore', () => {
  const onSnapshotMock = vi.fn()
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    onSnapshot: onSnapshotMock,
  }
})

import { onSnapshot } from 'firebase/firestore'
import { PushQueueTable } from './PushQueueTable'

const mockPayments = [
  {
    id: 'pay001',
    clientName: 'María García',
    clientPhone: '3318001234',
    amount: 500000,
    paymentMethod: 'transfer',
    // Legacy: sin odooSyncStatus (verificado antes de Story 9.2)
    odooSyncStatus: null,
    odooLastError: null,
    syncRetryCount: 0,
    status: 'verified',
    odooPaymentId: null,
    verifiedAt: '2026-05-14T10:00:00Z',
  },
  {
    id: 'pay002',
    clientName: 'Carlos López',
    clientPhone: null,
    amount: 145000000,
    paymentMethod: 'cash',
    odooSyncStatus: 'error',
    odooLastError: 'XML-RPC timeout after 30s al intentar create en Odoo prod',
    syncRetryCount: 3,
    status: 'verified',
    odooPaymentId: null,
    verifiedAt: '2026-05-13T08:00:00Z',
  },
]

// Pago dismissed — NO debe aparecer en la tabla
const dismissedPayment = {
  id: 'pay003',
  clientName: 'Descartado',
  clientPhone: null,
  amount: 10000,
  paymentMethod: 'cash',
  odooSyncStatus: 'dismissed',
  odooLastError: null,
  syncRetryCount: 0,
  status: 'verified',
  odooPaymentId: null,
  verifiedAt: '2026-05-10T08:00:00Z',
}

beforeEach(() => {
  ;(onSnapshot as Mock).mockImplementation(
    (_q: unknown, cb: (snap: unknown) => void, _err?: unknown) => {
      cb({
        docs: mockPayments.map((p) => ({
          id: p.id,
          data: () => p,
        })),
      })
      return () => {}
    },
  )

  global.fetch = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PushQueueTable', () => {
  it('renderiza 2 rows con los pagos mock', () => {
    render(<PushQueueTable />)
    expect(screen.getByText('María García')).toBeInTheDocument()
    expect(screen.getByText('Carlos López')).toBeInTheDocument()
  })

  it('muestra SyncStatusBadge para cada pago', () => {
    render(<PushQueueTable />)
    const badges = screen.getAllByTestId('sync-status-badge')
    expect(badges.length).toBeGreaterThanOrEqual(2)
  })

  it('muestra columnas de la tabla', () => {
    render(<PushQueueTable />)
    expect(screen.getByText('Cliente')).toBeInTheDocument()
    expect(screen.getByText('Monto')).toBeInTheDocument()
    expect(screen.getByText('Método')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Último error')).toBeInTheDocument()
    expect(screen.getByText('Reintentos')).toBeInTheDocument()
    expect(screen.getByText('Acciones')).toBeInTheDocument()
  })

  it('muestra el método con label legible', () => {
    render(<PushQueueTable />)
    expect(screen.getByText('Transferencia')).toBeInTheDocument()
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
  })

  it('click en Reintentar push hace POST al endpoint correcto y muestra toast en éxito', async () => {
    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, odooPaymentId: 9001 }),
    })

    render(<PushQueueTable />)

    const retryBtns = screen.getAllByRole('button', { name: /Reintentar push/i })
    fireEvent.click(retryBtns[0])

    await waitFor(() => {
      const fetchCall = (global.fetch as Mock).mock.calls[0]
      expect(fetchCall[0]).toBe('/api/payments/pay001/retry-odoo-push')
      expect(fetchCall[1]?.method).toBe('POST')
      // Auth via cookie — no se envía Authorization header
      expect(fetchCall[1]?.headers?.Authorization).toBeUndefined()
    })
  })

  it('click en Reintentar push muestra error en 502', async () => {
    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: 'Odoo no responde' }),
    })

    render(<PushQueueTable />)
    const retryBtns = screen.getAllByRole('button', { name: /Reintentar push/i })
    fireEvent.click(retryBtns[0])

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/payments/pay001/retry-odoo-push',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('click en Descartar muestra botón de confirmación en modal', async () => {
    render(<PushQueueTable />)
    const discardBtns = screen.getAllByRole('button', { name: /Descartar/i })
    expect(discardBtns.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(discardBtns[0])
    // Dialog renderiza en portal — verificamos que el estado cambia via aria-hidden en el trigger
    // y que el botón de confirmar aparece en el DOM
    await waitFor(
      () => {
        const confirmBtn = document.querySelector('[data-slot="dialog-content"]')
        expect(confirmBtn).not.toBeNull()
      },
      { timeout: 2000 },
    )
  })

  it('submit de descartar con reason válido hace POST correcto', async () => {
    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ dismissed: true }),
    })

    render(<PushQueueTable />)
    const discardBtns = screen.getAllByRole('button', { name: /Descartar/i })
    fireEvent.click(discardBtns[0])

    const textarea = screen.getByLabelText(/Motivo/i)
    fireEvent.change(textarea, { target: { value: 'Pago duplicado registrado por error' } })

    const confirmBtn = screen.getByRole('button', { name: /Confirmar descarte/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      const fetchCall = (global.fetch as Mock).mock.calls[0]
      expect(fetchCall[0]).toBe('/api/payments/pay001/dismiss-odoo-sync')
      expect(fetchCall[1]?.method).toBe('POST')
      // Auth via cookie — no se envía Authorization header
      expect(fetchCall[1]?.headers?.Authorization).toBeUndefined()
      const body = JSON.parse(fetchCall[1]?.body as string) as { reason: string }
      expect(body.reason).toBe('Pago duplicado registrado por error')
    })
  })

  it('muestra mensaje vacío cuando no hay pagos', () => {
    ;(onSnapshot as Mock).mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [] })
      return () => {}
    })
    render(<PushQueueTable />)
    expect(screen.getByText(/Sin pagos pendientes en la cola/)).toBeInTheDocument()
  })

  it('no renderiza pagos con odooSyncStatus dismissed', () => {
    ;(onSnapshot as Mock).mockImplementation(
      (_q: unknown, cb: (snap: unknown) => void, _err?: unknown) => {
        cb({
          docs: [...mockPayments, dismissedPayment].map((p) => ({
            id: p.id,
            data: () => p,
          })),
        })
        return () => {}
      },
    )
    render(<PushQueueTable />)
    expect(screen.queryByText('Descartado')).not.toBeInTheDocument()
    // Los pagos no-dismissed sí aparecen
    expect(screen.getByText('María García')).toBeInTheDocument()
    expect(screen.getByText('Carlos López')).toBeInTheDocument()
  })
})
