'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Landmark, Lock } from 'lucide-react'
import { bankDataSchema, type BankDataInput } from '@/schemas/profileSchema'
import { useAutoSave } from '@/hooks/useAutoSave'
import { ProfileSection } from './ProfileSection'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { BankData } from '@/types/user'

interface BankDataSectionProps {
  uid: string
  defaultValues?: BankData
}

export function BankDataSection({ uid, defaultValues }: BankDataSectionProps) {
  const form = useForm<BankDataInput>({
    resolver: zodResolver(bankDataSchema),
    defaultValues: {
      banco: defaultValues?.banco ?? '',
      numeroCuenta: defaultValues?.numeroCuenta ?? '',
      clabe: defaultValues?.clabe ?? '',
      titularCuenta: defaultValues?.titularCuenta ?? '',
    },
  })

  const { save } = useAutoSave<Record<string, unknown>>({
    endpoint: `/api/users/${uid}/profile`,
  })

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (!form.formState.isValid) return
      save({ section: 'bank', data: values })
    })
    return () => subscription.unsubscribe()
  }, [form, save])

  return (
    <ProfileSection
      title="Datos Bancarios"
      icon={<Landmark className="h-5 w-5 text-muted-foreground" />}
      badge={
        <Badge variant="outline" className="gap-1 text-xs">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Datos protegidos
        </Badge>
      }
    >
      <Form {...form}>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <FormField
            control={form.control}
            name="banco"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Banco</FormLabel>
                <FormControl>
                  <Input placeholder="BBVA, Banorte, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numeroCuenta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número de Cuenta</FormLabel>
                <FormControl>
                  <Input placeholder="1234567890123456" inputMode="numeric" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="clabe"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CLABE Interbancaria</FormLabel>
                <FormControl>
                  <Input placeholder="18 digitos" inputMode="numeric" maxLength={18} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="titularCuenta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Titular de la Cuenta</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre completo del titular" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </ProfileSection>
  )
}
