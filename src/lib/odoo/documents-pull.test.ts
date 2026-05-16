import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {},
}))

import {
  buildFolderPathMap,
  inferScope,
  mapRawToDocumentMirror,
  mapRawToFolderMirror,
  syncOdooDocuments,
  DocumentsSyncLockError,
  TAG_FOLDER_CANONICO,
  TAG_FOLDER_DUPLICADO,
} from './documents-pull'
import { odooDocumentRawSchema, type OdooDocumentRaw } from '@/schemas/odooDocumentMirrorSchema'

function parseRow(raw: unknown): OdooDocumentRaw {
  return odooDocumentRawSchema.parse(raw)
}

// Raw-shape fixtures (Odoo XML-RPC retorna tuplas para many2one, no objetos)
type RawRow = {
  id: number
  name: string
  type: string
  mimetype: string | false | null
  file_size: number
  folder_id: [number, string] | false | null
  attachment_id: [number, string | false] | false | null
  res_model: string | false | null
  res_id: number | false | null
  res_name: string | false | null
  owner_id: [number, string] | false | null
  create_uid: [number, string] | false | null
  create_date: string | false | null
  write_uid: [number, string] | false | null
  write_date: string
  tag_ids: number[]
  parent_folder_id: [number, string] | false | null
  shortcut_document_id: [number, string] | false | null
}

function makeFolder(id: number, name: string, parentId: number | null = null): RawRow {
  return {
    id,
    name,
    type: 'folder',
    mimetype: false,
    file_size: 0,
    folder_id: parentId != null ? [parentId, `parent-${parentId}`] : false,
    attachment_id: false,
    res_model: false,
    res_id: false,
    res_name: false,
    owner_id: false,
    create_uid: false,
    create_date: false,
    write_uid: false,
    write_date: '2026-05-16 00:00:00',
    tag_ids: [],
    parent_folder_id: false,
    shortcut_document_id: false,
  }
}

function makeDoc(id: number, name: string, folderId: number | null = null): RawRow {
  return {
    id,
    name,
    type: 'binary',
    mimetype: 'application/pdf',
    file_size: 1024,
    folder_id: folderId != null ? [folderId, `folder-${folderId}`] : false,
    attachment_id: [99, false],
    res_model: false,
    res_id: false,
    res_name: false,
    owner_id: false,
    create_uid: false,
    create_date: false,
    write_uid: false,
    write_date: '2026-05-16 10:00:00',
    tag_ids: [],
    parent_folder_id: false,
    shortcut_document_id: false,
  }
}

// -------- Helpers fake Firestore --------
interface FakeDoc {
  data: Record<string, unknown> | undefined
}
function makeFakeDb() {
  const store = new Map<string, FakeDoc>()
  const batches: Array<Array<{ path: string; data: Record<string, unknown> }>> = []

  function pathAwareCollection(name: string) {
    return {
      doc: (id: string) => {
        const path = `${name}/${id}`
        return {
          _path: path,
          get: async () => ({
            exists: store.has(path),
            data: () => store.get(path)?.data,
          }),
          set: async (data: Record<string, unknown>) => {
            const prev = store.get(path)?.data ?? {}
            store.set(path, { data: { ...prev, ...data } })
          },
        }
      },
    }
  }

  function pathAwareBatch() {
    const ops: Array<{ path: string; data: Record<string, unknown> }> = []
    return {
      set: (ref: { _path: string }, data: Record<string, unknown>) => {
        ops.push({ path: ref._path, data })
      },
      commit: async () => {
        for (const op of ops) {
          const prev = store.get(op.path)?.data ?? {}
          store.set(op.path, { data: { ...prev, ...op.data } })
        }
        batches.push([...ops])
        ops.length = 0
      },
    }
  }

  return {
    db: {
      collection: pathAwareCollection,
      batch: pathAwareBatch,
      // Transaction shim — para acquireLock
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: async (ref: { _path: string }) => ({
            exists: store.has(ref._path),
            data: () => store.get(ref._path)?.data,
          }),
          set: (ref: { _path: string }, data: Record<string, unknown>) => {
            const prev = store.get(ref._path)?.data ?? {}
            store.set(ref._path, { data: { ...prev, ...data } })
          },
        }
        return fn(tx)
      },
    } as unknown as import('firebase-admin/firestore').Firestore,
    store,
    batches,
  }
}

function makeFakeClient(rows: RawRow[]) {
  return {
    searchRead: vi.fn(async (_model: string, domain: unknown[], _fields: string[], opts: { offset?: number; limit?: number } | undefined) => {
      // Simula filtro write_date > cursor + paginación
      const offset = opts?.offset ?? 0
      const limit = opts?.limit ?? 200
      let filtered = rows
      // domain shape: [] o [['write_date','>',cursor]] o [['type','=','folder'],['id','in',[...]]]
      for (const clause of domain as unknown[][]) {
        if (Array.isArray(clause) && clause[0] === 'write_date' && clause[1] === '>') {
          filtered = filtered.filter((r) => (r.write_date ?? '') > (clause[2] as string))
        }
        if (Array.isArray(clause) && clause[0] === 'type' && clause[1] === '=' && clause[2] === 'folder') {
          filtered = filtered.filter((r) => r.type === 'folder')
        }
        if (Array.isArray(clause) && clause[0] === 'id' && clause[1] === 'in') {
          const ids = clause[2] as number[]
          filtered = filtered.filter((r) => ids.includes(r.id))
        }
      }
      return filtered.slice(offset, offset + limit)
    }),
  } as unknown as Parameters<typeof syncOdooDocuments>[1]
}

// =====================================================================
// Tests puros
// =====================================================================

describe('inferScope', () => {
  it('detecta payment por path PAGOS', () => {
    expect(inferScope('PAGOS VIAJES 2026', 'Felipe.pdf')).toBe('payment')
  })
  it('detecta sales por VENTAS', () => {
    expect(inferScope('VENTAS MAYO 2026', 'x.pdf')).toBe('sales')
  })
  it('detecta contrato', () => {
    expect(inferScope('CONTRATOS NAC', 'x.pdf')).toBe('contract')
  })
  it('fallback unmatched', () => {
    expect(inferScope(null, 'random.pdf')).toBe('unmatched')
  })
})

describe('buildFolderPathMap', () => {
  it('arma path con jerarquía', () => {
    const root = parseRow(makeFolder(1, 'Projects'))
    const child = parseRow(makeFolder(2, 'Asia', 1))
    const grand = parseRow(makeFolder(3, 'Asia Mayo 2026', 2))
    const map = buildFolderPathMap([root, child, grand])
    expect(map.get(1)).toBe('Projects')
    expect(map.get(2)).toBe('Projects / Asia')
    expect(map.get(3)).toBe('Projects / Asia / Asia Mayo 2026')
  })
  it('rompe ciclos defensivos', () => {
    const a = parseRow(makeFolder(1, 'A', 2))
    const b = parseRow(makeFolder(2, 'B', 1))
    const map = buildFolderPathMap([a, b])
    expect(map.has(1)).toBe(true)
    expect(map.has(2)).toBe(true)
  })
})

describe('mapRawToFolderMirror', () => {
  it('marca isCanonical cuando tag_ids contiene 49', () => {
    const raw = parseRow({ ...makeFolder(50, 'X'), tag_ids: [TAG_FOLDER_CANONICO] })
    const m = mapRawToFolderMirror(raw, 'run-1')
    expect(m.isCanonical).toBe(true)
    expect(m.isDuplicate).toBe(false)
  })
  it('marca isDuplicate cuando tag_ids contiene 50', () => {
    const raw = parseRow({ ...makeFolder(60, 'Y'), tag_ids: [TAG_FOLDER_DUPLICADO] })
    const m = mapRawToFolderMirror(raw, 'run-1')
    expect(m.isDuplicate).toBe(true)
  })
})

describe('mapRawToDocumentMirror', () => {
  it('mapea con scope inferido del folder path', () => {
    const folderMap = new Map<number, string>([[49, 'PAGOS VIAJES 2026']])
    const raw = parseRow(makeDoc(2018, 'Felipe.pdf', 49))
    const m = mapRawToDocumentMirror(raw, folderMap, 'run-1')
    expect(m.scope).toBe('payment')
    expect(m.folderId).toBe(49)
    expect(m.folderName).toBe('folder-49')
  })
})

// =====================================================================
// Tests integración syncOdooDocuments
// =====================================================================

describe('syncOdooDocuments — happy path', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-16T12:00:00Z'))
  })

  it('escribe folders y docs a Firestore con cursor incremental', async () => {
    const fake = makeFakeDb()
    const rows = [
      makeFolder(49, 'PAGOS'),
      { ...makeDoc(2018, 'Felipe.pdf', 49), write_date: '2026-05-16 10:00:00' as string },
      { ...makeDoc(2019, 'Maria.pdf', 49), write_date: '2026-05-16 11:00:00' as string },
    ]
    const client = makeFakeClient(rows)
    const summary = await syncOdooDocuments({ runId: 'r1', now: () => Date.now() }, client, fake.db)

    expect(summary.fetched).toBe(3)
    expect(summary.updated).toBe(3)
    expect(summary.errored).toBe(0)
    expect(summary.cursor).toBe('2026-05-16 11:00:00')

    // Verifica escrituras
    expect(fake.store.has('odooDocumentFolders/49')).toBe(true)
    expect(fake.store.has('odooDocuments/2018')).toBe(true)
    expect(fake.store.has('odooDocuments/2019')).toBe(true)

    const doc = fake.store.get('odooDocuments/2018')!.data
    expect(doc?.scope).toBe('payment')
    expect(doc?.syncRunId).toBe('r1')

    // Cursor persistido + lock liberado
    const cursor = fake.store.get('syncCursors/odooDocuments')!.data
    expect(cursor?.lastCursor).toBe('2026-05-16 11:00:00')
    expect(cursor?.inProgress).toBe(false)
    expect(cursor?.lastError).toBeNull()
  })

  it('dryRun NO escribe Firestore pero reporta updated', async () => {
    const fake = makeFakeDb()
    const rows = [makeFolder(49, 'X'), makeDoc(2018, 'x.pdf', 49)]
    const client = makeFakeClient(rows)
    const summary = await syncOdooDocuments({ dryRun: true, runId: 'r1' }, client, fake.db)
    expect(summary.dryRun).toBe(true)
    expect(summary.updated).toBe(2)
    expect(fake.store.has('odooDocuments/2018')).toBe(false)
    expect(fake.store.has('syncCursors/odooDocuments')).toBe(false)
  })

  it('incremental: respeta lastCursor', async () => {
    const fake = makeFakeDb()
    fake.store.set('syncCursors/odooDocuments', {
      data: { lastCursor: '2026-05-16 10:30:00' },
    })
    const rows = [
      { ...makeDoc(2018, 'old.pdf', 49), write_date: '2026-05-16 10:00:00' as string },
      { ...makeDoc(2019, 'new.pdf', 49), write_date: '2026-05-16 11:00:00' as string },
    ]
    const client = makeFakeClient(rows)
    const summary = await syncOdooDocuments({ runId: 'r1' }, client, fake.db)
    expect(summary.fetched).toBe(1)
    expect(fake.store.has('odooDocuments/2019')).toBe(true)
    expect(fake.store.has('odooDocuments/2018')).toBe(false)
  })

  it('lanza DocumentsSyncLockError si otro run está activo', async () => {
    const fake = makeFakeDb()
    const fixedNow = Date.now()
    // Simular lock activo reciente con timestamp con toMillis()
    fake.store.set('syncCursors/odooDocuments', {
      data: {
        inProgress: true,
        inProgressRunId: 'other-run',
        inProgressStartedAt: { toMillis: () => fixedNow - 1000 },
      },
    })
    const rows = [makeDoc(2018, 'x.pdf', 49)]
    const client = makeFakeClient(rows)
    await expect(
      syncOdooDocuments({ runId: 'r1', now: () => fixedNow }, client, fake.db),
    ).rejects.toBeInstanceOf(DocumentsSyncLockError)
  })

  it('stale lock (>10min) es robado', async () => {
    const fake = makeFakeDb()
    const fixedNow = Date.now()
    fake.store.set('syncCursors/odooDocuments', {
      data: {
        inProgress: true,
        inProgressRunId: 'stale',
        inProgressStartedAt: { toMillis: () => fixedNow - 11 * 60 * 1000 },
      },
    })
    const rows = [makeFolder(49, 'X')]
    const client = makeFakeClient(rows)
    const summary = await syncOdooDocuments({ runId: 'r1', now: () => fixedNow }, client, fake.db)
    expect(summary.fetched).toBe(1)
  })

  it('full=true ignora cursor y trae todo', async () => {
    const fake = makeFakeDb()
    fake.store.set('syncCursors/odooDocuments', {
      data: { lastCursor: '2099-01-01 00:00:00' },
    })
    const rows = [
      { ...makeDoc(2018, 'old.pdf', 49), write_date: '2020-01-01 00:00:00' as string },
    ]
    const client = makeFakeClient(rows)
    const summary = await syncOdooDocuments({ full: true, runId: 'r1' }, client, fake.db)
    expect(summary.fetched).toBe(1)
  })
})
