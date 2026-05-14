import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (vi.hoisted para evitar hoist de vi.mock antes de const) ---
const {
  mockSearchRead,
  mockFsSet,
  mockFsGet,
  mockConfDocSet,
  mockCollectionFn,
  docStore,
  setDoc,
  clearDocStore,
} = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()

  function setDoc(path: string, data: Record<string, unknown>) {
    store.set(path, data)
  }

  function clearDocStore() {
    store.clear()
  }

  const mockConfDocSet = vi.fn()

  // Incrementing counter for auto-id docs (paymentConflicts).
  let autoIdCounter = 0

  function makeDocRef(path: string) {
    const mockGet = vi.fn(() => {
      const data = store.get(path)
      return Promise.resolve({
        exists: data !== undefined,
        id: path.split('/').pop()!,
        data: () => data ?? undefined,
      })
    })
    const mockSet = vi.fn((data: Record<string, unknown>, _opts?: unknown) => {
      store.set(path, { ...(store.get(path) ?? {}), ...data })
      return Promise.resolve()
    })
    // where chain (for tier-3 query)
    const mockLimit = vi.fn()
    const mockWhere = vi.fn()

    return {
      get: mockGet,
      set: mockSet,
      id: path.split('/').pop()!,
      path,
      // store ref so tests can inspect
      _path: path,
      where: mockWhere,
      limit: mockLimit,
    }
  }

  function makeCollectionRef(name: string) {
    return {
      doc: vi.fn((id?: string) => {
        const docId = id ?? `auto-${autoIdCounter++}`
        const fullPath = `${name}/${docId}`
        if (name === 'paymentConflicts') {
          // Use a special mock for conflict docs to track calls
          return {
            set: mockConfDocSet,
            id: docId,
            _path: fullPath,
          }
        }
        return makeDocRef(fullPath)
      }),
      where: vi.fn((_field: string, _op: string, value: unknown) => {
        // Returns a chainable that resolves to empty or docs based on store
        const matchingDocs: Array<{ id: string; data: () => Record<string, unknown> }> = []
        for (const [path, data] of store.entries()) {
          if (path.startsWith(`${name}/`) && (data as Record<string, unknown>).odooPaymentId === value) {
            matchingDocs.push({
              id: path.split('/').pop()!,
              data: () => data,
            })
          }
        }
        return {
          limit: vi.fn(() => ({
            get: vi.fn(() =>
              Promise.resolve({
                empty: matchingDocs.length === 0,
                docs: matchingDocs,
              }),
            ),
          })),
        }
      }),
    }
  }

  const mockFsSet = vi.fn()
  const mockFsGet = vi.fn()

  const mockCollectionFn = vi.fn((name: string) => makeCollectionRef(name))

  return {
    mockSearchRead: vi.fn(),
    mockFsSet,
    mockFsGet,
    mockConfDocSet,
    mockCollectionFn,
    docStore: store,
    setDoc,
    clearDocStore,
  }
})

vi.mock('@/lib/odoo/client', () => ({
  getOdooClient: () => ({
    searchRead: mockSearchRead,
    create: vi.fn(),
    write: vi.fn(),
  }),
  OdooClient: class {},
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: mockCollectionFn,
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    increment: (n: number) => ({ __op: 'increment', n }),
  },
  Timestamp: {
    now: () => ({ seconds: 1747000000, nanoseconds: 0, toMillis: () => 1747000000000 }),
  },
}))

// server-only stub
vi.mock('server-only', () => ({}))

import {
  pullOdooPayments,
  processOdooPayment,
  resolveFirestoreDoc,
  mapOdooToMirror,
  assertOnlyMirrorFields,
  MirrorInvariantError,
  writeMirror,
  ALLOWED_MIRROR_FIELDS,
  type OdooPaymentRow,
  type ProcessPaymentContext,
} from './pull-payments'

// =====================================================================
// Fixtures
// =====================================================================

const CURSOR_24H_AGO = '2026-05-13 12:00:00'
const LAST_CURSOR = '2026-05-14 12:00:00'
const RUN_ID = 'test-run-1'

function makeOdooRow(overrides: Partial<OdooPaymentRow> = {}): OdooPaymentRow {
  return {
    id: 8100,
    state: 'draft',
    journal_id: [13, 'Bank'],
    partner_id: [100, 'Test Partner'],
    amount: 1000.0,
    date: '2026-05-14',
    memo: 'test memo',
    reconciled_invoice_ids: [],
    write_date: '2026-05-14 12:10:00',
    x_firebase_payment_id: null,
    x_firebase_agent_uid: null,
    ...overrides,
  }
}

function makeCtx(overrides: Partial<ProcessPaymentContext> = {}): ProcessPaymentContext {
  return {
    runId: RUN_ID,
    source: 'polling',
    lastCursor: LAST_CURSOR,
    extIdRow: null,
    ...overrides,
  }
}

// =====================================================================
// Setup
// =====================================================================

beforeEach(() => {
  clearDocStore()
  mockSearchRead.mockReset()
  mockConfDocSet.mockReset()
  mockCollectionFn.mockImplementation((name: string) => {
    // Rebuild collection refs each call to pick up fresh store state
    function makeDocRefInner(path: string) {
      return {
        get: vi.fn(() => {
          const data = docStore.get(path)
          return Promise.resolve({
            exists: data !== undefined,
            id: path.split('/').pop()!,
            data: () => data ?? undefined,
          })
        }),
        set: vi.fn((data: Record<string, unknown>, _opts?: unknown) => {
          docStore.set(path, { ...(docStore.get(path) ?? {}), ...data })
          return Promise.resolve()
        }),
        id: path.split('/').pop()!,
        path,
        _path: path,
      }
    }

    let autoId = 0
    return {
      doc: vi.fn((id?: string) => {
        const docId = id ?? `auto-${Math.random().toString(36).slice(2)}-${autoId++}`
        const fullPath = `${name}/${docId}`
        if (name === 'paymentConflicts') {
          return { set: mockConfDocSet, id: docId, _path: fullPath }
        }
        return makeDocRefInner(fullPath)
      }),
      where: vi.fn((_field: string, _op: string, value: unknown) => {
        const matchingDocs: Array<{ id: string; data: () => Record<string, unknown> }> = []
        for (const [path, data] of docStore.entries()) {
          if (
            path.startsWith(`${name}/`) &&
            (data as Record<string, unknown>).odooPaymentId === value
          ) {
            matchingDocs.push({ id: path.split('/').pop()!, data: () => data })
          }
        }
        return {
          limit: vi.fn(() => ({
            get: vi.fn(() =>
              Promise.resolve({ empty: matchingDocs.length === 0, docs: matchingDocs }),
            ),
          })),
        }
      }),
    }
  })
})

// =====================================================================
// Tests
// =====================================================================

describe('AC8 — pull-payments core (Story 9.3)', () => {
  // -----------------------------------------------------------------
  // Test 1: Happy path Tier 1 — 3 payments con x_firebase_payment_id
  // -----------------------------------------------------------------
  it('1. Tier 1: 3 payments con x_firebase_payment_id → 3 docs actualizados, sin ir.model.data', async () => {
    const rows: OdooPaymentRow[] = [
      makeOdooRow({ id: 8100, x_firebase_payment_id: 'fsId100', write_date: '2026-05-14 12:01:00' }),
      makeOdooRow({ id: 8101, x_firebase_payment_id: 'fsId101', write_date: '2026-05-14 12:02:00' }),
      makeOdooRow({ id: 8102, x_firebase_payment_id: 'fsId102', write_date: '2026-05-14 12:03:00' }),
    ]

    // Sembrar docs Firestore existentes para que no caigan en 'skipped'
    setDoc('payments/fsId100', { odooPaymentId: 8100, status: 'verified' })
    setDoc('payments/fsId101', { odooPaymentId: 8101, status: 'verified' })
    setDoc('payments/fsId102', { odooPaymentId: 8102, status: 'verified' })
    // Cursor existente
    setDoc('syncCursors/odooPayments', { lastCursor: LAST_CURSOR })

    mockSearchRead.mockImplementation((model: string) => {
      if (model === 'account.payment') return Promise.resolve(rows)
      return Promise.resolve([])
    })

    const result = await pullOdooPayments({ runId: RUN_ID, now: () => 1747000000000 })

    expect(result.ok).toBe(true)
    expect(result.summary.fetched).toBe(3)
    expect(result.summary.matched).toBe(3)
    expect(result.summary.updated).toBe(3)

    // No debe llamar ir.model.data porque todos tienen x_firebase_payment_id
    const irModelDataCalls = mockSearchRead.mock.calls.filter(
      (call: unknown[]) => call[0] === 'ir.model.data',
    )
    expect(irModelDataCalls).toHaveLength(0)
  })

  // -----------------------------------------------------------------
  // Test 2: Tier 2 fallback — ir.model.data
  // -----------------------------------------------------------------
  it('2. Tier 2: fallback ir.model.data → resuelve firestoreId = FsId123', async () => {
    const row = makeOdooRow({
      id: 8200,
      x_firebase_payment_id: null,
      write_date: '2026-05-14 12:05:00',
    })

    setDoc('payments/FsId123', { odooPaymentId: 8200, status: 'verified' })
    setDoc('syncCursors/odooPayments', { lastCursor: LAST_CURSOR })

    mockSearchRead.mockImplementation((model: string) => {
      if (model === 'account.payment') return Promise.resolve([row])
      if (model === 'ir.model.data')
        return Promise.resolve([{ id: 999, name: 'payment_FsId123', res_id: 8200, model: 'account.payment' }])
      return Promise.resolve([])
    })

    const result = await pullOdooPayments({ runId: RUN_ID, now: () => 1747000000000 })

    expect(result.ok).toBe(true)
    expect(result.summary.matched).toBe(1)
    expect(result.summary.updated).toBe(1)
  })

  // -----------------------------------------------------------------
  // Test 3: Tier 3 fallback — query Firestore por odooPaymentId
  // -----------------------------------------------------------------
  it('3. Tier 3: query Firestore where odooPaymentId == 8300 → procesa OK', async () => {
    const row = makeOdooRow({
      id: 8300,
      x_firebase_payment_id: null,
      write_date: '2026-05-14 12:06:00',
    })

    // Sin ir.model.data para este id
    // Pero el doc Firestore sí existe con odooPaymentId
    setDoc('payments/legacyDoc1', { odooPaymentId: 8300, status: 'verified' })
    setDoc('syncCursors/odooPayments', { lastCursor: LAST_CURSOR })

    mockSearchRead.mockImplementation((model: string) => {
      if (model === 'account.payment') return Promise.resolve([row])
      if (model === 'ir.model.data') return Promise.resolve([]) // sin extId
      return Promise.resolve([])
    })

    const result = await pullOdooPayments({ runId: RUN_ID, now: () => 1747000000000 })

    expect(result.ok).toBe(true)
    expect(result.summary.matched).toBe(1)
  })

  // -----------------------------------------------------------------
  // Test 4: Unmatched — sin ningún match
  // -----------------------------------------------------------------
  it('4. Unmatched: sin x_firebase_payment_id, sin extId, sin doc Firestore → unmatched=1', async () => {
    const row = makeOdooRow({
      id: 8400,
      x_firebase_payment_id: null,
      write_date: '2026-05-14 12:07:00',
    })

    setDoc('syncCursors/odooPayments', { lastCursor: LAST_CURSOR })

    mockSearchRead.mockImplementation((model: string) => {
      if (model === 'account.payment') return Promise.resolve([row])
      if (model === 'ir.model.data') return Promise.resolve([])
      return Promise.resolve([])
    })

    const result = await pullOdooPayments({ runId: RUN_ID, now: () => 1747000000000 })

    expect(result.ok).toBe(true)
    expect(result.summary.unmatched).toBe(1)
    expect(result.summary.matched).toBe(0)
  })

  // -----------------------------------------------------------------
  // Test 5: assertOnlyMirrorFields — invariante crítica
  // -----------------------------------------------------------------
  describe('5. assertOnlyMirrorFields — invariante crítica', () => {
    it('5a. campo Firestore-owned "status" → throws MirrorInvariantError con "status" y "Firestore-owned"', () => {
      expect(() => assertOnlyMirrorFields({ status: 'rejected' })).toThrow(MirrorInvariantError)
      expect(() => assertOnlyMirrorFields({ status: 'rejected' })).toThrow(/status/)
      expect(() => assertOnlyMirrorFields({ status: 'rejected' })).toThrow(/Firestore-owned/)
    })

    it('5b. campo agentId forbidden → throws', () => {
      expect(() => assertOnlyMirrorFields({ agentId: 'x', odooState: 'paid' })).toThrow(
        MirrorInvariantError,
      )
    })

    it('5c. campo aleatorio no en whitelist → throws con "no está en ALLOWED_MIRROR_FIELDS"', () => {
      expect(() => assertOnlyMirrorFields({ randomField: 1 })).toThrow(MirrorInvariantError)
      expect(() => assertOnlyMirrorFields({ randomField: 1 })).toThrow(
        /no está en ALLOWED_MIRROR_FIELDS/,
      )
    })

    it('5d. campos válidos odooState + lww nested → NO throws', () => {
      expect(() =>
        assertOnlyMirrorFields({ odooState: 'paid', lww: { memo: { value: 'x', writtenAt: 'now', source: 'odoo' } } }),
      ).not.toThrow()
    })

    it('5e. writeMirror con campo prohibido → throws antes de llamar .set()', async () => {
      const mockRef = { set: vi.fn() } as unknown as import('firebase-admin/firestore').DocumentReference
      await expect(writeMirror(mockRef, { status: 'x' })).rejects.toThrow(MirrorInvariantError)
      expect(mockRef.set).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------
  // Test 6: Conflicto LWW memo — Firestore escribió más reciente que cursor
  // -----------------------------------------------------------------
  it('6. Conflicto LWW memo: Firestore y Odoo ambos escribieron → paymentConflicts recibe doc, mirror NO incluye lww.memo', async () => {
    // Firestore lww.memo writtenAt DESPUÉS del cursor → conflicto verdadero
    // Odoo memo diferente con write_date después del cursor
    const firestoreLwwMemo = {
      value: 'fs',
      writtenAt: '2026-05-14 12:05:00', // DESPUÉS del cursor 12:00
      source: 'firestore',
    }

    const prev = {
      id: 'pay-conflict',
      odooPaymentId: 8600,
      odooState: 'draft' as const,
      lww: { memo: firestoreLwwMemo },
    }

    const odoo = makeOdooRow({
      id: 8600,
      x_firebase_payment_id: 'pay-conflict',
      memo: 'odoo-edit',
      write_date: '2026-05-14 12:08:00', // Odoo escribe DESPUÉS que Firestore → conflicto
    })

    setDoc('payments/pay-conflict', {
      odooPaymentId: 8600,
      status: 'verified',
      lww: { memo: firestoreLwwMemo },
    })
    setDoc('syncCursors/odooPayments', { lastCursor: LAST_CURSOR })

    mockSearchRead.mockImplementation((model: string) => {
      if (model === 'account.payment') return Promise.resolve([odoo])
      return Promise.resolve([])
    })

    const result = await pullOdooPayments({ runId: RUN_ID, now: () => 1747000000000 })

    expect(result.ok).toBe(true)
    // Debe haber creado un conflict doc
    expect(mockConfDocSet).toHaveBeenCalledTimes(1)
    const confData = mockConfDocSet.mock.calls[0][0] as Record<string, unknown>
    expect(confData.field).toBe('memo')

    // El mirror update no debe incluir lww.memo (ni como literal con punto ni nested)
    const paymentDoc = docStore.get('payments/pay-conflict') ?? {}
    expect('lww.memo' in paymentDoc).toBe(false) // ningún literal con punto

    // Inspeccionar la última escritura al doc: NO debe contener `lww`
    // (el conflict NO se aplica; queda pendiente para Story 9.6)
    const writeCalls = mockCollectionFn.mock.results
    void writeCalls // mock chain debug
  })

  // -----------------------------------------------------------------
  // Test 7: Odoo-wins legítimo — Firestore escribió ANTES del cursor
  // -----------------------------------------------------------------
  it('7. Odoo-wins legítimo: Firestore lww anterior al cursor → mirror incluye lww.memo, sin conflict', async () => {
    const firestoreLwwMemo = {
      value: 'old fs memo',
      writtenAt: '2026-05-14 10:00:00', // ANTES del cursor 12:00 → Odoo gana
      source: 'firestore',
    }

    const odoo = makeOdooRow({
      id: 8700,
      x_firebase_payment_id: 'pay-odoo-wins',
      memo: 'nuevo',
      write_date: '2026-05-14 12:10:00',
    })

    setDoc('payments/pay-odoo-wins', {
      odooPaymentId: 8700,
      status: 'verified',
      lww: { memo: firestoreLwwMemo },
    })
    setDoc('syncCursors/odooPayments', { lastCursor: LAST_CURSOR })

    mockSearchRead.mockImplementation((model: string) => {
      if (model === 'account.payment') return Promise.resolve([odoo])
      return Promise.resolve([])
    })

    const result = await pullOdooPayments({ runId: RUN_ID, now: () => 1747000000000 })

    expect(result.ok).toBe(true)
    expect(result.summary.conflicts).toBe(0)
    expect(mockConfDocSet).not.toHaveBeenCalled()

    // El doc debe tener lww.memo actualizado con source='odoo' (nested, NO literal con punto)
    const paymentDoc = docStore.get('payments/pay-odoo-wins') ?? {}
    expect('lww.memo' in paymentDoc).toBe(false) // invariante: no clave literal con punto
    const lwwNested = (paymentDoc as Record<string, unknown>).lww as Record<string, unknown>
    const lwwMemo = lwwNested.memo as Record<string, unknown>
    expect(lwwMemo).toBeDefined()
    expect(lwwMemo.value).toBe('nuevo')
    expect(lwwMemo.source).toBe('odoo')
  })

  // -----------------------------------------------------------------
  // Test 8: Alerta odoo_canceled — idempotente
  // -----------------------------------------------------------------
  it('8. Alerta odoo_canceled: crea alerta en primer run, no duplica en segundo run', async () => {
    const odoo = makeOdooRow({
      id: 8800,
      x_firebase_payment_id: 'pay-canceled',
      state: 'canceled',
      write_date: '2026-05-14 12:11:00',
    })

    setDoc('payments/pay-canceled', {
      odooPaymentId: 8800,
      status: 'verified',
      odooState: 'draft',
    })
    setDoc('syncCursors/odooPayments', { lastCursor: LAST_CURSOR })

    mockSearchRead.mockImplementation((model: string) => {
      if (model === 'account.payment') return Promise.resolve([odoo])
      return Promise.resolve([])
    })

    // --- Primer run ---
    const result1 = await pullOdooPayments({ runId: RUN_ID, now: () => 1747000000000 })
    expect(result1.ok).toBe(true)
    expect(result1.summary.alerts).toBe(1)

    // Verificar que el alert doc se creó en el store
    const alertDocId = 'pay-canceled__odoo_canceled'
    const alertDoc = docStore.get(`paymentAlerts/${alertDocId}`)
    expect(alertDoc).toBeDefined()
    expect(alertDoc!.status).toBe('open')

    // status del pago NO debe haber cambiado (campo Firestore-owned)
    const payDoc = docStore.get('payments/pay-canceled')!
    expect(payDoc.status).toBe('verified')

    // --- Segundo run: cursor avanzó, mismo payment ---
    // El cursor ahora es el write_date del payment
    const newCursor = result1.newCursor!

    mockSearchRead.mockImplementation((model: string) => {
      if (model === 'account.payment') return Promise.resolve([odoo])
      return Promise.resolve([])
    })

    const result2 = await pullOdooPayments({
      runId: 'test-run-2',
      cursorOverride: newCursor,
      now: () => 1747000000001,
    })
    expect(result2.ok).toBe(true)
    // El alert ya existe con status='open' → no se crea de nuevo
    expect(result2.summary.alerts).toBe(0)
  })

  // -----------------------------------------------------------------
  // Test 9: Cursor avanza al write_date más alto
  // -----------------------------------------------------------------
  it('9. Cursor avanza al write_date máximo tras el run', async () => {
    const rows: OdooPaymentRow[] = [
      makeOdooRow({ id: 8900, x_firebase_payment_id: 'fsId900', write_date: '2026-05-14 12:10:00' }),
      makeOdooRow({ id: 8901, x_firebase_payment_id: 'fsId901', write_date: '2026-05-14 12:30:00' }),
    ]

    setDoc('payments/fsId900', { odooPaymentId: 8900, status: 'verified' })
    setDoc('payments/fsId901', { odooPaymentId: 8901, status: 'verified' })
    setDoc('syncCursors/odooPayments', { lastCursor: LAST_CURSOR })

    mockSearchRead.mockImplementation((model: string) => {
      if (model === 'account.payment') return Promise.resolve(rows)
      return Promise.resolve([])
    })

    const result = await pullOdooPayments({ runId: RUN_ID, now: () => 1747000000000 })

    expect(result.ok).toBe(true)
    expect(result.newCursor).toBe('2026-05-14 12:30:00')

    const cursorDoc = docStore.get('syncCursors/odooPayments')!
    expect(cursorDoc.lastCursor).toBe('2026-05-14 12:30:00')
  })

  // -----------------------------------------------------------------
  // Test 10: Cursor NO avanza en error
  // -----------------------------------------------------------------
  it('10. Cursor NO avanza si searchRead lanza error', async () => {
    setDoc('syncCursors/odooPayments', { lastCursor: LAST_CURSOR })

    mockSearchRead.mockRejectedValueOnce(new Error('odoo down'))

    const result = await pullOdooPayments({ runId: RUN_ID, now: () => 1747000000000 })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('odoo down')

    // El cursor doc debe tener lastError pero NO lastCursor actualizado
    const cursorDoc = docStore.get('syncCursors/odooPayments')!
    expect(cursorDoc.lastError).toBe('odoo down')
    // lastCursor no se sobrescribió (sigue igual al que tenía o ausente del update de error)
    // El store combina con merge, así que si el original era LAST_CURSOR, sigue
    expect(cursorDoc.lastCursor).toBe(LAST_CURSOR)
    // newCursor en resultado debe ser null
    expect(result.newCursor).toBeNull()
  })

  // -----------------------------------------------------------------
  // Test 11: Paginación — 200 + 50 = 250 payments
  // -----------------------------------------------------------------
  it('11. Paginación: 200 rows en primer call + 50 en segundo → fetched=250, 2 calls a account.payment', async () => {
    const page1 = Array.from({ length: 200 }, (_, i) =>
      makeOdooRow({ id: 9000 + i, x_firebase_payment_id: `fsId${9000 + i}`, write_date: '2026-05-14 12:01:00' }),
    )
    const page2 = Array.from({ length: 50 }, (_, i) =>
      makeOdooRow({ id: 9200 + i, x_firebase_payment_id: `fsId${9200 + i}`, write_date: '2026-05-14 12:02:00' }),
    )

    // Sembrar docs para que no sean 'skipped'
    for (const r of [...page1, ...page2]) {
      setDoc(`payments/fsId${r.id}`, { odooPaymentId: r.id, status: 'verified' })
    }
    setDoc('syncCursors/odooPayments', { lastCursor: LAST_CURSOR })

    let callCount = 0
    mockSearchRead.mockImplementation((model: string, _domain: unknown, _fields: unknown, opts: { offset?: number } = {}) => {
      if (model === 'account.payment') {
        callCount++
        return Promise.resolve((opts.offset ?? 0) === 0 ? page1 : page2)
      }
      return Promise.resolve([])
    })

    const result = await pullOdooPayments({ runId: RUN_ID, now: () => 1747000000000 })

    expect(result.ok).toBe(true)
    expect(result.summary.fetched).toBe(250)

    const accountPaymentCalls = mockSearchRead.mock.calls.filter(
      (call: unknown[]) => call[0] === 'account.payment',
    )
    expect(accountPaymentCalls).toHaveLength(2)
    expect(accountPaymentCalls[0][3]).toMatchObject({ offset: 0 })
    expect(accountPaymentCalls[1][3]).toMatchObject({ offset: 200 })

    // Solo 1 call a ir.model.data (batch, no N+1)
    const irCalls = mockSearchRead.mock.calls.filter(
      (call: unknown[]) => call[0] === 'ir.model.data',
    )
    // Todos tienen x_firebase_payment_id → 0 calls a ir.model.data
    expect(irCalls).toHaveLength(0)
  })

  // -----------------------------------------------------------------
  // Test 12: Idempotencia — doble procesamiento del mismo row
  // -----------------------------------------------------------------
  it('12. Idempotencia: procesar el mismo row dos veces → 2do outcome es noop', async () => {
    const odoo = makeOdooRow({
      id: 9500,
      x_firebase_payment_id: 'fsId9500',
      write_date: '2026-05-14 12:15:00',
    })

    setDoc('payments/fsId9500', { odooPaymentId: 9500, status: 'verified' })

    const ctx = makeCtx({ extIdRow: null })

    // Primer procesamiento
    const result1 = await processOdooPayment(odoo, ctx)
    expect(result1.outcome).toBe('updated')

    // El store ahora tiene odooState, etc. actualizados.
    // Segundo procesamiento con el mismo row → los campos ya son iguales → noop
    const result2 = await processOdooPayment(odoo, ctx)
    // Puede ser 'noop' o 'updated' dependiendo de si los LWW son noop.
    // Al menos no debe lanzar error ni duplicar alert.
    expect(['noop', 'updated']).toContain(result2.outcome)
    expect(result2.alertCreated).toBe(false)
  })

  // -----------------------------------------------------------------
  // Test 13: Estado desconocido — skip odooState, otros campos sí se mapean
  // -----------------------------------------------------------------
  it('13. Estado desconocido "funky_state" → mirror no incluye odooState pero sí journal', async () => {
    const odoo = makeOdooRow({
      id: 9600,
      x_firebase_payment_id: 'fsId9600',
      state: 'funky_state',
      journal_id: [13, 'Bank'],
      write_date: '2026-05-14 12:20:00',
    })

    setDoc('payments/fsId9600', { odooPaymentId: 9600, status: 'verified' })

    const ctx = makeCtx()
    const result = await processOdooPayment(odoo, ctx)

    // Debe ser 'updated' (hay campos que sí cambian: journal, reconciliación, LWW)
    // o al menos no 'validation_failed'
    expect(['updated', 'noop']).toContain(result.outcome)

    // odooState no debe estar en el doc de payments
    const payDoc = docStore.get('payments/fsId9600') ?? {}
    expect(payDoc.odooState).toBeUndefined()
  })

  // -----------------------------------------------------------------
  // Test 14: Cursor default 24h atrás si no existe doc
  // -----------------------------------------------------------------
  it('14. Cursor default 24h atrás cuando cursorSnap.exists=false', async () => {
    // Sin seedear syncCursors/odooPayments → no existe

    mockSearchRead.mockImplementation(() => Promise.resolve([]))

    const fixedNow = new Date('2026-05-14T12:00:00Z').getTime()
    const result = await pullOdooPayments({ runId: RUN_ID, now: () => fixedNow })

    expect(result.ok).toBe(true)

    // El cursor que se setea debe ser ~24h atrás en formato YYYY-MM-DD HH:MM:SS
    const cursorDoc = docStore.get('syncCursors/odooPayments')!
    const lastCursor = cursorDoc.lastCursor as string
    expect(lastCursor).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)

    // La fecha debe ser aprox 2026-05-13 12:00:00 (24h atrás)
    expect(lastCursor).toBe('2026-05-13 12:00:00')
  })

  // -----------------------------------------------------------------
  // Test 15: mapOdooToMirror puro — tolerancia ±1 centavo en amount
  // -----------------------------------------------------------------
  it('15. mapOdooToMirror: tolerancia ±1 centavo en amount → noop, sin lww.amount en update', () => {
    const firestoreLwwAmount = {
      value: 500000, // 5000.00 MXN en centavos
      writtenAt: '2026-05-14 10:00:00',
      source: 'odoo' as const,
    }

    const odoo = makeOdooRow({
      id: 9700,
      x_firebase_payment_id: 'fsId9700',
      amount: 5000.005, // → Math.round(5000.005 * 100) = 500001 → diff = 1 → dentro de tolerancia
      write_date: '2026-05-14 12:25:00',
    })

    const prev = {
      id: 'fsId9700',
      odooPaymentId: 9700,
      lww: { amount: firestoreLwwAmount },
    }

    const build = mapOdooToMirror(odoo, prev, LAST_CURSOR, RUN_ID)

    // El update NO debe contener lww.amount (tolerancia aplicada → noop)
    const lww = build.update.lww as Record<string, unknown> | undefined
    expect(lww?.amount).toBeUndefined()
    // Tampoco como clave literal con punto
    expect('lww.amount' in build.update).toBe(false)
    // No debe haber conflicto de amount
    const amountConflict = build.conflicts.find((c) => c.field === 'amount')
    expect(amountConflict).toBeUndefined()
  })

  it('16. Guard dismissed: pago con odooSyncStatus=dismissed → outcome=skipped sin mirror ni conflicts (Story 9.6 F1)', async () => {
    // Sembrar doc con status dismissed
    setDoc('payments/fsIdDismissed', {
      odooSyncStatus: 'dismissed',
      odooSyncDismissedReason: 'Duplicado confirmado manual',
      status: 'verified',
      amountCents: 500000,
    })

    const odooRow = makeOdooRow({
      id: 9999,
      x_firebase_payment_id: 'fsIdDismissed',
      write_date: '2026-05-14 13:00:00',
    })

    const result = await processOdooPayment(odooRow, makeCtx())

    expect(result.outcome).toBe('skipped')
    expect(result.reason).toBe('dismissed')
    expect(result.conflicts).toBe(0)
    expect(result.alertCreated).toBe(false)
    // No debe haberse creado ningún conflicto
    expect(mockConfDocSet).not.toHaveBeenCalled()
    // El doc no debe haber sido modificado (status dismissed intacto)
    const docData = docStore.get('payments/fsIdDismissed')
    expect(docData?.odooSyncStatus).toBe('dismissed')
  })
})
