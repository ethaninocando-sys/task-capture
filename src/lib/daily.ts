import { toISODate } from './dates'

export interface DailyItem {
  id: string
  title: string
  /** Weekdays this item shows on. 0 = Sunday ... 6 = Saturday. */
  days: number[]
  position: number
  created_at: string
}

export interface DailyCheck {
  item_id: string
  day: string
}

/** Shown in the editor, Sunday first to match how JavaScript numbers days. */
export const WEEKDAYS = [
  { value: 0, short: 'S', long: 'Sunday' },
  { value: 1, short: 'M', long: 'Monday' },
  { value: 2, short: 'T', long: 'Tuesday' },
  { value: 3, short: 'W', long: 'Wednesday' },
  { value: 4, short: 'T', long: 'Thursday' },
  { value: 5, short: 'F', long: 'Friday' },
  { value: 6, short: 'S', long: 'Saturday' },
]

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

/** How far back we load checks. Streaks longer than this show as this number. */
export const HISTORY_DAYS = 180

export function isScheduledOn(item: DailyItem, date: Date): boolean {
  return item.days.includes(date.getDay())
}

/** Short description like "Every day", "Weekdays", or "Mon, Wed, Fri". */
export function describeDays(days: number[]): string {
  const set = new Set(days)
  if (set.size === 7) return 'Every day'
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays'
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends'
  return WEEKDAYS.filter((d) => set.has(d.value))
    .map((d) => d.long.slice(0, 3))
    .join(', ')
}

/**
 * Days in a row this item was done, counting only the days it's scheduled.
 * Today doesn't break the streak if it isn't checked yet. You still have time.
 */
export function streakFor(item: DailyItem, checkedDays: Set<string>, today: Date): number {
  const created = toISODate(new Date(item.created_at))
  const cursor = new Date(today)
  let streak = 0

  for (let i = 0; i < HISTORY_DAYS; i++) {
    const iso = toISODate(cursor)
    if (iso < created) break
    if (isScheduledOn(item, cursor)) {
      if (checkedDays.has(iso)) streak++
      else if (i > 0) break
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
