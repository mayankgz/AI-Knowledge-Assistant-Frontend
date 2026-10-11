import { FileSearch, Layers, Loader2, Lock, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, type AuthUser } from '../api'

type Mode = 'login' | 'register'

const FEATURES = [
  { icon: FileSearch, title: 'Grounded answers', text: 'Every answer cites the documents it came from.' },
  { icon: Layers, title: 'Any size document', text: 'Large files are indexed in batches, with live progress.' },
  { icon: Lock, title: 'Private by default', text: 'Your documents only ever answer your questions.' },
]

export function AuthScreen({
  onAuthenticated,
  notice,
}: {
  onAuthenticated: (user: AuthUser) => void
  notice: string | null
}) {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res =
        mode === 'login' ? await api.login(email, password) : await api.register(name, email, password)
      onAuthenticated({ token: res.token, email: res.email, name: res.name })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  return (
    <div className="flex min-h-full">
      {/* Brand panel, hidden on small screens */}
      <div className="relative hidden w-1/2 overflow-hidden bg-zinc-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -right-32 -bottom-48 h-[28rem] w-[28rem] rounded-full bg-violet-600/25 blur-3xl" />

        <div className="relative flex items-center gap-2.5 text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
            <Sparkles className="h-5 w-5" />
          </span>
          Knowledge Assistant
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">
            Ask your documents anything.
          </h1>
          <p className="mt-4 text-lg text-zinc-400">
            Upload reports, policies, and notes. Get answers grounded in what they actually say.
          </p>
          <ul className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-5 w-5 text-indigo-300" />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-zinc-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-zinc-500">Spring Boot · Spring AI · Kafka · ChromaDB · Groq</p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 text-lg font-semibold lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            Knowledge Assistant
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {mode === 'login' ? 'Sign in to your knowledge base.' : 'Start building your knowledge base.'}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-lg bg-zinc-200/60 p-1 text-sm font-medium dark:bg-zinc-800/60">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`rounded-md py-1.5 transition ${
                  mode === m
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {notice && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20">
              {notice}
            </p>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <Field label="Name" value={name} onChange={setName} autoComplete="name" required />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 6 : undefined}
              hint={mode === 'register' ? 'At least 6 characters' : undefined}
              required
            />

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 dark:focus-visible:ring-offset-zinc-950"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  hint,
  ...input
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <input
        {...input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-zinc-300 transition placeholder:text-zinc-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-zinc-900 dark:ring-zinc-700"
      />
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}
