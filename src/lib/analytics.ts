/**
 * Unified analytics wrapper — dispatches events to Firebase Analytics,
 * Meta Pixel, and Google Tag Manager simultaneously.
 *
 * All functions are safe to call during SSR (they no-op when window is
 * unavailable).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    fbq?: (...args: any[]) => void
    gtag?: (...args: any[]) => void
    dataLayer?: Record<string, unknown>[]
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Fire an event across all configured analytics services. */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return

  // Firebase Analytics / Google Tag
  if (window.gtag) {
    window.gtag('event', eventName, params)
  }

  // Meta Pixel
  if (window.fbq) {
    window.fbq('trackCustom', eventName, params)
  }

  // GTM dataLayer
  if (window.dataLayer) {
    window.dataLayer.push({ event: eventName, ...params })
  }
}

/** Track a standard page view across all services. */
export function trackPageView(path: string) {
  if (typeof window === 'undefined') return

  if (window.gtag) {
    window.gtag('event', 'page_view', { page_path: path })
  }

  if (window.fbq) {
    window.fbq('track', 'PageView')
  }
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
