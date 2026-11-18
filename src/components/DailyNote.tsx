import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const SAVE_DELAY_MS = 700

interface NoteProps {
  itemId: string
  itemTitle: string
  /** The day this note is for, "YYYY-MM-DD" (today). */
  day: string
  initial: string
  /** Tell the list the saved text, so the note icon updates. */
  onSaved: (text: string) => void
  onShowHistory: () => void
}

/** Today's note for one daily item. Saves on its own while you type. */
export function DailyNote({ itemId, itemTitle, day, initial, onSaved, onShowHistory }: NoteProps) {
  const [text, setText] = useState(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string | null>(null)
  const lastSaved = useRef(initial)

  async function save(value: string) {
    pending.current = null
    if (value === lastSaved.current) return
    setStatus('saving')
    const { error } = await supabase
      .from('daily_notes')
      .upsert({ item_id: itemId, day, note: value, updated_at: new Date().toISOString() }, { onConflict: 'item_id,day' })
    if (error) {
      setStatus('error')
      return
    }
    lastSaved.current = value
    setStatus('saved')
    onSaved(value)
  }

  function onChange(value: string) {
    setText(value)
    pending.current = value
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(value), SAVE_DELAY_MS)
  }

  function saveNow() {
    if (timer.current) clearTimeout(timer.current)
    if (pending.current !== null) void save(pending.current)
  }

  // Closing the note (or leaving the page) saves anything not saved yet.
  const saveNowRef = useRef(saveNow)
  useEffect(() => {
    saveNowRef.current = saveNow
  })
  useEffect(() => () => saveNowRef.current(), [])

  return (
    <div className="px-4 pb-3 pl-12">
      <label htmlFor={`note-${itemId}`} className="sr-only">
        Today's note for {itemTitle}
      </label>
      <textarea
        id={`note-${itemId}`}
        autoFocus
        rows={4}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={saveNow}
        placeholder="Your thoughts for today…"
        className="w-full resize-y rounded-xl border border-line bg-bg px-3 py-2 text-[15px] leading-relaxed placeholder:text-muted focus:outline-2 focus:outline-offset-0 focus:outline-accent"
      />
      <div className="mt-1 flex items-center gap-3 text-xs text-muted">
        <span role="status" className={status === 'error' ? 'text-danger' : ''}>
          {status === 'saving' && 'Saving…'}
          {status === 'saved' && 'Saved'}
          {status === 'error' && "Couldn't save. Check your connection."}
        </span>
        <button type="button" onClick={onShowHistory} className="ml-auto underline hover:text-text">
          Past notes
        </button>
      </div>
    </div>
  )
}

interface PastNote {
  day: string
  note: string
}

/** Earlier days' notes for one daily item, newest first. */
export function DailyNoteHistory({ itemId, today }: { itemId: string; today: string }) {
  const [notes, setNotes] = useState<PastNote[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void supabase
      .from('daily_notes')
      .select('day, note')
      .eq('item_id', itemId)
      .lt('day', today)
      .neq('note', '')
      .order('day', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(`Couldn't load past notes: ${error.message}`)
        else setNotes(data as PastNote[])
      })
    return () => {
      active = false
    }
  }, [itemId, today])

  if (error) return <p className="text-sm text-danger">{error}</p>
  if (!notes) return <p className="text-sm text-muted">Loading…</p>
  if (notes.length === 0) return <p className="text-sm text-muted">No notes from earlier days yet.</p>

  const thisYear = Number(today.slice(0, 4))
  return (
    <ol className="flex flex-col gap-4">
      {notes.map((n) => {
        const [y, m, d] = n.day.split('-').map(Number)
        const label = new Date(y, m - 1, d).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: y === thisYear ? undefined : 'numeric',
        })
        return (
          <li key={n.day}>
            <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
            <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{n.note}</p>
          </li>
        )
      })}
    </ol>
  )
}
