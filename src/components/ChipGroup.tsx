import type { Option } from '../lib/options'

interface Props<T extends string> {
  label: string
  options: (Option<T> & { dot?: string; hint?: string })[]
  value: T | null
  onChange: (value: T) => void
  error?: boolean
}

/** A row of pill buttons where exactly one can be picked. */
export function ChipGroup<T extends string>({ label, options, value, onChange, error }: Props<T>) {
  return (
    <fieldset>
      <legend className={`mb-2 text-xs font-medium tracking-wide uppercase ${error ? 'text-danger' : 'text-muted'}`}>
        {label}
        {error && <span className="ml-2 normal-case tracking-normal">Pick one</span>}
      </legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const selected = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.value)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected
                  ? 'border-accent bg-accent text-accent-text'
                  : 'border-line bg-surface text-text hover:bg-surface-2'
              }`}
            >
              {o.dot && <span className={`size-2 rounded-full ${o.dot}`} aria-hidden />}
              {o.hint && <span className="font-semibold">{o.hint}</span>}
              <span>{o.label}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
