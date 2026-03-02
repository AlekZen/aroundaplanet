import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock firebase/analytics to avoid actual Firebase initialization
vi.mock('firebase/analytics', () => ({
  isSupported: vi.fn().mockResolvedValue(false),
  getAnalytics: vi.fn(),
  logEvent: vi.fn(),
}))

vi.mock('@/lib/firebase/client', () => ({
  firebaseApp: {},
}))

import { trackEvent, trackPageView, captureAttribution, writeServerEvent } from './analytics'

describe('analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    // Mock window analytics globals
    window.gtag = vi.fn()
    window.fbq = vi.fn()
    window.dataLayer = []
    // Clear sessionStorage
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.gtag
    delete window.fbq
    delete window.dataLayer
  })

  describe('trackEvent', () => {
    it('dispatches to gtag, fbq, and dataLayer', () => {
      trackEvent('view_item', { item_id: 'trip-1' })

      expect(window.gtag).toHaveBeenCalledWith('event', 'view_item', { item_id: 'trip-1' })
      // view_item maps to ViewContent for Meta Pixel
      expect(window.fbq).toHaveBeenCalledWith('track', 'ViewContent', { item_id: 'trip-1' })
      expect(window.dataLayer).toEqual([{ event: 'view_item', item_id: 'trip-1' }])
    })

    it('uses trackCustom for unmapped Meta Pixel events', () => {
      trackEvent('agent_copy_link', { agent_id: 'lupita' })

      expect(window.fbq).toHaveBeenCalledWith('trackCustom', 'agent_copy_link', { agent_id: 'lupita' })
    })

    it('fires writeServerEvent for Firestore persistence', () => {
      trackEvent('begin_checkout', { item_id: 'trip-1' })

      expect(fetch).toHaveBeenCalledWith('/api/analytics/events', expect.objectContaining({
        method: 'POST',
        keepalive: true,
      }))
    })

    it('maps sign_up to CompleteRegistration for Meta Pixel', () => {
      trackEvent('sign_up', { method: 'google' })

      expect(window.fbq).toHaveBeenCalledWith('track', 'CompleteRegistration', { method: 'google' })
    })

    it('sign_up fires writeServerEvent with method metadata', () => {
      trackEvent('sign_up', { method: 'email' })

      const call = vi.mocked(fetch).mock.calls.find(c => c[0] === '/api/analytics/events')
      expect(call).toBeDefined()
      const body = JSON.parse(call![1]?.body as string)
      expect(body.type).toBe('sign_up')
      expect(body.metadata.method).toBe('email')
    })
  })

  describe('trackPageView', () => {
    it('dispatches page_view to gtag and fbq', () => {
      trackPageView('/viajes')

      expect(window.gtag).toHaveBeenCalledWith('event', 'page_view', { page_path: '/viajes' })
      expect(window.fbq).toHaveBeenCalledWith('track', 'PageView')
    })

    it('fires writeServerEvent', () => {
      trackPageView('/viajes/vuelta-al-mundo')

      expect(fetch).toHaveBeenCalledWith('/api/analytics/events', expect.objectContaining({
        method: 'POST',
      }))
    })
  })

  describe('captureAttribution', () => {
    it('stores UTM params and ref in sessionStorage', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?ref=lupita&utm_source=instagram&utm_medium=social&utm_campaign=verano' },
        writable: true,
      })

      captureAttribution()

      expect(sessionStorage.getItem('attribution_ref')).toBe('lupita')
      expect(sessionStorage.getItem('attribution_utm_source')).toBe('instagram')
      expect(sessionStorage.getItem('attribution_utm_medium')).toBe('social')
      expect(sessionStorage.getItem('attribution_utm_campaign')).toBe('verano')
    })

    it('does not overwrite existing values (first-touch-wins)', () => {
      sessionStorage.setItem('attribution_ref', 'first-agent')

      Object.defineProperty(window, 'location', {
        value: { search: '?ref=second-agent' },
        writable: true,
      })

      captureAttribution()

      expect(sessionStorage.getItem('attribution_ref')).toBe('first-agent')
    })
  })

  describe('writeServerEvent', () => {
    it('sends POST to /api/analytics/events with attribution', () => {
      sessionStorage.setItem('attribution_ref', 'lupita')
      sessionStorage.setItem('attribution_utm_source', 'instagram')

      writeServerEvent('view_item', { item_id: 'trip-1' })

      expect(fetch).toHaveBeenCalledWith('/api/analytics/events', expect.objectContaining({
        method: 'POST',
        keepalive: true,
      }))

      const call = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(call[1]?.body as string)
      expect(body.type).toBe('view_item')
      expect(body.metadata.agentRef).toBe('lupita')
      expect(body.metadata.channel).toBe('instagram')
      expect(body.metadata.item_id).toBe('trip-1')
    })

    it('does not throw on fetch failure', () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      expect(() => writeServerEvent('page_view')).not.toThrow()
    })
  })

  describe('attribution end-to-end chain', () => {
    it('captureAttribution → trackEvent → writeServerEvent propagates attribution', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?ref=lupita&utm_source=instagram&utm_medium=social&utm_campaign=verano' },
        writable: true,
      })

      // Step 1: Capture attribution from URL
      captureAttribution()

      // Step 2: Fire a trackEvent (which internally calls writeServerEvent)
      trackEvent('view_item', { item_id: 'trip-1' })

      // Step 3: Verify the server event includes attribution from sessionStorage
      const fetchCalls = vi.mocked(fetch).mock.calls
      const analyticsCall = fetchCalls.find(c => c[0] === '/api/analytics/events')
      expect(analyticsCall).toBeDefined()

      const body = JSON.parse(analyticsCall![1]?.body as string)
      expect(body.type).toBe('view_item')
      expect(body.metadata.agentRef).toBe('lupita')
      expect(body.metadata.channel).toBe('instagram')
      expect(body.metadata.item_id).toBe('trip-1')
    })
  })
})
