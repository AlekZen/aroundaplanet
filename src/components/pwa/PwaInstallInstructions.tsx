'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Device = 'ios' | 'macos';

interface Props {
  device: Device;
  open: boolean;
  onClose: () => void;
}

const iosSteps: { title: string; body: string }[] = [
  {
    title: 'Tap el ícono de Compartir',
    body: 'En la barra inferior de Safari (cuadrado con flecha hacia arriba).',
  },
  { title: 'Desplázate hacia abajo', body: 'En el menú que aparece.' },
  {
    title: 'Tap "Añadir a pantalla de inicio"',
    body: 'Verás el ícono de AroundaPlanet.',
  },
  {
    title: 'Tap "Añadir" arriba a la derecha',
    body: 'Listo. Aparecerá en tu pantalla como una app.',
  },
];

const macosSteps: { title: string; body: string }[] = [
  { title: 'En la barra de menús, abre Archivo', body: 'Safari 17 o superior.' },
  { title: 'Selecciona "Agregar al Dock"', body: 'Aparecerá un cuadro de confirmación.' },
  { title: 'Confirma el nombre y tap "Agregar"', body: 'AroundaPlanet quedará en tu Dock.' },
];

function ShareIcon(): React.ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="inline-block align-middle"
    >
      <path
        d="M10 2.5v10m0-10L7 5.5m3-3l3 3M5 9H4a1 1 0 00-1 1v6a1 1 0 001 1h12a1 1 0 001-1v-6a1 1 0 00-1-1h-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PwaInstallInstructions({ device, open, onClose }: Props): React.ReactElement {
  const steps = device === 'ios' ? iosSteps : macosSteps;
  const title =
    device === 'ios'
      ? 'Instala AroundaPlanet en tu iPhone'
      : 'Agrega AroundaPlanet a tu Mac';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {device === 'ios'
              ? 'Safari es el único navegador en iPhone que permite instalar apps web.'
              : 'Disponible desde Safari 17 (macOS Sonoma o superior).'}
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-4 mt-2">
          {steps.map((step, idx) => (
            <li key={idx} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {idx + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-foreground flex items-center gap-2">
                  {step.title}
                  {device === 'ios' && idx === 0 ? <ShareIcon /> : null}
                </p>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
