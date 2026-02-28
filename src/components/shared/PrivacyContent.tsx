/** Shared privacy content — used in /privacy page (SSG) and ConversionForm modal */
export function PrivacyContent() {
  return (
    <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">1. Datos que Recopilamos</h3>
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

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">2. Como Usamos tus Datos</h3>
        <p>Utilizamos tu informacion para:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Procesar y dar seguimiento a tus cotizaciones y reservaciones</li>
          <li>Contactarte por WhatsApp, telefono o correo sobre tus viajes</li>
          <li>Mejorar nuestros servicios y personalizar tu experiencia</li>
          <li>Cumplir con obligaciones legales y fiscales</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">3. Con Quien Compartimos tus Datos</h3>
        <p>Compartimos tu informacion unicamente con:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Prestadores de servicios turisticos necesarios para tu viaje</li>
          <li>Procesadores de pago autorizados</li>
          <li>Autoridades cuando sea requerido por ley</li>
        </ul>
        <p>No vendemos ni compartimos tus datos personales con terceros para fines publicitarios.</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">4. Tus Derechos (ARCO)</h3>
        <p>
          De acuerdo con la LFPDPPP, tienes derecho a:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Acceso:</strong> conocer que datos tenemos sobre ti</li>
          <li><strong>Rectificacion:</strong> corregir datos inexactos</li>
          <li><strong>Cancelacion:</strong> solicitar la eliminacion de tus datos</li>
          <li><strong>Oposicion:</strong> oponerte al uso de tus datos para fines especificos</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">5. Seguridad</h3>
        <p>
          Implementamos medidas de seguridad tecnicas y organizativas para proteger tus datos,
          incluyendo cifrado en transito, control de acceso basado en roles y almacenamiento
          seguro en la nube.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">6. Contacto</h3>
        <p>
          Para consultas sobre tus datos personales, contactanos por WhatsApp
          al +52 333 174 1585 o a traves de nuestra plataforma.
        </p>
      </section>
    </div>
  )
}
