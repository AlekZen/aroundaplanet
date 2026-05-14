import { describe, it, expect } from 'vitest'
import { csvEscape, csvRow } from './escape'

describe('csvEscape', () => {
  it('valor sin comas ni caracteres especiales — sin cambios', () => {
    expect(csvEscape('hello world')).toBe('hello world')
  })

  it('valor con coma — quoted', () => {
    expect(csvEscape('hello, world')).toBe('"hello, world"')
  })

  it('valor con comilla doble — quoted y escapada', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
  })

  it('null — string vacío', () => {
    expect(csvEscape(null)).toBe('')
  })

  it('undefined — string vacío', () => {
    expect(csvEscape(undefined)).toBe('')
  })

  it('valor con salto de línea — quoted', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })

  it('valor numérico — toString sin modificar', () => {
    expect(csvEscape(12345)).toBe('12345')
  })
})

describe('csvRow', () => {
  it('construye una fila CSV correctamente', () => {
    expect(csvRow(['id', 'nombre, apellido', 42])).toBe('id,"nombre, apellido",42')
  })
})
