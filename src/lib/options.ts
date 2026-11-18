// All the choices in the add-task form live here.
// To add or rename an area, edit the AREAS list. No database change needed.

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

export const AREAS: Option<string>[] = [
  { value: 'family', label: 'Family' },
  { value: 'relationship', label: 'Relationship' },
  { value: 'health', label: 'Health' },
  { value: 'events', label: 'Events' },
  { value: 'war-room', label: 'War Room' },
  { value: 'real-world', label: 'Real World' },
  { value: 'ei-conversion', label: 'EI-Conversion' },
  { value: 'finance', label: 'Finance' },
  { value: 'systems', label: 'Systems' },
]

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
  area: string
  kind: Kind
  deadline: string | null
  done: boolean
  done_at: string | null
  created_at: string
}

export function labelFor<T extends string>(list: Option<T>[], value: string): string {
  return list.find((o) => o.value === value)?.label ?? value
}
