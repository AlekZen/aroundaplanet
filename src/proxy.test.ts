import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from './proxy'

function createMockRequest(pathname: string, cookies: Record<string, string> = {}): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000')
  const request = new NextRequest(url)
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value)
  }
  return request
}

describe('proxy', () => {
  describe('rutas publicas — pasan sin autenticacion', () => {
    it('permite paso en ruta publica exacta /', () => {
      const request = createMockRequest('/')
      const response = proxy(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })

    it('permite paso en ruta publica exacta /viajes', () => {
      const request = createMockRequest('/viajes')
      const response = proxy(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })

    it('permite paso en ruta con prefijo /viajes/ (match por prefijo)', () => {
      const request = createMockRequest('/viajes/vuelta-al-mundo')
      const response = proxy(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })

    it('permite paso en ruta publica exacta /sobre-nosotros', () => {
      const request = createMockRequest('/sobre-nosotros')
      const response = proxy(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })
  })

  describe('rutas de autenticacion — pasan sin cookie', () => {
    it('permite paso en /login sin cookie de sesion', () => {
      const request = createMockRequest('/login')
      const response = proxy(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })

    it('permite paso en /register sin cookie de sesion', () => {
      const request = createMockRequest('/register')
      const response = proxy(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })

    it('permite paso en /forgot-password sin cookie de sesion', () => {
      const request = createMockRequest('/forgot-password')
      const response = proxy(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })
  })

  describe('rutas protegidas sin cookie — redirigen a /login', () => {
    it('redirige /dashboard a /login sin returnUrl (es la ruta fallback)', () => {
      const request = createMockRequest('/dashboard')
      const response = proxy(request)
      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).not.toBeNull()
      const redirectUrl = new URL(location!)
      expect(redirectUrl.pathname).toBe('/login')
      expect(redirectUrl.searchParams.has('returnUrl')).toBe(false)
    })

    it('redirige /admin/verification a /login?returnUrl=%2Fadmin%2Fverification', () => {
      const request = createMockRequest('/admin/verification')
      const response = proxy(request)
      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).not.toBeNull()
      const redirectUrl = new URL(location!)
      expect(redirectUrl.pathname).toBe('/login')
      expect(redirectUrl.searchParams.get('returnUrl')).toBe('/admin/verification')
    })
  })

  describe('rutas protegidas con cookie valida — pasan sin redireccion', () => {
    it('permite paso en /dashboard cuando existe cookie __session', () => {
      const request = createMockRequest('/dashboard', { __session: 'valid-session-token' })
      const response = proxy(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })
  })
})
