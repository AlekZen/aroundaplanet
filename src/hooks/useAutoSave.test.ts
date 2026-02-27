import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoSave } from './useAutoSave'

const mockToastSuccess = vi.hoisted(() => vi.fn())
const mockToastError = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

describe('useAutoSave', () => {
  beforeEach(() => {
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls fetch after debounce timeout', async () => {
    const { result } = renderHook(() =>
      useAutoSave({ endpoint: '/api/test', debounceMs: 50 })
    )

    await act(async () => {
      result.current.save({ key: 'value' })
      // Wait for debounce
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(fetch).toHaveBeenCalledWith('/api/test', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'value' }),
    })
  })

  it('shows success toast on successful save', async () => {
    const { result } = renderHook(() =>
      useAutoSave({ endpoint: '/api/test', debounceMs: 10 })
    )

    await act(async () => {
      result.current.save({ data: 'test' })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockToastSuccess).toHaveBeenCalledWith('Datos guardados', { duration: 4000 })
  })

  it('shows error toast on failed save', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Error de servidor' }),
      })
    )

    const { result } = renderHook(() =>
      useAutoSave({ endpoint: '/api/test', debounceMs: 10 })
    )

    await act(async () => {
      result.current.save({ data: 'test' })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockToastError).toHaveBeenCalledWith('Error de servidor', { duration: 0 })
  })

  it('debounces multiple rapid calls', async () => {
    const { result } = renderHook(() =>
      useAutoSave({ endpoint: '/api/test', debounceMs: 50 })
    )

    await act(async () => {
      result.current.save({ call: 1 })
      result.current.save({ call: 2 })
      result.current.save({ call: 3 })
      await new Promise((r) => setTimeout(r, 100))
    })

    // Only last call should have been sent
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        body: JSON.stringify({ call: 3 }),
      })
    )
  })

  it('calls onSuccess callback after successful save', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() =>
      useAutoSave({ endpoint: '/api/test', debounceMs: 10, onSuccess })
    )

    await act(async () => {
      result.current.save({ data: 'test' })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(onSuccess).toHaveBeenCalled()
  })

  it('calls onError callback on failed save', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Fallo' }),
      })
    )

    const onError = vi.fn()
    const { result } = renderHook(() =>
      useAutoSave({ endpoint: '/api/test', debounceMs: 10, onError })
    )

    await act(async () => {
      result.current.save({ data: 'test' })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(onError).toHaveBeenCalledWith('Fallo')
  })
})
