import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __testing,
  detectPlatform,
  isMuted,
  isStandalone,
  readState,
  usePwaInstall,
  type BeforeInstallPromptEvent,
} from './usePwaInstall';

function setUserAgent(ua: string, maxTouchPoints = 0): void {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  });
}

function mockMatchMedia(matchesStandalone: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (q: string) => ({
      matches: q.includes('standalone') ? matchesStandalone : false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }),
  });
}

function makeFakePromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted'): BeforeInstallPromptEvent {
  return {
    platforms: ['web'],
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
    preventDefault: vi.fn(),
  } as unknown as BeforeInstallPromptEvent;
}

describe('detectPlatform', () => {
  it('detects iOS Safari (iPhone)', () => {
    expect(
      detectPlatform(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        5,
      ),
    ).toBe('ios-safari');
  });

  it('detects iPadOS reportado como Mac via maxTouchPoints > 1', () => {
    expect(
      detectPlatform(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        5,
      ),
    ).toBe('ios-safari');
  });

  it('detects Android Chrome', () => {
    expect(
      detectPlatform(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
        5,
      ),
    ).toBe('chromium');
  });

  it('detects macOS Safari', () => {
    expect(
      detectPlatform(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        0,
      ),
    ).toBe('macos-safari');
  });

  it('detects desktop Chrome', () => {
    expect(
      detectPlatform(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        0,
      ),
    ).toBe('chromium');
  });

  it('detects Firefox', () => {
    expect(
      detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0', 0),
    ).toBe('firefox');
  });

  it('marca Chrome iOS como unsupported (no soporta beforeinstallprompt y los pasos Safari no aplican)', () => {
    expect(
      detectPlatform(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1',
        5,
      ),
    ).toBe('unsupported');
  });
});

describe('isStandalone', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it('false cuando no display-mode standalone', () => {
    expect(isStandalone()).toBe(false);
  });

  it('true cuando display-mode standalone', () => {
    mockMatchMedia(true);
    expect(isStandalone()).toBe(true);
  });

  it('true cuando navigator.standalone (iOS)', () => {
    mockMatchMedia(false);
    Object.defineProperty(window.navigator, 'standalone', {
      value: true,
      configurable: true,
    });
    expect(isStandalone()).toBe(true);
  });
});

describe('isMuted', () => {
  const now = new Date('2026-05-18T12:00:00Z').toISOString();
  const sixDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString();
  const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();
  const twentyDaysAgo = new Date(Date.now() - 20 * 86400000).toISOString();
  const fortyDaysAgo = new Date(Date.now() - 40 * 86400000).toISOString();

  it('installed siempre mute', () => {
    expect(isMuted({ installed: true, dismissedAt: null, dismissCount: 0 })).toBe(true);
  });

  it('permanent (999) siempre mute', () => {
    expect(isMuted({ installed: false, dismissedAt: now, dismissCount: 999 })).toBe(true);
  });

  it('1 dismiss < 7 días → muted', () => {
    expect(isMuted({ installed: false, dismissedAt: sixDaysAgo, dismissCount: 1 })).toBe(true);
  });

  it('1 dismiss > 7 días → no muted', () => {
    expect(isMuted({ installed: false, dismissedAt: eightDaysAgo, dismissCount: 1 })).toBe(false);
  });

  it('3 dismiss < 30 días → muted', () => {
    expect(isMuted({ installed: false, dismissedAt: twentyDaysAgo, dismissCount: 3 })).toBe(true);
  });

  it('3 dismiss > 30 días → no muted', () => {
    expect(isMuted({ installed: false, dismissedAt: fortyDaysAgo, dismissCount: 3 })).toBe(false);
  });

  it('pristine → no muted', () => {
    expect(isMuted({ installed: false, dismissedAt: null, dismissCount: 0 })).toBe(false);
  });
});

describe('usePwaInstall', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    mockMatchMedia(false);
    __testing.resetModuleScope();
    setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      0,
    );
    Object.defineProperty(window.navigator, 'standalone', { value: undefined, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shouldShow=false antes de delay 30s, true después si chromium con prompt', () => {
    const { result, rerender } = renderHook(() => usePwaInstall());
    act(() => {
      __testing.setDeferredPrompt(makeFakePromptEvent());
    });
    expect(result.current.shouldShow).toBe(false);
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    rerender();
    expect(result.current.canPrompt).toBe(true);
    expect(result.current.shouldShow).toBe(true);
  });

  it('promptInstall llama prompt() y limpia deferred al accept', async () => {
    const evt = makeFakePromptEvent('accepted');
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      __testing.setDeferredPrompt(evt);
      vi.advanceTimersByTime(31_000);
    });
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(evt.prompt).toHaveBeenCalled();
    expect(outcome).toBe('accepted');
    expect(result.current.isInstalled).toBe(true);
  });

  it('dismiss incrementa counter y persiste', () => {
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      result.current.dismiss();
    });
    const stored = readState();
    expect(stored.dismissCount).toBe(1);
    expect(stored.dismissedAt).not.toBeNull();
  });

  it('dismiss permanent setea 999', () => {
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      result.current.dismiss({ permanent: true });
    });
    expect(readState().dismissCount).toBe(999);
  });

  it('iOS Safari → shouldShow true sin deferredPrompt tras delay', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      5,
    );
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(result.current.platform).toBe('ios-safari');
    expect(result.current.canPrompt).toBe(false);
    expect(result.current.shouldShow).toBe(true);
  });

  it('Firefox unsupported nunca shouldShow', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; rv:120.0) Gecko/20100101 Firefox/120.0', 0);
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(result.current.shouldShow).toBe(false);
  });

  it('installed=true nunca shouldShow', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      __testing.setDeferredPrompt(makeFakePromptEvent());
      vi.advanceTimersByTime(31_000);
    });
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.shouldShow).toBe(false);
  });
});
