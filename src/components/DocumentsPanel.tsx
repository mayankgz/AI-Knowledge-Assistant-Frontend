import { AlertCircle, CheckCircle2, Clock, Loader2, Trash2, UploadCloud, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { api, type DocumentItem } from '../api'
import { extension, formatBytes, timeAgo } from '../format'

// Mirrors spring.servlet.multipart.max-file-size in the backend
const MAX_BYTES = 10 * 1024 * 1024
const POLL_MS = 2000

const isActive = (d: DocumentItem) => d.status === 'PENDING' || d.status === 'INDEXING'

interface Upload {
  key: number
  name: string
}

export function DocumentsPanel({
  token,
  documents,
  onDocumentsChange,
  onError,
}: {
  token: string
  documents: DocumentItem[]
  onDocumentsChange: (docs: DocumentItem[]) => void
  onError: (err: unknown) => string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadKey = useRef(0)

  const refresh = useCallback(async () => {
    try {
      onDocumentsChange(await api.listDocuments(token))
    } catch (err) {
      setError(onError(err))
    } finally {
      setLoading(false)
    }
  }, [token, onDocumentsChange, onError])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Poll only while something is queued or indexing, so progress bars move on their own
  const hasActive = documents.some(isActive)
  useEffect(() => {
    if (!hasActive) return
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [hasActive, refresh])

  const upload = async (files: FileList | File[]) => {
    setError(null)
    for (const file of Array.from(files)) {
      if (file.size === 0) {
        setError(`${file.name} is empty`)
        continue
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is larger than 10 MB`)
        continue
      }
      const key = ++uploadKey.current
      setUploads((u) => [...u, { key, name: file.name }])
      try {
        await api.uploadDocument(token, file)
      } catch (err) {
        setError(`${file.name}: ${onError(err)}`)
      } finally {
        setUploads((u) => u.filter((x) => x.key !== key))
      }
    }
    refresh()
  }

  const remove = async (id: number) => {
    setDeletingId(id)
    try {
      await api.deleteDocument(token, id)
      await refresh()
    } catch (err) {
      setError(onError(err))
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files)
  }

  const onDropzoneKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  return (
    <aside className="flex max-h-[45vh] w-full shrink-0 flex-col border-b border-zinc-200 bg-white md:max-h-none md:w-96 md:border-r md:border-b-0 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-sm font-semibold">Documents</h2>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {documents.length}
        </span>
      </div>

      <div className="px-5 pt-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={onDropzoneKey}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
            dragOver
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
              : 'border-zinc-300 hover:border-indigo-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-indigo-500/60 dark:hover:bg-zinc-800/40'
          }`}
        >
          <UploadCloud className={`h-7 w-7 ${dragOver ? 'text-indigo-500' : 'text-zinc-400'}`} />
          <p className="mt-2 text-sm font-medium">
            {dragOver ? 'Drop to upload' : 'Drop files or click to upload'}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">PDF, Word, text, and more · up to 10 MB</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files)
              e.target.value = '' // allow picking the same file again
            }}
          />
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20">
          <AlertCircle className="mt-px h-4 w-4 shrink-0" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError(null)} title="Dismiss" className="opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
        {uploads.map((u) => (
          <li key={`upload-${u.key}`} className="flex items-center gap-3 rounded-xl border border-dashed border-indigo-300 p-3 text-sm dark:border-indigo-500/40">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            <span className="min-w-0 flex-1 truncate">{u.name}</span>
            <span className="text-xs text-zinc-500">Uploading…</span>
          </li>
        ))}

        {loading &&
          [0, 1, 2].map((i) => (
            <li key={`skeleton-${i}`} className="flex animate-pulse items-center gap-3 rounded-xl p-3">
              <div className="h-9 w-9 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-2.5 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </li>
          ))}

        {!loading && documents.length === 0 && uploads.length === 0 && (
          <li className="py-8 text-center text-sm text-zinc-500">No documents yet</li>
        )}

        {documents.map((doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            confirming={confirmingId === doc.id}
            deleting={deletingId === doc.id}
            onAskDelete={() => setConfirmingId(doc.id)}
            onCancelDelete={() => setConfirmingId(null)}
            onConfirmDelete={() => remove(doc.id)}
          />
        ))}
      </ul>
    </aside>
  )
}

function DocumentRow({
  doc,
  confirming,
  deleting,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  doc: DocumentItem
  confirming: boolean
  deleting: boolean
  onAskDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}) {
  return (
    <li className="group rounded-xl border border-zinc-200 bg-white p-3 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <div className="flex items-start gap-3">
        <ExtensionBadge filename={doc.filename} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={doc.filename}>
            {doc.filename}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {formatBytes(doc.fileSize)} · {timeAgo(doc.uploadedAt)}
          </p>
        </div>
        <StatusBadge status={doc.status} />
        {!confirming && (
          <button
            onClick={onAskDelete}
            title="Delete document"
            className="-mr-1 rounded-md p-1 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 md:opacity-0 md:group-hover:opacity-100 dark:hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {isActive(doc) && <IndexingProgress doc={doc} />}

      {doc.status === 'FAILED' && doc.errorMessage && (
        <p className="mt-2 line-clamp-3 text-xs text-rose-600 dark:text-rose-400" title={doc.errorMessage}>
          {doc.errorMessage}
        </p>
      )}

      {confirming && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs dark:bg-rose-500/10">
          <span className="text-rose-700 dark:text-rose-300">Delete this document?</span>
          <div className="flex gap-1.5">
            <button
              onClick={onCancelDelete}
              disabled={deleting}
              className="rounded-md px-2 py-1 font-medium text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={onConfirmDelete}
              disabled={deleting}
              className="flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 font-medium text-white hover:bg-rose-500 disabled:opacity-60"
            >
              {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function IndexingProgress({ doc }: { doc: DocumentItem }) {
  const total = doc.batchesTotal ?? 0
  const done = doc.batchesDone ?? 0
  // Batch counts appear once the text is extracted and split; until then the length is unknown
  const known = doc.status === 'INDEXING' && total > 0
  const percent = known ? Math.round((done / total) * 100) : 0
  const label =
    doc.status === 'PENDING' ? 'Waiting to start' : known ? `Embedding batch ${done} of ${total}` : 'Reading document…'

  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-[11px] text-zinc-500">
        <span>{label}</span>
        {known && <span className="font-medium text-indigo-600 tabular-nums dark:text-indigo-400">{percent}%</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {known ? (
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(percent, 3)}%` }}
          />
        ) : (
          <div className="h-full w-2/5 animate-indeterminate rounded-full bg-indigo-400/70" />
        )}
      </div>
    </div>
  )
}

const STATUS_STYLES = {
  PENDING: { label: 'Queued', icon: Clock, className: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20' },
  INDEXING: { label: 'Indexing', icon: Loader2, className: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20' },
  INDEXED: { label: 'Ready', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20' },
  FAILED: { label: 'Failed', icon: AlertCircle, className: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20' },
} as const

function StatusBadge({ status }: { status: DocumentItem['status'] }) {
  const { label, icon: Icon, className } = STATUS_STYLES[status]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${className}`}>
      <Icon className={`h-3 w-3 ${status === 'INDEXING' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  )
}

const EXTENSION_COLORS: Record<string, string> = {
  PDF: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  DOC: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  DOCX: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  XLS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  XLSX: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  CSV: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  PPT: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  PPTX: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  MD: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
}

function ExtensionBadge({ filename }: { filename: string }) {
  const ext = extension(filename)
  const color = EXTENSION_COLORS[ext] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold tracking-wide ${color}`}>
      {ext}
    </span>
  )
}
