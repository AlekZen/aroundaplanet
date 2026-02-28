import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockTrackEvent } = vi.hoisted(() => ({
  mockTrackEvent: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: mockTrackEvent,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { toast } from 'sonner'
import { ConversionForm } from './ConversionForm'
import type { PublicDeparture } from '@/types/trip'

const FUTURE_DATE = '2027-06-15T00:00:00.000Z'
const FUTURE_END_DATE = '2027-07-15T00:00:00.000Z'

function makeDep(overrides: Partial<PublicDeparture> = {}): PublicDeparture {
  return {
    id: 'dep-1',
    odooName: 'Salida Junio',
    startDate: FUTURE_DATE,
    endDate: FUTURE_END_DATE,
    seatsMax: 20,
    seatsAvailable: 15,
    seatsUsed: 5,
    ...overrides,
  }
}

const DEFAULT_PROPS = {
  isOpen: true,
  onClose: vi.fn(),
  tripId: 'trip-1',
  tripName: 'Vuelta al Mundo',
  tripSlug: 'vuelta-al-mundo',
  tripPrice: 14500000,
  departures: [makeDep()],
  selectedDepartureId: null,
  isAuthenticated: false,
  attributionData: {},
}

const mockLocalStorage: Record<string, string> = {}

function mockSuccessResponse(guestToken: string | null = 'guest-token-123') {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      orderId: 'order-1',
      status: 'Interesado',
      tripId: 'trip-1',
      departureId: 'dep-1',
      amountTotalCents: 14500000,
      guestToken,
    }),
  })
}

function fillAndSubmit() {
  const nameInputs = screen.getAllByPlaceholderText('Tu nombre')
  fireEvent.change(nameInputs[0], { target: { value: 'Juan Perez' } })

  const phoneInputs = screen.getAllByPlaceholderText('Numero de telefono')
  fireEvent.change(phoneInputs[0], { target: { value: '3411234567' } })

  const buttons = screen.getAllByText('Confirmar Cotizacion')
  const enabledButton = buttons.find(
    (b) => !(b as HTMLButtonElement).disabled && !b.closest('button')?.disabled
  )
  if (enabledButton) fireEvent.click(enabledButton)
}

describe('ConversionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { mockLocalStorage[key] = val }),
      removeItem: vi.fn((key: string) => { delete mockLocalStorage[key] }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    for (const key of Object.keys(mockLocalStorage)) delete mockLocalStorage[key]
  })

  it('renders trip name and formatted price', () => {
    render(<ConversionForm {...DEFAULT_PROPS} />)
    const names = screen.getAllByText('Vuelta al Mundo')
    expect(names.length).toBeGreaterThanOrEqual(1)
    const prices = screen.getAllByText('$145,000')
    expect(prices.length).toBeGreaterThanOrEqual(1)
  })

  it('renders contact name field', () => {
    render(<ConversionForm {...DEFAULT_PROPS} />)
    const labels = screen.getAllByText('Nombre completo')
    expect(labels.length).toBeGreaterThanOrEqual(1)
  })

  it('renders phone field with country code selector', () => {
    render(<ConversionForm {...DEFAULT_PROPS} />)
    const labels = screen.getAllByText('WhatsApp / Telefono')
    expect(labels.length).toBeGreaterThanOrEqual(1)
    const codes = screen.getAllByText('MX +52')
    expect(codes.length).toBeGreaterThanOrEqual(1)
  })

  it('renders departure selector with available departures', () => {
    render(<ConversionForm {...DEFAULT_PROPS} />)
    const selectors = screen.getAllByText('Selecciona una fecha')
    expect(selectors.length).toBeGreaterThanOrEqual(1)
  })

  it('renders confirm button disabled when form is incomplete', () => {
    render(<ConversionForm {...DEFAULT_PROPS} />)
    const buttons = screen.getAllByText('Confirmar Cotizacion')
    expect(buttons.some((b) => (b as HTMLButtonElement).disabled || b.closest('button')?.disabled)).toBe(true)
  })

  it('renders empty state when no departures available', () => {
    render(<ConversionForm {...DEFAULT_PROPS} departures={[]} />)
    const msgs = screen.getAllByText(/Sin salidas disponibles/)
    expect(msgs.length).toBeGreaterThanOrEqual(1)
  })

  it('renders WhatsApp link in empty state', () => {
    render(<ConversionForm {...DEFAULT_PROPS} departures={[]} />)
    const links = screen.getAllByText('Contactar por WhatsApp')
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it('filters out sold-out departures', () => {
    const deps = [
      makeDep({ id: 'dep-sold', seatsAvailable: 0 }),
      makeDep({ id: 'dep-ok', seatsAvailable: 5 }),
    ]
    render(<ConversionForm {...DEFAULT_PROPS} departures={deps} />)
    expect(screen.queryByText(/Sin salidas disponibles/)).not.toBeInTheDocument()
  })

  it('strips non-digit characters from phone input', () => {
    render(<ConversionForm {...DEFAULT_PROPS} />)
    const phoneInputs = screen.getAllByPlaceholderText('Numero de telefono')
    const phoneInput = phoneInputs[0] as HTMLInputElement
    fireEvent.change(phoneInput, { target: { value: '341-123-4567' } })
    expect(phoneInput.value).toBe('3411234567')
  })

  it('shows inline error for short name on blur', () => {
    render(<ConversionForm {...DEFAULT_PROPS} />)
    const nameInputs = screen.getAllByPlaceholderText('Tu nombre')
    fireEvent.change(nameInputs[0], { target: { value: 'A' } })
    fireEvent.blur(nameInputs[0])

    const errors = screen.getAllByText('Minimo 2 caracteres')
    expect(errors.length).toBeGreaterThanOrEqual(1)
  })

  it('shows inline error for short phone on blur', () => {
    render(<ConversionForm {...DEFAULT_PROPS} />)
    const phoneInputs = screen.getAllByPlaceholderText('Numero de telefono')
    fireEvent.change(phoneInputs[0], { target: { value: '123' } })
    fireEvent.blur(phoneInputs[0])

    const errors = screen.getAllByText(/Minimo \d+ digitos/)
    expect(errors.length).toBeGreaterThanOrEqual(1)
  })

  it('submits order with contact data and shows success toast', async () => {
    const mockFetch = mockSuccessResponse()
    vi.stubGlobal('fetch', mockFetch)

    render(
      <ConversionForm
        {...DEFAULT_PROPS}
        selectedDepartureId="dep-1"
      />
    )

    fillAndSubmit()

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/orders', expect.objectContaining({
        method: 'POST',
      }))
    })

    // Verify contact data sent
    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(callBody.contactName).toBe('Juan Perez')
    expect(callBody.contactPhone).toBe('+523411234567')

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Tu cotizacion fue registrada')
    })
  })

  it('shows success screen after submit instead of closing', async () => {
    const mockFetch = mockSuccessResponse()
    vi.stubGlobal('fetch', mockFetch)
    const onClose = vi.fn()

    render(
      <ConversionForm
        {...DEFAULT_PROPS}
        onClose={onClose}
        selectedDepartureId="dep-1"
      />
    )

    fillAndSubmit()

    await waitFor(() => {
      const successMsgs = screen.getAllByText('Tu cotizacion fue registrada')
      expect(successMsgs.length).toBeGreaterThanOrEqual(1)
    })

    // Should NOT call onClose — shows success screen instead
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows create account CTA on success for unauthenticated users', async () => {
    const mockFetch = mockSuccessResponse()
    vi.stubGlobal('fetch', mockFetch)

    render(
      <ConversionForm
        {...DEFAULT_PROPS}
        isAuthenticated={false}
        selectedDepartureId="dep-1"
      />
    )

    fillAndSubmit()

    await waitFor(() => {
      const ctaTexts = screen.getAllByText('Crear cuenta para dar seguimiento')
      expect(ctaTexts.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('hides create account CTA on success for authenticated users', async () => {
    const mockFetch = mockSuccessResponse(null)
    vi.stubGlobal('fetch', mockFetch)

    render(
      <ConversionForm
        {...DEFAULT_PROPS}
        isAuthenticated={true}
        selectedDepartureId="dep-1"
      />
    )

    fillAndSubmit()

    await waitFor(() => {
      const successMsgs = screen.getAllByText('Tu cotizacion fue registrada')
      expect(successMsgs.length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.queryByText('Crear cuenta para dar seguimiento')).not.toBeInTheDocument()
  })

  it('shows WhatsApp CTA on success screen', async () => {
    const mockFetch = mockSuccessResponse()
    vi.stubGlobal('fetch', mockFetch)

    render(
      <ConversionForm
        {...DEFAULT_PROPS}
        selectedDepartureId="dep-1"
      />
    )

    fillAndSubmit()

    await waitFor(() => {
      const whatsappLinks = screen.getAllByText('Contactar por WhatsApp')
      expect(whatsappLinks.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('saves guestToken to localStorage on guest submit', async () => {
    const mockFetch = mockSuccessResponse('guest-uuid-abc')
    vi.stubGlobal('fetch', mockFetch)

    render(
      <ConversionForm
        {...DEFAULT_PROPS}
        isAuthenticated={false}
        selectedDepartureId="dep-1"
      />
    )

    fillAndSubmit()

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('guestOrderToken', 'guest-uuid-abc')
    })
  })

  it('does not save guestToken for authenticated user submit', async () => {
    const mockFetch = mockSuccessResponse(null)
    vi.stubGlobal('fetch', mockFetch)

    render(
      <ConversionForm
        {...DEFAULT_PROPS}
        isAuthenticated={true}
        selectedDepartureId="dep-1"
      />
    )

    fillAndSubmit()

    await waitFor(() => {
      const successMsgs = screen.getAllByText('Tu cotizacion fue registrada')
      expect(successMsgs.length).toBeGreaterThanOrEqual(1)
    })

    expect(localStorage.setItem).not.toHaveBeenCalledWith('guestOrderToken', expect.anything())
  })

  it('fires generate_lead analytics event on success', async () => {
    const mockFetch = mockSuccessResponse()
    vi.stubGlobal('fetch', mockFetch)

    render(
      <ConversionForm
        {...DEFAULT_PROPS}
        selectedDepartureId="dep-1"
        attributionData={{ agentId: 'agent-007', utmSource: 'google' }}
      />
    )

    const nameInputs = screen.getAllByPlaceholderText('Tu nombre')
    fireEvent.change(nameInputs[0], { target: { value: 'Maria Lopez' } })
    const phoneInputs = screen.getAllByPlaceholderText('Numero de telefono')
    fireEvent.change(phoneInputs[0], { target: { value: '5512345678' } })

    const buttons = screen.getAllByText('Confirmar Cotizacion')
    const enabledButton = buttons.find(
      (b) => !(b as HTMLButtonElement).disabled && !b.closest('button')?.disabled
    )
    if (enabledButton) fireEvent.click(enabledButton)

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('generate_lead', expect.objectContaining({
        trip_id: 'trip-1',
        agent_id: 'agent-007',
        utm_source: 'google',
      }))
    })
  })

  it('shows error toast on API failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Esta salida esta agotada' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <ConversionForm
        {...DEFAULT_PROPS}
        selectedDepartureId="dep-1"
      />
    )

    fillAndSubmit()

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Esta salida esta agotada',
        expect.objectContaining({ duration: Infinity })
      )
    })
  })

  it('shows loading state while submitting', async () => {
    let resolveResponse: (value: unknown) => void
    const mockFetch = vi.fn().mockReturnValue(
      new Promise((resolve) => { resolveResponse = resolve })
    )
    vi.stubGlobal('fetch', mockFetch)

    render(
      <ConversionForm
        {...DEFAULT_PROPS}
        selectedDepartureId="dep-1"
      />
    )

    fillAndSubmit()

    await waitFor(() => {
      const loadingTexts = screen.getAllByText('Procesando...')
      expect(loadingTexts.length).toBeGreaterThanOrEqual(1)
    })

    // Cleanup
    resolveResponse!({
      ok: true,
      json: async () => ({ orderId: 'x', status: 'Interesado', tripId: 'trip-1', departureId: 'dep-1', amountTotalCents: 0, guestToken: null }),
    })
  })

  it('renders T&C and privacy links in legal text', () => {
    render(<ConversionForm {...DEFAULT_PROPS} />)
    const tcLinks = screen.getAllByText('Terminos y Condiciones')
    expect(tcLinks.length).toBeGreaterThanOrEqual(1)
    const privacyLinks = screen.getAllByText('Aviso de Privacidad')
    expect(privacyLinks.length).toBeGreaterThanOrEqual(1)
  })
})
