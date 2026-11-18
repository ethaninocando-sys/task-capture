import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Area } from '../lib/options'
import { supabase } from '../lib/supabase'

interface Props {
  areas: Area[]
  /** How many tasks (open or done) use each area, by area id. */
  taskCounts: Map<string, number>
  onChanged: () => Promise<void>
  onDone: () => void
}

function friendly(message: string, code?: string, name?: string): string {
  if (code === '23505') return `You already have an area called "${name}".`
  return message
}

export function AreaEditor({ areas, taskCounts, onChanged, onDone }: Props) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const position = areas.reduce((max, a) => Math.max(max, a.position), -1) + 1
    const { error } = await supabase.from('areas').insert({ name, position })
    if (error) setError(friendly(error.message, error.code, name))
    else {
      setError(null)
      setNewName('')
    }
    await onChanged()
  }

  async function rename(area: Area, input: HTMLInputElement) {
    const name = input.value.trim()
    if (!name) {
      input.value = area.name
      return
    }
    if (name === area.name) return
    const { error } = await supabase.from('areas').update({ name }).eq('id', area.id)
    if (error) {
      setError(friendly(error.message, error.code, name))
      input.value = area.name
    } else setError(null)
    await onChanged()
  }

  async function move(index: number, direction: -1 | 1) {
    const order = [...areas]
    const target = index + direction
    if (target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target], order[index]]
    const changed = order.map((area, i) => ({ area, i })).filter(({ area, i }) => area.position !== i)
    const results = await Promise.all(
      changed.map(({ area, i }) => supabase.from('areas').update({ position: i }).eq('id', area.id)),
    )
    const failed = results.find((r) => r.error)
    setError(failed?.error ? failed.error.message : null)
    await onChanged()
  }

  async function remove(area: Area) {
    const count = taskCounts.get(area.id) ?? 0
    const warning = count > 0 ? ` Its ${count} task${count === 1 ? '' : 's'} will show as "No area".` : ''
    if (!confirm(`Remove the area "${area.name}"?${warning}`)) return
    const { error } = await supabase.from('areas').delete().eq('id', area.id)
    setError(error ? error.message : null)
    await onChanged()
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">Your areas</h2>
        <p className="text-sm text-muted">The parts of your life your tasks belong to. Only you see these.</p>
      </div>

      {areas.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {areas.map((area, index) => {
            const count = taskCounts.get(area.id) ?? 0
            return (
              <li key={area.id} className="flex items-center gap-1 rounded-xl border border-line bg-surface py-1 pr-1 pl-2">
                <input
                  aria-label="Area name"
                  defaultValue={area.name}
                  maxLength={40}
                  onBlur={(e) => void rename(area, e.currentTarget)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="min-h-9 min-w-0 flex-1 rounded-md bg-transparent px-2 text-[15px] hover:bg-surface-2 focus:bg-surface-2 focus:outline-2 focus:outline-accent"
                />
                <span className="shrink-0 px-1 text-xs text-muted tabular-nums" title={`${count} tasks`}>
                  {count > 0 ? count : ''}
                </span>
                <IconButton label={`Move "${area.name}" up`} disabled={index === 0} onClick={() => void move(index, -1)}>
                  <path d="M4 10l4-4 4 4" />
                </IconButton>
                <IconButton
                  label={`Move "${area.name}" down`}
                  disabled={index === areas.length - 1}
                  onClick={() => void move(index, 1)}
                >
                  <path d="M4 6l4 4 4-4" />
                </IconButton>
                <IconButton label={`Remove "${area.name}"`} danger onClick={() => void remove(area)}>
                  <path d="M4 4l8 8M12 4l-8 8" />
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}

      <form onSubmit={add} className="flex gap-2">
        <label htmlFor="new-area" className="sr-only">
          New area name
        </label>
        <input
          id="new-area"
          autoFocus={areas.length === 0}
          value={newName}
          maxLength={40}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New area, e.g. Side project"
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 placeholder:text-muted focus:outline-2 focus:outline-accent"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-text disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end border-t border-line pt-4">
        <button type="button" onClick={onDone} className="min-h-10 rounded-lg bg-accent px-5 text-sm font-medium text-accent-text">
          Done
        </button>
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 disabled:opacity-25 ${
        danger ? 'hover:text-danger' : 'hover:text-text'
      }`}
    >
      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  )
}
