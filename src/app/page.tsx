import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 sm:px-6">
      <main className="flex w-full max-w-md flex-col items-center gap-6 text-center sm:gap-8">
        <Image
          src="/images/logo-aroundaplanet.webp"
          alt="AroundaPlanet logo"
          width={200}
          height={200}
          priority
          className="w-28 rounded-lg sm:w-36 md:w-44"
          style={{ height: "auto" }}
        />

        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl md:text-4xl">
          AroundaPlanet
        </h1>

        <p className="text-base text-muted-foreground sm:text-lg">
          Plataforma en construccion. Proximamente tu portal para la Vuelta al
          Mundo en 33.8 dias.
        </p>

        <div className="mt-2 flex items-center gap-2 rounded-full bg-primary-muted px-4 py-2 text-xs text-primary sm:mt-4 sm:text-sm">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          Fase 0 en desarrollo
        </div>
      </main>
    </div>
  );
}
