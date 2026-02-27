import { z } from 'zod'
import { REGIMEN_FISCAL_VALUES, USO_CFDI_VALUES } from '@/config/fiscal'

export const personalDataSchema = z.object({
  firstName: z.string().min(1, 'Nombre es requerido').max(100, 'Maximo 100 caracteres'),
  lastName: z.string().min(1, 'Apellido es requerido').max(100, 'Maximo 100 caracteres'),
  phone: z
    .string()
    .regex(/^\+?[0-9\s\-()]{10,20}$/, 'Formato de telefono invalido')
    .optional()
    .or(z.literal('')),
})

export const fiscalDataSchema = z.object({
  rfc: z
    .string()
    .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, 'RFC invalido — formato esperado: XXXX000000XXX'),
  razonSocial: z.string().min(1, 'Razon social es requerida').max(150, 'Maximo 150 caracteres'),
  regimenFiscal: z.string().refine(
    (val) => (REGIMEN_FISCAL_VALUES as readonly string[]).includes(val),
    'Regimen fiscal invalido'
  ),
  domicilioFiscal: z.string().min(1, 'Domicilio fiscal es requerido').max(255, 'Maximo 255 caracteres'),
  usoCFDI: z.string().refine(
    (val) => (USO_CFDI_VALUES as readonly string[]).includes(val),
    'Uso CFDI invalido'
  ),
})

export const bankDataSchema = z.object({
  banco: z.string().min(1, 'Banco es requerido'),
  numeroCuenta: z
    .string()
    .regex(/^\d{10,18}$/, 'Numero de cuenta debe tener entre 10 y 18 digitos'),
  clabe: z
    .string()
    .regex(/^\d{18}$/, 'CLABE debe tener exactamente 18 digitos'),
  titularCuenta: z.string().min(1, 'Titular es requerido').max(100, 'Maximo 100 caracteres'),
})

/** Request body schema for PATCH /api/users/[uid]/profile */
export const profileUpdateSchema = z.discriminatedUnion('section', [
  z.object({ section: z.literal('personal'), data: personalDataSchema }),
  z.object({ section: z.literal('fiscal'), data: fiscalDataSchema }),
  z.object({ section: z.literal('bank'), data: bankDataSchema }),
])

export type PersonalDataInput = z.infer<typeof personalDataSchema>
export type FiscalDataInput = z.infer<typeof fiscalDataSchema>
export type BankDataInput = z.infer<typeof bankDataSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
