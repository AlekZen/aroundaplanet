import Link from 'next/link'
import { BookOpen, ChevronRight } from 'lucide-react'
import { ProfilePage } from '@/components/custom/ProfilePage'

export default function ClientProfilePage() {
  return (
    <div>
      <ProfilePage />
      <div className="mx-auto mt-4 max-w-2xl px-4 pb-6">
        <Link
          href="/client/manual"
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent-muted/40 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-muted/60 text-primary">
            <BookOpen className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block font-heading text-base font-semibold text-foreground">
              Ayuda y manual
            </span>
            <span className="block text-sm text-muted-foreground">
              Guía paso a paso para usar la app
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
