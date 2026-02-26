import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from './AppError'
import { handleApiError } from './handleApiError'

describe('AppError', () => {
  describe('constructor', () => {
    it('sets code, message, status y retryable correctamente', () => {
      const err = new AppError('NOT_FOUND', 'Recurso no encontrado', 404, true)

      expect(err.code).toBe('NOT_FOUND')
      expect(err.message).toBe('Recurso no encontrado')
      expect(err.status).toBe(404)
      expect(err.retryable).toBe(true)
    })

    it('usa status=500 y retryable=false por defecto', () => {
      const err = new AppError('SOME_CODE', 'Algo fallo')

      expect(err.status).toBe(500)
      expect(err.retryable).toBe(false)
    })

    it('extiende Error con name="AppError"', () => {
      const err = new AppError('TEST_CODE', 'mensaje de prueba')

      expect(err).toBeInstanceOf(Error)
      expect(err.name).toBe('AppError')
    })

    it('instanceof AppError funciona correctamente', () => {
      const err = new AppError('TEST', 'test')

      expect(err instanceof AppError).toBe(true)
      expect(err instanceof Error).toBe(true)
    })
  })
})

describe('handleApiError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('formatea AppError correctamente en NextResponse', async () => {
    const err = new AppError('AUTH_REQUIRED', 'Sesion requerida', 401, false)

    const response = handleApiError(err)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({
      code: 'AUTH_REQUIRED',
      message: 'Sesion requerida',
      retryable: false,
    })
  })

  it('formatea AppError con retryable=true correctamente', async () => {
    const err = new AppError('SERVICE_UNAVAILABLE', 'Servicio no disponible', 503, true)

    const response = handleApiError(err)
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Servicio no disponible',
      retryable: true,
    })
  })

  it('maneja errores desconocidos como INTERNAL_ERROR con status 500', async () => {
    const err = new Error('Fallo inesperado del sistema')

    const response = handleApiError(err)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
      retryable: true,
    })
  })

  it('llama console.error para errores desconocidos', () => {
    const err = new Error('Error no manejado')

    handleApiError(err)

    expect(console.error).toHaveBeenCalledWith('Unhandled API error:', err)
  })

  it('no llama console.error para AppError', () => {
    const err = new AppError('KNOWN_ERROR', 'Error conocido', 400, false)

    handleApiError(err)

    expect(console.error).not.toHaveBeenCalled()
  })

  it('maneja valores primitivos como error desconocido', async () => {
    const response = handleApiError('string error')
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.code).toBe('INTERNAL_ERROR')
  })
})
