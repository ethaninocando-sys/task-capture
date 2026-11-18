import { useCallback, useEffect, useMemo, useState } from 'react'
import { daysFromToday, toISODate } from '../lib/dates'
import { HISTORY_DAYS, isScheduledOn, streakFor } from '../lib/daily'
import type { DailyCheck, DailyItem } from '../lib/daily'
import { supabase } from '../lib/supabase'
import { DailyEditor } from './DailyEditor'
import { Modal } from './Modal'

/** Today's date as "YYYY-MM-DD". Updates on its own after midnight. */
function useTodayISO(): string {
  const [today, setToday] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const check = () => setToday(toISODate(new Date()))
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}

/** Supabase returns at most 1000 rows per request, so load checks in pages. */
async function loadChecks(since: string): Promise<{ data: DailyCheck[]; error: Error | null }> {
  const pageSize = 1000
  const all: DailyCheck[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('daily_checks')
      .select('item_id, day')
      .gte('day', since)
      .order('day', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) return { data: all, error }
    all.push(...(data as DailyCheck[]))
    if (data.length < pageSize) return { data: all, error: null }
  }
}

export function DailyChecklist() {
  const [items, setItems] = useState<DailyItem[]>([])
  const [checks, setChecks] = useState<DailyCheck[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notSetUp, setNotSetUp] = useState(false)
  const [editing, setEditing] = useState(false)
  const todayISO = useTodayISO()

  const load = useCallback(async () => {
    const [itemsRes, checksRes] = await Promise.all([
      supabase.from('daily_items').select('*').order('position').order('created_at'),
      loadChecks(daysFromToday(-HISTORY_DAYS)),
    ])
    const err = itemsRes.error ?? checksRes.error
    if (err) {
      const code = 'code' in err ? (err as { code?: string }).code : undefined
      // The tables don't exist yet: daily-checklist.sql hasn't been run.
      if (code === 'PGRST205' || code === '42P01') setNotSetUp(true)
      else setError(`Couldn't load your daily list: ${err.message}`)
    } else {
      setNotSetUp(false)
      setError(null)
      setItems(itemsRes.data as DailyItem[])
      setChecks(checksRes.data)
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel('daily-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_items' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_checks' }, () => void load())
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      void supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const checkedByItem = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const c of checks) {
      if (!map.has(c.item_id)) map.set(c.item_id, new Set())
      map.get(c.item_id)!.add(c.day)
    }
    return map
  }, [checks])

  const today = useMemo(() => {
    const [y, m, d] = todayISO.split('-').map(Number)
    return new Date(y, m - 1, d)
  }, [todayISO])

  const todays = items.filter((i) => isScheduledOn(i, today))
  const isDone = (item: DailyItem) => checkedByItem.get(item.id)?.has(todayISO) ?? false
  const doneCount = todays.filter(isDone).length

  async function toggle(item: DailyItem) {
    const wasDone = isDone(item)
    if (wasDone) {
      setChecks((cs) => cs.filter((c) => !(c.item_id === item.id && c.day === todayISO)))
      const { error } = await supabase.from('daily_checks').delete().eq('item_id', item.id).eq('day', todayISO)
      if (error) {
        setError(`Couldn't update: ${error.message}`)
        void load()
      }
    } else {
      setChecks((cs) => [...cs, { item_id: item.id, day: todayISO }])
      const { error } = await supabase
        .from('daily_checks')
        .upsert({ item_id: item.id, day: todayISO }, { onConflict: 'item_id,day', ignoreDuplicates: true })
      if (error) {
        setError(`Couldn't update: ${error.message}`)
        void load()
      }
    }
  }

  if (!loaded) return null

  if (notSetUp) {
    return (
      <p className="mb-6 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
        Daily checklist isn't switched on yet. Run <code>supabase/daily-checklist.sql</code> in the Supabase SQL Editor.
      </p>
    )
  }

  const weekday = today.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  const allDone = todays.length > 0 && doneCount === todays.length

  return (
    <section aria-labelledby="today-heading" className="mb-8">
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 id="today-heading" className="text-sm font-semibold">
          Today
        </h2>
        <span className="text-sm text-muted">{weekday}</span>
        {todays.length > 0 && (
          <span className="ml-auto text-xs text-muted tabular-nums">
            {doneCount} / {todays.length}
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`${todays.length > 0 ? '' : 'ml-auto'} rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-text`}
        >
          Edit list
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-2 rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-5 py-6 text-center">
          <p className="font-medium">Set up your daily checklist</p>
          <p className="mt-1 text-sm text-muted">Things you want to do every day. It resets each morning.</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-4 min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-text"
          >
            Add daily items
          </button>
        </div>
      ) : todays.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-4 text-sm text-muted">
          Nothing on your daily list today.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="h-1 bg-surface-2" aria-hidden>
            <div
              className="h-full bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${(doneCount / todays.length) * 100}%` }}
            />
          </div>
          <ul className="divide-y divide-line">
            {todays.map((item) => {
              const done = isDone(item)
              const streak = streakFor(item, checkedByItem.get(item.id) ?? new Set(), today)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    onClick={() => void toggle(item)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/50"
                  >
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                        done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted/60'
                      }`}
                      aria-hidden
                    >
                      {done && (
                        <svg viewBox="0 0 12 12" className="size-3">
                          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className={`min-w-0 flex-1 text-[15px] ${done ? 'text-muted line-through' : ''}`}>{item.title}</span>
                    {streak >= 2 && (
                      <span className="shrink-0 text-xs text-muted tabular-nums" title={`${streak} days in a row`}>
                        🔥 {streak}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          {allDone && <p className="border-t border-line px-4 py-2 text-xs text-emerald-600 dark:text-emerald-400">All done for today.</p>}
        </div>
      )}

      {editing && (
        <Modal label="Edit daily list" onClose={() => setEditing(false)}>
          <DailyEditor items={items} onChanged={load} onDone={() => setEditing(false)} />
        </Modal>
      )}
    </section>
  )
}
