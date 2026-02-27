import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { NotificationPreferencesSection } from './NotificationPreferencesSection'
import type { NotificationPreferences } from '@/types/user'
import type { UserRole } from '@/types/user'

// --- Mocks ---
// vi.hoisted() asegura que mockToastSuccess/Error sean resolvibles dentro del factory de vi.mock
const mockToastSuccess = vi.hoisted(() => vi.fn())
const mockToastError = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

// --- Datos de prueba ---

const DEFAULT_PREFS: NotificationPreferences = {
  categories: {
    payments: true,
    sales: true,
    reports: true,
    trips: true,
    alerts: true,
  },
  quietHours: {
    enabled: true,
    startTime: '23:00',
    endTime: '07:00',
  },
  channels: {
    push: true,
    whatsapp: true,
    email: false,
  },
  timezone: 'America/Mexico_City',
}

// --- Helpers ---

/**
 * Renderiza el componente y lo encapsula en un contenedor limpio.
 */
function renderSection(
  roles: UserRole[],
  defaultPreferences?: NotificationPreferences,
  uid = 'user-test-uid'
) {
  return render(
    <NotificationPreferencesSection
      uid={uid}
      roles={roles}
      defaultPreferences={defaultPreferences}
    />
  )
}

/**
 * Abre la seccion colapsable de notificaciones haciendo click en el CardHeader
 * (que tiene role="button" y aria-expanded).
 */
function openSection() {
  const trigger = screen.getByRole('button', { name: /notificaciones/i })
  fireEvent.click(trigger)
}

// --- Setup / Teardown ---

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

beforeEach(() => {
  // Mock global fetch — respuesta ok por defecto
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    })
  )
})

// =============================================================================
// Tests
// =============================================================================

describe('NotificationPreferencesSection', () => {
  // ---------------------------------------------------------------------------
  // 1. Categorias filtradas por rol: cliente
  // ---------------------------------------------------------------------------
  describe('categorias por rol: cliente', () => {
    it('muestra Pagos, Viajes y Alertas para el rol cliente', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      expect(screen.getByText('Pagos')).toBeInTheDocument()
      expect(screen.getByText('Viajes')).toBeInTheDocument()
      expect(screen.getByText('Alertas')).toBeInTheDocument()
    })

    it('NO muestra Nuevos Clientes ni Resumenes para el rol cliente', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      expect(screen.queryByText('Nuevos Clientes')).not.toBeInTheDocument()
      expect(screen.queryByText('Resumenes')).not.toBeInTheDocument()
    })

    it('muestra exactamente 3 categorias para el rol cliente', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      const allCategoryLabels = ['Pagos', 'Nuevos Clientes', 'Resumenes', 'Viajes', 'Alertas']
      const presentCount = allCategoryLabels.filter(
        (label) => screen.queryByText(label) !== null
      ).length
      expect(presentCount).toBe(3)
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Categorias filtradas por rol: agente
  // ---------------------------------------------------------------------------
  describe('categorias por rol: agente', () => {
    it('muestra Pagos, Nuevos Clientes, Resumenes y Alertas para el rol agente', () => {
      renderSection(['agente'], DEFAULT_PREFS)
      openSection()

      expect(screen.getAllByText('Pagos').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Nuevos Clientes').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Resumenes').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Alertas').length).toBeGreaterThanOrEqual(1)
    })

    it('NO muestra Viajes para el rol agente', () => {
      renderSection(['agente'], DEFAULT_PREFS)
      openSection()

      expect(screen.queryByText('Viajes')).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Todas las categorias para superadmin
  // ---------------------------------------------------------------------------
  describe('categorias por rol: superadmin', () => {
    it('muestra todas las categorias para el rol superadmin', () => {
      renderSection(['superadmin'], DEFAULT_PREFS)
      openSection()

      expect(screen.getAllByText('Pagos').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Nuevos Clientes').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Resumenes').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Viajes').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Alertas').length).toBeGreaterThanOrEqual(1)
    })

    it('muestra exactamente 5 categorias para el rol superadmin', () => {
      renderSection(['superadmin'], DEFAULT_PREFS)
      openSection()

      const allCategoryLabels = ['Pagos', 'Nuevos Clientes', 'Resumenes', 'Viajes', 'Alertas']
      const presentCount = allCategoryLabels.filter(
        (label) => screen.queryByText(label) !== null
      ).length
      expect(presentCount).toBe(5)
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Canales de notificacion
  // ---------------------------------------------------------------------------
  describe('toggles de canales', () => {
    it('muestra el label de Notificaciones push', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      expect(screen.getByText('Notificaciones push')).toBeInTheDocument()
    })

    it('muestra el label de WhatsApp', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      expect(screen.getByText('WhatsApp')).toBeInTheDocument()
    })

    it('muestra el label de Email', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      expect(screen.getByText('Email')).toBeInTheDocument()
    })

    it('el switch de push esta activado segun defaultPreferences (push: true)', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      const pushSwitch = screen.getByRole('switch', { name: /notificaciones push/i })
      expect(pushSwitch).toHaveAttribute('aria-checked', 'true')
    })

    it('el switch de email NO esta activado por defecto (email: false)', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      const emailSwitch = screen.getByRole('switch', { name: /^email$/i })
      expect(emailSwitch).toHaveAttribute('aria-checked', 'false')
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Horas de silencio
  // ---------------------------------------------------------------------------
  describe('horas de silencio', () => {
    it('muestra el heading de Horas de silencio', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      expect(screen.getByText('Horas de silencio')).toBeInTheDocument()
    })

    it('muestra el switch con id quiet-hours-enabled', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      const quietSwitch = document.getElementById('quiet-hours-enabled')
      expect(quietSwitch).not.toBeNull()
    })

    it('muestra los inputs de tiempo cuando horas de silencio esta habilitado', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      // DEFAULT_PREFS.quietHours.enabled = true → deben aparecer los inputs
      const startInput = document.getElementById('quiet-start') as HTMLInputElement | null
      const endInput = document.getElementById('quiet-end') as HTMLInputElement | null
      expect(startInput).not.toBeNull()
      expect(endInput).not.toBeNull()
      expect(startInput!.value).toBe('23:00')
      expect(endInput!.value).toBe('07:00')
    })

    it('oculta los inputs de tiempo cuando horas de silencio esta deshabilitado', () => {
      const prefs: NotificationPreferences = {
        ...DEFAULT_PREFS,
        quietHours: { enabled: false, startTime: '23:00', endTime: '07:00' },
      }
      renderSection(['cliente'], prefs)
      openSection()

      expect(document.getElementById('quiet-start')).toBeNull()
      expect(document.getElementById('quiet-end')).toBeNull()
    })

    it('alternar el switch de horas de silencio oculta los inputs de tiempo', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      // Inicialmente visible (enabled=true en DEFAULT_PREFS)
      expect(document.getElementById('quiet-start')).not.toBeNull()

      // Click en el switch para desactivar
      const quietSwitch = document.getElementById('quiet-hours-enabled')!
      fireEvent.click(quietSwitch)

      expect(document.getElementById('quiet-start')).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Selector de zona horaria
  // ---------------------------------------------------------------------------
  describe('selector de zona horaria', () => {
    it('muestra el label de Zona horaria', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      expect(screen.getByText('Zona horaria')).toBeInTheDocument()
    })

    it('muestra el select trigger con id timezone', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      const trigger = document.getElementById('timezone')
      expect(trigger).not.toBeNull()
    })

    it('muestra el label de la zona horaria seleccionada por defecto', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      // America/Mexico_City → etiqueta "Ciudad de Mexico (CST)"
      expect(screen.getByText('Ciudad de Mexico (CST)')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 7. Boton Guardar preferencias
  // ---------------------------------------------------------------------------
  describe('boton Guardar preferencias', () => {
    it('renderiza el boton Guardar preferencias', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      expect(
        screen.getByRole('button', { name: /guardar preferencias/i })
      ).toBeInTheDocument()
    })

    it('el boton Guardar no esta deshabilitado por defecto', () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      expect(
        screen.getByRole('button', { name: /guardar preferencias/i })
      ).not.toBeDisabled()
    })
  })

  // ---------------------------------------------------------------------------
  // 8. PATCH al endpoint al hacer click en Guardar
  // ---------------------------------------------------------------------------
  describe('llamada al endpoint PATCH', () => {
    it('llama a fetch con PATCH /api/users/{uid}/preferences al guardar', async () => {
      renderSection(['cliente'], DEFAULT_PREFS, 'uid-abc-123')
      openSection()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /guardar preferencias/i }))
      })

      await waitFor(() => {
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
      })

      const [url, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/users/uid-abc-123/preferences')
      expect(options.method).toBe('PATCH')
      expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' })
    })

    it('el body del PATCH contiene categories, quietHours, channels y timezone', async () => {
      renderSection(['cliente'], DEFAULT_PREFS, 'uid-abc-123')
      openSection()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /guardar preferencias/i }))
      })

      await waitFor(() => {
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
      })

      const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(options.body as string)
      expect(body).toHaveProperty('categories')
      expect(body).toHaveProperty('quietHours')
      expect(body).toHaveProperty('channels')
      expect(body).toHaveProperty('timezone')
    })

    it('el body de categories solo incluye las categorias del rol cliente', async () => {
      renderSection(['cliente'], DEFAULT_PREFS, 'uid-abc-123')
      openSection()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /guardar preferencias/i }))
      })

      await waitFor(() => {
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
      })

      const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(options.body as string)
      const categoryKeys = Object.keys(body.categories)

      // cliente: payments, trips, alerts — NO sales, reports
      expect(categoryKeys).toContain('payments')
      expect(categoryKeys).toContain('trips')
      expect(categoryKeys).toContain('alerts')
      expect(categoryKeys).not.toContain('sales')
      expect(categoryKeys).not.toContain('reports')
    })

    it('muestra el texto Guardando... y deshabilita el boton durante la peticion', async () => {
      let resolveFetch!: (value: unknown) => void
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveFetch = resolve
            })
        )
      )

      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /guardar preferencias/i }))
      })

      // Durante la peticion el boton debe mostrar "Guardando..." y estar deshabilitado
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /guardando.../i })).toBeDisabled()
      })

      // Resolver la peticion
      await act(async () => {
        resolveFetch({ ok: true, json: vi.fn().mockResolvedValue({}) })
      })

      // Tras resolver debe volver al estado normal
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /guardar preferencias/i })
        ).not.toBeDisabled()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // 9. Toast de exito / error despues de guardar
  // ---------------------------------------------------------------------------
  describe('toast despues de guardar', () => {
    it('muestra toast de exito cuando el PATCH responde ok', async () => {
      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /guardar preferencias/i }))
      })

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledTimes(1)
      })

      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Preferencias guardadas',
        expect.objectContaining({ duration: 4000 })
      )
    })

    it('muestra toast de error con mensaje del servidor cuando el PATCH falla', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          json: vi.fn().mockResolvedValue({ message: 'Error del servidor' }),
        })
      )

      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /guardar preferencias/i }))
      })

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledTimes(1)
      })

      expect(mockToastError).toHaveBeenCalledWith(
        'Error del servidor',
        expect.objectContaining({ duration: 0 })
      )
    })

    it('muestra toast de error generico cuando el PATCH falla sin mensaje', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          json: vi.fn().mockResolvedValue({}),
        })
      )

      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /guardar preferencias/i }))
      })

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledTimes(1)
      })

      expect(mockToastError).toHaveBeenCalledWith(
        'Error al guardar preferencias',
        expect.objectContaining({ duration: 0 })
      )
    })

    it('muestra toast de error cuando fetch lanza excepcion de red', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network failure'))
      )

      renderSection(['cliente'], DEFAULT_PREFS)
      openSection()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /guardar preferencias/i }))
      })

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledTimes(1)
      })

      expect(mockToastError).toHaveBeenCalledWith(
        'Network failure',
        expect.objectContaining({ duration: 0 })
      )
    })
  })

  // ---------------------------------------------------------------------------
  // 10. Sin defaultPreferences
  // ---------------------------------------------------------------------------
  describe('sin defaultPreferences', () => {
    it('renderiza sin errores cuando defaultPreferences es undefined', () => {
      renderSection(['cliente'])
      openSection()

      // Categorias del rol cliente con valores por defecto
      expect(screen.getByText('Pagos')).toBeInTheDocument()
      expect(screen.getByText('Viajes')).toBeInTheDocument()
      expect(screen.getByText('Alertas')).toBeInTheDocument()
    })

    it('el boton Guardar preferencias esta disponible sin preferencias previas', () => {
      renderSection(['cliente'])
      openSection()

      expect(
        screen.getByRole('button', { name: /guardar preferencias/i })
      ).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 11. Roles combinados
  // ---------------------------------------------------------------------------
  describe('categorias con roles multiples', () => {
    it('muestra la union de categorias para cliente + agente sin duplicados de switch', () => {
      // cliente: payments, trips, alerts
      // agente: payments, sales, reports, alerts
      // union deduplicada: payments, trips, alerts, sales, reports (5)
      renderSection(['cliente', 'agente'], DEFAULT_PREFS)
      openSection()

      expect(screen.getAllByText('Pagos').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Viajes').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Alertas').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Nuevos Clientes').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Resumenes').length).toBeGreaterThanOrEqual(1)
    })

    it('muestra exactamente 5 categorias para cliente + agente (union de ambos roles)', () => {
      renderSection(['cliente', 'agente'], DEFAULT_PREFS)
      openSection()

      const allCategoryLabels = ['Pagos', 'Nuevos Clientes', 'Resumenes', 'Viajes', 'Alertas']
      const presentCount = allCategoryLabels.filter(
        (label) => screen.queryByText(label) !== null
      ).length
      expect(presentCount).toBe(5)
    })
  })
})
