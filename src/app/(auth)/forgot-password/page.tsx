'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendPasswordReset } from '@/lib/firebase/auth'
import { forgotPasswordSchema, type ForgotPasswordData } from '@/schemas/forgotPasswordSchema'

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  async function handleResetPassword(data: ForgotPasswordData) {
    setIsSubmitting(true)
    try {
      await sendPasswordReset(data.email)
      setIsSent(true)
    } catch {
      // Don't reveal if email exists — always show success
      setIsSent(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSent) {
    return (
      <div className="space-y-6 text-center">
        <div>
          <h2 className="font-heading text-2xl font-bold text-primary">
            Revisa tu correo electronico
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña.
          </p>
        </div>
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/login">Volver a iniciar sesion</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-heading text-2xl font-bold text-primary">
          Recuperar contraseña
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresa tu correo y te enviaremos un enlace de recuperacion
        </p>
      </div>

      <form onSubmit={handleSubmit(handleResetPassword)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Correo electronico</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            className="h-12"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p id="email-error" className="text-sm text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent-light font-semibold"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar enlace de recuperacion'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground flex items-center justify-center min-h-11">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Volver a iniciar sesion
        </Link>
      </p>
    </div>
  )
}
