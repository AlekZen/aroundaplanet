'use client'

import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface ProfilePhotoUploadProps {
  uid: string
  currentPhotoURL: string | null
  displayName: string
  onPhotoUpdated?: (url: string) => void
}

export function ProfilePhotoUpload({
  uid,
  currentPhotoURL,
  displayName,
  onPhotoUpdated,
}: ProfilePhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  function handleClick() {
    inputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Tipo de archivo invalido — solo JPG, PNG o WebP')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Archivo excede 5MB')
      return
    }

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    setIsUploading(true)
    setProgress(10)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Simulate progress steps while upload is in flight
      const progressTimer = setInterval(() => {
        setProgress((prev) => Math.min(prev + 15, 85))
      }, 200)

      const response = await fetch(`/api/users/${uid}/profile-photo`, {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressTimer)

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || 'Error al subir foto')
      }

      setProgress(100)
      const body = await response.json()
      toast.success('Foto actualizada')
      setPreview(null)
      onPhotoUpdated?.(body.photoURL)
    } catch (error) {
      setPreview(null)
      toast.error(error instanceof Error ? error.message : 'No pudimos subir la foto')
    } finally {
      setIsUploading(false)
      setProgress(0)
      URL.revokeObjectURL(objectUrl)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        className="relative group"
        aria-label="Cambiar foto de perfil"
        disabled={isUploading}
      >
        <Avatar className="h-24 w-24">
          <AvatarImage src={preview ?? currentPhotoURL ?? undefined} alt={displayName} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <Camera className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
      </button>

      {isUploading && (
        <Progress value={progress} className="w-24 h-1.5" aria-label="Progreso de subida" />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />
    </div>
  )
}
