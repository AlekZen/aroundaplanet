import { describe, it, expect } from 'vitest'
import {
  personalDataSchema,
  fiscalDataSchema,
  bankDataSchema,
  profileUpdateSchema,
} from './profileSchema'

describe('personalDataSchema', () => {
  it('accepts valid personal data', () => {
    const result = personalDataSchema.safeParse({
      firstName: 'Juan',
      lastName: 'Lopez',
      phone: '+523331234567',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty phone', () => {
    const result = personalDataSchema.safeParse({
      firstName: 'Juan',
      lastName: 'Lopez',
      phone: '',
    })
    expect(result.success).toBe(true)
  })

  it('accepts missing phone', () => {
    const result = personalDataSchema.safeParse({
      firstName: 'Juan',
      lastName: 'Lopez',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty firstName', () => {
    const result = personalDataSchema.safeParse({
      firstName: '',
      lastName: 'Lopez',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty lastName', () => {
    const result = personalDataSchema.safeParse({
      firstName: 'Juan',
      lastName: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects firstName over 100 chars', () => {
    const result = personalDataSchema.safeParse({
      firstName: 'A'.repeat(101),
      lastName: 'Lopez',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid phone format', () => {
    const result = personalDataSchema.safeParse({
      firstName: 'Juan',
      lastName: 'Lopez',
      phone: 'abc',
    })
    expect(result.success).toBe(false)
  })
})

describe('fiscalDataSchema', () => {
  const validFiscal = {
    rfc: 'LOPA850101ABC',
    razonSocial: 'Juan Lopez SA de CV',
    regimenFiscal: '612',
    domicilioFiscal: 'Av Juarez 100, Guadalajara',
    usoCFDI: 'G03',
  }

  it('accepts valid fiscal data', () => {
    const result = fiscalDataSchema.safeParse(validFiscal)
    expect(result.success).toBe(true)
  })

  it('accepts 3-char RFC prefix (persona moral)', () => {
    const result = fiscalDataSchema.safeParse({
      ...validFiscal,
      rfc: 'ABC850101XYZ',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid RFC format', () => {
    const result = fiscalDataSchema.safeParse({
      ...validFiscal,
      rfc: '12345',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid regimen fiscal value', () => {
    const result = fiscalDataSchema.safeParse({
      ...validFiscal,
      regimenFiscal: '999',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid uso CFDI value', () => {
    const result = fiscalDataSchema.safeParse({
      ...validFiscal,
      usoCFDI: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty razon social', () => {
    const result = fiscalDataSchema.safeParse({
      ...validFiscal,
      razonSocial: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects domicilio fiscal over 255 chars', () => {
    const result = fiscalDataSchema.safeParse({
      ...validFiscal,
      domicilioFiscal: 'X'.repeat(256),
    })
    expect(result.success).toBe(false)
  })
})

describe('bankDataSchema', () => {
  const validBank = {
    banco: 'BBVA',
    numeroCuenta: '1234567890123456',
    clabe: '012345678901234567',
    titularCuenta: 'Juan Lopez',
  }

  it('accepts valid bank data', () => {
    const result = bankDataSchema.safeParse(validBank)
    expect(result.success).toBe(true)
  })

  it('rejects cuenta with less than 10 digits', () => {
    const result = bankDataSchema.safeParse({
      ...validBank,
      numeroCuenta: '123456789',
    })
    expect(result.success).toBe(false)
  })

  it('rejects CLABE not exactly 18 digits', () => {
    const result = bankDataSchema.safeParse({
      ...validBank,
      clabe: '12345678901234',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-numeric CLABE', () => {
    const result = bankDataSchema.safeParse({
      ...validBank,
      clabe: 'abcdefghijklmnopqr',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty banco', () => {
    const result = bankDataSchema.safeParse({
      ...validBank,
      banco: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty titular', () => {
    const result = bankDataSchema.safeParse({
      ...validBank,
      titularCuenta: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('profileUpdateSchema (discriminated union)', () => {
  it('accepts personal section update', () => {
    const result = profileUpdateSchema.safeParse({
      section: 'personal',
      data: { firstName: 'Maria', lastName: 'Gonzalez', phone: '+521234567890' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts fiscal section update', () => {
    const result = profileUpdateSchema.safeParse({
      section: 'fiscal',
      data: {
        rfc: 'GOMA900101ABC',
        razonSocial: 'Maria Gonzalez',
        regimenFiscal: '626',
        domicilioFiscal: 'Calle 1, CDMX',
        usoCFDI: 'G03',
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts bank section update', () => {
    const result = profileUpdateSchema.safeParse({
      section: 'bank',
      data: {
        banco: 'Santander',
        numeroCuenta: '1234567890123456',
        clabe: '012345678901234567',
        titularCuenta: 'Maria G',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown section', () => {
    const result = profileUpdateSchema.safeParse({
      section: 'unknown',
      data: { foo: 'bar' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects personal section with fiscal data', () => {
    const result = profileUpdateSchema.safeParse({
      section: 'personal',
      data: { rfc: 'LOPA850101ABC' },
    })
    expect(result.success).toBe(false)
  })
})
