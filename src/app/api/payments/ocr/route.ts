import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/handleApiError'
import { AppError } from '@/lib/errors/AppError'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
const MODEL_NAME = 'gemini-2.5-flash'

const OCR_PROMPT = `Analiza esta imagen de un comprobante de pago mexicano.
Puede ser una transferencia bancaria, deposito, recibo escrito a mano, voucher de terminal, o captura de pantalla de app bancaria.

Extrae los siguientes datos y responde SOLAMENTE con un JSON valido (sin markdown, sin backticks):

{
  "amountCents": <monto en centavos como entero, ej: 1450000 para $14,500.00>,
  "date": "<fecha del pago en formato YYYY-MM-DD>",
  "bankReference": "<numero de referencia, folio, o numero de operacion>",
  "bankName": "<nombre del banco: BBVA, Banorte, Santander, HSBC, Scotiabank, BanCoppel, Azteca, etc>",
  "beneficiaryName": "<nombre del beneficiario si es visible>",
  "concept": "<concepto o descripcion del pago, ej: 'Ceci Junio Chiapas'>",
  "sourceAccount": "<ultimos 4 digitos de la cuenta de origen, ej: '5250'>",
  "destinationAccount": "<ultimos 4 digitos de la cuenta de destino, ej: '3005'>",
  "paymentMethod": "<transfer | card | cash | deposit>",
  "confidence": <numero entre 0 y 100 indicando tu confianza en la extraccion>
}

Reglas para paymentMethod:
- "transfer": transferencia electronica, SPEI, transferencia interbancaria, pago desde app bancaria
- "card": voucher de terminal punto de venta, pago con tarjeta de credito/debito
- "cash": recibo escrito a mano, nota de pago en efectivo, ticket de caja
- "deposit": ficha de deposito bancario, deposito en ventanilla, deposito en cajero

Reglas generales:
- Si un campo no es visible o legible, usa null
- El monto SIEMPRE en centavos (multiplicar por 100)
- La fecha en formato ISO YYYY-MM-DD
- confidence: 90-100 si todo es claro, 70-89 si algunos campos son borrosos, <70 si la imagen es mala
- NO incluyas explicaciones, SOLO el JSON`

/**
 * POST /api/payments/ocr — Analyze payment receipt image with Gemini
 * Accepts: multipart/form-data with 'file' field
 * Returns: extracted payment data
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    if (!GEMINI_API_KEY) {
      throw new AppError('CONFIG_ERROR', 'API key de Gemini no configurada', 500)
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      throw new AppError('VALIDATION_ERROR', 'Archivo de imagen requerido', 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new AppError('VALIDATION_ERROR', 'La imagen no puede pesar mas de 10MB', 400)
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new AppError('VALIDATION_ERROR', 'Formato no soportado. Usa JPG, PNG o WebP', 400)
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')

    // Call Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: MODEL_NAME })

    const result = await model.generateContent([
      OCR_PROMPT,
      {
        inlineData: {
          mimeType: file.type,
          data: base64Data,
        },
      },
    ])

    const responseText = result.response.text().trim()

    // Parse JSON response — Gemini sometimes wraps in ```json
    let cleanJson = responseText
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleanJson)
    } catch {
      throw new AppError('OCR_PARSE_ERROR', 'No se pudo interpretar el comprobante. Intenta con una foto mas clara', 422)
    }

    // Validate and normalize
    const VALID_METHODS = ['transfer', 'card', 'cash', 'deposit']
    const ocrResult = {
      amountCents: typeof parsed.amountCents === 'number' ? Math.round(parsed.amountCents) : null,
      date: typeof parsed.date === 'string' ? parsed.date : null,
      bankReference: typeof parsed.bankReference === 'string' ? parsed.bankReference : null,
      bankName: typeof parsed.bankName === 'string' ? parsed.bankName : null,
      beneficiaryName: typeof parsed.beneficiaryName === 'string' ? parsed.beneficiaryName : null,
      concept: typeof parsed.concept === 'string' ? parsed.concept : null,
      sourceAccount: typeof parsed.sourceAccount === 'string' ? parsed.sourceAccount.replace(/[^0-9]/g, '') : null,
      destinationAccount: typeof parsed.destinationAccount === 'string' ? parsed.destinationAccount.replace(/[^0-9]/g, '') : null,
      paymentMethod: typeof parsed.paymentMethod === 'string' && VALID_METHODS.includes(parsed.paymentMethod)
        ? parsed.paymentMethod
        : null,
      confidence: typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, parsed.confidence)) : 0,
    }

    return NextResponse.json(ocrResult)
  } catch (error) {
    return handleApiError(error)
  }
}
