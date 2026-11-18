// Deadlines are stored as plain dates ("2026-11-20"), always read in your local time.

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysFromToday(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export type DeadlineTone = 'overdue' | 'today' | 'soon' | 'later'

export function describeDeadline(iso: string): { label: string; tone: DeadlineTone } {
  const date = parseISODate(iso)
  const today = parseISODate(toISODate(new Date()))
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000)

  const sameYear = date.getFullYear() === today.getFullYear()
  const short = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })

  if (diff < 0) return { label: `Overdue · ${short}`, tone: 'overdue' }
  if (diff === 0) return { label: 'Today', tone: 'today' }
  if (diff === 1) return { label: 'Tomorrow', tone: 'soon' }
  if (diff < 7) return { label: date.toLocaleDateString(undefined, { weekday: 'long' }), tone: 'soon' }
  return { label: short, tone: 'later' }
}
