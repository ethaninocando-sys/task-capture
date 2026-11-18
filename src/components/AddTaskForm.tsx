import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { daysFromToday } from '../lib/dates'
import { AREAS, KINDS, PRIORITIES } from '../lib/options'
import type { Kind, Priority } from '../lib/options'
import { supabase } from '../lib/supabase'
import { ChipGroup } from './ChipGroup'

interface Props {
  onAdded: () => void
  onCancel: () => void
}

export function AddTaskForm({ onAdded, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority | null>(null)
  const [area, setArea] = useState<string | null>(null)
  const [kind, setKind] = useState<Kind | null>(null)
  const [deadline, setDeadline] = useState('')
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const missing = {
    title: !title.trim(),
    priority: !priority,
    area: !area,
    kind: !kind,
  }
  const isValid = !Object.values(missing).some(Boolean)

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    setTried(true)
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('tasks').insert({
      title: title.trim(),
      priority,
      area,
      kind,
      deadline: deadline || null,
    })
    setSaving(false)
    if (error) {
      setError(`Couldn't save: ${error.message}`)
      return
    }
    onAdded()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
    // Cmd/Ctrl + Enter adds the task from anywhere in the form.
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void submit()
    }
  }

  const quickDates = [
    { label: 'Today', value: daysFromToday(0) },
    { label: 'Tomorrow', value: daysFromToday(1) },
    { label: 'In a week', value: daysFromToday(7) },
  ]

  return (
    <form onSubmit={submit} onKeyDown={onKeyDown} className="flex flex-col gap-5">
      <div>
        <label htmlFor="task-title" className="sr-only">
          What do you need to do?
        </label>
        <textarea
          id="task-title"
          autoFocus
          rows={3}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            // Plain Enter adds the task; Shift+Enter makes a new line.
            if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
              e.preventDefault()
              void submit()
            }
          }}
          placeholder="What do you need to do?"
          className={`w-full resize-none rounded-xl border bg-surface px-4 py-3 text-lg leading-snug placeholder:text-muted focus:outline-2 focus:outline-offset-0 focus:outline-accent ${
            tried && missing.title ? 'border-danger' : 'border-line'
          }`}
        />
      </div>

      <ChipGroup label="Priority" options={PRIORITIES} value={priority} onChange={setPriority} error={tried && missing.priority} />
      <ChipGroup label="Area" options={AREAS} value={area} onChange={setArea} error={tried && missing.area} />
      <ChipGroup label="Kind" options={KINDS} value={kind} onChange={setKind} error={tried && missing.kind} />

      <fieldset>
        <legend className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
          Deadline <span className="normal-case tracking-normal">(optional)</span>
        </legend>
        <div className="flex flex-wrap items-center gap-1.5">
          {quickDates.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setDeadline(q.value)}
              className={`min-h-9 rounded-full border px-3 text-sm transition-colors ${
                deadline === q.value
                  ? 'border-accent bg-accent text-accent-text'
                  : 'border-line bg-surface hover:bg-surface-2'
              }`}
            >
              {q.label}
            </button>
          ))}
          <input
            type="date"
            aria-label="Pick a deadline date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="min-h-9 rounded-full border border-line bg-surface px-3 text-sm"
          />
          {deadline && (
            <button type="button" onClick={() => setDeadline('')} className="min-h-9 px-2 text-sm text-muted underline">
              Clear
            </button>
          )}
        </div>
      </fieldset>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="hidden text-xs text-muted sm:block">
          Enter to add · Shift+Enter new line · Esc to cancel
        </p>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-10 rounded-lg border border-line px-4 text-sm font-medium hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-text disabled:opacity-60"
          >
            {saving ? 'Adding…' : 'Add task'}
          </button>
        </div>
      </div>
    </form>
  )
}
