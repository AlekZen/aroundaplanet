import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Stub global de `server-only` para módulos server-side bajo test (Story 9.3+).
vi.mock('server-only', () => ({}))

afterEach(() => {
  cleanup()
})
