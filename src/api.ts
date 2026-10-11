// Typed client for the Spring Boot API. Requests go to /api/v1/..., which the Vite dev
// server proxies to localhost:8080 (see vite.config.ts).

export interface AuthUser {
  token: string
  email: string
  name: string
}

export type DocStatus = 'PENDING' | 'INDEXING' | 'INDEXED' | 'FAILED'

export interface DocumentItem {
  id: number
  filename: string
  contentType: string
  fileSize: number
  status: DocStatus
  uploadedAt: string
  indexedAt: string | null
  batchesDone: number | null
  batchesTotal: number | null
  errorMessage: string | null
}

export interface RagAnswer {
  answer: string
  sources: string[]
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Spring Security answers a missing, invalid, or expired token with a bare 403, while the
// app's own "not your document" 403 carries a JSON body with error FORBIDDEN
export class SessionExpiredError extends ApiError {}

type RequestOptions = RequestInit & { token?: string }

async function request<T>(path: string, { token, headers, ...init }: RequestOptions = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
  })

  if (res.ok) {
    return (res.status === 204 ? undefined : await res.json()) as T
  }
  throw await toApiError(res, token)
}

async function toApiError(res: Response, token?: string): Promise<ApiError> {
  const body = await res.json().catch(() => null)
  if (token && res.status === 403 && body?.error !== 'FORBIDDEN') {
    return new SessionExpiredError(403, 'Your session has expired. Please sign in again.')
  }
  // Validation errors list field problems in "details"; everything else has "message"
  const message: string =
    (Array.isArray(body?.details) && body.details.join(', ')) ||
    body?.message ||
    `Request failed (${res.status})`
  return new ApiError(res.status, message)
}

export interface StreamHandlers {
  onSources: (sources: string[]) => void
  onToken: (text: string) => void
  onError: (message: string) => void
}

// POST /query/stream returns server-sent events. EventSource can't send an Authorization
// header (or POST), so the body is read with fetch and parsed here. Every event's data is JSON.
async function askStream(token: string, question: string, handlers: StreamHandlers, signal?: AbortSignal) {
  const res = await fetch('/api/v1/query/stream', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
    body: new URLSearchParams({ question }),
    signal,
  })
  if (!res.ok || !res.body) throw await toApiError(res, token)

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += value.replace(/\r\n/g, '\n')

    // Events are separated by a blank line; keep any trailing partial event for the next read
    let boundary
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      if (dispatchEvent(raw, handlers)) return
    }
  }
}

// Returns true once the stream is finished (done or error)
function dispatchEvent(raw: string, handlers: StreamHandlers): boolean {
  let event = 'message'
  const data: string[] = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
  }
  const payload = data.length ? JSON.parse(data.join('\n')) : null

  switch (event) {
    case 'sources':
      handlers.onSources(payload ?? [])
      return false
    case 'token':
      handlers.onToken(payload?.text ?? '')
      return false
    case 'error':
      handlers.onError(payload?.message ?? 'Something went wrong')
      return true
    case 'done':
      return true
    default:
      return false
  }
}

const json = (data: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
})

export const api = {
  login: (email: string, password: string) =>
    request<AuthUser>('/auth/login', json({ email, password })),

  register: (name: string, email: string, password: string) =>
    request<AuthUser>('/auth/register', json({ name, email, password })),

  listDocuments: (token: string) => request<DocumentItem[]>('/documents', { token }),

  uploadDocument: (token: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<DocumentItem>('/documents', { method: 'POST', body: form, token })
  },

  deleteDocument: (token: string, id: number) =>
    request<void>(`/documents/${id}`, { method: 'DELETE', token }),

  // The endpoint reads "question" as a form parameter, not JSON
  ask: (token: string, question: string) =>
    request<RagAnswer>('/query', { method: 'POST', body: new URLSearchParams({ question }), token }),

  askStream,
}
