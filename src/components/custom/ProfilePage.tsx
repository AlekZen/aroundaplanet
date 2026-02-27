'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { Skeleton } from '@/components/ui/skeleton'
import { RoleBadge } from '@/components/custom/RoleBadge'
import { StatusBadge } from '@/components/custom/StatusBadge'
import { ProfilePhotoUpload } from './ProfilePhotoUpload'
import { PersonalDataSection } from './PersonalDataSection'
import { FiscalDataSection } from './FiscalDataSection'
import { BankDataSection } from './BankDataSection'
import { NotificationPreferencesSection } from './NotificationPreferencesSection'
import type { NotificationPreferences } from '@/types/user'

export function ProfilePage() {
  const { profile, claims, isLoading } = useAuthStore()
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true)

  const uid = profile?.uid
  const roles = claims?.roles ?? profile?.roles ?? []
  const isAgent = roles.includes('agente')

  function handlePhotoUpdated(url: string) {
    const store = useAuthStore.getState()
    if (store.profile) {
      store.setProfile({ ...store.profile, photoURL: url })
    }
  }

  // Fetch notification preferences
  useEffect(() => {
    if (!uid) return
    let cancelled = false

    async function fetchPreferences() {
      try {
        const response = await fetch(`/api/users/${uid}/preferences`)
        if (!response.ok) throw new Error('Failed to load preferences')
        const body = await response.json()
        if (!cancelled) setPreferences(body.preferences)
      } catch {
        // Preferences will use defaults
      } finally {
        if (!cancelled) setIsLoadingPrefs(false)
      }
    }

    fetchPreferences()
    return () => { cancelled = true }
  }, [uid])

  if (isLoading || !profile) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto">
      {/* Header: photo + name + roles */}
      <div className="flex flex-col items-center gap-3">
        <ProfilePhotoUpload
          uid={profile.uid}
          currentPhotoURL={profile.photoURL}
          displayName={profile.displayName}
          onPhotoUpdated={handlePhotoUpdated}
        />
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {profile.displayName}
        </h1>
        <div className="flex items-center gap-2">
          {roles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
          <StatusBadge isActive={profile.isActive} />
        </div>
      </div>

      {/* Profile sections */}
      <PersonalDataSection
        uid={profile.uid}
        defaultValues={{
          firstName: profile.firstName ?? profile.displayName.split(' ')[0] ?? '',
          lastName: profile.lastName ?? profile.displayName.split(' ').slice(1).join(' ') ?? '',
          phone: profile.phone,
        }}
        email={profile.email}
      />

      <FiscalDataSection
        uid={profile.uid}
        defaultValues={profile.fiscalData}
      />

      {isAgent && (
        <BankDataSection
          uid={profile.uid}
          defaultValues={profile.bankData}
        />
      )}

      {isLoadingPrefs ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <NotificationPreferencesSection
          uid={profile.uid}
          roles={roles}
          defaultPreferences={preferences ?? undefined}
        />
      )}
    </div>
  )
}
