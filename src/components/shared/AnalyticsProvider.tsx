'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { trackPageView, captureAttribution, initFirebaseAnalytics } from '@/lib/analytics'

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID

/**
 * Renders analytics scripts and tracks page views.
 * Does NOT wrap children — render as a sibling to avoid forcing
 * the entire layout tree into a Client Component boundary.
 */
export function AnalyticsProvider() {
  const pathname = usePathname()
  const isFirstRender = useRef(true)

  // Initialize Firebase Analytics SDK + capture attribution on first load
  useEffect(() => {
    initFirebaseAnalytics()
    captureAttribution()
  }, [])

  // Track page views on route changes (skip first render —
  // the Meta Pixel init script already fires PageView on load)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    trackPageView(pathname)
  }, [pathname])

  return (
    <>
      {/* Google Tag Manager */}
      {GTM_ID && (
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />
      )}

      {/* Meta Pixel — init fires PageView on load, subsequent
          navigations tracked via trackPageView in useEffect */}
      {META_PIXEL_ID && (
        <Script
          id="meta-pixel-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`,
          }}
        />
      )}
    </>
  )
}
