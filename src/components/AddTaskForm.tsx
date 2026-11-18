import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { daysFromToday } from '../lib/dates'
import { KINDS, PRIORITIES } from '../lib/options'
import type { Area, Kind, Priority, Task } from '../lib/options'
import { supabase } from '../lib/supabase'
import { ChipGroup } from './ChipGroup'

interface Props {
  areas: Area[]
  /** When given, the form starts filled in with this task and saves changes to it. */
  task?: Task
  /** Called after the task is added (or saved, when editing). */
  onAdded: () => void
  onCancel: () => void
  onEditAreas: () => void
}

export function AddTaskForm({ areas, task, onAdded, onCancel, onEditAreas }: Props) {
  const editing = Boolean(task)
  const [title, setTitle] = useState(task?.title ?? '')
  const [priority, setPriority] = useState<Priority | null>(task?.priority ?? null)
  const [pickedArea, setArea] = useState<string | null>(task?.area_id ?? null)
  // If the picked area gets deleted in the Edit areas screen, un-pick it.
  const area = pickedArea && areas.some((a) => a.id === pickedArea) ? pickedArea : null
  const [kind, setKind] = useState<Kind | null>(task?.kind ?? null)
  const [deadline, setDeadline] = useState(task?.deadline ?? '')
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
    const fields = {
      title: title.trim(),
      priority,
      area_id: area,
      kind,
      deadline: deadline || null,
    }
    const { error } = task
      ? await supabase.from('tasks').update(fields).eq('id', task.id)
      : await supabase.from('tasks').insert(fields)
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
          rows={editing ? 8 : 3}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          // Enter makes a new line here. ⌘Enter (handled on the form) adds the task.
          placeholder="What do you need to do?"
          className={`w-full resize-none rounded-xl border bg-surface px-4 py-3 text-lg leading-snug placeholder:text-muted focus:outline-2 focus:outline-offset-0 focus:outline-accent ${
            tried && missing.title ? 'border-danger' : 'border-line'
          }`}
        />
      </div>

      <ChipGroup label="Priority" options={PRIORITIES} value={priority} onChange={setPriority} error={tried && missing.priority} />
      <ChipGroup
        label="Area"
        options={areas.map((a) => ({ value: a.id, label: a.name }))}
        value={area}
        onChange={setArea}
        error={tried && missing.area}
        action={
          <button
            type="button"
            onClick={onEditAreas}
            className="inline-flex min-h-9 items-center rounded-full border border-dashed border-line px-3 text-sm text-muted hover:bg-surface-2 hover:text-text"
          >
            {areas.length === 0 ? '+ Add an area' : 'Edit'}
          </button>
        }
      />
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
          ⌘Enter to {editing ? 'save' : 'add'} · Enter new line · Esc to cancel
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
            {editing ? (saving ? 'Saving…' : 'Save') : saving ? 'Adding…' : 'Add task'}
          </button>
        </div>
      </div>
    </form>
  )
}
