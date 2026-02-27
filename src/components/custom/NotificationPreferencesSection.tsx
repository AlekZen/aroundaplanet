'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import {
  NOTIFICATION_CATEGORIES,
  ROLE_NOTIFICATION_CATEGORIES,
  TIMEZONE_OPTIONS,
  type NotificationCategoryKey,
} from '@/config/notifications'
import { ProfileSection } from './ProfileSection'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { UserRole, NotificationPreferences } from '@/types/user'

interface NotificationPreferencesSectionProps {
  uid: string
  roles: UserRole[]
  defaultPreferences?: NotificationPreferences
}

export function NotificationPreferencesSection({
  uid,
  roles,
  defaultPreferences,
}: NotificationPreferencesSectionProps) {
  const allowedCategories = roles.flatMap(
    (role) => ROLE_NOTIFICATION_CATEGORIES[role] ?? []
  )
  const uniqueCategories = [...new Set(allowedCategories)]

  const [categories, setCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const key of uniqueCategories) {
      initial[key] = defaultPreferences?.categories[key] ?? true
    }
    return initial
  })

  const [quietHours, setQuietHours] = useState({
    enabled: defaultPreferences?.quietHours?.enabled ?? true,
    startTime: defaultPreferences?.quietHours?.startTime ?? '23:00',
    endTime: defaultPreferences?.quietHours?.endTime ?? '07:00',
  })

  const [channels, setChannels] = useState({
    push: defaultPreferences?.channels?.push ?? true,
    whatsapp: defaultPreferences?.channels?.whatsapp ?? true,
    email: defaultPreferences?.channels?.email ?? false,
  })

  const [timezone, setTimezone] = useState(
    defaultPreferences?.timezone ?? 'America/Mexico_City'
  )

  const [isSaving, setIsSaving] = useState(false)

  // Update state when defaultPreferences change (initial load)
  useEffect(() => {
    if (!defaultPreferences) return
    const newCategories: Record<string, boolean> = {}
    for (const key of uniqueCategories) {
      newCategories[key] = defaultPreferences.categories[key] ?? true
    }
    setCategories(newCategories)
    setQuietHours({
      enabled: defaultPreferences.quietHours?.enabled ?? true,
      startTime: defaultPreferences.quietHours?.startTime ?? '23:00',
      endTime: defaultPreferences.quietHours?.endTime ?? '07:00',
    })
    setChannels({
      push: defaultPreferences.channels?.push ?? true,
      whatsapp: defaultPreferences.channels?.whatsapp ?? true,
      email: defaultPreferences.channels?.email ?? false,
    })
    setTimezone(defaultPreferences.timezone ?? 'America/Mexico_City')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPreferences])

  async function handleSave() {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/users/${uid}/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories, quietHours, channels, timezone }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || 'Error al guardar preferencias')
      }

      toast.success('Preferencias guardadas', { duration: 4000 })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No pudimos guardar — intenta de nuevo',
        { duration: 0 }
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ProfileSection
      title="Notificaciones"
      icon={<Bell className="h-5 w-5 text-muted-foreground" />}
    >
      <div className="space-y-6">
        {/* Category toggles */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Categorías</h3>
          {uniqueCategories.map((key) => {
            const category = NOTIFICATION_CATEGORIES[key as NotificationCategoryKey]
            return (
              <div key={key} className="flex items-center justify-between min-h-[44px]">
                <div>
                  <Label htmlFor={`cat-${key}`} className="text-sm">
                    {category.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{category.description}</p>
                </div>
                <Switch
                  id={`cat-${key}`}
                  checked={categories[key] ?? true}
                  onCheckedChange={(checked) =>
                    setCategories((prev) => ({ ...prev, [key]: checked }))
                  }
                />
              </div>
            )
          })}
        </div>

        <Separator />

        {/* Channels */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Canales</h3>
          {[
            { key: 'push' as const, label: 'Notificaciones push' },
            { key: 'whatsapp' as const, label: 'WhatsApp' },
            { key: 'email' as const, label: 'Email' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between min-h-[44px]">
              <Label htmlFor={`channel-${key}`} className="text-sm">
                {label}
              </Label>
              <Switch
                id={`channel-${key}`}
                checked={channels[key]}
                onCheckedChange={(checked) =>
                  setChannels((prev) => ({ ...prev, [key]: checked }))
                }
              />
            </div>
          ))}
        </div>

        <Separator />

        {/* Quiet hours */}
        <div className="space-y-3">
          <div className="flex items-center justify-between min-h-[44px]">
            <div>
              <h3 className="text-sm font-medium">Horas de silencio</h3>
              <p className="text-xs text-muted-foreground">
                No enviar notificaciones en este horario
              </p>
            </div>
            <Switch
              id="quiet-hours-enabled"
              checked={quietHours.enabled}
              onCheckedChange={(enabled) =>
                setQuietHours((prev) => ({ ...prev, enabled }))
              }
            />
          </div>
          {quietHours.enabled && (
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <Label htmlFor="quiet-start" className="text-xs text-muted-foreground">
                  Desde
                </Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={quietHours.startTime}
                  onChange={(e) =>
                    setQuietHours((prev) => ({ ...prev, startTime: e.target.value }))
                  }
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="quiet-end" className="text-xs text-muted-foreground">
                  Hasta
                </Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={quietHours.endTime}
                  onChange={(e) =>
                    setQuietHours((prev) => ({ ...prev, endTime: e.target.value }))
                  }
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Timezone */}
        <div className="space-y-2">
          <Label htmlFor="timezone" className="text-sm font-medium">
            Zona horaria
          </Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone">
              <SelectValue placeholder="Selecciona zona" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full"
        >
          {isSaving ? 'Guardando...' : 'Guardar preferencias'}
        </Button>
      </div>
    </ProfileSection>
  )
}
