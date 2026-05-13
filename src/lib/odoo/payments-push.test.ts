import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (vi.hoisted para evitar el hoist de vi.mock antes de const) ---
const { mockSearchRead, mockCreate, mockWrite, mockSet, mockFsDoc, mockFsCollection } = vi.hoisted(() => {
  const mockSet = vi.fn()
  const mockFsDoc = vi.fn(() => ({ set: mockSet }))
  const mockFsCollection = vi.fn(() => ({ doc: mockFsDoc }))
  return {
    mockSearchRead: vi.fn(),
    mockCreate: vi.fn(),
    mockWrite: vi.fn(),
    mockSet,
    mockFsDoc,
    mockFsCollection,
  }
})

vi.mock('@/lib/odoo/client', () => ({
  getOdooClient: () => ({
    searchRead: mockSearchRead,
    create: mockCreate,
    write: mockWrite,
  }),
  OdooClient: class {},
}))

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: mockFsCollection,
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    increment: (n: number) => ({ __op: 'increment', n }),
  },
}))

import {
  pushPaymentToOdoo,
  syncVerifiedPaymentToOdoo,
  resolvePartnerId,
  resolveJournalId,
  PartnerNotFoundError,
} from './payments-push'

beforeEach(() => {
  mockSearchRead.mockReset()
  mockCreate.mockReset()
  mockWrite.mockReset()
  mockSet.mockReset()
  mockFsDoc.mockClear()
  mockFsCollection.mockClear()
  process.env.ODOO_JOURNAL_BANK_DEFAULT_ID = '13'
  process.env.ODOO_JOURNAL_CASH_ID = '14'
})

describe('pushPaymentToOdoo', () => {
  const baseInput = {
    firestoreId: 'pay1',
    partnerId: 4314,
    journalId: 13,
    amount: 1.0,
    date: '2026-05-12',
    memo: 'orderX — Cliente Test',
  }

  it('idempotency: lookup hit → isNew=false, sin creates', async () => {
    mockSearchRead.mockResolvedValueOnce([{ id: 555964, res_id: 8121 }])

    const result = await pushPaymentToOdoo(baseInput)

    expect(result).toEqual({ odooPaymentId: 8121, extIdRecordId: 555964, isNew: false, orphan: false })
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('happy path: lookup miss → reserva extId, crea payment, write res_id', async () => {
    mockSearchRead.mockResolvedValueOnce([]) // lookup miss
    mockCreate
      .mockResolvedValueOnce(555970) // ir.model.data
      .mockResolvedValueOnce(8200) // account.payment
    mockWrite.mockResolvedValueOnce(true)

    const result = await pushPaymentToOdoo({
      ...baseInput,
      firebaseAgentUid: 'agent-uid-xyz',
      ocrConfidence: 0.87,
    })

    expect(result).toEqual({ odooPaymentId: 8200, extIdRecordId: 555970, isNew: true, orphan: false })
    expect(mockCreate.mock.calls[0][0]).toBe('ir.model.data')
    expect(mockCreate.mock.calls[0][1]).toMatchObject({
      module: '__aroundaplanet__',
      name: 'payment_pay1',
      model: 'account.payment',
      res_id: 0,
      noupdate: true,
    })
    expect(mockCreate.mock.calls[1][0]).toBe('account.payment')
    expect(mockCreate.mock.calls[1][1]).toMatchObject({
      partner_id: 4314,
      journal_id: 13,
      amount: 1.0,
      date: '2026-05-12',
      memo: 'orderX — Cliente Test',
      payment_type: 'inbound',
      partner_type: 'customer',
      x_firebase_payment_id: 'pay1',
      x_firebase_agent_uid: 'agent-uid-xyz',
      x_ocr_confidence: 0.87,
    })
    expect(mockWrite).toHaveBeenCalledWith('ir.model.data', [555970], { res_id: 8200 })
  })

  it('recovery: lookup hit res_id=0 → reusa extId, crea payment', async () => {
    mockSearchRead.mockResolvedValueOnce([{ id: 555971, res_id: 0 }])
    mockCreate.mockResolvedValueOnce(8201) // payment
    mockWrite.mockResolvedValueOnce(true)

    const result = await pushPaymentToOdoo(baseInput)

    expect(result.isNew).toBe(true)
    expect(result.extIdRecordId).toBe(555971)
    expect(mockCreate).toHaveBeenCalledTimes(1) // solo account.payment, no ir.model.data
    expect(mockCreate.mock.calls[0][0]).toBe('account.payment')
  })

  it('UNIQUE violation: otro caller ganó la carrera → retorna ganador', async () => {
    mockSearchRead
      .mockResolvedValueOnce([]) // 1er lookup miss
      .mockResolvedValueOnce([{ id: 555972, res_id: 9999 }]) // post-violation lookup
    mockCreate.mockRejectedValueOnce(
      new Error(
        'duplicate key value violates unique constraint "ir_model_data_module_name_uniq_index"',
      ),
    )

    const result = await pushPaymentToOdoo(baseInput)

    expect(result).toEqual({ odooPaymentId: 9999, extIdRecordId: 555972, isNew: false, orphan: false })
    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('write res_id falla 4 veces → marca orphan en syncLog', async () => {
    mockSearchRead.mockResolvedValueOnce([])
    mockCreate
      .mockResolvedValueOnce(555980)
      .mockResolvedValueOnce(8300)
    mockWrite.mockRejectedValue(new Error('Odoo down'))

    const result = await pushPaymentToOdoo(baseInput)

    expect(result.orphan).toBe(true)
    expect(result.odooPaymentId).toBe(8300)
    expect(mockWrite).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
    expect(mockFsCollection).toHaveBeenCalledWith('syncLog')
    expect(mockFsDoc).toHaveBeenCalledWith('pay1')
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        orphan: true,
        odooPaymentId: 8300,
        extIdRecordId: 555980,
      }),
      { merge: true },
    )
  }, 30_000)
})

describe('resolvePartnerId', () => {
  const fakeClient = {
    searchRead: (...a: unknown[]) => mockSearchRead(...a),
  } as never

  it('retorna id en primer match', async () => {
    mockSearchRead.mockResolvedValueOnce([{ id: 4314 }])
    await expect(resolvePartnerId(fakeClient, 'Juan Perez')).resolves.toBe(4314)
  })

  it('PartnerNotFoundError cuando no hay match', async () => {
    mockSearchRead.mockResolvedValueOnce([])
    await expect(resolvePartnerId(fakeClient, 'Inexistente Garcia')).rejects.toBeInstanceOf(PartnerNotFoundError)
  })

  it('empty clientName tira PartnerNotFoundError sin llamar Odoo', async () => {
    await expect(resolvePartnerId(fakeClient, '   ')).rejects.toBeInstanceOf(PartnerNotFoundError)
    expect(mockSearchRead).not.toHaveBeenCalled()
  })
})

describe('resolveJournalId', () => {
  const fakeClient = {
    searchRead: (...a: unknown[]) => mockSearchRead(...a),
  } as never

  it('cash → journal cash', async () => {
    mockSearchRead.mockResolvedValueOnce([{ id: 14, name: 'Cash' }])
    const r = await resolveJournalId(fakeClient, 'cash')
    expect(r.journalId).toBe(14)
    expect(r.fallback).toBe(false)
  })

  it('transfer → journal bank default', async () => {
    mockSearchRead.mockResolvedValueOnce([{ id: 13, name: 'Bank' }])
    const r = await resolveJournalId(fakeClient, 'transfer')
    expect(r.journalId).toBe(13)
    expect(r.fallback).toBe(false)
  })

  it('cash sin env CASH → fallback a bank con warning flag', async () => {
    delete process.env.ODOO_JOURNAL_CASH_ID
    mockSearchRead.mockResolvedValueOnce([{ id: 13, name: 'Bank' }])
    const r = await resolveJournalId(fakeClient, 'cash')
    expect(r.journalId).toBe(13)
    expect(r.fallback).toBe(true)
  })

  it('sin envs → throw', async () => {
    delete process.env.ODOO_JOURNAL_BANK_DEFAULT_ID
    delete process.env.ODOO_JOURNAL_CASH_ID
    await expect(resolveJournalId(fakeClient, 'transfer')).rejects.toMatchObject({ code: 'ODOO_JOURNAL_NOT_CONFIGURED' })
  })
})

describe('syncVerifiedPaymentToOdoo', () => {
  const paymentData = {
    amountCents: 14500000,
    paymentMethod: 'transfer' as const,
    date: new Date('2026-05-12T00:00:00Z'),
    clientName: 'Cliente Test',
    agentId: 'agent-uid-xyz',
    orderId: 'order-1',
    ocrResult: { confidence: 0.91 },
  }

  it('happy path: actualiza Firestore con synced + mirror completo', async () => {
    // resolvePartnerId → searchRead
    mockSearchRead.mockResolvedValueOnce([{ id: 4314 }])
    // resolveJournalId → searchRead
    mockSearchRead.mockResolvedValueOnce([{ id: 13, name: 'Bank' }])
    // pushPaymentToOdoo: lookup miss, create extId, create payment, write
    mockSearchRead.mockResolvedValueOnce([])
    mockCreate.mockResolvedValueOnce(555990).mockResolvedValueOnce(8400)
    mockWrite.mockResolvedValueOnce(true)

    const result = await syncVerifiedPaymentToOdoo('pay1', paymentData)

    expect(result.status).toBe('synced')
    expect(result.odooPaymentId).toBe(8400)
    expect(result.odooJournalId).toBe(13)
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        odooPaymentId: 8400,
        odooSyncStatus: 'synced',
        odooState: 'draft',
        odooJournalId: 13,
        odooJournalName: 'Bank',
        syncRetryCount: 0,
        odooLastError: null,
        syncedToOdoo: true,
      }),
      { merge: true },
    )
  })

  it('partner not found → status error, odooLastError documenta, NO throw', async () => {
    mockSearchRead.mockResolvedValueOnce([]) // partner lookup vacío

    const result = await syncVerifiedPaymentToOdoo('pay1', { ...paymentData, clientName: 'No Existe' })

    expect(result.status).toBe('error')
    expect(result.error).toMatch(/partner_not_found/)
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        odooSyncStatus: 'error',
        odooLastError: expect.stringMatching(/partner_not_found/),
      }),
      { merge: true },
    )
  })

  it('transient error en payment.create → status error, retryable=true', async () => {
    mockSearchRead.mockResolvedValueOnce([{ id: 4314 }])
    mockSearchRead.mockResolvedValueOnce([{ id: 13, name: 'Bank' }])
    mockSearchRead.mockResolvedValueOnce([])
    mockCreate.mockResolvedValueOnce(555991).mockRejectedValueOnce(new Error('Odoo timeout'))

    const result = await syncVerifiedPaymentToOdoo('pay1', paymentData)

    expect(result.status).toBe('error')
    expect(result.retryable).toBe(true)
  })
})
