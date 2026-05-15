import { describe, expect, it } from 'vitest'
import { appConfigOdooSchema } from './appConfigOdooSchema'

describe('appConfigOdooSchema', () => {
  it('acepta config vacía', () => {
    expect(appConfigOdooSchema.safeParse({}).success).toBe(true)
  })

  it('acepta solo attachmentReceiptTagId (Story 9.4 baseline)', () => {
    const r = appConfigOdooSchema.safeParse({ attachmentReceiptTagId: 47 })
    expect(r.success).toBe(true)
  })

  it('acepta ambos folder tags juntos', () => {
    const r = appConfigOdooSchema.safeParse({
      folderCanonicoTagId: 49,
      folderDuplicadoTagId: 50,
    })
    expect(r.success).toBe(true)
  })

  it('rechaza solo folderCanonicoTagId sin folderDuplicadoTagId', () => {
    const r = appConfigOdooSchema.safeParse({ folderCanonicoTagId: 49 })
    expect(r.success).toBe(false)
  })

  it('rechaza solo folderDuplicadoTagId sin folderCanonicoTagId', () => {
    const r = appConfigOdooSchema.safeParse({ folderDuplicadoTagId: 50 })
    expect(r.success).toBe(false)
  })

  it('rechaza folderAutoAssign=true sin folderCanonicoTagId', () => {
    const r = appConfigOdooSchema.safeParse({ folderAutoAssign: true })
    expect(r.success).toBe(false)
  })

  it('acepta folderAutoAssign=true con tags definidos', () => {
    const r = appConfigOdooSchema.safeParse({
      folderCanonicoTagId: 49,
      folderDuplicadoTagId: 50,
      folderAutoAssign: true,
    })
    expect(r.success).toBe(true)
  })

  it('rechaza folderAutoCreate=true sin folderAutoAssign=true', () => {
    const r = appConfigOdooSchema.safeParse({
      folderCanonicoTagId: 49,
      folderDuplicadoTagId: 50,
      folderAutoCreate: true,
    })
    expect(r.success).toBe(false)
  })

  it('acepta config completa', () => {
    const r = appConfigOdooSchema.safeParse({
      attachmentReceiptTagId: 47,
      folderCanonicoTagId: 49,
      folderDuplicadoTagId: 50,
      folderAutoAssign: true,
      folderAutoCreate: true,
    })
    expect(r.success).toBe(true)
  })

  it('rechaza tagIds no positivos', () => {
    const r = appConfigOdooSchema.safeParse({
      folderCanonicoTagId: 0,
      folderDuplicadoTagId: 50,
    })
    expect(r.success).toBe(false)
  })
})
