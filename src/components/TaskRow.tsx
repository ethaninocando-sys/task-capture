import { describeDeadline } from '../lib/dates'
import { AREAS, KINDS, labelFor } from '../lib/options'
import type { Task } from '../lib/options'

interface Props {
  task: Task
  onToggle: (task: Task) => void
  onDelete: (task: Task) => void
}

const toneClass = {
  overdue: 'text-danger font-medium',
  today: 'text-warn font-medium',
  soon: 'text-text',
  later: 'text-muted',
} as const

export function TaskRow({ task, onToggle, onDelete }: Props) {
  const due = task.deadline ? describeDeadline(task.deadline) : null

  return (
    <li className="group flex items-start gap-3 px-4 py-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        onClick={() => onToggle(task)}
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          task.done ? 'border-accent bg-accent text-accent-text' : 'border-muted/60 hover:border-text'
        }`}
      >
        {task.done && (
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
            <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-[15px] leading-snug break-words whitespace-pre-wrap ${task.done ? 'text-muted line-through' : ''}`}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span>{labelFor(AREAS, task.area)}</span>
          <span aria-hidden>·</span>
          <span>{labelFor(KINDS, task.kind)}</span>
          {due && !task.done && (
            <>
              <span aria-hidden>·</span>
              <span className={toneClass[due.tone]}>{due.label}</span>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDelete(task)}
        aria-label={`Delete "${task.title}"`}
        className="shrink-0 rounded-md p-1 text-muted opacity-60 hover:bg-surface-2 hover:text-danger hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  )
}
