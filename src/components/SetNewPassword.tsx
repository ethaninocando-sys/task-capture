import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

/** Shown after someone opens a "reset your password" email link. */
export function SetNewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Pick something you'll remember.</p>

        <label className="mb-1 block text-sm font-medium" htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 focus:outline-2 focus:outline-accent"
        />
        <p className="mb-4 text-xs text-muted">At least 8 characters.</p>

        {error && (
          <p role="alert" className="mb-4 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-lg bg-accent font-medium text-accent-text disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </main>
  )
}
