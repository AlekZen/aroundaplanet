import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

// sonner toast: mock para evitar portal mount issues
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { FolderClusterView } from './FolderClusterView'
import type { FolderMirrorClient } from './types'
import { toast } from 'sonner'

afterEach(cleanup)

const folder: FolderMirrorClient = {
  id: '100',
  odooFolderId: 100,
  name: 'ASIA MAYO 2026',
  parentFolderId: 1,
  parentFolderName: 'Viajes',
  isCanonical: true,
  isDuplicate: false,
  writeDate: '2026-05-16',
  fileCount: 3,
}

describe('<FolderClusterView>', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    ;(toast.success as ReturnType<typeof vi.fn>).mockClear()
    ;(toast.error as ReturnType<typeof vi.fn>).mockClear()
  })

  it('renderiza tabla con badge canónico + conteo de archivos', () => {
    render(<FolderClusterView folders={[folder]} />)
    expect(screen.getByText('ASIA MAYO 2026')).toBeInTheDocument()
    expect(screen.getByText('Canónico')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('empty state', () => {
    render(<FolderClusterView folders={[]} />)
    expect(screen.getByText('No hay carpetas con ese filtro.')).toBeInTheDocument()
  })

  it('confirma mapping vía fetch POST a /folder-mappings con productId numérico', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )

    render(<FolderClusterView folders={[folder]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Acciones' }))
    const productIdInput = screen.getByPlaceholderText('Product ID (opcional)')
    fireEvent.change(productIdInput, { target: { value: '1748' } })
    fireEvent.click(screen.getByText('Confirmar mapping'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/odoo/documents/folder-mappings')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({ folderId: 100, action: 'confirm', productId: 1748 })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Mapping confirmado'))
  })

  it('error de servidor muestra toast.error sin reset del busy permanente', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Folder mirror no encontrado' }), {
        status: 404,
      }),
    )
    render(<FolderClusterView folders={[folder]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Acciones' }))
    fireEvent.click(screen.getByText('Ignorar'))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Folder mirror no encontrado'),
    )
  })
})
