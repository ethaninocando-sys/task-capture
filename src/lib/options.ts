// Fixed choices in the add-task form. Areas are per person and live in the database (see Area).

export type Priority = 'A' | 'B' | 'C' | 'D' | 'W'
export type Kind = 'quick' | 'message' | 'call' | 'deep'

export interface Option<T extends string> {
  value: T
  label: string
}

export const PRIORITIES: (Option<Priority> & { hint: string; dot: string })[] = [
  { value: 'A', label: 'ASAP', hint: 'A', dot: 'bg-red-500' },
  { value: 'B', label: 'This week', hint: 'B', dot: 'bg-amber-500' },
  { value: 'C', label: 'Someday maybe', hint: 'C', dot: 'bg-stone-400' },
  { value: 'D', label: 'Delegate', hint: 'D', dot: 'bg-violet-500' },
  { value: 'W', label: 'Waiting for', hint: 'W', dot: 'bg-sky-500' },
]

/** One of your areas (each person has their own list, stored in the database). */
export interface Area {
  id: string
  name: string
  position: number
}

export const KINDS: Option<Kind>[] = [
  { value: 'quick', label: 'Quick' },
  { value: 'message', label: 'Message' },
  { value: 'call', label: 'Call' },
  { value: 'deep', label: 'Deep work' },
]

export interface Task {
  id: string
  title: string
  priority: Priority
  /** Old text value, kept only for older app versions. Use area_id. */
  area: string | null
  area_id: string | null
  kind: Kind
  deadline: string | null
  /** Optional extra details. Null when there's no note. */
  notes: string | null
  done: boolean
  done_at: string | null
  created_at: string
}

export function labelFor<T extends string>(list: Option<T>[], value: string): string {
  return list.find((o) => o.value === value)?.label ?? value
}
