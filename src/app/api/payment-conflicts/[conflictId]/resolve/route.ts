/**
 * Story 9.6 — PATCH /api/payment-conflicts/[conflictId]/resolve
 *
 * Resuelve un conflicto LWW Firestore↔Odoo eligiendo qué valor gana.
 * Opciones: 'firestore' | 'odoo' | 'custom'
 *
 * Después de persistir la resolución, si el ganador no es el valor Firestore
 * actual (o si Firestore es más reciente que Odoo), dispara push idempotente
 * Firestore→Odoo via syncVerifiedPaymentToOdoo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { requirePermission } from '@/lib/auth/requirePermission'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'
import { resolvePaymentConflictSchema } from '@/schemas/paymentConflictSchema'
import { syncVerifiedPaymentToOdoo } from '@/lib/odoo/payments-push'

const CONFLICTS_COLLECTION = 'paymentConflicts'
const PAYMENTS_COLLECTION = 'payments'

interface RouteContext {
  params: Promise<{ conflictId: string }>
}

/** Valida que el valor ganador coincida con el tipo del campo LWW. */
function validateWinnerType(field: string, value: unknown): boolean {
  if (field === 'amount') {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
  }
  if (field === 'memo') {
    return typeof value === 'string' && value.length <= 500
  }
  if (field === 'paymentDate') {
    if (value instanceof Date) return true
    if (typeof value === 'string') return value.length > 0
    if (typeof value === 'object' && value !== null) {
      const v = value as Record<string, unknown>
      return typeof v.seconds === 'number' && typeof v.nanoseconds === 'number'
    }
    return false
  }
  return false
}

/** Convierte Firestore Timestamp-like / Date / string a ms epoch para comparar. */
function toEpochMs(val: unknown): number {
  if (val instanceof Date) return val.getTime()
  if (typeof val === 'string') return new Date(val).getTime()
  if (typeof val === 'object' && val !== null) {
    const v = val as Record<string, unknown>
    if (typeof v.seconds === 'number') return v.seconds * 1000
    if (typeof v.toMillis === 'function') return (v.toMillis as () => number)()
  }
  return 0
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const claims = await requirePermission('payments:verify')
    const { conflictId } = await context.params

    const body = await request.json()
    const parsed = resolvePaymentConflictSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Datos inválidos',
          retryable: false,
        },
        { status: 400 },
      )
    }

    const { resolution, resolutionValue, resolutionNote } = parsed.data

    // ----------------------------------------------------------------
    // Transacción Firestore
    // ----------------------------------------------------------------
    let winnerValue: unknown
    let conflictData: FirebaseFirestore.DocumentData
    let paymentData: FirebaseFirestore.DocumentData
    let paymentId: string

    const db = adminDb

    await db.runTransaction(async (tx) => {
      const conflictRef = db.collection(CONFLICTS_COLLECTION).doc(conflictId)
      const conflictSnap = await tx.get(conflictRef)

      if (!conflictSnap.exists) {
        throw new AppError('CONFLICT_NOT_FOUND', 'Conflicto no encontrado', 404)
      }

      conflictData = conflictSnap.data()!

      if (conflictData.resolvedAt != null) {
        throw new AppError(
          'ALREADY_RESOLVED',
          `Ya resuelto por ${conflictData.resolvedBy ?? 'desconocido'}`,
          409,
          false,
        )
      }

      paymentId = conflictData.paymentId as string
      const field = conflictData.field as string

      // Calcular ganador
      if (resolution === 'firestore') {
        winnerValue = conflictData.firestoreValue
      } else if (resolution === 'odoo') {
        winnerValue = conflictData.odooValue
      } else {
        // custom
        winnerValue = resolutionValue
      }

      // Validar tipo del ganador
      if (!validateWinnerType(field, winnerValue)) {
        throw new AppError(
          'INVALID_RESOLUTION_VALUE',
          `resolutionValue no matchea el tipo del campo "${field}"`,
          400,
          false,
        )
      }

      // Leer payment para el push posterior
      const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId)
      const paymentSnap = await tx.get(paymentRef)
      if (!paymentSnap.exists) {
        throw new AppError('PAYMENT_NOT_FOUND', 'Pago no encontrado', 404)
      }
      paymentData = paymentSnap.data()!

      // Actualizar lww en payment con estructura nested (NUNCA claves con punto)
      const lwwUpdate = {
        lww: {
          [field]: {
            value: winnerValue,
            writtenAt: FieldValue.serverTimestamp(),
            source: 'admin',
          },
        },
      }
      tx.set(paymentRef, lwwUpdate, { merge: true })

      // Marcar conflicto como resuelto
      tx.update(conflictRef, {
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: claims.uid,
        resolution,
        resolutionValue: winnerValue,
        resolutionNote: resolutionNote ?? null,
      })
    })

    // ----------------------------------------------------------------
    // Decidir si disparar push a Odoo (fuera de la transacción)
    // ----------------------------------------------------------------
    const field = conflictData!.field as string

    // 'memo' no tiene mapeo directo top-level en SyncedPaymentDoc — buildMemo()
    // reconstruye desde clientName+orderId. La resolución ya quedó persistida en
    // lww.memo; Paloma actualiza manualmente en Odoo cuando sea relevante.
    const canPushField = field !== 'memo'

    const shouldPush = canPushField && (() => {
      if (resolution === 'odoo' || resolution === 'custom') return true
      // firestore: push si firestoreWrittenAt >= odooWrittenAt o timestamps ausentes
      // (admin tomó decisión explícita — se empuja independientemente del timestamp)
      const fsMs = toEpochMs(conflictData!.firestoreWrittenAt)
      const odooMs = toEpochMs(conflictData!.odooWrittenAt)
      return fsMs === 0 || fsMs >= odooMs
    })()

    if (shouldPush) {
      // Construir snapshot fresco con el valor ganador mapeado al campo top-level
      // que usa syncVerifiedPaymentToOdoo. Mapeo: amount→amountCents, paymentDate→date.
      const FIELD_MAP: Record<string, string> = {
        amount: 'amountCents',
        paymentDate: 'date',
      }
      const mappedKey = FIELD_MAP[field] ?? field
      const freshPaymentData = { ...paymentData!, [mappedKey]: winnerValue }

      try {
          await syncVerifiedPaymentToOdoo(paymentId!, freshPaymentData)
        return NextResponse.json({ resolved: true, pushQueued: false })
      } catch {
        // Push falló — resolución sí persistió, push se reintentará
        await adminDb
          .collection(PAYMENTS_COLLECTION)
          .doc(paymentId!)
          .update({
            odooSyncStatus: 'error',
            odooLastError: 'Push falló después de resolución de conflicto',
            updatedAt: FieldValue.serverTimestamp(),
          })
        return NextResponse.json({ resolved: true, pushQueued: true })
      }
    }

    return NextResponse.json({ resolved: true, pushQueued: false })
  } catch (error) {
    return handleApiError(error)
  }
}
