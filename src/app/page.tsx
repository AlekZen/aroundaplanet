import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <main className="flex flex-col items-center gap-8 text-center">
        <Image
          src="/images/logo-aroundaplanet.webp"
          alt="AroundaPlanet logo"
          width={200}
          height={200}
          priority
          className="rounded-lg"
        />

        <h1 className="font-heading text-3xl font-bold text-primary">
          AroundaPlanet
        </h1>

        <p className="max-w-md text-lg text-muted-foreground">
          Plataforma en construccion. Proximamente tu portal para la Vuelta al
          Mundo en 33.8 dias.
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-full bg-primary-muted px-4 py-2 text-sm text-primary">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          Fase 0 en desarrollo
        </div>
      </main>
    </div>
  );
}
