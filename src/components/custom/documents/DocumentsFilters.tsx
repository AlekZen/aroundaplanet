'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SCOPE_LABELS, SCOPE_OPTIONS, type DocumentScope } from './types'

export interface DocumentsFiltersValue {
  search: string
  scope: DocumentScope | 'all'
}

interface Props {
  value: DocumentsFiltersValue
  onChange: (next: DocumentsFiltersValue) => void
}

export function DocumentsFilters({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder="Buscar documento, carpeta, producto o ID"
          className="pl-9"
        />
      </div>
      <Select
        value={value.scope}
        onValueChange={(next) => onChange({ ...value, scope: next as DocumentScope | 'all' })}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Scope" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los scopes</SelectItem>
          {SCOPE_OPTIONS.map((scope) => (
            <SelectItem key={scope} value={scope}>
              {SCOPE_LABELS[scope]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
