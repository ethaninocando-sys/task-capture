import { useCallback, useEffect, useMemo, useState } from 'react'
import { KINDS, PRIORITIES } from '../lib/options'
import type { Area, Task } from '../lib/options'
import { supabase } from '../lib/supabase'
import { AddTaskForm } from './AddTaskForm'
import { AreaEditor } from './AreaEditor'
import { CalendarLink } from './CalendarLink'
import { DailyChecklist } from './DailyChecklist'
import { Modal } from './Modal'
import { TaskRow } from './TaskRow'

const ALL = 'all'
const NO_AREA = 'none'

export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [editingAreas, setEditingAreas] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(() => new URLSearchParams(location.search).has('add'))
  const [areaFilter, setAreaFilter] = useState(ALL)
  const [kindFilter, setKindFilter] = useState(ALL)
  const [showDone, setShowDone] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)

  const load = useCallback(async () => {
    const [open, done, areaRows] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('done', false)
        .order('deadline', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
      supabase.from('tasks').select('*').eq('done', true).order('done_at', { ascending: false }).limit(50),
      supabase.from('areas').select('id, name, position').order('position').order('created_at'),
    ])
    const err = open.error ?? done.error ?? areaRows.error
    if (err) setError(`Couldn't load tasks: ${err.message}`)
    else {
      setError(null)
      setTasks([...(open.data as Task[]), ...(done.data as Task[])])
      setAreas(areaRows.data as Area[])
    }
    setLoading(false)
  }, [])

  // First load + live updates from your other devices.
  useEffect(() => {
    void load()
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'areas' }, () => void load())
      .subscribe()
    // Phones pause connections in the background, so refresh when you come back to the app.
    const onVisible = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      void supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  // Press "N" anywhere (when not typing) to add a task.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (adding || document.querySelector('[role=dialog]')) return
      if (target.closest('input, textarea, select, [contenteditable]')) return
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setAdding(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [adding])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  async function toggle(task: Task) {
    const done = !task.done
    const done_at = done ? new Date().toISOString() : null
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, done, done_at } : t)))
    const { error } = await supabase.from('tasks').update({ done, done_at }).eq('id', task.id)
    if (error) {
      setError(`Couldn't update: ${error.message}`)
      void load()
    }
  }

  async function remove(task: Task) {
    if (!confirm(`Delete "${task.title}"? This can't be undone.`)) return
    setTasks((ts) => ts.filter((t) => t.id !== task.id))
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) {
      setError(`Couldn't delete: ${error.message}`)
      void load()
    }
  }

  function closeAdd() {
    setAdding(false)
    if (location.search) history.replaceState(null, '', location.pathname)
  }

  const areaNames = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas])
  const nameOf = (t: Task) => (t.area_id ? (areaNames.get(t.area_id) ?? null) : null)
  const taskCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of tasks) if (t.area_id) counts.set(t.area_id, (counts.get(t.area_id) ?? 0) + 1)
    return counts
  }, [tasks])
  const hasNoAreaTasks = tasks.some((t) => !t.done && !(t.area_id && areaNames.has(t.area_id)))

  // If the area you were filtering by gets deleted, go back to showing all.
  const activeArea =
    areaFilter === ALL || (areaFilter === NO_AREA && hasNoAreaTasks) || areaNames.has(areaFilter) ? areaFilter : ALL

  const matches = useCallback(
    (t: Task) => {
      const hasArea = Boolean(t.area_id && areaNames.has(t.area_id))
      const areaOk = activeArea === ALL || (activeArea === NO_AREA ? !hasArea : t.area_id === activeArea)
      return areaOk && (kindFilter === ALL || t.kind === kindFilter)
    },
    [activeArea, kindFilter, areaNames],
  )

  const open = useMemo(() => tasks.filter((t) => !t.done && matches(t)), [tasks, matches])
  const done = useMemo(
    () =>
      tasks
        .filter((t) => t.done && matches(t))
        .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')),
    [tasks, matches],
  )
  const groups = PRIORITIES.map((p) => ({ ...p, tasks: open.filter((t) => t.priority === p.value) })).filter(
    (g) => g.tasks.length > 0,
  )
  const filtered = activeArea !== ALL || kindFilter !== ALL

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-28">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Task Capture</h1>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setShowCalendar(true)}
            aria-label="Add to Apple Calendar"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-text"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
              <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Calendar</span>
          </button>
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="min-h-10 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-text"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="hidden min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-text sm:inline-flex"
          >
            Add task
            <kbd className="rounded border border-accent-text/30 px-1 text-[11px] opacity-70">N</kbd>
          </button>
        </div>
      </header>

      <DailyChecklist />

      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-sm font-semibold">Tasks</h2>
        <span className="text-sm text-muted">
          {loading ? 'Loading…' : `${open.length} open${filtered ? ' (filtered)' : ''}`}
        </span>
      </div>
      <div className="mb-5 flex flex-col gap-2">
        <FilterRow
          label="Area"
          value={activeArea}
          onChange={setAreaFilter}
          options={[
            ...areas.map((a) => ({ value: a.id, label: a.name })),
            ...(hasNoAreaTasks ? [{ value: NO_AREA, label: 'No area' }] : []),
          ]}
          onEdit={() => setEditingAreas(true)}
        />
        <FilterRow label="Kind" value={kindFilter} onChange={setKindFilter} options={KINDS} />
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {!loading && !error && groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <p className="font-medium">{filtered ? 'Nothing matches these filters.' : 'All clear.'}</p>
          <p className="mt-1 text-sm text-muted">
            {filtered ? 'Try a different area or kind.' : 'Add something with the button or press N.'}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.value} aria-labelledby={`group-${g.value}`}>
            <h2 id={`group-${g.value}`} className="mb-2 flex items-center gap-2 px-1 text-sm font-medium">
              <span className={`size-2 rounded-full ${g.dot}`} aria-hidden />
              <span className="font-semibold">{g.value}</span>
              <span className="text-muted">{g.label}</span>
              <span className="ml-auto text-xs text-muted tabular-nums">{g.tasks.length}</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {g.tasks.map((t) => (
                <TaskRow key={t.id} task={t} areaName={nameOf(t)} onToggle={toggle} onDelete={remove} />
              ))}
            </ul>
          </section>
        ))}

        {done.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowDone((s) => !s)}
              aria-expanded={showDone}
              className="flex w-full items-center gap-2 px-1 py-1 text-sm text-muted hover:text-text"
            >
              <svg viewBox="0 0 12 12" className={`size-3 transition-transform ${showDone ? 'rotate-90' : ''}`} aria-hidden>
                <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Done <span className="tabular-nums">({done.length})</span>
            </button>
            {showDone && (
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} areaName={nameOf(t)} onToggle={toggle} onDelete={remove} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Big thumb-friendly add button on phones */}
      <button
        type="button"
        onClick={() => setAdding(true)}
        aria-label="Add task"
        className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex size-14 items-center justify-center rounded-full bg-accent text-accent-text shadow-lg sm:hidden"
      >
        <svg viewBox="0 0 16 16" className="size-6" aria-hidden>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {adding && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
          onMouseDown={(e) => e.target === e.currentTarget && closeAdd()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add a task"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-xl sm:rounded-2xl"
          >
            <AddTaskForm
              areas={areas}
              onEditAreas={() => setEditingAreas(true)}
              onCancel={closeAdd}
              onAdded={() => {
                closeAdd()
                setToast('Task added')
                void load()
              }}
            />
          </div>
        </div>
      )}

      {editingAreas && (
        <Modal label="Edit your areas" onClose={() => setEditingAreas(false)}>
          <AreaEditor areas={areas} taskCounts={taskCounts} onChanged={load} onDone={() => setEditingAreas(false)} />
        </Modal>
      )}

      {showCalendar && (
        <Modal label="Add to Apple Calendar" onClose={() => setShowCalendar(false)}>
          <CalendarLink onDone={() => setShowCalendar(false)} />
        </Modal>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-accent px-4 py-2 text-sm text-accent-text shadow-lg sm:bottom-8"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

function FilterRow({
  label,
  value,
  onChange,
  options,
  onEdit,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  onEdit?: () => void
}) {
  const all = [{ value: ALL, label: 'All' }, ...options]
  return (
    <div className="flex items-start gap-2">
      <span className="w-10 shrink-0 pt-2 text-xs leading-4 text-muted">{label}</span>
      <div className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
        {all.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`min-h-8 shrink-0 rounded-full px-3 text-xs whitespace-nowrap transition-colors ${
              value === o.value ? 'bg-accent text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-text'
            }`}
          >
            {o.label}
          </button>
        ))}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="min-h-8 shrink-0 rounded-full border border-dashed border-line px-3 text-xs whitespace-nowrap text-muted hover:bg-surface-2 hover:text-text"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  )
}
