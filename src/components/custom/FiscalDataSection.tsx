'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FileText, Lock } from 'lucide-react'
import { fiscalDataSchema, type FiscalDataInput } from '@/schemas/profileSchema'
import { REGIMEN_FISCAL_OPTIONS, USO_CFDI_OPTIONS } from '@/config/fiscal'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { FiscalData } from '@/types/user'

interface FiscalDataSectionProps {
  uid: string
  defaultValues?: FiscalData
}

export function FiscalDataSection({ uid, defaultValues }: FiscalDataSectionProps) {
  const form = useForm<FiscalDataInput>({
    resolver: zodResolver(fiscalDataSchema),
    defaultValues: {
      rfc: defaultValues?.rfc ?? '',
      razonSocial: defaultValues?.razonSocial ?? '',
      regimenFiscal: defaultValues?.regimenFiscal ?? '',
      domicilioFiscal: defaultValues?.domicilioFiscal ?? '',
      usoCFDI: defaultValues?.usoCFDI ?? '',
    },
  })

  const { save } = useAutoSave<Record<string, unknown>>({
    endpoint: `/api/users/${uid}/profile`,
  })

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (!form.formState.isValid) return
      save({ section: 'fiscal', data: values })
    })
    return () => subscription.unsubscribe()
  }, [form, save])

  return (
    <ProfileSection
      title="Datos Fiscales"
      icon={<FileText className="h-5 w-5 text-muted-foreground" />}
      badge={
        <Badge variant="outline" className="gap-1 text-xs">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Solo tu ves estos datos
        </Badge>
      }
    >
      <Form {...form}>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <FormField
            control={form.control}
            name="rfc"
            render={({ field }) => (
              <FormItem>
                <FormLabel>RFC</FormLabel>
                <FormControl>
                  <Input
                    placeholder="XAXX010101000"
                    className="uppercase"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="razonSocial"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Razón Social</FormLabel>
                <FormControl>
                  <Input placeholder="Mi Empresa S.A. de C.V." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="regimenFiscal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Regimen Fiscal</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona regimen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {REGIMEN_FISCAL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="domicilioFiscal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Domicilio Fiscal</FormLabel>
                <FormControl>
                  <Input placeholder="Calle, Numero, Colonia, CP" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="usoCFDI"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Uso CFDI</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona uso CFDI" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {USO_CFDI_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </ProfileSection>
  )
}
