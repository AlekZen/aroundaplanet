/**
 * Validates returnUrl is a safe internal path.
 * Returns the URL if safe, or fallback otherwise.
 */
export function validateReturnUrl(url: string | null, fallback = '/dashboard'): string {
  if (!url) return fallback
  // Must start with / but NOT // (protocol-relative URL)
  if (url.startsWith('/') && !url.startsWith('//')) return url
  return fallback
}
