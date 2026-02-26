import { z } from 'zod'

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'El correo electronico es obligatorio')
    .email('Ingresa un correo electronico valido'),
})

export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>
