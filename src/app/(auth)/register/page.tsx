'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { FirebaseError } from 'firebase/app'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  registerSchema,
  type RegisterFormData,
} from '@/schemas/registerSchema'
import { registerWithEmail, loginWithGoogle } from '@/lib/firebase/auth'
import { createUserProfile, getUserProfile, updateLastLogin } from '@/lib/firebase/firestore'
import { getFirebaseErrorMessage } from '@/lib/firebase/errors'
import { useAuthStore } from '@/stores/useAuthStore'
import { validateReturnUrl } from '@/lib/utils/validateReturnUrl'
import { GoogleIcon } from '@/components/shared/GoogleIcon'

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrl = validateReturnUrl(searchParams.get('returnUrl'))
  const { isLoading, isAuthenticated } = useAuthStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(returnUrl)
    }
  }, [isAuthenticated, router, returnUrl])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (isAuthenticated) {
    return null
  }

  async function handleEmailRegister(data: RegisterFormData) {
    setIsSubmitting(true)
    try {
      const credential = await registerWithEmail(
        data.email,
        data.password,
        data.displayName
      )
      await createUserProfile(credential.user, 'email')
      // Refresh profile in store after creation (onIdTokenChanged fires before doc exists)
      const freshProfile = await getUserProfile(credential.user.uid)
      useAuthStore.getState().setProfile(freshProfile)
      toast.success('Cuenta creada exitosamente')
      router.push(returnUrl)
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleRegister() {
    setIsSubmitting(true)
    try {
      const credential = await loginWithGoogle()
      const existingProfile = await getUserProfile(credential.user.uid)
      if (!existingProfile) {
        await createUserProfile(credential.user, 'google')
      } else {
        await updateLastLogin(credential.user.uid)
      }
      router.push(returnUrl)
    } catch (error) {
      if (
        error instanceof FirebaseError &&
        error.code === 'auth/popup-closed-by-user'
      ) {
        setIsSubmitting(false)
        return
      }
      toast.error(getFirebaseErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-heading text-2xl font-bold text-primary">
          Crear Cuenta
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Unete a AroundaPlanet
        </p>
      </div>

      <form
        onSubmit={handleSubmit(handleEmailRegister)}
        className="space-y-4"
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="displayName">Nombre completo</Label>
          <Input
            id="displayName"
            type="text"
            autoComplete="name"
            placeholder="Tu nombre"
            className="h-12"
            aria-invalid={!!errors.displayName}
            aria-describedby={
              errors.displayName ? 'name-error' : undefined
            }
            {...register('displayName')}
          />
          {errors.displayName && (
            <p
              id="name-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.displayName.message}
            </p>
          )}
        </div>

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
            <p
              id="email-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Minimo 8 caracteres, 1 letra y 1 numero"
            className="h-12"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
          />
          {errors.password && (
            <p
              id="password-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repite tu contraseña"
            className="h-12"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={
              errors.confirmPassword ? 'confirm-error' : undefined
            }
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p
              id="confirm-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent-light font-semibold"
        >
          {isSubmitting ? 'Creando cuenta...' : 'Crear Cuenta'}
        </Button>
      </form>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-sm text-muted-foreground">
          o
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={isSubmitting}
        onClick={handleGoogleRegister}
        className="w-full h-12"
      >
        <GoogleIcon className="mr-2 h-5 w-5" />
        Continuar con Google
      </Button>

      <p className="text-center text-sm text-muted-foreground flex items-center justify-center min-h-11">
        Ya tienes cuenta?{' '}
        <Link
          href="/login"
          className="text-primary font-medium hover:underline ml-1"
        >
          Inicia Sesion
        </Link>
      </p>
    </div>
  )
}
