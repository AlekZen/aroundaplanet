import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CotizacionForm } from './CotizacionForm'

// Radix Select necesita APIs de DOM que JSDOM no implementa
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.setPointerCapture = () => {}
})

describe('CotizacionForm', () => {
  it('renderiza todos los campos y el botón de submit', () => {
    render(<CotizacionForm />)
    expect(screen.getByLabelText('Nombre del asesor')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre del cliente')).toBeInTheDocument()
    expect(screen.getByLabelText('Destino')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha de salida')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha de regreso')).toBeInTheDocument()
    expect(screen.getByLabelText('Notas adicionales')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar por WhatsApp' })).toBeInTheDocument()
  })

  it('muestra errores de validación al submit sin datos', async () => {
    render(<CotizacionForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }))

    await waitFor(() => {
      expect(screen.getByText(/Nombre del asesor es requerido/)).toBeInTheDocument()
    })
  })

  it('no muestra campo edadesMenores cuando menores es 0 (default)', () => {
    render(<CotizacionForm />)
    expect(screen.queryByLabelText('Edades de menores')).not.toBeInTheDocument()
  })

  it('muestra campo edadesMenores al seleccionar menores > 0', async () => {
    render(<CotizacionForm />)

    // El tercer combobox es menores (0: tipoViaje, 1: adultos, 2: menores)
    const comboboxes = screen.getAllByRole('combobox')
    fireEvent.click(comboboxes[2])

    await waitFor(() => {
      const option = screen.getByRole('option', { name: '2' })
      fireEvent.click(option)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Edades de menores')).toBeInTheDocument()
    })
  })

  it('transiciona a vista de confirmación al submit válido', { timeout: 15000 }, async () => {
    render(<CotizacionForm />)

    // Llenar campos de texto
    fireEvent.change(screen.getByLabelText('Nombre del asesor'), {
      target: { value: 'María López' },
    })
    fireEvent.change(screen.getByLabelText('Nombre del cliente'), {
      target: { value: 'Juan Pérez' },
    })
    fireEvent.change(screen.getByLabelText('Destino'), {
      target: { value: 'Cancún' },
    })
    fireEvent.change(screen.getByLabelText('Fecha de salida'), {
      target: { value: '2026-05-15' },
    })
    fireEvent.change(screen.getByLabelText('Fecha de regreso'), {
      target: { value: '2026-05-22' },
    })

    // Tipo de viaje (Radix Select)
    const comboboxes = screen.getAllByRole('combobox')
    fireEvent.click(comboboxes[0]) // tipoViaje
    await waitFor(() => {
      fireEvent.click(screen.getByRole('option', { name: 'Internacional' }))
    })

    // Presupuesto (último combobox)
    const updatedComboboxes = screen.getAllByRole('combobox')
    fireEvent.click(updatedComboboxes[updatedComboboxes.length - 1])
    await waitFor(() => {
      fireEvent.click(screen.getByRole('option', { name: '$25K-$50K MXN' }))
    })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }))

    await waitFor(() => {
      expect(screen.getByText('Vista previa del mensaje')).toBeInTheDocument()
    })
  })

  it('muestra enlace a WhatsApp con wa.me en la confirmación', { timeout: 15000 }, async () => {
    render(<CotizacionForm />)

    // Llenar formulario
    fireEvent.change(screen.getByLabelText('Nombre del asesor'), {
      target: { value: 'María López' },
    })
    fireEvent.change(screen.getByLabelText('Nombre del cliente'), {
      target: { value: 'Juan Pérez' },
    })
    fireEvent.change(screen.getByLabelText('Destino'), {
      target: { value: 'Cancún' },
    })
    fireEvent.change(screen.getByLabelText('Fecha de salida'), {
      target: { value: '2026-05-15' },
    })
    fireEvent.change(screen.getByLabelText('Fecha de regreso'), {
      target: { value: '2026-05-22' },
    })

    const comboboxes = screen.getAllByRole('combobox')
    fireEvent.click(comboboxes[0])
    await waitFor(() => {
      fireEvent.click(screen.getByRole('option', { name: 'Internacional' }))
    })

    const updatedComboboxes = screen.getAllByRole('combobox')
    fireEvent.click(updatedComboboxes[updatedComboboxes.length - 1])
    await waitFor(() => {
      fireEvent.click(screen.getByRole('option', { name: '$25K-$50K MXN' }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }))

    await waitFor(() => {
      const waLink = screen.getByRole('link', { name: 'Abrir WhatsApp' })
      expect(waLink).toBeInTheDocument()
      expect(waLink.getAttribute('href')).toContain('wa.me/5215517492766')
      expect(waLink.getAttribute('target')).toBe('_blank')
    })
  })

  it('regresa al formulario con datos preservados al editar', { timeout: 15000 }, async () => {
    render(<CotizacionForm />)

    fireEvent.change(screen.getByLabelText('Nombre del asesor'), {
      target: { value: 'María López' },
    })
    fireEvent.change(screen.getByLabelText('Nombre del cliente'), {
      target: { value: 'Juan Pérez' },
    })
    fireEvent.change(screen.getByLabelText('Destino'), {
      target: { value: 'Cancún' },
    })
    fireEvent.change(screen.getByLabelText('Fecha de salida'), {
      target: { value: '2026-05-15' },
    })
    fireEvent.change(screen.getByLabelText('Fecha de regreso'), {
      target: { value: '2026-05-22' },
    })

    const comboboxes = screen.getAllByRole('combobox')
    fireEvent.click(comboboxes[0])
    await waitFor(() => {
      fireEvent.click(screen.getByRole('option', { name: 'Internacional' }))
    })

    const updatedComboboxes = screen.getAllByRole('combobox')
    fireEvent.click(updatedComboboxes[updatedComboboxes.length - 1])
    await waitFor(() => {
      fireEvent.click(screen.getByRole('option', { name: '$25K-$50K MXN' }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }))

    await waitFor(() => {
      expect(screen.getByText('Vista previa del mensaje')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Editar cotización' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Nombre del asesor')).toHaveValue('María López')
      expect(screen.getByLabelText('Nombre del cliente')).toHaveValue('Juan Pérez')
    })
  })
})
