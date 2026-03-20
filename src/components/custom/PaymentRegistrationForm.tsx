'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, CheckCircle2, Upload, Sparkles, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '@/schemas/paymentSchema'

interface OrderOption {
  id: string
  tripName: string
  amountTotalCents: number
  contactName: string
}

interface PaymentRegistrationFormProps {
  isOpen: boolean
  onClose: () => void
  orders: OrderOption[]
  preselectedOrderId?: string | null
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function FormContent({
  orders,
  preselectedOrderId,
  onSuccess,
}: {
  orders: OrderOption[]
  preselectedOrderId?: string | null
  onSuccess: () => void
}) {
  const [orderId, setOrderId] = useState(preselectedOrderId ?? '')
  const [amountStr, setAmountStr] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)
  const [ocrBankName, setOcrBankName] = useState<string | null>(null)
  const [ocrBankRef, setOcrBankRef] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const amountCents = Math.round(parseFloat(amountStr || '0') * 100)
  const isValid = !!orderId && amountCents > 0 && !!paymentMethod && !!date

  const selectedOrder = orders.find((o) => o.id === orderId)

  async function handleSubmit() {
    setTouched(true)
    if (!isValid) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amountCents,
          paymentMethod,
          date,
          receiptUrl: receiptUrl ?? undefined,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.message ?? 'Error al registrar el pago')
      }

      toast.success('Pago registrado — pendiente de verificacion')
      onSuccess()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No pudimos registrar el pago'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Order selector */}
      <div className="space-y-1">
        <label htmlFor="order-select" className="text-sm font-medium">Orden / Viaje</label>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tienes ordenes activas</p>
        ) : (
          <Select value={orderId} onValueChange={setOrderId}>
            <SelectTrigger id="order-select" aria-label="Seleccionar orden">
              <SelectValue placeholder="Selecciona una orden" />
            </SelectTrigger>
            <SelectContent>
              {orders.map((order) => (
                <SelectItem key={order.id} value={order.id}>
                  {order.tripName} — {order.contactName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedOrder && (
          <p className="text-xs text-muted-foreground">
            Total de la orden: {formatCurrency(selectedOrder.amountTotalCents)}
          </p>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-1">
        <label htmlFor="payment-amount" className="text-sm font-medium">Monto (MXN)</label>
        <Input
          id="payment-amount"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amountStr}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmountStr(e.target.value)}
          min={1}
          step="0.01"
          aria-invalid={touched && amountCents <= 0}
        />
        {touched && amountCents <= 0 && (
          <p className="text-xs text-destructive">El monto debe ser mayor a 0</p>
        )}
      </div>

      {/* Payment method */}
      <div className="space-y-1">
        <label htmlFor="payment-method" className="text-sm font-medium">Metodo de pago</label>
        <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
          <SelectTrigger id="payment-method" aria-label="Metodo de pago">
            <SelectValue placeholder="Selecciona metodo" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((method) => (
              <SelectItem key={method} value={method}>
                {PAYMENT_METHOD_LABELS[method]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {touched && !paymentMethod && (
          <p className="text-xs text-destructive">Selecciona un metodo de pago</p>
        )}
      </div>

      {/* Date */}
      <div className="space-y-1">
        <label htmlFor="payment-date" className="text-sm font-medium">Fecha del pago</label>
        <Input
          id="payment-date"
          type="date"
          value={date}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
        />
      </div>

      {/* Receipt upload + OCR */}
      <div className="space-y-2">
        <label htmlFor="receipt-upload" className="text-sm font-medium">
          Comprobante
        </label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={isAnalyzing}
            onClick={() => document.getElementById('receipt-upload')?.click()}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Analizando...
              </>
            ) : (
              <>
                <Upload className="mr-1.5 h-4 w-4" />
                {receiptFile ? 'Cambiar foto' : 'Subir comprobante'}
              </>
            )}
          </Button>
          {receiptFile && !isAnalyzing && (
            <span className="truncate text-xs text-muted-foreground">{receiptFile.name}</span>
          )}
        </div>
        <input
          id="receipt-upload"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0] ?? null
            setReceiptFile(file)
            if (!file) return

            setIsAnalyzing(true)
            setOcrConfidence(null)
            setOcrBankName(null)
            setOcrBankRef(null)
            setReceiptUrl(null)

            try {
              // Upload to Storage + OCR in parallel
              const uploadForm = new FormData()
              uploadForm.append('file', file)
              uploadForm.append('orderId', orderId || 'pending')

              const ocrForm = new FormData()
              ocrForm.append('file', file)

              const [uploadRes, ocrRes] = await Promise.all([
                fetch('/api/payments/upload', { method: 'POST', body: uploadForm }),
                fetch('/api/payments/ocr', { method: 'POST', body: ocrForm }),
              ])

              // Handle upload result
              if (uploadRes.ok) {
                const uploadData = await uploadRes.json()
                setReceiptUrl(uploadData.receiptUrl ?? null)
              }

              // Handle OCR result
              if (ocrRes.ok) {
                const ocr = await ocrRes.json()
                if (ocr.amountCents && ocr.amountCents > 0) {
                  setAmountStr((ocr.amountCents / 100).toFixed(2))
                }
                if (ocr.date) setDate(ocr.date)
                if (ocr.confidence) setOcrConfidence(ocr.confidence)
                if (ocr.bankName) setOcrBankName(ocr.bankName)
                if (ocr.bankReference) setOcrBankRef(ocr.bankReference)
                const bankInfo = [
                  ocr.bankName ? `Banco: ${ocr.bankName}` : null,
                  ocr.bankReference ? `Ref: ${ocr.bankReference}` : null,
                  ocr.beneficiaryName ? `Beneficiario: ${ocr.beneficiaryName}` : null,
                ].filter(Boolean).join(' | ')
                if (bankInfo && !notes) setNotes(bankInfo)
                toast.success('Comprobante subido y datos extraidos')
              } else {
                toast.success('Comprobante subido — llena los datos manualmente')
              }
            } catch {
              toast.error('Error al procesar el comprobante')
            } finally {
              setIsAnalyzing(false)
            }
          }}
        />
        {/* OCR confidence indicator */}
        {ocrConfidence !== null && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>
              IA extrajo los datos
              {ocrConfidence >= 90 ? (
                <Badge className="ml-1.5 bg-green-100 text-green-800 text-[10px]">Alta confianza</Badge>
              ) : ocrConfidence >= 70 ? (
                <Badge className="ml-1.5 bg-yellow-100 text-yellow-800 text-[10px]">Verificar datos</Badge>
              ) : (
                <Badge className="ml-1.5 bg-red-100 text-red-800 text-[10px]">Baja confianza</Badge>
              )}
            </span>
            {ocrBankName && <span className="text-muted-foreground">— {ocrBankName}</span>}
            {ocrBankRef && <span className="font-mono text-muted-foreground">{ocrBankRef}</span>}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label htmlFor="payment-notes" className="text-sm font-medium">
          Notas <span className="text-muted-foreground">(opcional)</span>
        </label>
        <Textarea
          id="payment-notes"
          placeholder="Informacion adicional del pago..."
          value={notes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
        />
      </div>

      {/* Submit */}
      <Button
        className="h-12 w-full text-base font-semibold"
        disabled={isSubmitting || (touched && !isValid)}
        onClick={handleSubmit}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Registrando...
          </>
        ) : (
          'Registrar Pago'
        )}
      </Button>
    </div>
  )
}

function SuccessContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Pago registrado</h3>
        <p className="text-sm text-muted-foreground">
          El equipo de administracion verificara el comprobante y actualizara el estado.
        </p>
      </div>
      <Button variant="outline" className="w-full" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  )
}

export function PaymentRegistrationForm({
  isOpen,
  onClose,
  orders,
  preselectedOrderId,
}: PaymentRegistrationFormProps) {
  const [formStep, setFormStep] = useState<'form' | 'success'>('form')

  function handleClose() {
    setFormStep('form')
    onClose()
  }

  function handleSuccess() {
    setFormStep('success')
  }

  const content = formStep === 'success' ? (
    <SuccessContent onClose={handleClose} />
  ) : (
    <FormContent
      orders={orders}
      preselectedOrderId={preselectedOrderId}
      onSuccess={handleSuccess}
    />
  )

  return (
    <>
      {/* Mobile: Sheet (bottom) */}
      <div className="lg:hidden">
        <Sheet open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl pb-8">
            <SheetHeader className="pb-4 text-left">
              <SheetTitle>Registrar Pago</SheetTitle>
              <SheetDescription>
                Registra un pago para que el admin lo verifique
              </SheetDescription>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Dialog (centered) */}
      <div className="hidden lg:block">
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Pago</DialogTitle>
              <DialogDescription>
                Registra un pago para que el admin lo verifique
              </DialogDescription>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
