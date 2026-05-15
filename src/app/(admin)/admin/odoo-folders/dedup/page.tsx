import { adminDb } from '@/lib/firebase/admin'
import { folderDedupLogSchema, type FolderDedupLog } from '@/schemas/folderDedupLogSchema'

export const metadata = {
  title: 'Folder Dedup Odoo Documents | AroundaPlanet',
}

export const dynamic = 'force-dynamic'

interface ClusterRow extends FolderDedupLog {
  executedAtMs: number | null
}

function asMillis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    try {
      return (value as { toMillis: () => number }).toMillis()
    } catch {
      return null
    }
  }
  if (typeof value === 'string') {
    const t = Date.parse(value)
    return Number.isFinite(t) ? t : null
  }
  if (value instanceof Date) return value.getTime()
  return null
}

async function loadDedupLog(): Promise<ClusterRow[]> {
  try {
    const snap = await adminDb.collection('folderDedupLog').get()
    const rows: ClusterRow[] = []
    for (const doc of snap.docs) {
      const raw = doc.data()
      const executedAtMs = asMillis(raw.executedAt)
      // Firestore Timestamp no matchea z.date() | z.string() del schema — convertir antes de parse.
      const normalized = {
        ...raw,
        executedAt: executedAtMs ? new Date(executedAtMs).toISOString() : new Date(0).toISOString(),
      }
      const parsed = folderDedupLogSchema.safeParse(normalized)
      if (!parsed.success) {
        console.warn('[odoo-folders/dedup] doc no valida schema', {
          docId: doc.id,
          issues: parsed.error.issues.map((i) => `${i.path.join('.')}:${i.message}`),
        })
        continue
      }
      rows.push({
        ...parsed.data,
        executedAtMs,
      })
    }
    rows.sort((a, b) => a.normalizedKey.localeCompare(b.normalizedKey))
    return rows
  } catch (err) {
    console.error('[odoo-folders/dedup] loadDedupLog falló', err)
    return []
  }
}

function ExternalFolderLink({ id, name }: { id: number; name: string }) {
  const odooBase = 'https://aroundaplanet.odoo.com'
  return (
    <a
      href={`${odooBase}/odoo/documents/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-2 hover:underline"
    >
      {name}
    </a>
  )
}

export default async function FolderDedupPage() {
  const rows = await loadDedupLog()
  const totalCanonicos = rows.length
  const totalDuplicados = rows.reduce((s, r) => s + r.duplicateIds.length, 0)

  return (
    <div className="space-y-6 p-4">
      <header>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Folder Dedup Odoo Documents
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Story 9.5 — solo lectura. Marcas escritas por{' '}
          <code>scripts/execute-9-5-folder-dedup.mjs</code>. Cambios de canónico se hacen
          manualmente en Odoo o re-ejecutando el script con un override.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Clusters resueltos</div>
          <div className="mt-1 text-2xl font-semibold">{totalCanonicos}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Duplicados</div>
          <div className="mt-1 text-2xl font-semibold">{totalDuplicados}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Estado</div>
          <div className="mt-1 text-sm">
            {totalCanonicos === 0
              ? 'Sin runs. Ejecutar script.'
              : `${totalCanonicos} clusters procesados`}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No hay logs de dedup todavía. Corre:
          <pre className="mt-2 rounded bg-muted p-2 text-xs">
            node scripts/audit-9-5-folder-clusters.mjs{'\n'}
            node scripts/execute-9-5-folder-dedup.mjs --snapshot=&lt;path&gt; --dry-run{'\n'}
            node scripts/execute-9-5-folder-dedup.mjs --snapshot=&lt;path&gt;
          </pre>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Cluster</th>
                <th className="px-4 py-2">Canónico</th>
                <th className="px-4 py-2 text-right"># docs canónico</th>
                <th className="px-4 py-2">Duplicados</th>
                <th className="px-4 py-2 text-right"># docs duplicados</th>
                <th className="px-4 py-2">Procesado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {rows.map((r) => (
                <tr key={r.normalizedKey}>
                  <td className="px-4 py-2 font-mono text-xs">{r.normalizedKey}</td>
                  <td className="px-4 py-2">
                    <ExternalFolderLink id={r.canonicalId} name={r.canonicalName} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.canonicalChildrenCount}
                  </td>
                  <td className="px-4 py-2">
                    <ul className="space-y-1">
                      {r.duplicateIds.map((id, idx) => (
                        <li key={id} className="text-xs">
                          <ExternalFolderLink
                            id={id}
                            name={r.duplicateNames[idx] ?? `#${id}`}
                          />
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.totalChildrenInDuplicates}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {r.executedAtMs
                      ? new Date(r.executedAtMs).toLocaleString('es-MX')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
