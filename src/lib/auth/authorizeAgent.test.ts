import { describe, it, expect } from 'vitest'
import { AppError } from '@/lib/errors/AppError'
import { authorizeAgent } from './authorizeAgent'

describe('authorizeAgent', () => {
  it('permite acceso cuando el agentId del llamador coincide con el solicitado', () => {
    expect(() => authorizeAgent('agent-123', ['cliente', 'agente'], 'agent-123')).not.toThrow()
  })

  it('permite acceso a un usuario con rol admin independientemente del agentId', () => {
    expect(() => authorizeAgent(undefined, ['cliente', 'admin'], 'agent-456')).not.toThrow()
  })

  it('permite acceso a un usuario con rol director independientemente del agentId', () => {
    expect(() => authorizeAgent('agent-otro', ['cliente', 'director'], 'agent-999')).not.toThrow()
  })

  it('permite acceso a un usuario con rol superadmin independientemente del agentId', () => {
    expect(() => authorizeAgent(undefined, ['superadmin'], 'cualquier-agente')).not.toThrow()
  })

  it('lanza AGENT_ISOLATION_VIOLATION cuando el agentId no coincide y no tiene rol de override', () => {
    try {
      authorizeAgent('agent-123', ['cliente', 'agente'], 'agent-456')
      expect.fail('Debe lanzar error')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      const appErr = err as AppError
      expect(appErr.code).toBe('AGENT_ISOLATION_VIOLATION')
      expect(appErr.status).toBe(403)
      expect(appErr.retryable).toBe(false)
      expect(appErr.message).toBe('No tienes acceso a datos de otro agente')
    }
  })

  it('lanza AGENT_ISOLATION_VIOLATION cuando callerAgentId es undefined y el rol es solo agente', () => {
    try {
      authorizeAgent(undefined, ['cliente', 'agente'], 'agent-123')
      expect.fail('Debe lanzar error')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      const appErr = err as AppError
      expect(appErr.code).toBe('AGENT_ISOLATION_VIOLATION')
      expect(appErr.status).toBe(403)
    }
  })

  it('permite acceso cuando tiene multiples roles incluyendo uno de override', () => {
    expect(() =>
      authorizeAgent('agent-123', ['cliente', 'agente', 'director'], 'agent-999')
    ).not.toThrow()
  })
})
