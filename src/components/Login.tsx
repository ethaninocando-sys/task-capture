import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup' | 'forgot'

const copy: Record<Mode, { title: string; subtitle: string; button: string; busy: string }> = {
  signin: { title: 'Task Capture', subtitle: 'Sign in to see your tasks.', button: 'Sign in', busy: 'Signing in…' },
  signup: { title: 'Create your account', subtitle: 'Your tasks are private to you.', button: 'Create account', busy: 'Creating…' },
  forgot: { title: 'Reset your password', subtitle: "We'll email you a link to set a new one.", button: 'Send reset link', busy: 'Sending…' },
}

const inputClass =
  'mb-4 min-h-11 w-full rounded-lg border border-line bg-surface px-3 focus:outline-2 focus:outline-accent'

export function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function switchTo(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setError(error.message)
      // If Supabase still requires email confirmation, there's no session yet.
      else if (!data.session) setNotice('Check your email to confirm your account, then sign in.')
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      if (error) setError(error.message)
      else setNotice('If that email has an account, a reset link is on its way. Check your inbox (and spam).')
    }

    setBusy(false)
  }

  const c = copy[mode]

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
        <p className="mt-1 mb-6 text-sm text-muted">{c.subtitle}</p>

        <label className="mb-1 block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />

        {mode !== 'forgot' && (
          <>
            <div className="mb-1 flex items-baseline justify-between">
              <label className="block text-sm font-medium" htmlFor="password">
                Password
              </label>
              {mode === 'signin' && (
                <button type="button" onClick={() => switchTo('forgot')} className="text-xs text-muted underline hover:text-text">
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            {mode === 'signup' && <p className="-mt-3 mb-4 text-xs text-muted">At least 8 characters.</p>}
          </>
        )}

        {error && (
          <p role="alert" className="mb-4 text-sm text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-sm">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-lg bg-accent font-medium text-accent-text disabled:opacity-60"
        >
          {busy ? c.busy : c.button}
        </button>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === 'signin' ? (
            <>
              New here?{' '}
              <button type="button" onClick={() => switchTo('signup')} className="font-medium text-text underline">
                Create an account
              </button>
            </>
          ) : (
            <>
              {mode === 'signup' ? 'Already have an account? ' : 'Remembered it? '}
              <button type="button" onClick={() => switchTo('signin')} className="font-medium text-text underline">
                Sign in
              </button>
            </>
          )}
        </p>
      </form>
    </main>
  )
}
