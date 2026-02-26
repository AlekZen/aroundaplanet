import { z } from 'zod'

export const registerSchema = z
  .object({
    displayName: z
      .string()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(100, 'El nombre no puede exceder 100 caracteres'),
    email: z
      .string()
      .min(1, 'El correo electronico es obligatorio')
      .email('Ingresa un correo electronico valido'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .regex(/[a-zA-Z]/, 'La contraseña debe contener al menos una letra')
      .regex(/[0-9]/, 'La contraseña debe contener al menos un numero'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type RegisterFormData = z.infer<typeof registerSchema>
