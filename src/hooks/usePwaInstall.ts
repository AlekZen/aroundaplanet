'use client';

import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type PwaPlatform =
  | 'chromium'
  | 'ios-safari'
  | 'macos-safari'
  | 'firefox'
  | 'unsupported';

const STORAGE_KEY = 'aroundaplanet_pwa_install';
const DELAY_MS = 30_000;
const DISMISS_WINDOW_SHORT_DAYS = 7;
const DISMISS_WINDOW_LONG_DAYS = 30;

interface PersistedState {
  dismissedAt: string | null;
  dismissCount: number;
  installed: boolean;
}

let deferredPromptModuleScope: BeforeInstallPromptEvent | null = null;
let listenersRegistered = false;
const subscribers = new Set<(evt: BeforeInstallPromptEvent | null) => void>();

function notifySubscribers(evt: BeforeInstallPromptEvent | null): void {
  subscribers.forEach((cb) => cb(evt));
}

function registerGlobalListeners(): void {
  if (typeof window === 'undefined' || listenersRegistered) return;
  listenersRegistered = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPromptModuleScope = e as BeforeInstallPromptEvent;
    notifySubscribers(deferredPromptModuleScope);
  });
  window.addEventListener('appinstalled', () => {
    deferredPromptModuleScope = null;
    notifySubscribers(null);
    const state = readState();
    writeState({ ...state, installed: true });
  });
}

if (typeof window !== 'undefined') {
  registerGlobalListeners();
}

export function readState(): PersistedState {
  if (typeof window === 'undefined') {
    return { dismissedAt: null, dismissCount: 0, installed: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dismissedAt: null, dismissCount: 0, installed: false };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      dismissedAt: typeof parsed.dismissedAt === 'string' ? parsed.dismissedAt : null,
      dismissCount: typeof parsed.dismissCount === 'number' ? parsed.dismissCount : 0,
      installed: parsed.installed === true,
    };
  } catch {
    return { dismissedAt: null, dismissCount: 0, installed: false };
  }
}

function writeState(state: PersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore (private mode, quota)
  }
}

export function detectPlatform(uaInput?: string, maxTouchPoints?: number): PwaPlatform {
  if (typeof window === 'undefined' && !uaInput) return 'unsupported';
  const ua = uaInput ?? window.navigator.userAgent;
  const touchPoints =
    maxTouchPoints ??
    (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0);

  const isIPad = /Mac/.test(ua) && touchPoints > 1;
  const isIPhone = /iPhone|iPod/.test(ua);
  if (isIPhone || isIPad) {
    if (/CriOS|FxiOS|EdgiOS/.test(ua)) return 'unsupported';
    return 'ios-safari';
  }
  if (/Android/.test(ua)) {
    if (/Chrome|SamsungBrowser|EdgA/.test(ua)) return 'chromium';
    if (/Firefox/.test(ua)) return 'firefox';
    return 'unsupported';
  }
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) {
    return 'macos-safari';
  }
  if (/Edg\/|Chrome\/|Chromium/.test(ua)) return 'chromium';
  if (/Firefox\//.test(ua)) return 'firefox';
  return 'unsupported';
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  const navStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  if (navStandalone === true) return true;
  if (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) {
    return true;
  }
  return false;
}

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Infinity;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

export function isMuted(state: PersistedState): boolean {
  if (state.installed) return true;
  if (state.dismissCount >= 999) return true;
  if (state.dismissCount >= 3) return daysSince(state.dismissedAt) < DISMISS_WINDOW_LONG_DAYS;
  if (state.dismissCount >= 1) return daysSince(state.dismissedAt) < DISMISS_WINDOW_SHORT_DAYS;
  return false;
}

export interface UsePwaInstallResult {
  isInstalled: boolean;
  platform: PwaPlatform;
  canPrompt: boolean;
  shouldShow: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismiss: (opts?: { permanent?: boolean }) => void;
}

export function usePwaInstall(): UsePwaInstallResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    deferredPromptModuleScope,
  );
  const [installed, setInstalled] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : isStandalone() || readState().installed,
  );
  const [platform] = useState<PwaPlatform>(() =>
    typeof window === 'undefined' ? 'unsupported' : detectPlatform(),
  );
  const [delayElapsed, setDelayElapsed] = useState<boolean>(false);
  const [persisted, setPersisted] = useState<PersistedState>(() => readState());

  useEffect(() => {
    registerGlobalListeners();

    const sub = (evt: BeforeInstallPromptEvent | null) => setDeferredPrompt(evt);
    subscribers.add(sub);

    const timer = window.setTimeout(() => setDelayElapsed(true), DELAY_MS);

    const onInstalled = () => {
      setInstalled(true);
      const state = readState();
      writeState({ ...state, installed: true });
      setPersisted({ ...state, installed: true });
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      subscribers.delete(sub);
      window.clearTimeout(timer);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback((opts?: { permanent?: boolean }) => {
    const current = readState();
    const next: PersistedState = {
      installed: current.installed,
      dismissedAt: new Date().toISOString(),
      dismissCount: opts?.permanent ? 999 : current.dismissCount + 1,
    };
    writeState(next);
    setPersisted(next);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPromptModuleScope = null;
    setDeferredPrompt(null);
    if (choice.outcome === 'accepted') {
      const state = readState();
      writeState({ ...state, installed: true });
      setPersisted({ ...state, installed: true });
      setInstalled(true);
    }
    return choice.outcome;
  }, [deferredPrompt]);

  const canPrompt = platform === 'chromium' && deferredPrompt !== null;
  const supportedManual = platform === 'ios-safari' || platform === 'macos-safari';
  const shouldShow =
    !installed && delayElapsed && (canPrompt || supportedManual) && !isMuted(persisted);

  return {
    isInstalled: installed,
    platform,
    canPrompt,
    shouldShow,
    promptInstall,
    dismiss,
  };
}

export const __testing = {
  STORAGE_KEY,
  DELAY_MS,
  resetModuleScope: () => {
    deferredPromptModuleScope = null;
    subscribers.clear();
  },
  setDeferredPrompt: (evt: BeforeInstallPromptEvent | null) => {
    deferredPromptModuleScope = evt;
    notifySubscribers(evt);
  },
};
