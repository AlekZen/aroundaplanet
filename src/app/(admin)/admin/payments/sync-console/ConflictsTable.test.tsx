import { render, screen, cleanup, fireEvent } from '@testing-library/react'
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
import { ConflictsTable } from './ConflictsTable'

const mockConflicts = [
  {
    paymentId: 'pay001',
    field: 'amount',
    firestoreValue: 500000, // $5,000 MXN en centavos
    odooValue: 600000,       // $6,000 MXN en centavos
    firestoreWrittenAt: new Date('2026-05-14T10:00:00Z').toISOString(),
    odooWrittenAt: new Date('2026-05-14T10:05:00Z').toISOString(),
    detectedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // hace 12 min
    firestoreSource: 'firestore',
    odooSource: 'odoo',
    resolvedAt: null,
    conflictId: 'conflict001',
  },
  {
    paymentId: 'pay002',
    field: 'memo',
    firestoreValue: 'Pago viaje Asia',
    odooValue: 'Pago Asia Mayo',
    firestoreWrittenAt: new Date('2026-05-14T09:00:00Z').toISOString(),
    odooWrittenAt: new Date('2026-05-14T09:10:00Z').toISOString(),
    detectedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // hace 1h
    firestoreSource: 'firestore',
    resolvedAt: null,
    conflictId: 'conflict002',
  },
]

beforeEach(() => {
  ;(onSnapshot as Mock).mockImplementation((_q: unknown, cb: (snap: unknown) => void, _err?: unknown) => {
    cb({
      docs: mockConflicts.map((c) => ({
        id: c.conflictId,
        data: () => c,
      })),
    })
    return () => {}
  })
  ;(getDoc as Mock).mockResolvedValue({
    exists: () => true,
    data: () => ({ clientName: 'Juan Pérez', amount: 500000 }),
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ConflictsTable', () => {
  it('renderiza columnas de la tabla', () => {
    render(<ConflictsTable />)
    expect(screen.getByText('Pago')).toBeInTheDocument()
    expect(screen.getByText('Campo')).toBeInTheDocument()
    expect(screen.getByText('Valor Firestore')).toBeInTheDocument()
    expect(screen.getByText('Valor Odoo')).toBeInTheDocument()
    expect(screen.getByText('Detectado')).toBeInTheDocument()
    expect(screen.getByText('Sources')).toBeInTheDocument()
    expect(screen.getByText('Acción')).toBeInTheDocument()
  })

  it('renderiza 2 filas de conflictos', () => {
    render(<ConflictsTable />)
    const resolverBtns = screen.getAllByRole('button', { name: 'Resolver' })
    expect(resolverBtns).toHaveLength(2)
  })

  it('muestra badges de campo correcto', () => {
    render(<ConflictsTable />)
    expect(screen.getByText('Monto')).toBeInTheDocument()
    expect(screen.getByText('Memo')).toBeInTheDocument()
  })

  it('abre modal al hacer click en Resolver', () => {
    render(<ConflictsTable />)
    const btns = screen.getAllByRole('button', { name: 'Resolver' })
    fireEvent.click(btns[0])
    // El modal debe mostrar el título de resolución
    expect(screen.getByText(/Resolver conflicto/)).toBeInTheDocument()
  })

  it('muestra mensaje vacío cuando no hay conflictos', () => {
    ;(onSnapshot as Mock).mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [] })
      return () => {}
    })
    render(<ConflictsTable />)
    expect(screen.getByText(/Sin conflictos pendientes/)).toBeInTheDocument()
  })
})
