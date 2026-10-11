import { useState } from 'react'
import type { AuthUser } from './api'
import { AuthScreen } from './components/AuthScreen'
import { Workspace } from './components/Workspace'

const STORAGE_KEY = 'aka.auth'

// Storage can be unavailable (private mode, blocked site data), so every access is guarded
function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function saveUser(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Still works for this tab; the user just signs in again after a reload
  }
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(loadUser)
  const [notice, setNotice] = useState<string | null>(null)

  const signIn = (next: AuthUser) => {
    saveUser(next)
    setNotice(null)
    setUser(next)
  }

  const signOut = (reason?: string) => {
    saveUser(null)
    setNotice(reason ?? null)
    setUser(null)
  }

  return user ? (
    <Workspace user={user} onSignOut={signOut} />
  ) : (
    <AuthScreen onAuthenticated={signIn} notice={notice} />
  )
}
