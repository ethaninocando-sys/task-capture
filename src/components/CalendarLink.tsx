import { useEffect, useState } from 'react'
import { supabase, supabaseUrl } from '../lib/supabase'

/** Screen for subscribing to your tasks in Apple Calendar. */
export function CalendarLink({ onDone }: { onDone: () => void }) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notSetUp, setNotSetUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from('calendar_feeds').select('token').maybeSingle()
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') setNotSetUp(true)
        else setError(error.message)
      } else setToken(data?.token ?? null)
      setLoading(false)
    })()
  }, [])

  async function create() {
    setBusy(true)
    setError(null)
    const { data: auth } = await supabase.auth.getSession()
    const userId = auth.session?.user.id
    if (!userId) {
      setError('You need to be signed in.')
      setBusy(false)
      return
    }
    const { data, error } = await supabase.from('calendar_feeds').insert({ user_id: userId }).select('token').single()
    if (error) setError(error.message)
    else setToken(data.token)
    setBusy(false)
  }

  async function reset() {
    if (!token) return
    if (!confirm('Make a new link? The old one stops working, so you will need to subscribe again in Calendar.')) return
    setBusy(true)
    const { error } = await supabase.from('calendar_feeds').delete().eq('token', token)
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    setToken(null)
    await create()
  }

  const feedUrl = token ? `${supabaseUrl}/functions/v1/calendar?token=${token}` : ''
  const webcalUrl = feedUrl.replace(/^https?:/, 'webcal:')

  async function copy() {
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it instead.")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">Add to Apple Calendar</h2>
        <p className="mt-1 text-sm text-muted">
          Tasks with a deadline show up as all-day events on your Mac and iPhone. Check a task off and it disappears from
          the calendar.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : notSetUp ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
          Calendar isn't switched on yet. Run <code>supabase/calendar-feed.sql</code> in the Supabase SQL Editor.
        </p>
      ) : !token ? (
        <button
          type="button"
          onClick={() => void create()}
          disabled={busy}
          className="min-h-11 rounded-lg bg-accent px-4 font-medium text-accent-text disabled:opacity-60"
        >
          {busy ? 'Making your link…' : 'Make my calendar link'}
        </button>
      ) : (
        <>
          <a
            href={webcalUrl}
            className="flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 font-medium text-accent-text"
          >
            Subscribe in Apple Calendar
          </a>

          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Tap the button above, on each device you want it on.</li>
            <li>Calendar asks to subscribe. Say yes.</li>
            <li>
              On a Mac, set <span className="text-text">Auto-refresh</span> to{' '}
              <span className="text-text">Every 5 minutes</span> so changes show up fast.
            </li>
          </ol>

          <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">Or copy the link</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={feedUrl}
                aria-label="Calendar link"
                onFocus={(e) => e.currentTarget.select()}
                className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-xs text-muted"
              />
              <button
                type="button"
                onClick={() => void copy()}
                className="min-h-10 shrink-0 rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-2"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">Works with Google Calendar and Outlook too ("subscribe by URL").</p>
          </div>

          <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
            <p className="font-medium">Keep this link private</p>
            <p className="mt-0.5 text-muted">Anyone with it can see your task titles. If it ever leaks, make a new one.</p>
            <button
              type="button"
              onClick={() => void reset()}
              disabled={busy}
              className="mt-2 text-sm font-medium text-danger underline disabled:opacity-60"
            >
              Make a new link
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end border-t border-line pt-4">
        <button type="button" onClick={onDone} className="min-h-10 rounded-lg border border-line px-5 text-sm font-medium hover:bg-surface-2">
          Close
        </button>
      </div>
    </div>
  )
}
