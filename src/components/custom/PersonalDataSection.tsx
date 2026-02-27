'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { User } from 'lucide-react'
import { personalDataSchema, type PersonalDataInput } from '@/schemas/profileSchema'
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

interface PersonalDataSectionProps {
  uid: string
  defaultValues: {
    firstName: string
    lastName: string
    phone?: string
  }
  email: string
}

export function PersonalDataSection({
  uid,
  defaultValues,
  email,
}: PersonalDataSectionProps) {
  const form = useForm<PersonalDataInput>({
    resolver: zodResolver(personalDataSchema),
    defaultValues: {
      firstName: defaultValues.firstName,
      lastName: defaultValues.lastName,
      phone: defaultValues.phone ?? '',
    },
  })

  const { save } = useAutoSave<Record<string, unknown>>({
    endpoint: `/api/users/${uid}/profile`,
  })

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (!form.formState.isValid) return

      save({
        section: 'personal',
        data: {
          firstName: values.firstName ?? '',
          lastName: values.lastName ?? '',
          ...(values.phone !== undefined ? { phone: values.phone } : {}),
        },
      })
    })
    return () => subscription.unsubscribe()
  }, [form, save])

  return (
    <ProfileSection
      title="Datos Personales"
      icon={<User className="h-5 w-5 text-muted-foreground" />}
      defaultOpen
    >
      <Form {...form}>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Tu nombre" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido</FormLabel>
                <FormControl>
                  <Input placeholder="Tu apellido" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input placeholder="+52 333 123 4567" type="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <label htmlFor="profile-email" className="text-sm font-medium text-muted-foreground">Email</label>
            <Input id="profile-email" value={email} disabled className="mt-2 bg-muted" />
          </div>
        </form>
      </Form>
    </ProfileSection>
  )
}
