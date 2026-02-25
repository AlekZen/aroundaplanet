import { AdminShell } from '@/components/shared/AdminShell'

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell roles={['superadmin']}>{children}</AdminShell>
}
