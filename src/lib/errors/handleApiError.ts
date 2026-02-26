import { NextResponse } from 'next/server'
import { AppError } from './AppError'

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { code: error.code, message: error.message, retryable: error.retryable },
      { status: error.status }
    )
  }

  console.error('Unhandled API error:', error)
  return NextResponse.json(
    { code: 'INTERNAL_ERROR', message: 'Error interno del servidor', retryable: true },
    { status: 500 }
  )
}
