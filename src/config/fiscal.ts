/** SAT Regimen Fiscal options (Mexico) */
export const REGIMEN_FISCAL_OPTIONS = [
  { value: '601', label: 'General de Ley Personas Morales' },
  { value: '603', label: 'Personas Morales con Fines no Lucrativos' },
  { value: '605', label: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { value: '606', label: 'Arrendamiento' },
  { value: '608', label: 'Demas ingresos' },
  { value: '610', label: 'Residentes en el Extranjero sin EP en Mexico' },
  { value: '612', label: 'Personas Fisicas con Actividades Empresariales y Profesionales' },
  { value: '616', label: 'Sin obligaciones fiscales' },
  { value: '620', label: 'Sociedades Cooperativas de Produccion' },
  { value: '621', label: 'Incorporacion Fiscal' },
  { value: '625', label: 'Regimen de las Actividades Empresariales con ingresos a traves de Plataformas Tecnologicas' },
  { value: '626', label: 'Regimen Simplificado de Confianza' },
] as const

export const REGIMEN_FISCAL_VALUES = REGIMEN_FISCAL_OPTIONS.map((o) => o.value)

/** SAT Uso CFDI options */
export const USO_CFDI_OPTIONS = [
  { value: 'G01', label: 'Adquisicion de mercancias' },
  { value: 'G03', label: 'Gastos en general' },
  { value: 'I01', label: 'Construcciones' },
  { value: 'I08', label: 'Otra maquinaria y equipo' },
  { value: 'P01', label: 'Por definir' },
  { value: 'S01', label: 'Sin efectos fiscales' },
  { value: 'CP01', label: 'Pagos' },
] as const

export const USO_CFDI_VALUES = USO_CFDI_OPTIONS.map((o) => o.value)
