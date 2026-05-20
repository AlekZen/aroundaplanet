import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AppLogo } from './AppLogo'

describe('AppLogo', () => {
  it('renderiza con tamaño md por default', () => {
    render(<AppLogo />)
    const img = screen.getByAltText('AroundaPlanet Travel Agency') as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('width')).toBe('48')
    expect(img.getAttribute('height')).toBe('48')
  })

  it('aplica tamaño sm (32px)', () => {
    render(<AppLogo size="sm" />)
    const img = screen.getByAltText('AroundaPlanet Travel Agency') as HTMLImageElement
    expect(img.getAttribute('width')).toBe('32')
  })

  it('aplica tamaño lg (80px)', () => {
    render(<AppLogo size="lg" />)
    const img = screen.getByAltText('AroundaPlanet Travel Agency') as HTMLImageElement
    expect(img.getAttribute('width')).toBe('80')
  })

  it('apunta a /aroundaplanet-logo.png', () => {
    render(<AppLogo />)
    const img = screen.getByAltText('AroundaPlanet Travel Agency') as HTMLImageElement
    expect(img.src).toContain('aroundaplanet-logo.png')
    expect(img.src).toContain('images')
  })

  it('mezcla className adicional', () => {
    render(<AppLogo className="rounded-full" />)
    const img = screen.getByAltText('AroundaPlanet Travel Agency')
    expect(img.className).toContain('rounded-full')
  })
})
