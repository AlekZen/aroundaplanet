/**
 * Unified analytics wrapper — dispatches events to Firebase Analytics,
 * Meta Pixel, Google Tag Manager, and custom Firestore analytics simultaneously.
 *
 * All functions are safe to call during SSR (they no-op when window is
 * unavailable).
 */

import type { Analytics } from 'firebase/analytics'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    fbq?: (...args: any[]) => void
    gtag?: (...args: any[]) => void
    dataLayer?: Record<string, unknown>[]
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Meta Pixel standard event mapping */
const META_PIXEL_EVENTS: Record<string, string> = {
  page_view: 'PageView',
  view_item: 'ViewContent',
  view_item_list: 'ViewContent',
  select_item: 'ViewContent',
  begin_checkout: 'InitiateCheckout',
  generate_lead: 'Lead',
  sign_up: 'CompleteRegistration',
  purchase: 'Purchase',
}

let firebaseAnalytics: Analytics | null = null
let firebaseLogEvent: ((analytics: Analytics, eventName: string, params?: Record<string, unknown>) => void) | null = null

/** Initialize Firebase Analytics SDK (client-side only, call once). */
export async function initFirebaseAnalytics() {
  if (typeof window === 'undefined' || firebaseAnalytics) return
  try {
    const { isSupported, getAnalytics, logEvent } = await import('firebase/analytics')
    const supported = await isSupported()
    if (supported) {
      const { firebaseApp } = await import('@/lib/firebase/client')
      firebaseAnalytics = getAnalytics(firebaseApp)
      firebaseLogEvent = logEvent
    }
  } catch {
    // Silent failure — analytics should never block the app
  }
}

/** Fire an event across all configured analytics services. */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return

  // Firebase Analytics SDK (native — logEvent cached at init time)
  if (firebaseAnalytics && firebaseLogEvent) {
    firebaseLogEvent(firebaseAnalytics, eventName, params)
  }

  // Google Tag (gtag.js via GTM)
  if (window.gtag) {
    window.gtag('event', eventName, params)
  }

  // Meta Pixel — use standard event if mapped, otherwise trackCustom
  if (window.fbq) {
    const metaEvent = META_PIXEL_EVENTS[eventName]
    if (metaEvent) {
      window.fbq('track', metaEvent, params)
    } else {
      window.fbq('trackCustom', eventName, params)
    }
  }

  // GTM dataLayer
  if (window.dataLayer) {
    window.dataLayer.push({ event: eventName, ...params })
  }

  // Fire-and-forget write to Firestore analytics
  writeServerEvent(eventName, params)
}

/** Track a standard page view across all services. */
export function trackPageView(path: string) {
  if (typeof window === 'undefined') return

  if (firebaseAnalytics && firebaseLogEvent) {
    firebaseLogEvent(firebaseAnalytics, 'page_view', { page_path: path })
  }

  if (window.gtag) {
    window.gtag('event', 'page_view', { page_path: path })
  }

  if (window.fbq) {
    window.fbq('track', 'PageView')
  }

  writeServerEvent('page_view', { page_path: path })
}

/** Capture UTM params and agent ref from URL into sessionStorage. */
export function captureAttribution() {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)

  const ref = params.get('ref')
  const utmSource = params.get('utm_source')
  const utmMedium = params.get('utm_medium')
  const utmCampaign = params.get('utm_campaign')

  // First-touch-wins: only store if not already captured this session
  if (ref && !sessionStorage.getItem('attribution_ref'))
    sessionStorage.setItem('attribution_ref', ref)
  if (utmSource && !sessionStorage.getItem('attribution_utm_source'))
    sessionStorage.setItem('attribution_utm_source', utmSource)
  if (utmMedium && !sessionStorage.getItem('attribution_utm_medium'))
    sessionStorage.setItem('attribution_utm_medium', utmMedium)
  if (utmCampaign && !sessionStorage.getItem('attribution_utm_campaign'))
    sessionStorage.setItem('attribution_utm_campaign', utmCampaign)
}

/** Read current attribution data from sessionStorage. */
function getSessionAttribution(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const result: Record<string, string> = {}
  const ref = sessionStorage.getItem('attribution_ref')
  const source = sessionStorage.getItem('attribution_utm_source')
  const medium = sessionStorage.getItem('attribution_utm_medium')
  const campaign = sessionStorage.getItem('attribution_utm_campaign')
  if (ref) result.agentRef = ref
  if (source) result.channel = source
  if (medium) result.utmMedium = medium
  if (campaign) result.utmCampaign = campaign
  return result
}

/**
 * Fire-and-forget POST to /api/analytics/events for Firestore persistence.
 * Never blocks UI — errors are silently ignored.
 */
export function writeServerEvent(type: string, metadata?: Record<string, unknown>) {
  if (typeof window === 'undefined') return

  const attribution = getSessionAttribution()

  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      metadata: { ...attribution, ...metadata },
    }),
    keepalive: true,
  }).catch(() => { /* fire-and-forget */ })
}
