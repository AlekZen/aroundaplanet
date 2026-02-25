import { render, screen, cleanup, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { OfflineBanner } from './OfflineBanner'

vi.mock('framer-motion', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: (v: any) => v }))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('OfflineBanner', () => {
  it('shows offline alert when offline', () => {
    render(<OfflineBanner isOffline={true} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Sin conexion a internet')).toBeInTheDocument()
  })

  it('offline state has role="alert"', () => {
    render(<OfflineBanner isOffline={true} />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
  })

  it('shows reconnecting status when isReconnecting', () => {
    render(<OfflineBanner isOffline={true} isReconnecting={true} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Reconectando...')).toBeInTheDocument()
  })

  it('isReconnecting=true does NOT show the offline "alert" role', () => {
    render(<OfflineBanner isOffline={true} isReconnecting={true} />)
    // El estado reconectando usa role="status", no role="alert"
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('hides banner when online and not reconnecting', () => {
    render(<OfflineBanner isOffline={false} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('lastSyncTimestamp renders time ago text in minutes', () => {
    // Simular que el ultimo sync fue hace 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    render(<OfflineBanner isOffline={true} lastSyncTimestamp={fiveMinutesAgo} />)
    expect(screen.getByText(/5min/)).toBeInTheDocument()
  })

  it('lastSyncTimestamp renders time ago text in hours', () => {
    // Simular que el ultimo sync fue hace 2 horas
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    render(<OfflineBanner isOffline={true} lastSyncTimestamp={twoHoursAgo} />)
    expect(screen.getByText(/2h/)).toBeInTheDocument()
  })

  it('does NOT render lastSyncTimestamp text when not provided', () => {
    render(<OfflineBanner isOffline={true} />)
    // Solo debe tener el texto principal, sin texto de tiempo
    expect(screen.queryByText(/min|h$/)).not.toBeInTheDocument()
  })

  it('online-restored state shows success message after transition from offline', async () => {
    const { rerender } = render(<OfflineBanner isOffline={true} />)
    // Simular que vuelve online
    rerender(<OfflineBanner isOffline={false} />)
    // El setTimeout del showTimer se ejecuta con delay 0 — avanzar timers
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(screen.getByText('Conexion restaurada')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('restored banner disappears after 3 seconds', async () => {
    const { rerender } = render(<OfflineBanner isOffline={true} />)
    rerender(<OfflineBanner isOffline={false} />)
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    // Banner de exito debe estar visible
    expect(screen.getByText('Conexion restaurada')).toBeInTheDocument()
    // Avanzar 3 segundos para que se oculte
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByText('Conexion restaurada')).not.toBeInTheDocument()
  })

  it('applies custom className to the offline alert', () => {
    render(<OfflineBanner isOffline={true} className="custom-banner" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('custom-banner')
  })

  it('applies custom className to the reconnecting alert', () => {
    render(<OfflineBanner isOffline={true} isReconnecting={true} className="custom-banner" />)
    const statusEl = screen.getByRole('status')
    expect(statusEl).toHaveClass('custom-banner')
  })
})
