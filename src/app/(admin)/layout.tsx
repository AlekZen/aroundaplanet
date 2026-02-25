import { AdminShell } from '@/components/shared/AdminShell'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell roles={['admin']}>{children}</AdminShell>
}
