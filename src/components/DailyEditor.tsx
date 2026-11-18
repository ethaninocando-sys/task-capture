import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ALL_DAYS, WEEKDAYS, describeDays } from '../lib/daily'
import type { DailyItem } from '../lib/daily'
import { supabase } from '../lib/supabase'

interface Props {
  items: DailyItem[]
  onChanged: () => Promise<void>
  onDone: () => void
}

export function DailyEditor({ items, onChanged, onDone }: Props) {
  const [newTitle, setNewTitle] = useState('')
  const [newDays, setNewDays] = useState<number[]>(ALL_DAYS)
  const [error, setError] = useState<string | null>(null)

  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await action
    if (error) setError(error.message)
    else setError(null)
    await onChanged()
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    const position = items.reduce((max, i) => Math.max(max, i.position), -1) + 1
    setNewTitle('')
    setNewDays(ALL_DAYS)
    await run(supabase.from('daily_items').insert({ title, days: newDays, position }))
  }

  async function rename(item: DailyItem, title: string) {
    const clean = title.trim()
    if (!clean || clean === item.title) return
    await run(supabase.from('daily_items').update({ title: clean }).eq('id', item.id))
  }

  async function setDays(item: DailyItem, days: number[]) {
    await run(supabase.from('daily_items').update({ days }).eq('id', item.id))
  }

  async function move(index: number, direction: -1 | 1) {
    const order = [...items]
    const target = index + direction
    if (target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target], order[index]]
    const changed = order.map((item, i) => ({ item, i })).filter(({ item, i }) => item.position !== i)
    const results = await Promise.all(
      changed.map(({ item, i }) => supabase.from('daily_items').update({ position: i }).eq('id', item.id)),
    )
    const failed = results.find((r) => r.error)
    setError(failed?.error ? failed.error.message : null)
    await onChanged()
  }

  async function remove(item: DailyItem) {
    if (!confirm(`Remove "${item.title}" from your daily list? Its streak history goes too.`)) return
    await run(supabase.from('daily_items').delete().eq('id', item.id))
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">Daily checklist</h2>
        <p className="text-sm text-muted">These reset every day. Pick which days each one shows up.</p>
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={item.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <input
                  aria-label="Item name"
                  defaultValue={item.title}
                  onBlur={(e) => void rename(item, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="min-h-9 min-w-0 flex-1 rounded-md bg-transparent px-2 text-[15px] hover:bg-surface-2 focus:bg-surface-2 focus:outline-2 focus:outline-accent"
                />
                <IconButton label={`Move "${item.title}" up`} disabled={index === 0} onClick={() => void move(index, -1)}>
                  <path d="M4 10l4-4 4 4" />
                </IconButton>
                <IconButton
                  label={`Move "${item.title}" down`}
                  disabled={index === items.length - 1}
                  onClick={() => void move(index, 1)}
                >
                  <path d="M4 6l4 4 4-4" />
                </IconButton>
                <IconButton label={`Remove "${item.title}"`} danger onClick={() => void remove(item)}>
                  <path d="M4 4l8 8M12 4l-8 8" />
                </IconButton>
              </div>
              <div className="mt-2 flex items-center gap-2 pl-2">
                <DayPicker days={item.days} onChange={(days) => void setDays(item, days)} />
                <span className="text-xs text-muted">{describeDays(item.days)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="rounded-xl border border-dashed border-line p-3">
        <label htmlFor="new-daily" className="mb-2 block text-xs font-medium tracking-wide text-muted uppercase">
          Add an item
        </label>
        <div className="flex gap-2">
          <input
            id="new-daily"
            autoFocus={items.length === 0}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Workout, Read 10 pages, Journal"
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 placeholder:text-muted focus:outline-2 focus:outline-accent"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-text disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <DayPicker days={newDays} onChange={setNewDays} />
          <span className="text-xs text-muted">{describeDays(newDays)}</span>
        </div>
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

/** Seven little S M T W T F S toggles. At least one day always stays on. */
function DayPicker({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) {
  return (
    <div role="group" aria-label="Days" className="flex gap-1">
      {WEEKDAYS.map((d) => {
        const on = days.includes(d.value)
        return (
          <button
            key={d.value}
            type="button"
            aria-pressed={on}
            aria-label={d.long}
            onClick={() => {
              const next = on ? days.filter((x) => x !== d.value) : [...days, d.value].sort((a, b) => a - b)
              if (next.length > 0) onChange(next)
            }}
            className={`size-7 rounded-full text-xs font-medium transition-colors ${
              on ? 'bg-accent text-accent-text' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {d.short}
          </button>
        )
      })}
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
