/* eslint-disable react/no-unescaped-entities */
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, Svg, Polygon } from '@react-pdf/renderer'
import { loadLogoBuffer } from '@/lib/pdf/assets'
import type { ContractSnapshot } from '@/schemas/contractSchema'
import type { ContractTemplate } from '@/schemas/contractTemplateSchema'

/**
 * Story 10.1.4 — Rediseño visual con branding fiel al machote Paloma.
 * Texto legal hardcoded (validado Story 10.1, NO modificar contenido).
 * Paleta del machote real (NO del design system del frontend):
 *   azul oscuro, turquesa, amarillo accent en marco título.
 * Logo cargado como Buffer en module init (server-only).
 */

const COLOR_NAVY = '#1C2D52'
const COLOR_TEAL = '#3FB8AF'
const COLOR_ACCENT = '#F4A261'
const COLOR_MUTED = '#525252'
const COLOR_BORDER = '#9CA3AF'

const LOGO_BUFFER: Buffer = loadLogoBuffer()

const PAGE_W = 612 // LETTER width (pt)
const HEADER_H = 80
const FOOTER_H = 50

const styles = StyleSheet.create({
  page: {
    paddingTop: HEADER_H + 16,
    paddingBottom: FOOTER_H + 16,
    paddingHorizontal: 48,
    fontSize: 9.5,
    lineHeight: 1.45,
    fontFamily: 'Helvetica',
    color: '#111111',
  },
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_H,
  },
  headerLogo: {
    position: 'absolute',
    top: 10,
    left: 36,
    width: 60,
    height: 60,
    objectFit: 'contain',
  },
  headerAddress: {
    position: 'absolute',
    top: 22,
    right: 40,
    width: 260,
    color: '#FFFFFF',
    fontSize: 9,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },
  footerWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FOOTER_H,
  },
  footerInline: {
    position: 'absolute',
    bottom: 14,
    left: 60,
    right: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 4,
    right: 16,
    fontSize: 7,
    color: COLOR_MUTED,
  },
  titleBanner: {
    backgroundColor: COLOR_TEAL,
    borderWidth: 2,
    borderColor: COLOR_ACCENT,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 14,
  },
  titleBannerText: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    textAlign: 'center',
  },
  subTitle: {
    backgroundColor: COLOR_TEAL,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  subTitleText: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  intro: {
    textAlign: 'justify',
    marginBottom: 10,
  },
  sectionHeader: {
    backgroundColor: COLOR_TEAL,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 8,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  sectionHeaderText: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  paragraph: {
    textAlign: 'justify',
    marginBottom: 4,
  },
  clause: {
    textAlign: 'justify',
    marginBottom: 6,
  },
  clauseLead: {
    fontFamily: 'Helvetica-Bold',
  },
  bullet: {
    textAlign: 'justify',
    marginBottom: 2,
    marginLeft: 12,
  },
  underlineName: {
    fontFamily: 'Helvetica-Bold',
    textDecoration: 'underline',
  },
  annexTitle: {
    backgroundColor: COLOR_TEAL,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 6,
    marginBottom: 8,
  },
  annexSubtitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: COLOR_NAVY,
    marginTop: 10,
    marginBottom: 3,
  },
  signaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 36,
    gap: 24,
  },
  signatureBlock: {
    flex: 1,
    alignItems: 'center',
  },
  signatureLine: {
    borderTop: `1pt solid ${COLOR_BORDER}`,
    width: '90%',
    paddingTop: 4,
    textAlign: 'center',
    fontSize: 9,
  },
  signatureLabel: {
    fontFamily: 'Helvetica-Bold',
    color: COLOR_NAVY,
    fontSize: 9,
  },
  signatureName: {
    fontSize: 9,
  },
  signatureRole: {
    fontSize: 8,
    color: COLOR_MUTED,
  },
})

/**
 * Header con dos paralelogramos SVG (azul + turquesa).
 * Logo AroundaPlanet sobre la banda azul.
 * Dirección fiscal sobre la banda turquesa.
 */
function ContractHeader({ direccionLinea1, direccionLinea2 }: { direccionLinea1: string; direccionLinea2: string }) {
  return (
    <View style={styles.headerWrap} fixed>
      <Svg viewBox={`0 0 ${PAGE_W} ${HEADER_H}`} style={{ width: PAGE_W, height: HEADER_H }}>
        <Polygon points={`0,0 340,0 300,${HEADER_H} 0,${HEADER_H}`} fill={COLOR_NAVY} />
        <Polygon points={`360,0 ${PAGE_W},0 ${PAGE_W},${HEADER_H} 320,${HEADER_H}`} fill={COLOR_TEAL} />
      </Svg>
      {LOGO_BUFFER.length > 0 ? (
        <Image style={styles.headerLogo} src={{ data: LOGO_BUFFER, format: 'png' }} />
      ) : null}
      <View style={styles.headerAddress}>
        <Text>{direccionLinea1}</Text>
        <Text>{direccionLinea2}</Text>
      </View>
    </View>
  )
}

/**
 * Footer con paralelogramos invertidos + contacto.
 */
function ContractFooter({
  contactoWeb,
  contactoTel,
  contactoEmail,
}: {
  contactoWeb: string
  contactoTel: string
  contactoEmail: string
}) {
  return (
    <View style={styles.footerWrap} fixed>
      <Svg viewBox={`0 0 ${PAGE_W} ${FOOTER_H}`} style={{ width: PAGE_W, height: FOOTER_H }}>
        <Polygon points={`0,0 300,0 340,${FOOTER_H} 0,${FOOTER_H}`} fill={COLOR_NAVY} />
        <Polygon points={`320,0 ${PAGE_W},0 ${PAGE_W},${FOOTER_H} 360,${FOOTER_H}`} fill={COLOR_TEAL} />
      </Svg>
      <View style={styles.footerInline}>
        <Text style={styles.footerItem}>{contactoWeb}</Text>
        <Text style={styles.footerItem}>{contactoTel}</Text>
        <Text style={styles.footerItem}>{contactoEmail}</Text>
      </View>
    </View>
  )
}

function SectionHeader({ children }: { children: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{children}</Text>
    </View>
  )
}

type ContractDocumentProps = {
  template: ContractTemplate
  snapshot: ContractSnapshot
  contractId: string
  generatedAtIso: string
}

function clauseN(num: string, body: string): React.ReactElement {
  return (
    <Text style={styles.clause}>
      <Text style={styles.clauseLead}>{num}. — </Text>
      {body}
    </Text>
  )
}

// Datos de contacto/branding centralizados — fuente de verdad para header/footer.
const BRAND = {
  direccionLinea1: 'Montecito 38, piso 22, oficina 10. WTC',
  direccionLinea2: 'Napoles, Benito Juarez, CDMX.',
  contactoWeb: 'aroundaplanet.odoo.com',
  contactoTel: '3929 2264 79',
  contactoEmail: 'aroundaplanet123@gmail.com',
} as const

export function ContractDocument({ template, snapshot, contractId, generatedAtIso }: ContractDocumentProps) {
  const periodo = snapshot.periodoViaje ?? `${template.destinoLabel} ${snapshot.viajeTemporada}`
  const nombreCliente = snapshot.nombreCliente.toUpperCase()
  const acompanantes = (snapshot.nombreAcompanantes ?? '').trim()
  const fechaFirma = new Date(generatedAtIso)
  const fechaFirmaStr = fechaFirma.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })

  const anticipoSentence = snapshot.anticipoCents && snapshot.anticipoFormatted && snapshot.anticipoLetras
    ? ` el pago se hará de forma fraccionada, dando como anticipo la cantidad de ${snapshot.anticipoLetras} (${snapshot.anticipoFormatted}) por persona;`
    : ' el pago se hará de forma INMEDIATA;'

  return (
    <Document title={`Contrato ${template.destinoLabel} — ${nombreCliente}`} author="AroundaPlanet">
      <Page size="LETTER" style={styles.page}>
        <ContractHeader direccionLinea1={BRAND.direccionLinea1} direccionLinea2={BRAND.direccionLinea2} />
        <ContractFooter
          contactoWeb={BRAND.contactoWeb}
          contactoTel={BRAND.contactoTel}
          contactoEmail={BRAND.contactoEmail}
        />

        <View style={styles.titleBanner}>
          <Text style={styles.titleBannerText}>{periodo.toUpperCase()}</Text>
        </View>

        <View style={styles.subTitle}>
          <Text style={styles.subTitleText}>CONTRATO DE PRESTACIÓN DE SERVICIOS TURÍSTICOS</Text>
        </View>

        <Text style={styles.intro}>
          CELEBRADO POR UNA PARTE POR LA AGENCIA DE VIAJES AROUNDAPLANET, REPRESENTADA EN LA PRESENTE POR LA C.
          NOEL SAHAGÚN CERVANTES, A QUIEN EN LO SUCESIVO DENTRO DEL PRESENTE CONTRATO SE LE CONOCERÁ COMO "LA
          AGENCIA" Y POR LA OTRA PARTE <Text style={styles.underlineName}>{nombreCliente}</Text>
          {acompanantes ? <Text> {acompanantes.toUpperCase()}</Text> : null}, A QUIEN EN LO CONSECUTIVO EN EL
          PRESENTE CONTRATO SE LE DENOMINARÁ COMO "EL CLIENTE", AMBAS PARTES ACUERDAN Y CONFIRMAN EXPONER DATOS
          VERDADEROS DENTRO DE LAS DECLARACIONES ASÍ COMO SUJETARSE AL TENOR DE LAS DECLARACIONES Y CLÁUSULAS
          EXPUESTAS DENTRO DEL PRESENTE CONTRATO.
        </Text>

        <SectionHeader>DECLARACIONES:</SectionHeader>

        <Text style={styles.paragraph}>
          <Text style={styles.clauseLead}>I.- DECLARA "LA AGENCIA": </Text>
          A.- Ser una persona física de nacionalidad mexicana, con capacidad jurídica para obligarse en términos
          del presente contrato. B.- Contar con domicilio fiscal y físico ubicado en la calle Montecito número
          38, piso 22 oficina 10 edificio World Trade Center, delegación Benito Juárez, en la ciudad de México.
          C.- Que cuenta con la capacidad, infraestructura, servicios, recursos necesarios y personal
          capacitado, bastantes y suficientes, para dar cumplimiento a las obligaciones contenidas dentro del
          presente contrato. D.- Estar al corriente y vigente de sus obligaciones fiscales y permisos
          expedidos por SECTUR para operar los servicios que son objetos del presente contrato.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.clauseLead}>II.- DECLARA "EL CLIENTE": </Text>
          A. Ser una persona física, mayor de edad en pleno uso de sus facultades y con capacidad jurídica
          suficiente para obligarse en los términos del presente contrato. B. Que es su deseo y voluntad el
          obligarse en los términos del clausulado del presente contrato y que lo hace libre de toda coacción.
        </Text>

        <SectionHeader>CLÁUSULAS:</SectionHeader>

        {clauseN(
          'Primera',
          'El motivo y objeto del presente contrato es la prestación del servicio por parte de "la agencia", el cual consiste en contratar un paquete vacacional, que incluye contratar, conseguir y agendar tanto acomodaciones hoteleras, turísticas, guías, tours y vuelos que serán enumerados dentro del anexo 1 del presente contrato.'
        )}

        <Text style={styles.clause}>
          <Text style={styles.clauseLead}>Segunda. — </Text>
          El cliente se obliga al pago de la cantidad de {snapshot.montoTotalLetras} ({snapshot.montoTotalFormatted})
          por persona a cambio de la prestación del servicio descrito en la cláusula anterior,
          {anticipoSentence} y se compromete de igual forma a hacer los pagos necesarios para completar el costo
          total del servicio contratado a más tardar {template.plazoLimitePagoDias} días naturales antes de la
          fecha de salida del viaje, fecha a la cual de no haber sido cubierto el pago en su totalidad, "el
          cliente" perderá su reservación para participar en dicho servicio, así como cualquier cantidad que
          haya dado como anticipo como penalización por incumplimiento del presente contrato.
        </Text>

        {clauseN(
          'Tercera',
          'El pago del servicio del que trata la segunda cláusula, incluye única y exclusivamente lo especificado y numerado dentro de la primera cláusula y su anexo. "La agencia" se deslinda de responsabilidad de cualquier pago generado por consumos o actividades ajenas a lo establecido dentro del cuerpo del presente contrato.'
        )}

        {clauseN(
          'Cuarta',
          '"La agencia" no se hace responsable de cualquier gasto, daño y/o pago generado por cuestiones de retrasos, huelgas, desastres naturales o cualquier otro tipo de fenómeno social, cultural o natural o causa de fuerza mayor, así como cualquier clase de accidente o irregularidad que le fuese ocasionada a "el cliente" o sus pertenencias.'
        )}

        {clauseN(
          'Quinta',
          '"La agencia" se reservará el derecho de admisión, permanencia y/o expulsión del tour de cualquier persona, cuando a juicio y discreción del responsable, representante y/o empleado a cargo del viaje, esté afectando, molestando, obstaculizando o cualquier otro motivo que entorpezca o afecte el desarrollo programado del viaje, así como la convivencia, seguridad y respeto al resto de los asistentes, guías y cualquier otra persona o lugar. Dicha situación que origine este supuesto será responsabilidad de "el cliente" y no originará ninguna clase de reembolso o reacomodo por parte de "la agencia".'
        )}

        {clauseN(
          'Sexta',
          '"La agencia" se reservará el derecho a efectuar alteraciones totales o parciales a los programas establecidos en casos de fuerza mayor, siempre y cuando lo exija así el desarrollo y naturaleza de las actividades a realizar, así como siempre poner en primer lugar el preservar la seguridad y bienestar del cliente.'
        )}

        {clauseN(
          'Séptima',
          'En caso de los viajes o tours grupales "la agencia" se reserva el derecho a cancelar o aplazar la salida del paquete vacacional, en caso de que no se registren o inscriban un mínimo de 12 personas. En dicho caso y supuesto "la agencia" se compromete a realizar la devolución íntegra de la totalidad de los anticipos o pagos que haya efectuado.'
        )}

        {clauseN(
          'Octava',
          'Ambas partes convienen que "la agencia" queda libre de toda responsabilidad, tanto civil, penal y mercantil o de cualquier otra índole, en lo que respecta cualquier siniestro ocurrido, accidentes, robo, extravíos o cualquier tipo de afectación ocurrida dentro del transcurso del viaje y que afecte a "el cliente" directa o indirectamente ya sea en su persona y/o posesiones.'
        )}

        {clauseN(
          'Novena',
          '"El cliente" se compromete a tener en regla y vigencia toda su documentación, identificaciones, permisos, visa y cualquier tipo de documentación o trámite necesario y/o requerido por las autoridades para cualquier viaje que esté contratando y será por completo su responsabilidad arreglar y subsanar cualquier tipo de irregularidad acaecido por dichos efectos, esto siempre a excepción de aquellos trámites o documentación que "la agencia" expresamente indique que proveerá.'
        )}

        {clauseN(
          'Décima',
          '"El cliente" acepta y declara que es de su conocimiento que "la agencia" funge como intermediario en la prestación y contratación de los servicios que son listados en la primera cláusula de este contrato y que es de su conocimiento que cualquier retraso, incidente o afectación hecha directamente por el uso de dichas instalaciones lugares o servicios son responsabilidad única y directa del dueño o prestador directo del servicio.'
        )}

        {clauseN(
          'Décima primera',
          'En caso de una cancelación, solicitud de cambio de nombre o cualquier otro trámite que sea requerido y/o realizado por parte de "el cliente", siempre y cuando dicho trámite sea autorizado por la aerolínea y/o prestador de servicio, éste aceptará cubrir cualquier tipo de pago, multa o tarifa impuesta ya sea por las aerolíneas, hoteles y/o servicios que hayan sido contratados a su nombre.'
        )}

        {clauseN(
          'Décima segunda',
          '"El cliente" será el único responsable de tener y mantener todo tipo de documentación y/o trámites necesarios para poder realizar el paquete vacacional contratado, incluyendo y especialmente el revisar que su pasaporte tenga un mínimo de 6 meses de vigencia pendiente al momento del viaje, ya que así lo señalan las políticas migratorias internacionales. "La agencia" se deslinda de cualquier problema que sea originado o relacionado a falta, caducidad, ilegitimidad o cualquier otro problema relativo a dichos documentos y trámites, a excepción de los que hayan sido expresamente incluidos dentro del paquete vacacional.'
        )}

        {clauseN(
          'Décima tercera',
          'Para efectos de la contratación de un paquete vacacional en viaje grupal, sobre todo en los internacionales, se deberá tener en cuenta que la fecha de salida estará sujeta a cambios que variarán en no más de dos días hábiles antes o después de lo programado, dependiendo de la disponibilidad, sobrecupo y disposiciones hechas por la aerolínea. Estas modificaciones no afectarán y tal como se marca en la presente estarán tomadas como previstas dentro del presente contrato, para cualquier efecto que esto tuviese.'
        )}

        {clauseN(
          'Décima cuarta',
          'El presente contrato es personal e intransferible, cualquier violación a lo estipulado dentro del presente contrato por parte del cliente resultará en su cancelación y terminación, resultando en el mismo supuesto que lo estipulado dentro de la cláusula segunda. "La agencia" no reembolsará ningún adelanto que haya sido realizado por parte de "el cliente" en ningún supuesto en que éste haya sido el culpable o promotor de la cancelación anticipada del contrato antes de llegar a su buen término.'
        )}

        {clauseN(
          'Décima quinta',
          '"El cliente" se compromete y hará responsable de respetar cualquier tipo de reglamento interno, dentro de cualquier tipo de acomodaciones hoteleras que le hayan sido proporcionadas, así como respetar los reglamentos de las locaciones de los tours guiados locales, así como el pago de servicios adicionales y las propinas de carácter obligatorio de los guías locales, cualquier tipo de servicios provistos e incluso en la vía pública, ya que "la agencia" se deslinda de cualquier situación, penalidad o repercusión causada por haber acaecido en estas situaciones.'
        )}

        {clauseN(
          'Décima sexta',
          'La asignación de los asientos en los vuelos del paquete vacacional se realiza de forma automática de setenta y dos a veinticuatro horas anteriores al despegue. Si "el cliente" desea la asignación de algún asiento especial en específico, deberá solicitarlo y cubrir el costo extra que imponga la aerolínea por este servicio.'
        )}

        {clauseN(
          'Décima séptima',
          'En caso de que la totalidad o parte de los lugares a visitar dentro del paquete vacacional estuviesen inaccesibles por causas de fuerza mayor y/o caso fortuito, entendiéndose por éstos aquellos ocasionados por accidentes, atentados, huelgas, retrasos o anticipación de horarios, condiciones atmosféricas, catástrofes naturales, bancarrota de aerolíneas o prestadores de servicios, declaraciones o prohibiciones de las autoridades nacionales o internacionales, etc.; siendo estos ajenos a la voluntad y poder de ambas partes, y en virtud de los cuales los servicios contratados no pudieran ser proporcionados total o parcialmente, "la agencia" no tendrá responsabilidad alguna, pero se compromete a realizar y coadyuvar al cliente en las solicitudes de reembolso que correspondan y procedan, sin comprometerse a asegurar que estas procedan.'
        )}

        {clauseN(
          'Décima octava',
          'Cuando "la agencia" cancele la realización del paquete vacacional contratado por cualquier causa que le sea ajena a "el cliente", "la agencia" se obliga al reembolso en su totalidad de la cantidad que le haya sido entregada como anticipo o pago que le hayan sido efectuados para este efecto.'
        )}

        <Text style={styles.clause}>
          <Text style={styles.clauseLead}>Décima novena. — </Text>
          Los pagos totales y parciales que sean realizados por "el cliente", sólo serán válidos con su
          comprobante de depósito o transferencia en las cuentas que se proveen a continuación, así como los
          realizados en efectivo y ambas asegurándose de tener su comprobante de pago con folio, expedido en
          cualquiera de nuestras sucursales.
        </Text>
        <Text style={styles.bullet}>
          • MARIA DE JESUS CERVANTES SOTELO (Representante Legal) — BANAMEX 5204 1650 9943 7190 — BBVA 4152
          3136 3676 0055
        </Text>
        <Text style={styles.bullet}>
          • BBVA Noel Sahagún Cervantes — CLABE interbancaria: 0 1 2 3 7 0 0 0 4 7 3 5 4 3 0 0 5 4
        </Text>

        {clauseN(
          'Vigésima',
          'En caso de querella legal con base al presente contrato, ambas partes se someten y sujetan a la jurisdicción de los Tribunales competentes en la Ciudad de México, renunciando expresamente a cualquier otra jurisdicción que pudiera corresponderles, por razón de sus domicilios presentes o futuros o por cualquier otra razón.'
        )}

        <Text style={styles.paragraph}>
          Leído que fue por las partes el contenido del presente contrato y sabedoras de su alcance legal, lo
          firman por duplicado en {snapshot.ciudadFirma}, a {fechaFirmaStr}.
        </Text>

        <View style={styles.signaturesRow} wrap={false}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>"LA AGENCIA"</Text>
            </Text>
            <Text style={styles.signatureName}>NOEL SAHAGÚN CERVANTES</Text>
            <Text style={styles.signatureRole}>REPRESENTANTE LEGAL AROUNDAPLANET</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>
              <Text style={styles.signatureLabel}>"EL CLIENTE"</Text>
            </Text>
            <Text style={styles.signatureName}>{nombreCliente}</Text>
            {acompanantes ? <Text style={styles.signatureRole}>{acompanantes.toUpperCase()}</Text> : null}
          </View>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages} · Contrato ${contractId}`}
          fixed
        />
      </Page>

      {/* ANEXO 1 */}
      <Page size="LETTER" style={styles.page}>
        <ContractHeader direccionLinea1={BRAND.direccionLinea1} direccionLinea2={BRAND.direccionLinea2} />
        <ContractFooter
          contactoWeb={BRAND.contactoWeb}
          contactoTel={BRAND.contactoTel}
          contactoEmail={BRAND.contactoEmail}
        />

        <Text style={styles.annexTitle}>ANEXO 1 — {template.destinoLabel}</Text>

        <Text style={styles.annexSubtitle}>INCLUYE</Text>
        {template.anexoIncluye.map((item, i) => (
          <Text key={`inc-${i}`} style={styles.bullet}>
            • {item}
          </Text>
        ))}

        {template.anexoVisitamos && template.anexoVisitamos.length > 0 ? (
          <>
            <Text style={styles.annexSubtitle}>VISITAMOS</Text>
            {template.anexoVisitamos.map((item, i) => (
              <Text key={`vis-${i}`} style={styles.bullet}>
                • {item}
              </Text>
            ))}
          </>
        ) : null}

        {template.anexoNoIncluye && template.anexoNoIncluye.length > 0 ? (
          <>
            <Text style={styles.annexSubtitle}>NO INCLUYE</Text>
            {template.anexoNoIncluye.map((item, i) => (
              <Text key={`noinc-${i}`} style={styles.bullet}>
                • {item}
              </Text>
            ))}
          </>
        ) : null}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages} · Anexo 1`}
          fixed
        />
      </Page>
    </Document>
  )
}
