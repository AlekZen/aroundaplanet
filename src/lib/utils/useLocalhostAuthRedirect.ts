'use client'

import { useEffect } from 'react'

export function useLocalhostAuthRedirect() {
  useEffect(() => {
    if (window.location.hostname !== '127.0.0.1') return

    const url = new URL(window.location.href)
    url.hostname = 'localhost'
    window.location.replace(url.toString())
  }, [])
}
