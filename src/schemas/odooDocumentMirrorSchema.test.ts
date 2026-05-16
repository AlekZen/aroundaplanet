import { describe, it, expect } from 'vitest'
import {
  odooDocumentRawSchema,
  odooDocumentMirrorSchema,
  odooDocumentFolderMirrorSchema,
  odooDocumentFolderMappingSchema,
  documentsSyncRunSummarySchema,
  documentsSyncRequestSchema,
  odooStringOrNullSchema,
  odooMany2OneSchema,
} from './odooDocumentMirrorSchema'

describe('odooStringOrNullSchema — handle Odoo `false`', () => {
  it('passes string through', () => {
    expect(odooStringOrNullSchema.parse('hello')).toBe('hello')
  })
  it('coerces `false` to null', () => {
    expect(odooStringOrNullSchema.parse(false)).toBeNull()
  })
  it('coerces null/undefined', () => {
    expect(odooStringOrNullSchema.parse(null)).toBeNull()
    expect(odooStringOrNullSchema.parse(undefined)).toBeNull()
  })
})

describe('odooMany2OneSchema', () => {
  it('extracts [id, name]', () => {
    expect(odooMany2OneSchema.parse([42, 'Folder X'])).toEqual({ id: 42, name: 'Folder X' })
  })
  it('handles [id, false] (Odoo bug: name vacío)', () => {
    expect(odooMany2OneSchema.parse([42, false])).toEqual({ id: 42, name: null })
  })
  it('returns null for false', () => {
    expect(odooMany2OneSchema.parse(false)).toBeNull()
  })
})

describe('odooDocumentRawSchema', () => {
  it('parses real-shape row con false strings', () => {
    const row = {
      id: 2018,
      name: 'Recibo.pdf',
      type: 'binary',
      mimetype: 'application/pdf',
      file_size: 12345,
      folder_id: [49, 'PAGOS VIAJES 2026/2027'],
      attachment_id: [45803, false],
      res_model: false, // Odoo retorna false acá
      res_id: false,
      res_name: false,
      owner_id: [2, 'Noel Sahagun'],
      create_uid: [2, 'Noel Sahagun'],
      create_date: '2026-05-08 18:07:14',
      write_uid: [2, 'Noel Sahagun'],
      write_date: '2026-05-08 18:07:14',
      tag_ids: [47],
    }
    const parsed = odooDocumentRawSchema.parse(row)
    expect(parsed.id).toBe(2018)
    expect(parsed.res_model).toBeNull()
    expect(parsed.folder_id).toEqual({ id: 49, name: 'PAGOS VIAJES 2026/2027' })
    expect(parsed.attachment_id).toEqual({ id: 45803, name: null })
  })

  it('default tag_ids a []', () => {
    const parsed = odooDocumentRawSchema.parse({
      id: 1,
      name: 'X',
      type: 'binary',
      mimetype: false,
    })
    expect(parsed.tag_ids).toEqual([])
  })
})

describe('odooDocumentMirrorSchema', () => {
  it('valida mirror completo', () => {
    const doc = {
      odooDocumentId: 2018,
      name: 'Recibo.pdf',
      type: 'binary',
      mimetype: 'application/pdf',
      fileSize: 12345,
      folderId: 49,
      folderName: 'PAGOS',
      attachmentId: 45803,
      resModel: 'account.payment',
      resId: 8134,
      resName: 'Felipe RUBIO',
      ownerId: 2,
      ownerName: 'Noel',
      createUid: 2,
      createDate: '2026-05-08 18:07:14',
      writeUid: 2,
      writeDate: '2026-05-08 18:07:14',
      tagIds: [47],
      scope: 'payment' as const,
      syncedAt: new Date(),
      syncRunId: 'run-1',
    }
    expect(() => odooDocumentMirrorSchema.parse(doc)).not.toThrow()
  })

  it('rechaza scope inválido', () => {
    expect(
      odooDocumentMirrorSchema.safeParse({
        odooDocumentId: 1,
        name: 'x',
        type: 'binary',
        mimetype: null,
        fileSize: 0,
        folderId: null,
        folderName: null,
        attachmentId: null,
        resModel: null,
        resId: null,
        resName: null,
        ownerId: null,
        ownerName: null,
        createUid: null,
        createDate: null,
        writeUid: null,
        writeDate: null,
        tagIds: [],
        scope: 'pirate' as unknown as never,
        syncedAt: new Date(),
      }).success,
    ).toBe(false)
  })
})

describe('odooDocumentFolderMirrorSchema', () => {
  it('isCanonical/isDuplicate default false', () => {
    const folder = odooDocumentFolderMirrorSchema.parse({
      odooFolderId: 49,
      name: 'PAGOS',
      parentFolderId: null,
      parentFolderName: null,
      shortcutDocumentId: null,
      ownerId: null,
      ownerName: null,
      tagIds: [],
      createDate: null,
      writeDate: null,
      syncedAt: new Date(),
    })
    expect(folder.isCanonical).toBe(false)
    expect(folder.isDuplicate).toBe(false)
  })
})

describe('odooDocumentFolderMappingSchema', () => {
  it('status default a auto', () => {
    const m = odooDocumentFolderMappingSchema.parse({
      duplicateFolderId: 100,
      canonicalFolderId: 49,
      confidence: 80,
      detectedBy: 'story-9-5-execute',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    expect(m.status).toBe('auto')
  })

  it('rechaza canonical == duplicate? — schema no lo valida, lo hace el caller (TODO documented)', () => {
    // Solo verificamos que sí parsea — el guard semántico es responsabilidad del helper.
    const ok = odooDocumentFolderMappingSchema.safeParse({
      duplicateFolderId: 49,
      canonicalFolderId: 49,
      confidence: 100,
      detectedBy: 'admin-manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    expect(ok.success).toBe(true)
  })
})

describe('documentsSyncRequestSchema', () => {
  it('defaults', () => {
    const r = documentsSyncRequestSchema.parse({})
    expect(r.dryRun).toBe(false)
    expect(r.batchSize).toBe(200)
    expect(r.full).toBe(false)
  })
  it('batchSize debe estar en rango', () => {
    expect(documentsSyncRequestSchema.safeParse({ batchSize: 10 }).success).toBe(false)
    expect(documentsSyncRequestSchema.safeParse({ batchSize: 9999 }).success).toBe(false)
  })
})

describe('documentsSyncRunSummarySchema', () => {
  it('shape completo', () => {
    expect(
      documentsSyncRunSummarySchema.safeParse({
        created: 10,
        updated: 5,
        skipped: 0,
        errored: 0,
        cursor: '2026-05-16 00:00:00',
        durationMs: 1234,
        fetched: 15,
        runId: 'run-1',
        dryRun: false,
      }).success,
    ).toBe(true)
  })
})
