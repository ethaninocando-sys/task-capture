// Calendar feed for Apple Calendar (or Google Calendar, Outlook...).
// URL: https://<project>.supabase.co/functions/v1/calendar?token=<secret token>
// Returns every open task that has a deadline as an all-day event.
// Deploy with --no-verify-jwt because calendar apps can't log in. The token is the password.

import { createClient } from 'npm:@supabase/supabase-js@2'

const PRIORITY_LABELS: Record<string, string> = {
  A: 'ASAP',
  B: 'This week',
  C: 'Someday maybe',
  D: 'Delegate',
  W: 'Waiting for',
}

const KIND_LABELS: Record<string, string> = {
  quick: 'Quick',
  message: 'Message',
  call: 'Call',
  deep: 'Deep work',
}

// Keep in sync with AREAS in src/lib/options.ts. Unknown areas get turned into Title Case.
const AREA_LABELS: Record<string, string> = {
  family: 'Family',
  relationship: 'Relationship',
  health: 'Health',
  events: 'Events',
  'war-room': 'War Room',
  'real-world': 'Real World',
  'ei-conversion': 'EI-Conversion',
  finance: 'Finance',
  systems: 'Systems',
}

const prettyArea = (area: string) =>
  AREA_LABELS[area] ??
  area
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

function secretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>
    if (parsed.default) return parsed.default
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Calendar text needs commas, semicolons, backslashes and new lines escaped. */
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Calendar lines must be at most 75 bytes; longer ones continue on the next line after a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const ch of line) {
    const chSize = new TextEncoder().encode(ch).length
    const limit = parts.length === 0 ? 75 : 74
    if (size + chSize > limit) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += ch
    size += chSize
  }
  parts.push(current)
  return parts.join('\r\n ')
}

const compactDate = (iso: string) => iso.replaceAll('-', '')

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

interface TaskRow {
  id: string
  title: string
  priority: string
  area: string
  kind: string
  deadline: string
  created_at: string
}

function buildCalendar(tasks: TaskRow[]): string {
  const now = stamp(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Task Capture//Tasks//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Task Capture',
    'X-WR-CALDESC:Tasks with deadlines from Task Capture',
    'X-PUBLISHED-TTL:PT15M',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
  ]

  for (const t of tasks) {
    const details = [PRIORITY_LABELS[t.priority] ?? t.priority, prettyArea(t.area), KIND_LABELS[t.kind] ?? t.kind]
    lines.push(
      'BEGIN:VEVENT',
      `UID:${t.id}@task-capture`,
      `DTSTAMP:${now}`,
      `CREATED:${stamp(new Date(t.created_at))}`,
      `DTSTART;VALUE=DATE:${compactDate(t.deadline)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(t.deadline))}`,
      `SUMMARY:${escapeText(`${t.priority} · ${t.title}`)}`,
      `DESCRIPTION:${escapeText(details.join(' · '))}`,
      `CATEGORIES:${escapeText(prettyArea(t.area))}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return new Response('Not found', { status: 404 })
  }

  const { data: feed, error: feedError } = await supabase
    .from('calendar_feeds')
    .select('user_id')
    .eq('token', token)
    .maybeSingle()

  if (feedError) {
    console.error('feed lookup failed', feedError)
    return new Response('Something went wrong', { status: 500 })
  }
  if (!feed) return new Response('Not found', { status: 404 })

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, title, priority, area, kind, deadline, created_at')
    .eq('user_id', feed.user_id)
    .eq('done', false)
    .not('deadline', 'is', null)
    .order('deadline')
    .limit(1000)

  if (tasksError) {
    console.error('task lookup failed', tasksError)
    return new Response('Something went wrong', { status: 500 })
  }

  return new Response(buildCalendar(tasks as TaskRow[]), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="task-capture.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
})
