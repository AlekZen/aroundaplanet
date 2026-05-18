import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PwaInstallToaster } from './PwaInstallToaster';
import * as hookMod from '@/hooks/usePwaInstall';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(props as Record<string, string>)} />;
  },
}));

function mockHook(overrides: Partial<ReturnType<typeof hookMod.usePwaInstall>>): void {
  vi.spyOn(hookMod, 'usePwaInstall').mockReturnValue({
    isInstalled: false,
    platform: 'chromium',
    canPrompt: true,
    shouldShow: true,
    promptInstall: vi.fn().mockResolvedValue('accepted'),
    dismiss: vi.fn(),
    ...overrides,
  });
}

describe('PwaInstallToaster', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('no renderiza si shouldShow=false', () => {
    mockHook({ shouldShow: false });
    const { container } = render(<PwaInstallToaster />);
    expect(container.firstChild).toBeNull();
  });

  it('chromium muestra "Instalar"', () => {
    mockHook({ canPrompt: true, platform: 'chromium' });
    render(<PwaInstallToaster />);
    expect(screen.getByText('Instalar')).toBeInTheDocument();
  });

  it('ios-safari muestra "Cómo instalar" y abre modal', () => {
    mockHook({ canPrompt: false, platform: 'ios-safari' });
    render(<PwaInstallToaster />);
    const btn = screen.getByText('Cómo instalar');
    fireEvent.click(btn);
    expect(screen.getByText(/Tap el ícono de Compartir/i)).toBeInTheDocument();
  });

  it('macos-safari muestra "Cómo agregar"', () => {
    mockHook({ canPrompt: false, platform: 'macos-safari' });
    render(<PwaInstallToaster />);
    expect(screen.getByText('Cómo agregar')).toBeInTheDocument();
  });

  it('click Instalar invoca promptInstall', async () => {
    const promptInstall = vi.fn().mockResolvedValue('accepted');
    mockHook({ canPrompt: true, platform: 'chromium', promptInstall });
    render(<PwaInstallToaster />);
    fireEvent.click(screen.getByText('Instalar'));
    expect(promptInstall).toHaveBeenCalled();
  });

  it('click X invoca dismiss', () => {
    const dismiss = vi.fn();
    mockHook({ canPrompt: true, platform: 'chromium', dismiss });
    render(<PwaInstallToaster />);
    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(dismiss).toHaveBeenCalledWith();
  });

  it('click "No volver a mostrar" invoca dismiss permanente', () => {
    const dismiss = vi.fn();
    mockHook({ canPrompt: true, platform: 'chromium', dismiss });
    render(<PwaInstallToaster />);
    fireEvent.click(screen.getByText('No volver a mostrar'));
    expect(dismiss).toHaveBeenCalledWith({ permanent: true });
  });
});
