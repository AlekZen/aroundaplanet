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
import { loginSchema, type LoginFormData } from '@/schemas/loginSchema'
import { loginWithEmail, loginWithGoogle } from '@/lib/firebase/auth'
import { createUserProfile, getUserProfile, updateLastLogin } from '@/lib/firebase/firestore'
import { getFirebaseErrorMessage } from '@/lib/firebase/errors'
import { useAuthStore } from '@/stores/useAuthStore'
import { validateReturnUrl } from '@/lib/utils/validateReturnUrl'
import { GoogleIcon } from '@/components/shared/GoogleIcon'
import { trackEvent } from '@/lib/analytics'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrl = validateReturnUrl(searchParams.get('returnUrl'))
  const { isLoading, isAuthenticated } = useAuthStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
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
      </div>
    )
  }

  if (isAuthenticated) {
    return null
  }

  async function handleEmailLogin(data: LoginFormData) {
    setIsSubmitting(true)
    try {
      const credential = await loginWithEmail(data.email, data.password)
      const existingProfile = await getUserProfile(credential.user.uid)
      if (!existingProfile) {
        await createUserProfile(credential.user, 'email')
        trackEvent('sign_up', { method: 'email' })
      } else {
        await updateLastLogin(credential.user.uid)
      }
      // Ensure profile is in store before redirect (onIdTokenChanged may fire before doc exists)
      const freshProfile = await getUserProfile(credential.user.uid)
      useAuthStore.getState().setProfile(freshProfile)
      router.push(returnUrl)
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleLogin() {
    setIsSubmitting(true)
    try {
      const credential = await loginWithGoogle()
      const existingProfile = await getUserProfile(credential.user.uid)
      if (!existingProfile) {
        await createUserProfile(credential.user, 'google')
        trackEvent('sign_up', { method: 'google' })
      } else {
        await updateLastLogin(credential.user.uid)
      }
      const freshProfile = await getUserProfile(credential.user.uid)
      useAuthStore.getState().setProfile(freshProfile)
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
          Iniciar Sesion
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresa a tu cuenta de AroundaPlanet
        </p>
      </div>

      <form
        onSubmit={handleSubmit(handleEmailLogin)}
        className="space-y-4"
        noValidate
      >
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
            autoComplete="current-password"
            placeholder="Tu contraseña"
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

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent-light font-semibold"
        >
          {isSubmitting ? 'Iniciando sesion...' : 'Iniciar Sesion'}
        </Button>
      </form>

      <div className="text-center">
        <Link
          href="/forgot-password"
          className="inline-flex items-center min-h-11 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Olvide mi contraseña
        </Link>
      </div>

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
        onClick={handleGoogleLogin}
        className="w-full h-12"
      >
        <GoogleIcon className="mr-2 h-5 w-5" />
        Continuar con Google
      </Button>

      <p className="text-center text-sm text-muted-foreground flex items-center justify-center min-h-11">
        No tienes cuenta?{' '}
        <Link
          href="/register"
          className="text-primary font-medium hover:underline ml-1"
        >
          Registrate
        </Link>
      </p>
    </div>
  )
}
