import { AlertCircle, ArrowUp, FileText, MessageSquareText, Sparkles, Square } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import Markdown from 'react-markdown'
import { api } from '../api'

interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  sources?: string[]
  // Set on assistant messages while tokens are still arriving
  streaming?: boolean
  // Shown below whatever text arrived before the failure
  error?: string
  stopped?: boolean
}

const SUGGESTIONS = [
  'Summarize my documents',
  'What are the key dates or deadlines?',
  'List the main risks or open issues',
]

// Within this many pixels of the bottom counts as "following" the answer
const STICK_THRESHOLD = 80

export function ChatPanel({
  token,
  readyCount,
  onError,
}: {
  token: string
  readyCount: number
  onError: (err: unknown) => string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stickToBottom = useRef(true)
  const nextId = useRef(1)

  // Follow the answer as it grows, unless the user has scrolled up to read something
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  // Stop any in-flight stream if the panel goes away (e.g. sign-out)
  useEffect(() => () => abortRef.current?.abort(), [])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD
  }

  const resizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || pending) return

    setInput('')
    requestAnimationFrame(resizeTextarea)
    stickToBottom.current = true

    const questionId = nextId.current++
    const answerId = nextId.current++
    setMessages((m) => [
      ...m,
      { id: questionId, role: 'user', text: question },
      { id: answerId, role: 'assistant', text: '', streaming: true },
    ])
    const update = (patch: (msg: Message) => Partial<Message>) =>
      setMessages((all) => all.map((msg) => (msg.id === answerId ? { ...msg, ...patch(msg) } : msg)))

    const controller = new AbortController()
    abortRef.current = controller
    setPending(true)

    try {
      await api.askStream(
        token,
        question,
        {
          onSources: (sources) => update(() => ({ sources })),
          onToken: (t) => update((msg) => ({ text: msg.text + t })),
          onError: (message) => update(() => ({ error: message })),
        },
        controller.signal,
      )
    } catch (err) {
      if (controller.signal.aborted) update(() => ({ stopped: true }))
      else update(() => ({ error: onError(err) }))
    } finally {
      update(() => ({ streaming: false }))
      abortRef.current = null
      setPending(false)
      textareaRef.current?.focus()
    }
  }

  const stop = () => abortRef.current?.abort()

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds a line; ignore Enter while an IME is composing text
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState readyCount={readyCount} onPick={send} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
            {messages.map((m) =>
              m.role === 'user' ? <UserBubble key={m.id} text={m.text} /> : <AssistantMessage key={m.id} message={m} />,
            )}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 bg-white/80 px-4 py-4 backdrop-blur sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
        <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
          <div className="relative rounded-2xl bg-white shadow-sm ring-1 ring-zinc-300 transition focus-within:ring-2 focus-within:ring-indigo-500 dark:bg-zinc-900 dark:ring-zinc-700">
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value)
                resizeTextarea()
              }}
              onKeyDown={onKeyDown}
              placeholder={readyCount > 0 ? 'Ask a question about your documents…' : 'Upload a document, then ask about it…'}
              className="block max-h-40 w-full resize-none bg-transparent py-3.5 pr-14 pl-4 text-sm placeholder:text-zinc-400 focus:outline-none"
            />
            {pending ? (
              <button
                type="button"
                onClick={stop}
                title="Stop generating"
                className="absolute right-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                title="Send"
                className="absolute right-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-zinc-400">
            Enter to send · Shift+Enter for a new line · Answers come only from your documents
          </p>
        </form>
      </div>
    </section>
  )
}

function EmptyState({ readyCount, onPick }: { readyCount: number; onPick: (q: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25">
        <MessageSquareText className="h-7 w-7" />
      </span>
      <h2 className="mt-5 text-xl font-semibold tracking-tight">Ask anything about your documents</h2>
      <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        {readyCount > 0
          ? `${readyCount} ${readyCount === 1 ? 'document is' : 'documents are'} ready. Answers cite the files they come from.`
          : 'Upload a document to get started. Answers are grounded only in your own files.'}
      </p>
      {readyCount > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded-full bg-white px-3.5 py-1.5 text-sm text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition hover:text-indigo-600 hover:ring-indigo-300 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:text-indigo-300 dark:hover:ring-indigo-500/50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm whitespace-pre-wrap text-white shadow-sm">
        {text}
      </p>
    </div>
  )
}

function AssistantAvatar() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
      <Sparkles className="h-4 w-4" />
    </span>
  )
}

function AssistantMessage({ message }: { message: Message }) {
  const waiting = message.streaming && message.text === ''

  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 pt-1">
        {waiting && !message.error && <ThinkingDots />}

        {message.text && (
          <div className="prose prose-sm max-w-none prose-zinc dark:prose-invert prose-p:leading-relaxed prose-pre:bg-zinc-900">
            <Markdown
              components={{
                a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
              }}
            >
              {message.text}
            </Markdown>
            {/* Blinking caret while the answer is still being written */}
            {message.streaming && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-indigo-500 align-text-bottom" />
            )}
          </div>
        )}

        {message.stopped && <p className="mt-2 text-xs text-zinc-400 italic">Stopped</p>}

        {message.error && (
          <p className="mt-2 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {message.error}
          </p>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400">Sources</span>
            {message.sources.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700"
              >
                <FileText className="h-3.5 w-3.5 text-indigo-500" />
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 pt-1.5" aria-label="Thinking">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 animate-bounce rounded-full bg-zinc-400"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}
