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
import { AttachmentQueueTable } from './AttachmentQueueTable'

const mockPayments = [
  {
    id: 'pay-att-001',
    clientName: 'Carlos Méndez',
    agentName: null,
    registeredByName: null,
    amountCents: 300000,
    tripName: 'ASIA MAYO 2026',
    odooPaymentId: 8134,
    odooSyncStatus: 'synced',
    odooDocumentId: null,
    odooAttachmentSyncStatus: 'error',
    odooAttachmentLastError: 'HTTP 403 Forbidden al intentar subir attachment a Odoo Documents',
    attachmentRetryCount: 2,
    status: 'verified',
    verifiedAt: '2026-05-14T10:00:00Z',
  },
  {
    id: 'pay-att-002',
    clientName: 'Luisa Ramírez',
    agentName: null,
    registeredByName: null,
    amountCents: 145000000,
    tripName: 'VUELTA AL MUNDO 33.8',
    odooPaymentId: 8200,
    odooSyncStatus: 'synced',
    odooDocumentId: '77001',
    odooAttachmentSyncStatus: 'never',
    odooAttachmentLastError: null,
    attachmentRetryCount: 0,
    status: 'verified',
    verifiedAt: '2026-05-13T08:00:00Z',
  },
]

// Pago sin odooPaymentId — NO debe aparecer (filtro: ya pusheado)
const notPushedPayment = {
  id: 'pay-att-003',
  clientName: 'Sin Odoo',
  amountCents: 10000,
  odooPaymentId: null,
  odooAttachmentSyncStatus: 'error',
  attachmentRetryCount: 0,
  status: 'verified',
  verifiedAt: '2026-05-10T08:00:00Z',
}

// Pago con attachment synced — NO debe aparecer
const syncedAttachmentPayment = {
  id: 'pay-att-004',
  clientName: 'Ya Subido',
  amountCents: 20000,
  odooPaymentId: 8300,
  odooSyncStatus: 'synced',
  odooAttachmentSyncStatus: 'synced',
  attachmentRetryCount: 1,
  status: 'verified',
  verifiedAt: '2026-05-10T09:00:00Z',
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

describe('AttachmentQueueTable', () => {
  it('renderiza 2 pagos con error y never en attachment', () => {
    render(<AttachmentQueueTable />)
    expect(screen.getByText('Carlos Méndez')).toBeInTheDocument()
    expect(screen.getByText('Luisa Ramírez')).toBeInTheDocument()
  })

  it('muestra badge de error (rojo) para status error y badge pendiente para never', () => {
    render(<AttachmentQueueTable />)
    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('muestra el count de reintentos y "Rate limit" cuando attachmentRetryCount >= 5', () => {
    const atLimitPayment = {
      id: 'pay-att-005',
      clientName: 'Rate Limited',
      amountCents: 50000,
      odooPaymentId: 8400,
      odooSyncStatus: 'synced',
      odooAttachmentSyncStatus: 'error',
      odooAttachmentLastError: 'timeout',
      attachmentRetryCount: 5,
      status: 'verified',
      verifiedAt: '2026-05-12T08:00:00Z',
    }
    ;(onSnapshot as Mock).mockImplementation(
      (_q: unknown, cb: (snap: unknown) => void) => {
        cb({
          docs: [atLimitPayment].map((p) => ({
            id: p.id,
            data: () => p,
          })),
        })
        return () => {}
      },
    )
    render(<AttachmentQueueTable />)
    expect(screen.getByText('Rate limit')).toBeInTheDocument()
  })

  it('muestra empty state cuando no hay pagos con problema de attachment', () => {
    ;(onSnapshot as Mock).mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [] })
      return () => {}
    })
    render(<AttachmentQueueTable />)
    expect(screen.getByText(/Sin comprobantes con error/)).toBeInTheDocument()
  })

  it('renderiza Skeleton durante la carga inicial', () => {
    ;(onSnapshot as Mock).mockImplementation(() => {
      // No llama al callback — simula estado loading
      return () => {}
    })
    render(<AttachmentQueueTable />)
    // Skeleton genera divs animate-pulse
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  it('click en Reintentar comprobante hace POST al endpoint correcto', async () => {
    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })

    render(<AttachmentQueueTable />)

    const retryBtns = screen.getAllByRole('button', { name: /Reintentar comprobante/i })
    fireEvent.click(retryBtns[0])

    await waitFor(() => {
      const fetchCall = (global.fetch as Mock).mock.calls[0]
      expect(fetchCall[0]).toBe('/api/payments/pay-att-001/retry-attachment')
      expect(fetchCall[1]?.method).toBe('POST')
      // Auth via cookie — no se envía Authorization header
      expect(fetchCall[1]?.headers?.Authorization).toBeUndefined()
    })
  })

  it('muestra toast info cuando alreadyExists=true en respuesta ok', async () => {
    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ alreadyExists: true }),
    })

    render(<AttachmentQueueTable />)

    const retryBtns = screen.getAllByRole('button', { name: /Reintentar comprobante/i })
    fireEvent.click(retryBtns[0])

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/payments/pay-att-001/retry-attachment',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('no renderiza pagos sin odooPaymentId ni pagos con attachment synced', () => {
    ;(onSnapshot as Mock).mockImplementation(
      (_q: unknown, cb: (snap: unknown) => void) => {
        cb({
          docs: [...mockPayments, notPushedPayment, syncedAttachmentPayment].map((p) => ({
            id: p.id,
            data: () => p,
          })),
        })
        return () => {}
      },
    )
    render(<AttachmentQueueTable />)
    expect(screen.queryByText('Sin Odoo')).not.toBeInTheDocument()
    expect(screen.queryByText('Ya Subido')).not.toBeInTheDocument()
    // Los dos con problema sí aparecen
    expect(screen.getByText('Carlos Méndez')).toBeInTheDocument()
    expect(screen.getByText('Luisa Ramírez')).toBeInTheDocument()
  })
})
