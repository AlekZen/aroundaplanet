import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { DocumentsFilters, type DocumentsFiltersValue } from './DocumentsFilters'

afterEach(cleanup)

const base: DocumentsFiltersValue = { search: '', scope: 'all' }

describe('<DocumentsFilters>', () => {
  it('renderiza input + placeholder', () => {
    render(<DocumentsFilters value={base} onChange={() => {}} />)
    expect(
      screen.getByPlaceholderText('Buscar documento, carpeta, producto o ID'),
    ).toBeInTheDocument()
  })

  it('emite onChange al escribir en search', () => {
    const onChange = vi.fn()
    render(<DocumentsFilters value={base} onChange={onChange} />)
    const input = screen.getByPlaceholderText('Buscar documento, carpeta, producto o ID')
    fireEvent.change(input, { target: { value: 'felipe' } })
    expect(onChange).toHaveBeenCalledWith({ search: 'felipe', scope: 'all' })
  })

  it('preserva scope cuando cambia search', () => {
    const onChange = vi.fn()
    render(<DocumentsFilters value={{ search: '', scope: 'payment' }} onChange={onChange} />)
    const input = screen.getByPlaceholderText('Buscar documento, carpeta, producto o ID')
    fireEvent.change(input, { target: { value: 'x' } })
    expect(onChange).toHaveBeenCalledWith({ search: 'x', scope: 'payment' })
  })

  it('refleja value actual del search prop', () => {
    render(<DocumentsFilters value={{ search: 'existing', scope: 'all' }} onChange={() => {}} />)
    const input = screen.getByPlaceholderText(
      'Buscar documento, carpeta, producto o ID',
    ) as HTMLInputElement
    expect(input.value).toBe('existing')
  })
})
