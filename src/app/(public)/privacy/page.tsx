import { createMetadata } from '@/lib/metadata'

export const metadata = createMetadata({
  title: 'Aviso de Privacidad — AroundaPlanet',
  description: 'Aviso de privacidad de AroundaPlanet. Conoce como recopilamos, usamos y protegemos tus datos personales.',
})

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl py-12">
      <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
        Aviso de Privacidad
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Ultima actualizacion: 28 de febrero de 2026</p>

      <div className="mt-8 space-y-8 text-foreground/90 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">1. Datos que Recopilamos</h2>
          <p>
            AroundaPlanet recopila los siguientes datos personales cuando utilizas nuestra plataforma:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Nombre completo</li>
            <li>Numero de telefono / WhatsApp</li>
            <li>Correo electronico (al crear una cuenta)</li>
            <li>Informacion de navegacion y preferencias de viaje</li>
            <li>Datos de pago (procesados de forma segura por terceros)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">2. Como Usamos tus Datos</h2>
          <p>Utilizamos tu informacion para:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Procesar y dar seguimiento a tus cotizaciones y reservaciones</li>
            <li>Contactarte por WhatsApp, telefono o correo sobre tus viajes</li>
            <li>Mejorar nuestros servicios y personalizar tu experiencia</li>
            <li>Cumplir con obligaciones legales y fiscales</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">3. Con Quien Compartimos tus Datos</h2>
          <p>
            Compartimos tu informacion unicamente con:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Prestadores de servicios turisticos necesarios para tu viaje (aerolineas, hoteles, etc.)</li>
            <li>Procesadores de pago autorizados</li>
            <li>Autoridades cuando sea requerido por ley</li>
          </ul>
          <p>
            No vendemos ni compartimos tus datos personales con terceros para fines publicitarios.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">4. Tus Derechos</h2>
          <p>
            De acuerdo con la Ley Federal de Proteccion de Datos Personales en Posesion de los
            Particulares (LFPDPPP), tienes derecho a:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong>Acceso:</strong> conocer que datos tenemos sobre ti</li>
            <li><strong>Rectificacion:</strong> corregir datos inexactos</li>
            <li><strong>Cancelacion:</strong> solicitar la eliminacion de tus datos</li>
            <li><strong>Oposicion:</strong> oponerte al uso de tus datos para fines especificos</li>
          </ul>
          <p>
            Para ejercer tus derechos ARCO, contactanos por los medios indicados abajo.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">5. Seguridad</h2>
          <p>
            Implementamos medidas de seguridad tecnicas y organizativas para proteger tus datos,
            incluyendo cifrado en transito, control de acceso basado en roles y almacenamiento
            seguro en la nube.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">6. Contacto</h2>
          <p>
            Para consultas sobre tus datos personales, contactanos por WhatsApp
            al +52 333 174 1585 o a traves de nuestra plataforma.
          </p>
        </section>
      </div>
    </article>
  )
}
