'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { RoleBadge } from '@/components/custom/RoleBadge'
import { StatusBadge } from '@/components/custom/StatusBadge'
import { VALID_ROLES } from '@/config/roles'
import type { UserProfile, UserRole } from '@/types/user'

const DEBOUNCE_MS = 300

/** Firestore Timestamps serialize as {_seconds, _nanoseconds} via JSON */
function timestampToDate(ts: unknown): Date | null {
  if (!ts || typeof ts !== 'object') return null
  const obj = ts as Record<string, unknown>
  const seconds = (obj.seconds ?? obj._seconds) as number | undefined
  return typeof seconds === 'number' ? new Date(seconds * 1000) : null
}

interface UserTableProps {
  onEditRoles: (user: UserProfile) => void
  onDeactivate: (user: UserProfile) => void
}

interface FetchState {
  users: UserProfile[]
  nextCursor: string | null
  total: number
  isLoading: boolean
  error: string | null
}

export function UserTable({ onEditRoles, onDeactivate }: UserTableProps) {
  const [state, setState] = useState<FetchState>({
    users: [], nextCursor: null, total: 0, isLoading: true, error: null,
  })
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const fetchUsers = useCallback(async (params: {
    search?: string; roleFilter?: string; statusFilter?: string; cursor?: string
  }) => {
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      const query = new URLSearchParams()
      if (params.search) query.set('search', params.search)
      if (params.roleFilter && params.roleFilter !== 'all') query.set('roleFilter', params.roleFilter)
      if (params.statusFilter && params.statusFilter !== 'all') query.set('statusFilter', params.statusFilter)
      if (params.cursor) query.set('cursor', params.cursor)

      const res = await fetch(`/api/users?${query.toString()}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Error al cargar usuarios')
      }
      const data = await res.json()
      setState({
        users: data.users ?? [],
        nextCursor: data.nextCursor ?? null,
        total: data.total ?? 0,
        isLoading: false,
        error: null,
      })
    } catch (err) {
      setState((s) => ({
        ...s, isLoading: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      }))
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCursor(undefined)
      fetchUsers({ search, roleFilter, statusFilter })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search, roleFilter, statusFilter, fetchUsers])

  function handleNextPage() {
    if (state.nextCursor) {
      setCursor(state.nextCursor)
      fetchUsers({ search, roleFilter, statusFilter, cursor: state.nextCursor })
    }
  }

  // Skeleton loading
  if (state.isLoading && state.users.length === 0) {
    return (
      <div className="space-y-4" role="status" aria-label="Cargando usuarios">
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  // Error state
  if (state.error) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
        <p className="text-sm text-destructive">{state.error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => fetchUsers({ search, roleFilter, statusFilter })}
        >
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
          aria-label="Buscar usuarios"
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por rol">
            <SelectValue placeholder="Todos los roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            {VALID_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por estado">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Empty state */}
      {state.users.length === 0 && !state.isLoading ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No se encontraron usuarios</p>
          {(search || roleFilter || statusFilter) && (
            <Button
              variant="link"
              onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter('') }}
              className="mt-2"
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ultimo acceso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.users.map((user) => (
                  <TableRow
                    key={user.uid}
                    className={!user.isActive ? 'opacity-60' : undefined}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onEditRoles(user)
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted font-heading text-sm font-semibold">
                          {user.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <span className="font-medium">{user.displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-muted-foreground">{user.email}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.map((role) => (
                          <RoleBadge key={role} role={role as UserRole} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge isActive={user.isActive} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {(() => {
                          const d = timestampToDate(user.lastLoginAt)
                          return d ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Nunca'
                        })()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditRoles(user)}
                          aria-label={`Editar roles de ${user.displayName}`}
                        >
                          Editar Roles
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={user.isActive ? 'text-destructive hover:text-destructive' : 'text-green-700 hover:text-green-800'}
                          onClick={() => onDeactivate(user)}
                          aria-label={user.isActive ? `Desactivar a ${user.displayName}` : `Reactivar a ${user.displayName}`}
                        >
                          {user.isActive ? 'Desactivar' : 'Reactivar'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {state.users.map((user) => (
              <Card key={user.uid} className={!user.isActive ? 'opacity-60' : undefined}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-heading text-sm font-semibold">
                    {user.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium">{user.displayName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{user.email}</p>
                    <div className="flex flex-wrap gap-1">
                      {user.roles?.map((role) => (
                        <RoleBadge key={role} role={role as UserRole} />
                      ))}
                      <StatusBadge isActive={user.isActive} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditRoles(user)}
                      aria-label={`Editar roles de ${user.displayName}`}
                    >
                      Roles
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={user.isActive ? 'text-destructive' : 'text-green-700'}
                      onClick={() => onDeactivate(user)}
                      aria-label={user.isActive ? `Desactivar a ${user.displayName}` : `Reactivar a ${user.displayName}`}
                    >
                      {user.isActive ? 'Desactivar' : 'Reactivar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Loading overlay during pagination */}
      {state.isLoading && state.users.length > 0 && (
        <div className="flex justify-center py-4" role="status" aria-label="Cargando mas usuarios">
          <Skeleton className="h-10 w-32" />
        </div>
      )}

      {/* Pagination + count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{state.total} usuario{state.total !== 1 ? 's' : ''}</span>
        {state.nextCursor && (
          <Button variant="outline" size="sm" onClick={handleNextPage} disabled={state.isLoading}>
            Cargar mas
          </Button>
        )}
      </div>
    </div>
  )
}
