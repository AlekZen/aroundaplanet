import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { DocumentsList } from './DocumentsList'
import type { DocumentMirrorClient } from './types'

afterEach(cleanup)

const baseDoc: DocumentMirrorClient = {
  id: '42',
  odooDocumentId: 42,
  name: 'Comprobante de Felipe.pdf',
  type: 'binary',
  mimetype: 'application/pdf',
  fileSize: 256_000,
  folderId: 100,
  folderName: 'ASIA MAYO 2026',
  attachmentId: 999,
  resModel: 'product.template',
  resId: 1748,
  resName: 'ASIA MAYO 2026',
  scope: 'payment',
  writeDate: '2026-05-16 10:00:00',
  effectiveScope: 'payment',
  relationStatus: 'linked',
}

describe('<DocumentsList>', () => {
  it('renderiza filas + odoo id + scope badge + tamaño', () => {
    render(
      <DocumentsList
        documents={[baseDoc]}
        emptyText="vacío"
        onSelect={() => {}}
        selectedId={undefined}
      />,
    )
    expect(screen.getByText('Comprobante de Felipe.pdf')).toBeInTheDocument()
    expect(screen.getByText('Odoo #42')).toBeInTheDocument()
    expect(screen.getByText('Pago')).toBeInTheDocument()
    expect(screen.getByText('250 KB')).toBeInTheDocument()
  })

  it('muestra empty state', () => {
    render(
      <DocumentsList documents={[]} emptyText="No hay docs" onSelect={() => {}} />,
    )
    expect(screen.getByText('No hay docs')).toBeInTheDocument()
  })

  it('llama onSelect cuando se da click en Detalle', () => {
    const onSelect = vi.fn()
    render(<DocumentsList documents={[baseDoc]} emptyText="" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Detalle'))
    expect(onSelect).toHaveBeenCalledWith(baseDoc)
  })

  it('marca override admin cuando adminOverride.scope existe', () => {
    render(
      <DocumentsList
        documents={[
          {
            ...baseDoc,
            adminOverride: { scope: 'contract' },
            effectiveScope: 'contract',
          },
        ]}
        emptyText=""
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('Override admin')).toBeInTheDocument()
    expect(screen.getByText('Contrato')).toBeInTheDocument()
  })
})
