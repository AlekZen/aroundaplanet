import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PwaInstallInstructions } from './PwaInstallInstructions';

describe('PwaInstallInstructions', () => {
  it('device=ios renderiza 4 pasos', () => {
    render(<PwaInstallInstructions device="ios" open onClose={vi.fn()} />);
    expect(screen.getByText('Instala AroundaPlanet en tu iPhone')).toBeInTheDocument();
    expect(screen.getByText(/Tap el ícono de Compartir/i)).toBeInTheDocument();
    expect(screen.getByText(/Tap "Añadir" arriba a la derecha/i)).toBeInTheDocument();
  });

  it('device=macos renderiza 3 pasos', () => {
    render(<PwaInstallInstructions device="macos" open onClose={vi.fn()} />);
    expect(screen.getByText('Agrega AroundaPlanet a tu Mac')).toBeInTheDocument();
    expect(screen.getByText(/Agregar al Dock/i)).toBeInTheDocument();
  });

  it('onClose se invoca al cerrar', () => {
    const onClose = vi.fn();
    render(<PwaInstallInstructions device="ios" open onClose={onClose} />);
    const closeBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Close'));
    if (closeBtn) fireEvent.click(closeBtn);
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('open=false no renderiza contenido', () => {
    render(<PwaInstallInstructions device="ios" open={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Instala AroundaPlanet en tu iPhone')).not.toBeInTheDocument();
  });
});
