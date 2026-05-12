import { describe, it, expect, beforeEach, vi } from 'vitest'
import { dedupInflight, clearInflightCache } from './inflightCache'

describe('dedupInflight', () => {
  beforeEach(() => {
    clearInflightCache()
  })

  it('runs fetcher once and returns its value', async () => {
    const fetcher = vi.fn().mockResolvedValue('OK')
    const result = await dedupInflight('k1', fetcher)
    expect(result).toBe('OK')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent calls — single fetcher invocation for N parallel callers', async () => {
    const fetcher = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('shared'), 50)),
    )
    const results = await Promise.all([
      dedupInflight('k1', fetcher),
      dedupInflight('k1', fetcher),
      dedupInflight('k1', fetcher),
      dedupInflight('k1', fetcher),
      dedupInflight('k1', fetcher),
    ])
    expect(results).toEqual(['shared', 'shared', 'shared', 'shared', 'shared'])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('caches resolved value during TTL window', async () => {
    const fetcher = vi.fn().mockResolvedValue('cached')
    await dedupInflight('k1', fetcher, 1_000)
    await dedupInflight('k1', fetcher, 1_000)
    await dedupInflight('k1', fetcher, 1_000)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('refreshes after TTL expires', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2')
    const first = await dedupInflight('k1', fetcher, 10)
    expect(first).toBe('v1')
    await new Promise((r) => setTimeout(r, 20))
    const second = await dedupInflight('k1', fetcher, 10)
    expect(second).toBe('v2')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('separa cache por clave', async () => {
    const a = vi.fn().mockResolvedValue('A')
    const b = vi.fn().mockResolvedValue('B')
    const [r1, r2] = await Promise.all([
      dedupInflight('keyA', a),
      dedupInflight('keyB', b),
    ])
    expect(r1).toBe('A')
    expect(r2).toBe('B')
  })

  it('failures do NOT poison the cache: next call retries', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('recovered')

    await expect(dedupInflight('k1', fetcher)).rejects.toThrow('boom')
    const result = await dedupInflight('k1', fetcher)
    expect(result).toBe('recovered')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
