'use client';

import Image from 'next/image';
import { useState } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { PwaInstallInstructions } from './PwaInstallInstructions';

export function PwaInstallToaster(): React.ReactElement | null {
  const { platform, canPrompt, shouldShow, promptInstall, dismiss } = usePwaInstall();
  const [showInstructions, setShowInstructions] = useState(false);

  if (!shouldShow) return null;

  const isIos = platform === 'ios-safari';
  const isMacos = platform === 'macos-safari';

  const headline = canPrompt
    ? 'Instala AroundaPlanet como aplicación'
    : isIos
      ? 'Instala AroundaPlanet en tu iPhone'
      : isMacos
        ? 'Agrega AroundaPlanet a tu Mac'
        : '';

  const subline = canPrompt
    ? 'Accede más rápido, sin abrir el navegador.'
    : 'Te mostramos los pasos en 30 segundos.';

  const primaryLabel = canPrompt ? 'Instalar' : isIos ? 'Cómo instalar' : 'Cómo agregar';

  const handlePrimary = async (): Promise<void> => {
    if (canPrompt) {
      await promptInstall();
    } else {
      setShowInstructions(true);
    }
  };

  const handleDismiss = (): void => dismiss();
  const handleNeverShow = (): void => dismiss({ permanent: true });

  return (
    <>
      <div
        role="dialog"
        aria-labelledby="pwa-install-headline"
        className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-border bg-background/95 backdrop-blur shadow-lg ring-1 ring-black/5 lg:left-auto lg:right-6 lg:bottom-6 lg:mx-0"
        data-testid="pwa-install-toaster"
      >
        <div className="flex items-start gap-3 p-4">
          <div className="shrink-0 rounded-xl bg-muted p-1">
            <Image
              src="/icons/icon-192x192.png"
              width={48}
              height={48}
              alt=""
              className="rounded-lg"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p id="pwa-install-headline" className="font-semibold text-foreground leading-tight">
              {headline}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{subline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={handlePrimary} data-testid="pwa-install-primary">
                {primaryLabel}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleNeverShow}
                data-testid="pwa-install-never"
              >
                No volver a mostrar
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={handleDismiss}
            data-testid="pwa-install-close"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {(isIos || isMacos) && (
        <PwaInstallInstructions
          device={isIos ? 'ios' : 'macos'}
          open={showInstructions}
          onClose={() => setShowInstructions(false)}
        />
      )}
    </>
  );
}
