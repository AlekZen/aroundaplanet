import { createMetadata } from '@/lib/metadata'

export const metadata = createMetadata({
  title: 'Terminos y Condiciones — AroundaPlanet',
  description: 'Terminos y condiciones de uso del servicio de AroundaPlanet, agencia de viajes grupales.',
})

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl py-12">
      <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
        Terminos y Condiciones
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Ultima actualizacion: 28 de febrero de 2026</p>

      <div className="mt-8 space-y-8 text-foreground/90 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">1. Uso del Servicio</h2>
          <p>
            AroundaPlanet opera como agencia de viajes grupales. Al utilizar nuestra plataforma aceptas
            estos terminos en su totalidad. El servicio esta disponible para personas mayores de 18 anios
            o menores con autorizacion de su tutor legal.
          </p>
          <p>
            Nos reservamos el derecho de modificar estos terminos. Las modificaciones entraran en vigor
            al ser publicadas en esta pagina.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">2. Cotizaciones</h2>
          <p>
            Las cotizaciones generadas a traves de la plataforma son informativas y no constituyen
            un contrato de compra. Los precios estan sujetos a disponibilidad y pueden cambiar sin
            previo aviso hasta que se confirme el pago.
          </p>
          <p>
            La disponibilidad de lugares mostrada es en tiempo real pero no garantiza reservacion
            hasta completar el proceso de pago.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">3. Pagos y Reservaciones</h2>
          <p>
            Para confirmar una reservacion se requiere un deposito inicial segun las condiciones
            del viaje seleccionado. Los metodos de pago aceptados y las politicas de plazos se
            comunican al momento de la confirmacion.
          </p>
          <p>
            Todos los precios se expresan en Pesos Mexicanos (MXN) e incluyen los servicios
            detallados en la descripcion de cada viaje.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">4. Cancelaciones y Reembolsos</h2>
          <p>
            Las politicas de cancelacion varian segun el viaje y la fecha de salida. En general:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Cancelacion con mas de 60 dias de anticipacion: reembolso del 80%</li>
            <li>Cancelacion entre 30 y 60 dias: reembolso del 50%</li>
            <li>Cancelacion con menos de 30 dias: sin reembolso</li>
          </ul>
          <p>
            AroundaPlanet se reserva el derecho de cancelar un viaje por causas de fuerza mayor,
            en cuyo caso se ofrecera reembolso completo o reprogramacion.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">5. Responsabilidad</h2>
          <p>
            AroundaPlanet actua como intermediario entre los viajeros y los prestadores de servicios
            turisticos. No somos responsables por retrasos, cancelaciones o cambios realizados por
            aerolineas, hoteles u otros proveedores.
          </p>
          <p>
            Recomendamos contratar un seguro de viaje que cubra cancelaciones, gastos medicos
            y perdida de equipaje.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">6. Contacto</h2>
          <p>
            Para cualquier consulta sobre estos terminos puedes contactarnos por WhatsApp
            al +52 333 174 1585 o a traves de nuestra plataforma.
          </p>
        </section>
      </div>
    </article>
  )
}
