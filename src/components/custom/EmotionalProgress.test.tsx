import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { EmotionalProgress } from './EmotionalProgress'

afterEach(() => {
  cleanup()
})

describe('EmotionalProgress', () => {
  it('renders trip name and percentage', () => {
    render(<EmotionalProgress percentage={50} tripName="Vuelta al Mundo" />)
    expect(screen.getByText('Vuelta al Mundo')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('has progressbar role', () => {
    render(<EmotionalProgress percentage={75} tripName="Test" />)
    // El div raiz y el shadcn Progress ambos tienen role="progressbar"
    const progressbars = screen.getAllByRole('progressbar')
    expect(progressbars.length).toBeGreaterThan(0)
  })

  it('shows milestone label', () => {
    render(<EmotionalProgress percentage={50} tripName="Test" />)
    expect(screen.getByText('A mitad del camino')).toBeInTheDocument()
  })

  it('aria-valuenow matches the percentage prop', () => {
    render(<EmotionalProgress percentage={60} tripName="Viaje Test" />)
    // El div raiz tiene role="progressbar" y aria-valuenow
    const progressbars = screen.getAllByRole('progressbar')
    // El primer progressbar es el div raiz del componente (tiene aria-valuenow explicito)
    const outerProgressbar = progressbars.find((el) => el.getAttribute('aria-valuenow') === '60')
    expect(outerProgressbar).toBeTruthy()
    expect(outerProgressbar).toHaveAttribute('aria-valuenow', '60')
  })

  it('aria-valuemin="0" is present', () => {
    render(<EmotionalProgress percentage={30} tripName="Test" />)
    const progressbars = screen.getAllByRole('progressbar')
    const outerProgressbar = progressbars.find((el) => el.getAttribute('aria-valuemin') === '0')
    expect(outerProgressbar).toBeTruthy()
    expect(outerProgressbar).toHaveAttribute('aria-valuemin', '0')
  })

  it('aria-valuemax="100" is present', () => {
    render(<EmotionalProgress percentage={30} tripName="Test" />)
    const progressbars = screen.getAllByRole('progressbar')
    const outerProgressbar = progressbars.find((el) => el.getAttribute('aria-valuemax') === '100')
    expect(outerProgressbar).toBeTruthy()
    expect(outerProgressbar).toHaveAttribute('aria-valuemax', '100')
  })

  it('aria-label contains tripName and percentage', () => {
    render(<EmotionalProgress percentage={45} tripName="Europa Express" />)
    const progressbars = screen.getAllByRole('progressbar')
    const labeled = progressbars.find((el) => el.getAttribute('aria-label')?.includes('Europa Express'))
    expect(labeled).toBeTruthy()
    expect(labeled).toHaveAttribute('aria-label', 'Progreso de Europa Express: 45%')
  })

  it('renders greeting with userName when provided', () => {
    render(<EmotionalProgress percentage={50} tripName="Test" userName="Carlos" />)
    expect(screen.getByText('Hola, Carlos')).toBeInTheDocument()
  })

  it('does NOT render greeting when userName is absent', () => {
    render(<EmotionalProgress percentage={50} tripName="Test" />)
    expect(screen.queryByText(/hola,/i)).not.toBeInTheDocument()
  })

  it('renders destinationHighlight when provided', () => {
    render(<EmotionalProgress percentage={50} tripName="Test" destinationHighlight="Tokyo, Japon" />)
    expect(screen.getByText('Tokyo, Japon')).toBeInTheDocument()
  })

  it('does NOT render destinationHighlight when absent', () => {
    render(<EmotionalProgress percentage={50} tripName="Test" />)
    // Solo deberia haber el tripName, no texto adicional de destino
    expect(screen.queryByText('Tokyo, Japon')).not.toBeInTheDocument()
  })

  it('applies custom className to the container', () => {
    render(<EmotionalProgress percentage={50} tripName="Test" className="custom-progress" />)
    const progressbars = screen.getAllByRole('progressbar')
    const outerProgressbar = progressbars.find((el) => el.classList.contains('custom-progress'))
    expect(outerProgressbar).toBeTruthy()
  })

  it('shows correct milestone for 0%', () => {
    render(<EmotionalProgress percentage={0} tripName="Test" />)
    // Ningun milestone se activa con 0% (findLast busca m.at <= percentage)
    // El milestone label no debe aparecer (no hay milestone para 0)
    expect(screen.queryByText('Preparando tu aventura')).not.toBeInTheDocument()
  })

  it('shows milestone "Preparando tu aventura" for 25%', () => {
    render(<EmotionalProgress percentage={25} tripName="Test" />)
    expect(screen.getByText('Preparando tu aventura')).toBeInTheDocument()
  })

  it('shows milestone "Viaje completado" for 100%', () => {
    render(<EmotionalProgress percentage={100} tripName="Test" />)
    expect(screen.getByText('Viaje completado')).toBeInTheDocument()
  })
})
