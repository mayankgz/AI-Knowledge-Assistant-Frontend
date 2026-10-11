import { LogOut, Sparkles } from 'lucide-react'
import { useCallback, useState } from 'react'
import { SessionExpiredError, type AuthUser, type DocumentItem } from '../api'
import { initials } from '../format'
import { ChatPanel } from './ChatPanel'
import { DocumentsPanel } from './DocumentsPanel'

export function Workspace({ user, onSignOut }: { user: AuthUser; onSignOut: (reason?: string) => void }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])

  // Any API error funnels through here: an expired session signs the user out with a notice,
  // everything else is handed back to the panel to display
  const handleError = useCallback(
    (err: unknown): string => {
      if (err instanceof SessionExpiredError) {
        onSignOut(err.message)
        return err.message
      }
      return err instanceof Error ? err.message : 'Something went wrong'
    },
    [onSignOut],
  )

  const readyCount = documents.filter((d) => d.status === 'INDEXED').length

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center gap-2.5 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">Knowledge Assistant</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right text-sm leading-tight sm:block">
            <p className="font-medium">{user.name}</p>
            <p className="text-xs text-zinc-500">{user.email}</p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
            {initials(user.name) || '?'}
          </span>
          <button
            onClick={() => onSignOut()}
            title="Sign out"
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <DocumentsPanel
          token={user.token}
          documents={documents}
          onDocumentsChange={setDocuments}
          onError={handleError}
        />
        <ChatPanel token={user.token} readyCount={readyCount} onError={handleError} />
      </main>
    </div>
  )
}
